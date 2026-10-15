/**
 * Extrai o áudio de um vídeo e entrega em MP3, no próprio navegador (FFmpeg em WebAssembly).
 * Nada é enviado a servidor: o vídeo já está na máquina da pessoa.
 */
import { loadFFmpeg } from "@/lib/metadata/video";

/** Nome seguro de arquivo MP3 a partir do nome do vídeo. */
export function nomeMp3(nomeVideo: string): string {
  const base = nomeVideo.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[^\p{L}\p{N}_.-]/gu, "_");
  return `${base || "audio"}.mp3`;
}

/** Garante nomes únicos dentro de um ZIP (dois vídeos nunca sobrescrevem um ao outro). */
export function nomeUnico(nome: string, usados: Set<string>): string {
  if (!usados.has(nome)) {
    usados.add(nome);
    return nome;
  }
  const i = nome.lastIndexOf(".");
  const base = i > 0 ? nome.slice(0, i) : nome;
  const ext = i > 0 ? nome.slice(i) : "";
  let n = 2;
  while (usados.has(`${base}_${n}${ext}`)) n++;
  const final = `${base}_${n}${ext}`;
  usados.add(final);
  return final;
}

export class SemAudioError extends Error {
  constructor() {
    super("Este vídeo não tem faixa de áudio.");
  }
}

/** Converte o áudio do vídeo em MP3 (192 kbps, estéreo, 44,1 kHz). */
export async function extrairMp3(
  video: File,
  onProgresso?: (ratio: number) => void,
): Promise<{ blob: Blob; nome: string }> {
  const ffmpeg = await loadFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");
  const ext = (video.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = crypto.randomUUID();
  const entrada = `in_${id}.${ext}`;
  const saida = `out_${id}.mp3`;
  const linhas: string[] = [];
  const log = ({ message }: { message: string }) => linhas.push(message);
  const prog = ({ progress }: { progress: number }) =>
    onProgresso?.(Math.max(0, Math.min(1, progress)));
  await ffmpeg.writeFile(entrada, await fetchFile(video));
  ffmpeg.on("log", log);
  ffmpeg.on("progress", prog);
  try {
    const codigo = await ffmpeg.exec([
      "-hide_banner",
      "-i",
      entrada,
      "-vn", // sem imagem
      "-map",
      "0:a:0", // primeira faixa de áudio
      "-map_metadata",
      "-1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      "-ar",
      "44100",
      "-ac",
      "2",
      saida,
    ]);
    if (codigo !== 0) {
      const semAudio = linhas.some((l) =>
        /matches no streams|does not contain any stream/i.test(l),
      );
      if (semAudio) throw new SemAudioError();
      throw new Error("Não consegui extrair o áudio deste vídeo.");
    }
    const dados = await ffmpeg.readFile(saida);
    if (typeof dados === "string" || dados.length < 128) throw new SemAudioError();
    return {
      blob: new Blob([dados as BlobPart], { type: "audio/mpeg" }),
      nome: nomeMp3(video.name),
    };
  } finally {
    ffmpeg.off("log", log);
    ffmpeg.off("progress", prog);
    await ffmpeg.deleteFile(entrada).catch(() => {});
    await ffmpeg.deleteFile(saida).catch(() => {});
  }
}
