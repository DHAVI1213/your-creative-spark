// Contadores de uso guardados só neste aparelho (localStorage).
export type UsoTipo = "legenda" | "proposta" | "limpeza" | "clone";

export type UsoEvento = { t: number; tipo: UsoTipo; n: number; nota?: string };

const KEY = "fabrica:uso:v1";
const MAX = 500;

export function lerUso(): UsoEvento[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as UsoEvento[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function registrarUso(tipo: UsoTipo, n = 1, nota?: string) {
  try {
    const arr = lerUso();
    const ev: UsoEvento = nota ? { t: Date.now(), tipo, n, nota } : { t: Date.now(), tipo, n };
    arr.push(ev);
    localStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX)));
  } catch {
    /* sem armazenamento: ignora */
  }
}

export function limparUso() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}

export const USO_ROTULO: Record<UsoTipo, string> = {
  legenda: "Legendas geradas",
  proposta: "Propostas criadas",
  limpeza: "Arquivos limpos",
  clone: "Sites clonados",
};
