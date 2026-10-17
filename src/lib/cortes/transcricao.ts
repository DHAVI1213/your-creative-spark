/**
 * Transcrição com o tempo de cada palavra — porte do transcrever() do desktop.
 * O áudio sai do vídeo em partes de 10 minutos (FFmpeg no navegador, lendo o arquivo direto do disco,
 * sem copiar o vídeo inteiro para a memória) e cada parte vai para o motor escolhido:
 *  - Whisper no navegador (grátis, sem enviar nada; usa a placa de vídeo quando dá)
 *  - Groq ou OpenAI (muito mais rápido, com a chave do cliente)
 * Cada parte pronta fica guardada neste navegador: rodar de novo no mesmo vídeo continua de onde parou.
 */
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { Word } from "../editor/model";
import type { TranscricaoConfig } from "../ia/ia";

export const PARTE_SEG = 600;
export const MODELOS_NAVEGADOR: Record<string, string> = {
  "navegador-turbo": "onnx-community/whisper-large-v3-turbo_timestamped",
  "navegador-small": "onnx-community/whisper-small_timestamped",
};
export const NOMES_MOTOR: Record<TranscricaoConfig["motor"], string> = {
  "navegador-turbo": "No navegador · Melhor (Turbo, ~1 GB na 1ª vez)",
  "navegador-small": "No navegador · Rápida (Small, ~250 MB na 1ª vez)",
  groq: "Groq (grátis com chave, muito rápido)",
  openai: "OpenAI Whisper (pago, com chave)",
};

export type Info = { duracao: number; largura: number; altura: number; temAudio: boolean; temVideo: boolean };
export type Transcricao = { words: Word[]; energia: number[]; duracao: number };
export type Prog = (etapa: "preparar" | "audio" | "transcrever", pct: number, msg: string) => void;

export const mmss = (t: number) => {
  t = Math.max(0, Math.floor(t));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s).padStart(2, "0");
};

// ------------------------------------------------------------ vídeo montado direto do disco
export type Montado = { f: FFmpeg; caminho: string; soltar: () => Promise<void> };
/** Deixa o arquivo visível para o FFmpeg sem copiar para a memória (WORKERFS). */
export async function montar(file: File): Promise<Montado> {
  const { editorEngine } = await import("../editor/engine");
  const f = await editorEngine();
  const dir = "/in_" + crypto.randomUUID().slice(0, 8);
  await f.createDir(dir);
  await f.mount("WORKERFS" as never, { files: [file] }, dir);
  return {
    f,
    caminho: `${dir}/${file.name}`,
    soltar: async () => {
      await f.unmount(dir).catch(() => undefined);
      await f.deleteDir(dir).catch(() => undefined);
    },
  };
}

async function logs(f: FFmpeg, args: string[]) {
  const linhas: string[] = [];
  const ouvir = ({ message }: { message: string }) => linhas.push(message);
  f.on("log", ouvir);
  try {
    const code = await f.exec(args);
    return { code, linhas };
  } finally {
    f.off("log", ouvir);
  }
}

export function lerInfo(linhas: string[]): Info {
  let duracao = 0;
  let largura = 0;
  let altura = 0;
  let temAudio = false;
  let temVideo = false;
  for (const l of linhas) {
    const d = l.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (d) duracao = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
    if (/Stream #\d+:\d+.*Audio:/.test(l)) temAudio = true;
    if (/Stream #\d+:\d+.*Video:/.test(l) && !/attached pic/.test(l) && !temVideo) {
      temVideo = true;
      const m = l.match(/,\s*(\d{2,5})x(\d{2,5})/);
      if (m) {
        largura = Number(m[1]);
        altura = Number(m[2]);
      }
    }
  }
  return { duracao, largura, altura, temAudio, temVideo };
}

export async function sondar(m: Montado): Promise<Info> {
  return lerInfo((await logs(m.f, ["-hide_banner", "-i", m.caminho])).linhas);
}

// ------------------------------------------------------------ WAV
/** Volume (dB) por segundo de um WAV 16 kHz mono: ajuda a achar momentos de mais energia. */
export function energiaWav(buf: Uint8Array): number[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const ini = dataOffset(buf);
  const out: number[] = [];
  for (let p = ini; p + 32000 <= buf.length; p += 32000) {
    let soma = 0;
    for (let i = p; i < p + 32000; i += 8) {
      const x = dv.getInt16(i, true) / 32768;
      soma += x * x;
    }
    out.push(Math.round(10 * Math.log10(soma / 4000 + 1e-9) * 10) / 10);
  }
  return out;
}
function dataOffset(buf: Uint8Array) {
  for (let i = 12; i + 8 <= Math.min(buf.length, 4096); i++) {
    if (buf[i] === 0x64 && buf[i + 1] === 0x61 && buf[i + 2] === 0x74 && buf[i + 3] === 0x61) return i + 8;
  }
  return 44;
}
export function wavParaFloat(buf: Uint8Array): Float32Array {
  const ini = dataOffset(buf);
  const n = Math.floor((buf.length - ini) / 2);
  const dv = new DataView(buf.buffer, buf.byteOffset + ini, n * 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = dv.getInt16(i * 2, true) / 32768;
  return out;
}

// ------------------------------------------------------------ palavras
/** Arruma ordem e fim de cada palavra (mesma regra do desktop) e soma o deslocamento da parte. */
export function arrumarPalavras(brutas: { w: string; s: number; e?: number }[], offset: number): Word[] {
  const words: { w: string; s: number; t1?: number }[] = [];
  for (const b of brutas) {
    const w = String(b.w || "").replace(/�/g, "").trim();
    if (!w || /^[\s.,!?…-]+$/.test(w)) {
      if (w && words.length) words[words.length - 1]!.w += w.trim();
      continue;
    }
    words.push({ w, s: Number(b.s) || 0, t1: b.e });
  }
  for (let i = 1; i < words.length; i++) {
    if (words[i]!.s < words[i - 1]!.s + 0.02) words[i]!.s = words[i - 1]!.s + 0.02;
  }
  return words.map((w, i) => {
    const nx = words[i + 1];
    const est = Math.min(1.2, 0.14 + 0.065 * w.w.length);
    let e = w.t1 && w.t1 > w.s ? Math.min(w.t1, w.s + 2) : w.s + est;
    if (nx && (nx.s < e || nx.s - e < 0.3)) e = nx.s;
    e = Math.max(w.s + 0.06, e);
    return { w: w.w, s: Math.round((w.s + offset) * 1000) / 1000, e: Math.round((e + offset) * 1000) / 1000 };
  });
}

/** Tira a alucinação típica do Whisper: a mesma frase repetida 3 vezes ou mais em sequência. */
export function semRepeticao(words: Word[]): Word[] {
  const out: Word[] = [];
  const janela = (arr: Word[], a: number, n: number) => arr.slice(a, a + n).map((w) => w.w.toLowerCase()).join(" ");
  for (let i = 0; i < words.length; i++) {
    let pulou = false;
    for (let n = 3; n <= 12 && !pulou; n++) {
      if (out.length >= 2 * n && i + n <= words.length) {
        const atual = janela(words, i, n);
        if (atual === janela(out, out.length - n, n) && atual === janela(out, out.length - 2 * n, n)) {
          i += n - 1;
          pulou = true;
        }
      }
    }
    if (!pulou) out.push(words[i]!);
  }
  return out;
}

// ------------------------------------------------------------ motores
let worker: Worker | null = null;
let seq = 0;
function whisperNavegador(audio: Float32Array, modelo: string, idioma: string, aoBaixar: (p: number) => void, sinal: AbortSignal) {
  if (!worker) worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  const w = worker;
  const id = ++seq;
  return new Promise<{ w: string; s: number; e?: number }[]>((resolve, reject) => {
    const parar = () => {
      w.terminate();
      worker = null;
      reject(new Error("Cancelado"));
    };
    sinal.addEventListener("abort", parar, { once: true });
    w.onmessage = (e: MessageEvent<{ id: number; tipo: string; p?: number; msg?: string; chunks?: { text: string; timestamp: [number, number | null] }[] }>) => {
      if (e.data.id !== id) return;
      if (e.data.tipo === "baixando") aoBaixar(e.data.p || 0);
      else if (e.data.tipo === "ok") {
        sinal.removeEventListener("abort", parar);
        resolve((e.data.chunks || []).map((c) => ({ w: c.text, s: c.timestamp[0], e: c.timestamp[1] ?? undefined })));
      } else if (e.data.tipo === "erro") {
        sinal.removeEventListener("abort", parar);
        reject(new Error("O Whisper do navegador falhou: " + e.data.msg));
      }
    };
    w.onerror = (ev) => {
      sinal.removeEventListener("abort", parar);
      reject(new Error("O Whisper do navegador falhou: " + ev.message));
    };
    w.postMessage({ id, modelo, audio, idioma }, [audio.buffer]);
  });
}

async function whisperApi(wav: Uint8Array, cfg: TranscricaoConfig, sinal: AbortSignal) {
  if (!cfg.chave) throw new Error(`Cole a chave da ${cfg.motor === "groq" ? "Groq (console.groq.com → API Keys)" : "OpenAI"} em Transcrição.`);
  const groq = cfg.motor === "groq";
  const fd = new FormData();
  fd.append("file", new Blob([wav as BlobPart], { type: "audio/wav" }), "parte.wav");
  fd.append("model", groq ? "whisper-large-v3-turbo" : "whisper-1");
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  fd.append("timestamp_granularities[]", "segment");
  if (cfg.idioma && cfg.idioma !== "auto") fd.append("language", cfg.idioma);
  for (let tentativa = 0; ; tentativa++) {
    const r = await fetch(groq ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: "Bearer " + cfg.chave },
      body: fd,
      signal: sinal,
    });
    const j = (await r.json().catch(() => ({}))) as { words?: { word: string; start: number; end: number }[]; error?: { message?: string } };
    // limite por minuto da conta grátis: espera e tenta de novo
    if (r.status === 429 && tentativa < 6) {
      await new Promise((ok) => setTimeout(ok, 20000));
      continue;
    }
    if (!r.ok) throw new Error(j.error?.message || `A transcrição respondeu ${r.status}`);
    return (j.words || []).map((w) => ({ w: w.word, s: w.start, e: w.end }));
  }
}

// ------------------------------------------------------------ cache (IndexedDB)
function banco(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const r = indexedDB.open("nk-transcricoes", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("partes");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch {
      ok(null);
    }
  });
}
async function cacheLer(k: string): Promise<{ words: Word[]; energia: number[] } | null> {
  const db = await banco();
  if (!db) return null;
  return new Promise((ok) => {
    try {
      const r = db.transaction("partes").objectStore("partes").get(k);
      r.onsuccess = () => ok(r.result || null);
      r.onerror = () => ok(null);
    } catch {
      ok(null);
    }
  });
}
async function cacheGravar(k: string, v: { words: Word[]; energia: number[] }) {
  const db = await banco();
  if (!db) return;
  try {
    db.transaction("partes", "readwrite").objectStore("partes").put(v, k);
  } catch {
    /* sem espaço: segue sem cache */
  }
}
export const assinaturaArquivo = (file: File, cfg: TranscricaoConfig) => [file.name, file.size, file.lastModified, cfg.motor, cfg.idioma].join("|");

/** Diz se esse vídeo já foi transcrito inteiro antes com o mesmo motor e idioma. */
export async function jaTranscrito(file: File, cfg: TranscricaoConfig, duracao: number) {
  const n = Math.max(1, Math.ceil(duracao / PARTE_SEG));
  return !!(await cacheLer(assinaturaArquivo(file, cfg) + "|" + (n - 1)));
}

// ------------------------------------------------------------ transcrever
export async function transcrever(
  file: File,
  m: Montado,
  info: Info,
  cfg: TranscricaoConfig,
  prog: Prog,
  sinal: AbortSignal,
  aoParte?: (words: Word[], ateSeg: number) => void,
): Promise<Transcricao> {
  if (!info.temAudio) throw new Error("Esse vídeo não tem áudio para transcrever.");
  const partes = Math.max(1, Math.ceil(info.duracao / PARTE_SEG));
  const base = assinaturaArquivo(file, cfg);
  const words: Word[] = [];
  const energia: number[] = [];
  const t0 = Date.now();
  let feitoSeg = 0;
  prog("preparar", 1, "Pronto para transcrever");
  for (let i = 0; i < partes; i++) {
    if (sinal.aborted) throw new Error("Cancelado");
    const ini = i * PARTE_SEG;
    const dur = Math.min(PARTE_SEG, info.duracao - ini);
    const k = base + "|" + i;
    let parte = await cacheLer(k);
    if (!parte) {
      const msg = (p: number) => {
        const feito = feitoSeg + p * dur;
        const decorrido = (Date.now() - t0) / 1000;
        let eta = "";
        if (feito > 30 && decorrido > 5) {
          const resta = ((info.duracao - feito) * decorrido) / feito;
          eta = ` · falta ~${resta > 90 ? Math.round(resta / 60) + " min" : Math.round(resta) + " s"}`;
        }
        prog("transcrever", feito / info.duracao, `Transcrevendo parte ${i + 1} de ${partes} (${mmss(ini)} de ${mmss(info.duracao)})${eta}`);
      };
      prog("audio", i / partes, `Tirando o áudio da parte ${i + 1} de ${partes}…`);
      const nome = `audio_${crypto.randomUUID().slice(0, 8)}.wav`;
      const r = await logs(m.f, ["-y", "-hide_banner", "-ss", String(ini), "-t", String(dur), "-i", m.caminho, "-vn", "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", nome]);
      if (r.code !== 0) throw new Error("Falha ao extrair o áudio: " + r.linhas.slice(-2).join(" "));
      const wav = (await m.f.readFile(nome)) as Uint8Array;
      await m.f.deleteFile(nome).catch(() => undefined);
      msg(0);
      const brutas =
        cfg.motor === "groq" || cfg.motor === "openai"
          ? await whisperApi(wav, cfg, sinal)
          : await whisperNavegador(wavParaFloat(wav), MODELOS_NAVEGADOR[cfg.motor]!, cfg.idioma, (p) => prog("preparar", p, `Baixando o modelo de transcrição (só na primeira vez) · ${Math.round(p * 100)}%`), sinal);
      parte = { words: semRepeticao(arrumarPalavras(brutas, 0)), energia: energiaWav(wav) };
      await cacheGravar(k, parte);
    }
    for (const w of parte.words) words.push({ w: w.w, s: Math.round((w.s + ini) * 1000) / 1000, e: Math.round((w.e + ini) * 1000) / 1000 });
    for (const v of parte.energia) energia.push(v);
    feitoSeg += dur;
    aoParte?.(words.slice(), ini + dur);
    prog("transcrever", feitoSeg / info.duracao, `Transcrito ${mmss(feitoSeg)} de ${mmss(info.duracao)}`);
  }
  prog("transcrever", 1, `Transcrição pronta · ${words.length} palavras`);
  return { words, energia, duracao: info.duracao };
}

/** Legenda automática de um vídeo curto da mesa. */
export async function transcreverArquivo(file: File, cfg: TranscricaoConfig, prog: Prog, sinal: AbortSignal): Promise<Word[]> {
  const m = await montar(file);
  try {
    const info = await sondar(m);
    return (await transcrever(file, m, info, cfg, prog, sinal)).words;
  } finally {
    await m.soltar();
  }
}
