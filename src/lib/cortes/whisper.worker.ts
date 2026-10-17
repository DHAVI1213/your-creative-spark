/// <reference lib="webworker" />
/**
 * Whisper rodando no navegador (transformers.js). Fica num Worker para a tela não travar.
 * Usa a placa de vídeo (WebGPU) quando o navegador deixa; senão usa o processador.
 */
import { pipeline } from "@huggingface/transformers";

type Pedido = { id: number; modelo: string; audio: Float32Array; idioma: string };
type Chunk = { text: string; timestamp: [number, number | null] };
type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string; chunks?: Chunk[] }>;

const IDIOMAS: Record<string, string> = { pt: "portuguese", en: "english", es: "spanish" };
let asr: Asr | null = null;
let atual = "";
let placa = false;

async function carregar(modelo: string, id: number) {
  if (asr && atual === modelo) return asr;
  const nav = self.navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } };
  const gpu = !!(await nav.gpu?.requestAdapter().catch(() => null));
  const progresso = (p: { status?: string; progress?: number; file?: string }) => {
    if (p.status === "progress") (self as unknown as Worker).postMessage({ id, tipo: "baixando", p: (p.progress || 0) / 100, arquivo: p.file });
  };
  const tentativas: Record<string, unknown>[] = gpu
    ? [{ device: "webgpu", dtype: { encoder_model: "fp16", decoder_model_merged: "q4" } }, { device: "webgpu" }, { device: "wasm", dtype: "q8" }]
    : [{ device: "wasm", dtype: "q8" }, { device: "wasm" }];
  let ultimoErro: unknown;
  for (const opts of tentativas) {
    try {
      asr = (await pipeline("automatic-speech-recognition", modelo, { ...opts, progress_callback: progresso } as never)) as unknown as Asr;
      atual = modelo;
      placa = opts.device === "webgpu";
      return asr;
    } catch (err) {
      ultimoErro = err;
      console.warn("Whisper: tentativa falhou", opts, err);
    }
  }
  throw ultimoErro;
}

self.onmessage = async (e: MessageEvent<Pedido>) => {
  const { id, modelo, audio, idioma } = e.data;
  const responder = (m: Record<string, unknown>) => (self as unknown as Worker).postMessage({ id, ...m });
  try {
    const t = await carregar(modelo, id);
    responder({ tipo: "rodando", placa });
    const out = await t(audio, {
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
      task: "transcribe",
      ...(IDIOMAS[idioma] ? { language: IDIOMAS[idioma] } : {}),
    });
    responder({ tipo: "ok", chunks: out.chunks || [] });
  } catch (err) {
    responder({ tipo: "erro", msg: err instanceof Error ? err.message : String(err) });
  }
};
