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

export async function cleanVideo(file: File, onProgress?: (ratio: number) => void): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  const { input, output, ext } = uniqueName(file);
  const { fetchFile } = await import("@ffmpeg/util");
  await ffmpeg.writeFile(input, await fetchFile(file));

  const progress = ({ progress }: { progress: number }) =>
    onProgress?.(Math.max(0, Math.min(1, progress)));
  ffmpeg.on("progress", progress);
  try {
    const code = await ffmpeg.exec([
      "-hide_banner",
      "-i",
      input,
      // Só vídeo e áudio: descarta faixas de dados (onde iPhone e Android guardam GPS).
      "-map",
      "0:v?",
      "-map",
      "0:a?",
      "-map_metadata",
      "-1",
      "-map_chapters",
      "-1",
      "-c",
      "copy",
      "-fflags",
      "+bitexact",
      "-flags:v",
      "+bitexact",
      "-flags:a",
      "+bitexact",
      ...(ext === "mp4" || ext === "mov" || ext === "m4v" ? ["-movflags", "+faststart"] : []),
      output,
    ]);
    if (code !== 0) throw new Error("O FFmpeg não conseguiu processar esse vídeo.");
    const data = await ffmpeg.readFile(output);
    return new Blob([data as BlobPart], { type: file.type || "video/mp4" });
  } finally {
    ffmpeg.off("progress", progress);
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}
