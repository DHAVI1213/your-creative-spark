// Carrossel vivo: coreografia a 120 BPM, som sintetizado e exportação de vídeo.
// Regras (aula "Carrossel vivo"): tudo é função pura do tempo t, o quadro 0 é o design pronto,
// todo efeito volta ao repouso antes do fim, nenhum acerto nos últimos 0,8 s, loop sem emenda.
import { W, H, desenhar, listarSlides, type Carrossel, type Estilo } from "./carrossel";

export const BPM = 120;
export const BATIDA = 60 / BPM; // 0,5 s
export const FPS = 30;

export type Kind = "carimbo" | "queda" | "soco";
export type Evento = {
  id: string;
  at: number;
  kind: Kind;
  som: "impacto" | "clique" | "whoosh";
  txt: string;
};

export function duracao(chave: string): number {
  return chave === "capa" || chave === "cta" ? 8 : 6;
}

/** Coreografia: cada acerto cai numa batida (múltiplos de 0,5 s) e termina antes de dur-0,8 s. */
function eventosBase(chave: string, nItens: number): Evento[] {
  const e = (id: string, at: number, kind: Kind, som: Evento["som"], txt: string): Evento => ({
    id,
    at,
    kind,
    som,
    txt,
  });
  if (chave === "capa")
    return [
      e("palavra", 1, "queda", "impacto", "a palavra gigante pula e cai com peso"),
      e("topo", 2.5, "carimbo", "clique", "a linha de cima carimba"),
      e("sub", 3.5, "carimbo", "clique", "a linha de baixo carimba"),
      e("palavra", 5, "queda", "impacto", "a palavra cai de novo"),
    ];
  if (chave === "mapa") {
    const base = [e("tese", 1, "carimbo", "impacto", "a tese carimba")];
    for (let i = 0; i < Math.min(nItens, 8); i++)
      base.push(e(`i${i}`, 2 + i * 0.5, "soco", "clique", `o item ${i + 1} do mapa dá um soco`));
    return base;
  }
  if (chave.startsWith("item-"))
    return [
      e("num", 1, "queda", "impacto", "o número cai com peso"),
      e("nome", 2, "carimbo", "clique", "o nome carimba"),
      e("def", 3, "soco", "clique", "a definição dá um soco"),
      e("fecho", 4, "carimbo", "impacto", "a barra de veredito carimba"),
    ];
  if (chave === "virada")
    return [
      e("A", 1, "soco", "clique", "a primeira frase balança"),
      e("B", 2.5, "carimbo", "impacto", "a virada carimba"),
      e("U", 3.5, "queda", "impacto", "a última palavra cai e fecha"),
    ];
  return [
    e("comenta", 1, "soco", "clique", "“comenta” dá um soco"),
    e("palavra", 2, "queda", "impacto", "a palavra-chave cai com peso"),
    e("palavra", 4, "carimbo", "impacto", "a palavra-chave carimba"),
    e("entrega", 5.5, "soco", "clique", "o entregável dá um soco"),
  ];
}

/** Coreografia do slide; cada estilo pode somar acertos próprios (lacre, cartões...). */
export function eventos(chave: string, nItens = 0, estilo: Estilo = "editorial"): Evento[] {
  const base = eventosBase(chave, nItens);
  const e = (id: string, at: number, kind: Kind, som: Evento["som"], txt: string): Evento => ({
    id,
    at,
    kind,
    som,
    txt,
  });
  if (chave === "capa" && estilo === "classico")
    base.push(e("selo", 2, "carimbo", "impacto", "o lacre carimba"));
  if (chave === "capa" && estilo === "interface")
    base.push(
      e("card0", 1.5, "soco", "clique", "chega a 1ª mensagem"),
      e("card1", 2, "soco", "clique", "chega a 2ª mensagem"),
      e("card2", 3, "soco", "clique", "chega a 3ª mensagem"),
      e("badge", 4, "carimbo", "impacto", "o contador carimba"),
    );
  if (chave === "capa" && estilo === "premium")
    base.push(e("foto", 3, "carimbo", "impacto", "o produto pulsa na luz"));
  if (chave === "capa" && estilo === "fogo")
    base.push(e("foto", 2, "queda", "impacto", "o produto cai na brasa"));
  return base.sort((a, b) => a.at - b.at);
}

const sq = (x: number) => x * x;
const eoQuad = (x: number) => 1 - sq(1 - x);

type Tf = { dx: number; dy: number; sx: number; sy: number };
const REPOUSO: Tf = { dx: 0, dy: 0, sx: 1, sy: 1 };

function curva(kind: Kind, u: number): Tf {
  if (u <= 0 || u >= 1) return REPOUSO;
  if (kind === "carimbo") {
    // acelera e freia; mais largo = mais baixo (volume constante)
    const amp = Math.sin(Math.PI * u) * Math.exp(-2.5 * u);
    const s = 1 + 0.09 * amp * 2.2;
    return { dx: 0, dy: 0, sx: s, sy: 1 / s };
  }
  if (kind === "soco") {
    const amp = Math.sin(Math.PI * u) * Math.exp(-2 * u);
    return { dx: 0, dy: -26 * amp, sx: 1 + 0.03 * amp, sy: 1 / (1 + 0.03 * amp) };
  }
  // queda: sobe, cai esticando, achata no impacto e volta
  const Hh = 46;
  if (u < 0.35) return { dx: 0, dy: -Hh * eoQuad(u / 0.35), sx: 1, sy: 1 };
  if (u < 0.65) {
    const w = (u - 0.35) / 0.3;
    const st = 1 + 0.06 * sq(w);
    return { dx: 0, dy: -Hh * (1 - sq(w)), sx: 1 / st, sy: st };
  }
  const v = (u - 0.65) / 0.35;
  const sx = 1 + 0.16 * sq(1 - v);
  return { dx: 0, dy: 0, sx, sy: 1 / sx };
}

const DURACAO_CURVA: Record<Kind, number> = { carimbo: 0.55, soco: 0.5, queda: 0.8 };

/** Aplica ao contexto o movimento do elemento `id` no tempo t (âncora em ax, ay). Chame ctx.restore() depois. */
export function aplicar(
  ctx: CanvasRenderingContext2D,
  evs: Evento[],
  id: string,
  t: number,
  ax: number,
  ay: number,
) {
  ctx.save();
  let tf = REPOUSO;
  for (const ev of evs) {
    if (ev.id !== id) continue;
    const d = DURACAO_CURVA[ev.kind];
    if (t >= ev.at && t < ev.at + d) tf = curva(ev.kind, (t - ev.at) / d);
  }
  if (tf === REPOUSO) return;
  ctx.translate(ax + tf.dx, ay + tf.dy);
  ctx.scale(tf.sx, tf.sy);
  ctx.translate(-ax, -ay);
}

// ---------- storyboard ----------
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

export function storyboard(c: Carrossel): string {
  const linhas: string[] = [
    "# STORYBOARD",
    "",
    `Grade: ${BPM} BPM (1 batida = ${BATIDA} s). 1080x1350, ${FPS} fps. Um vídeo por slide, em loop, sem emenda.`,
    "Regras: suavidade (nada linear), peso (o que cai estica e achata, volume constante), ritmo (tudo na batida).",
    "",
  ];
  let n = 1;
  for (const s of listarSlides(c)) {
    const d = duracao(s.chave);
    linhas.push(`## ${n++}. ${s.rotulo} · ${d} s (${d / (BATIDA * 4)} compassos)`);
    linhas.push(`- 0:00.0 · quadro 0 = design pronto e legível (a capa do slide)`);
    for (const ev of eventos(s.chave, c.itens.length, c.estilo)) {
      linhas.push(
        `- ${fmt(ev.at)} · batida ${Math.round(ev.at / BATIDA) + 1} · ${ev.kind} · ${ev.txt} · som: ${ev.som}`,
      );
    }
    linhas.push(
      `- ${fmt(d - 0.8)} a ${fmt(d)} · tudo em repouso (o último quadro emenda no quadro 0)`,
      "",
    );
  }
  return linhas.join("\n");
}

// ---------- som ----------
const SR = 44100;

function ruido(sementeInicial: number) {
  let s = sementeInicial >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
}

/** Música + efeitos de um slide, num buffer de duração exata (loop circular). */
async function renderizar(
  dur: number,
  inicioGlobal: number,
  evs: Evento[],
  comMusica: boolean,
): Promise<Float32Array<ArrayBuffer>> {
  const cauda = 1;
  const off = new OfflineAudioContext(1, Math.ceil((dur + cauda) * SR), SR);
  const mestre = off.createGain();
  mestre.gain.value = 1;
  mestre.connect(off.destination);

  const nota = (freq: number, t: number, len: number, tipo: OscillatorType, ganho: number) => {
    const o = off.createOscillator();
    const g = off.createGain();
    o.type = tipo;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(ganho, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(mestre);
    o.start(t);
    o.stop(t + len + 0.02);
  };
  const buffRuido = (len: number, sem: number) => {
    const b = off.createBuffer(1, Math.ceil(len * SR), SR);
    const d = b.getChannelData(0);
    const r = ruido(sem);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2;
    return b;
  };

  // música editorial: baixo nas batidas, arpejo em colcheias, chimbau no contratempo.
  const baixo = [55, 55, 65.41, 49];
  const arpejo = [220, 261.63, 329.63, 392, 440, 329.63, 261.63, 329.63];
  const totalBatidas = Math.ceil((dur + cauda) / BATIDA);
  const g0 = Math.round(inicioGlobal / BATIDA);
  for (let b = 0; comMusica && b < totalBatidas; b++) {
    const g = g0 + b;
    const t = b * BATIDA;
    if (g % 2 === 0) nota(baixo[Math.floor(g / 4) % 4]!, t, 0.45, "triangle", 0.34);
    nota(arpejo[g % 8]!, t, 0.4, "triangle", 0.05);
    nota(arpejo[(g + 3) % 8]! * 2, t + BATIDA / 2, 0.25, "sine", 0.03);
    const h = off.createBufferSource();
    h.buffer = buffRuido(0.05, g * 977 + 13);
    const hf = off.createBiquadFilter();
    hf.type = "highpass";
    hf.frequency.value = 7000;
    const hg = off.createGain();
    hg.gain.value = 0.05;
    h.connect(hf).connect(hg).connect(mestre);
    h.start(t + BATIDA / 2);
  }

  // efeitos nos acertos da coreografia
  for (const ev of evs) {
    const queda = ev.kind === "queda";
    const t = ev.at + (queda ? 0.8 * 0.65 : 0.06); // a queda bate no chão em 65% da curva
    if (ev.som === "impacto") {
      const o = off.createOscillator();
      const g = off.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(mestre);
      o.start(t);
      o.stop(t + 0.4);
    } else {
      nota(1900, t, 0.04, "square", 0.12);
    }
    if (queda) {
      const w = off.createBufferSource();
      w.buffer = buffRuido(0.5, 4242);
      const f = off.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(500, ev.at);
      f.frequency.exponentialRampToValueAtTime(3500, t);
      const g = off.createGain();
      g.gain.setValueAtTime(0.0001, ev.at);
      g.gain.linearRampToValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      w.connect(f).connect(g).connect(mestre);
      w.start(ev.at);
    }
  }

  const rendido = await off.startRendering();
  const bruto = rendido.getChannelData(0);
  const n = Math.round(dur * SR);
  const saida = new Float32Array(n);
  saida.set(bruto.subarray(0, n));
  // loop circular: a cauda cai de volta no começo
  for (let i = 0; i < bruto.length - n && i < n; i++)
    saida[i] = (saida[i] ?? 0) + (bruto[n + i] ?? 0);
  return saida;
}

function normalizar(saida: Float32Array<ArrayBuffer>, ganhoFixo?: number): number {
  let soma = 0;
  let pico = 0;
  for (let i = 0; i < saida.length; i++) {
    const v = saida[i] ?? 0;
    soma += v * v;
    pico = Math.max(pico, Math.abs(v));
  }
  const rms = Math.sqrt(soma / saida.length) || 1;
  // ~ -14 LUFS pelo RMS, com teto de pico
  const ganho = ganhoFixo ?? Math.min(0.2 / rms, 0.92 / (pico || 1));
  for (let i = 0; i < saida.length; i++)
    saida[i] = Math.max(-1, Math.min(1, (saida[i] ?? 0) * ganho));
  return ganho;
}

function paraBuffer(saida: Float32Array<ArrayBuffer>): AudioBuffer {
  const buf = new AudioBuffer({ length: saida.length, sampleRate: SR, numberOfChannels: 1 });
  buf.copyToChannel(saida, 0);
  return buf;
}

/** Música + efeitos de um slide, num buffer de duração exata (loop circular). Usado no vídeo. */
export async function sintetizar(
  c: Carrossel,
  chave: string,
  inicioGlobal: number,
): Promise<AudioBuffer> {
  const saida = await renderizar(
    duracao(chave),
    inicioGlobal,
    eventos(chave, c.itens.length, c.estilo),
    true,
  );
  normalizar(saida);
  return paraBuffer(saida);
}

/** O padrão da música se repete a cada 4 compassos (8 s): dá pra tocar em loop sem fim. */
export const CICLO_MUSICA = 8;

/**
 * Para a prévia: a música separada (toca contínua, nunca reinicia ao passar o slide)
 * e os efeitos de cada slide separados (começam junto com a animação do slide).
 */
export async function sintetizarPartes(c: Carrossel) {
  const musica = await renderizar(CICLO_MUSICA, 0, [], true);
  const ganho = normalizar(musica);
  const efeitos: Record<string, AudioBuffer> = {};
  for (const s of listarSlides(c)) {
    const e = await renderizar(
      duracao(s.chave),
      0,
      eventos(s.chave, c.itens.length, c.estilo),
      false,
    );
    normalizar(e, ganho);
    efeitos[s.chave] = paraBuffer(e);
  }
  return { musica: paraBuffer(musica), efeitos };
}

/** Início (em segundos) de cada slide na música única, para as emendas fecharem. */
export function inicios(c: Carrossel): Record<string, number> {
  const out: Record<string, number> = {};
  let acc = 0;
  for (const s of listarSlides(c)) {
    out[s.chave] = acc;
    acc += duracao(s.chave);
  }
  return out;
}

// ---------- teste de loop ----------
export function testeLoop(c: Carrossel, chave: string): number {
  const a = document.createElement("canvas");
  const b = document.createElement("canvas");
  a.width = b.width = W;
  b.width = W;
  a.height = b.height = H;
  const ca = a.getContext("2d", { willReadFrequently: true })!;
  const cb = b.getContext("2d", { willReadFrequently: true })!;
  desenhar(ca, c, chave, 0);
  desenhar(cb, c, chave, duracao(chave));
  const da = ca.getImageData(0, 0, W, H).data;
  const db = cb.getImageData(0, 0, W, H).data;
  let diff = 0;
  for (let i = 0; i < da.length; i++) if (Math.abs((da[i] ?? 0) - (db[i] ?? 0)) > 6) diff++;
  return diff;
}

// ---------- exportação de vídeo (tempo real, com o som) ----------
export function tipoVideo(): { mime: string; ext: string } {
  const opts: [string, string][] = [
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [m, e] of opts)
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m))
      return { mime: m, ext: e };
  return { mime: "", ext: "webm" };
}

export async function gravarSlide(
  c: Carrossel,
  chave: string,
  inicioGlobal: number,
): Promise<{ blob: Blob; ext: string }> {
  const dur = duracao(chave);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  desenhar(ctx, c, chave, 0);
  const buf = await sintetizar(c, chave, inicioGlobal);
  const ac = new AudioContext({ sampleRate: SR });
  const dest = ac.createMediaStreamDestination();
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.connect(dest);
  const stream = cv.captureStream(FPS);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const { mime, ext } = tipoVideo();
  const rec = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 8_000_000,
    audioBitsPerSecond: 160_000,
  });
  const partes: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
  const fim = new Promise<void>((res) => (rec.onstop = () => res()));
  rec.start(250);
  src.start();
  const t0 = performance.now();
  await new Promise<void>((res) => {
    const passo = () => {
      const t = (performance.now() - t0) / 1000;
      if (t >= dur) return res();
      desenhar(ctx, c, chave, t);
      requestAnimationFrame(passo);
    };
    passo();
  });
  desenhar(ctx, c, chave, 0);
  await new Promise((r) => setTimeout(r, 120));
  rec.stop();
  await fim;
  src.stop();
  await ac.close();
  return { blob: new Blob(partes, { type: mime || "video/webm" }), ext };
}
