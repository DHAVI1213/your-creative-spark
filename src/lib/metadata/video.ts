/**
 * Leitura e limpeza de metadados de vídeo com FFmpeg rodando no navegador (WebAssembly).
 * A limpeza copia o vídeo e o áudio sem recomprimir: mesma qualidade, só sem os metadados.
 */
import type { FFmpeg } from "@ffmpeg/ffmpeg";

import type { MetaEntry } from "./image";

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

let ffmpegPromise: Promise<FFmpeg> | null = null;

/** Carrega o FFmpeg uma única vez (~30 MB, fica no cache do navegador depois). */
export function loadFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })().catch((e) => {
      ffmpegPromise = null;
      throw e;
    });
  }
  return ffmpegPromise;
}

const IGNORED_KEYS = new Set([
  "major_brand",
  "minor_version",
  "compatible_brands",
  "handler_name",
  "vendor_id",
]);

const LABELS: Record<string, { label: string; sensitive?: boolean }> = {
  location: { label: "Localização GPS", sensitive: true },
  "location-eng": { label: "Localização GPS", sensitive: true },
  "com.apple.quicktime.location.ISO6709": { label: "Localização GPS", sensitive: true },
  "com.android.capture.fps": { label: "FPS da câmera" },
  "com.apple.quicktime.make": { label: "Fabricante", sensitive: true },
  "com.apple.quicktime.model": { label: "Aparelho", sensitive: true },
  "com.apple.quicktime.software": { label: "Software", sensitive: true },
  "com.apple.quicktime.creationdate": { label: "Data da gravação", sensitive: true },
  "com.android.manufacturer": { label: "Fabricante", sensitive: true },
  "com.android.model": { label: "Aparelho", sensitive: true },
  creation_time: { label: "Data da gravação", sensitive: true },
  encoder: { label: "Programa que gerou" },
  comment: { label: "Comentário" },
  title: { label: "Título" },
  artist: { label: "Autor", sensitive: true },
  copyright: { label: "Direitos autorais" },
};

function uniqueName(file: File) {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    input: `in_${crypto.randomUUID()}.${ext}`,
    output: `out_${crypto.randomUUID()}.${ext}`,
    ext,
  };
}

/** Executa o FFmpeg capturando o que ele escreve no log. */
async function runWithLogs(ffmpeg: FFmpeg, args: string[]) {
  const lines: string[] = [];
  const onLog = ({ message }: { message: string }) => lines.push(message);
  ffmpeg.on("log", onLog);
  try {
    await ffmpeg.exec(args);
  } finally {
    ffmpeg.off("log", onLog);
  }
  return lines;
}

function parseMetadata(lines: string[]): MetaEntry[] {
  const entries: MetaEntry[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const m = line.match(/^\s{4,}([A-Za-z0-9_.-]+)\s*:\s(.+)$/);
    if (!m) continue;
    const key = m[1] ?? "";
    const value = m[2] ?? "";
    if (IGNORED_KEYS.has(key)) continue;
    const known = LABELS[key];
    const label = known?.label ?? key;
    const dedupe = `${label}=${value}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    entries.push({ label, value: value.trim().slice(0, 80), sensitive: known?.sensitive ?? false });
  }
  // Mostra primeiro o que é mais sensível.
  return entries.sort((a, b) => Number(!!b.sensitive) - Number(!!a.sensitive));
}

export async function readVideoMeta(file: File): Promise<MetaEntry[]> {
  const ffmpeg = await loadFFmpeg();
  const { input } = uniqueName(file);
  const { fetchFile } = await import("@ffmpeg/util");
  await ffmpeg.writeFile(input, await fetchFile(file));
  try {
    // Sem arquivo de saída o FFmpeg só imprime as informações e encerra.
    const lines = await runWithLogs(ffmpeg, ["-hide_banner", "-i", input]);
    return parseMetadata(lines);
  } finally {
    await ffmpeg.deleteFile(input).catch(() => {});
  }
}

export type StreamInfo = { index: number; tipo: "video" | "audio" | "outro"; codec: string; capa: boolean };
export type ProbeInfo = { duracao: number; streams: StreamInfo[] };

/** Lê duração e faixas a partir do log do FFmpeg (no navegador não há ffprobe). */
export function parseProbe(lines: string[]): ProbeInfo {
  let duracao = 0;
  const streams: StreamInfo[] = [];
  for (const line of lines) {
    const d = line.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (d) duracao = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
    const s = line.match(/Stream #0:(\d+)[^:]*:\s*(Video|Audio|Data|Subtitle|Attachment):\s*([a-z0-9_]+)/i);
    if (s) {
      const t = (s[2] ?? "").toLowerCase();
      streams.push({
        index: Number(s[1]),
        tipo: t === "video" ? "video" : t === "audio" ? "audio" : "outro",
        codec: (s[3] ?? "").toLowerCase(),
        capa: /attached pic/i.test(line),
      });
    }
  }
  return { duracao, streams };
}

/** Monta o comando de limpeza igual ao limpar-metadados.js do desktop. */
export function cleanArgs(input: string, output: string, ext: string, probe: ProbeInfo, removerSei: boolean): string[] {
  const args = ["-hide_banner", "-loglevel", "error", "-i", input];
  const uteis = probe.streams.filter((s) => s.tipo !== "outro");
  // Vídeo (inclusive a capa embutida) e áudio. Faixas de dados (GPS do iPhone/Android) e legendas saem.
  for (const s of uteis) args.push("-map", `0:${s.index}`);
  args.push("-c", "copy", "-map_metadata", "-1", "-map_chapters", "-1", "-fflags", "+bitexact");
  uteis.forEach((s, o) => {
    args.push(`-metadata:s:${o}`, "encoder= ", `-metadata:s:${o}`, "handler_name= ", `-metadata:s:${o}`, "creation_time=");
    // Apaga as informações que o codificador grava dentro do vídeo (SEI).
    if (removerSei && s.tipo === "video" && !s.capa) {
      if (s.codec === "h264") args.push(`-bsf:${o}`, "filter_units=remove_types=6");
      else if (s.codec === "hevc") args.push(`-bsf:${o}`, "filter_units=remove_types=39|40");
    }
  });
  if (ext === "mp4" || ext === "mov" || ext === "m4v") args.push("-movflags", "+faststart");
  args.push(output);
  return args;
}

async function probe(ffmpeg: FFmpeg, nome: string): Promise<ProbeInfo> {
  return parseProbe(await runWithLogs(ffmpeg, ["-hide_banner", "-i", nome]));
}

export type CleanResult = { blob: Blob; removidos: number };

/**
 * Limpa sem refazer o vídeo (mesma qualidade e tamanho, capa embutida mantida) e confere
 * antes de entregar: o resultado precisa ter a mesma duração e as mesmas faixas.
 */
export async function cleanVideo(file: File, onProgress?: (ratio: number) => void): Promise<CleanResult> {
  const ffmpeg = await loadFFmpeg();
  const { input, output, ext } = uniqueName(file);
  const { fetchFile } = await import("@ffmpeg/util");
  await ffmpeg.writeFile(input, await fetchFile(file));

  const progress = ({ progress }: { progress: number }) =>
    onProgress?.(Math.max(0, Math.min(1, progress)));
  try {
    const logAntes = await runWithLogs(ffmpeg, ["-hide_banner", "-i", input]);
    const original = parseProbe(logAntes);
    const removidos = parseMetadata(logAntes).length;
    const uteis = original.streams.filter((s) => s.tipo !== "outro").length;
    if (!uteis) throw new Error("Não achei vídeo nem áudio nesse arquivo.");

    ffmpeg.on("progress", progress);
    let code = await ffmpeg.exec(cleanArgs(input, output, ext, original, true));
    // Se o filtro de SEI não existir nessa versão do FFmpeg, limpa o resto mesmo assim.
    if (code !== 0) code = await ffmpeg.exec(cleanArgs(input, output, ext, original, false));
    ffmpeg.off("progress", progress);
    if (code !== 0) throw new Error("O FFmpeg não conseguiu processar esse vídeo.");

    const limpo = await probe(ffmpeg, output);
    if (limpo.streams.length !== uteis || Math.abs(limpo.duracao - original.duracao) > 0.25) {
      throw new Error("O resultado não bateu com o original (nada foi alterado).");
    }
    const data = await ffmpeg.readFile(output);
    return { blob: new Blob([data as BlobPart], { type: file.type || "video/mp4" }), removidos };
  } finally {
    ffmpeg.off("progress", progress);
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}

/** Pasta de um arquivo escolhido por pasta ("" quando veio solto). */
export function pastaDe(caminho: string): string {
  const i = caminho.lastIndexOf("/");
  return i < 0 ? "" : caminho.slice(0, i);
}

/**
 * Nomes "vídeo 1", "vídeo 2"... com numeração separada por pasta, na ordem do Explorer
 * (ordem natural pt-BR). Recebe os caminhos relativos e devolve o novo caminho de cada um.
 */
export function nomesSequenciais(caminhos: string[]): Map<string, string> {
  const porPasta = new Map<string, string[]>();
  for (const c of caminhos) {
    const p = pastaDe(c);
    porPasta.set(p, [...(porPasta.get(p) ?? []), c]);
  }
  const base = (c: string) => c.slice(c.lastIndexOf("/") + 1);
  const ordem = (a: string, b: string) => base(a).localeCompare(base(b), "pt-BR", { numeric: true, sensitivity: "base" });
  const out = new Map<string, string>();
  for (const [pasta, lista] of porPasta) {
    [...lista].sort(ordem).forEach((c, i) => {
      const ext = (base(c).match(/\.[^.]+$/)?.[0] ?? ".mp4").toLowerCase();
      out.set(c, `${pasta ? pasta + "/" : ""}vídeo ${i + 1}${ext}`);
    });
  }
  return out;
}
