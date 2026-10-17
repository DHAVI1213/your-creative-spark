import type { CorteInfo, EmojiMark, Meta, Settings, Word } from "../editor/model";
import { even } from "../editor/shared.js";

export type FormatoCorte = "cheio" | "meio" | "perfil";
export type OpcoesMesa = { formato: FormatoCorte; legenda: boolean; emojis: boolean; titulo: boolean };
/** Um corte pronto que vai para a mesa do Editor. */
export type CorteMesa = { file: File; titulo: string; words: Word[]; emojis: EmojiMark[]; corte: CorteInfo };

/** Ajustes de cada corte na mesa conforme o formato escolhido (igual ao desktop). */
export function ajustarCorte(s: Settings, m: Meta, opts: OpcoesMesa, temPalavras: boolean): Settings {
  const out = structuredClone(s);
  out.legendaAnim.ativo = opts.legenda && temPalavras;
  out.legendaAnim.emojis = opts.emojis;
  if (opts.formato === "cheio") {
    const alvo = (m.height * 9) / 16;
    const lado = m.width > alvo + 4 ? even((m.width - alvo) / 2) : 0;
    out.recorte = { ...out.recorte, left: lado, right: lado, top: 0, bottom: 0, zoom: 1, posV: 0.5 };
    if (out.template.fundoTipo === "blur") out.template.fundoTipo = "cor";
  } else if (opts.formato === "meio") {
    out.recorte = { ...out.recorte, left: 0, right: 0, top: 0, bottom: 0, zoom: 1, posV: 0.5 };
    out.template.fundoTipo = "blur";
  }
  if (opts.titulo) {
    out.texto.pos = "topo";
    out.texto.v = opts.formato === "meio" ? 20 : 14;
  }
  return out;
}
