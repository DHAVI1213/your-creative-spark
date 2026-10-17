/**
 * Ponte NK: programinha que roda no PC do cliente (kit ponte-nk.zip) e baixa os vídeos escolhidos
 * na extensão Minerador Viral (TikTok e YouTube pelo yt-dlp). O site busca os vídeos prontos aqui.
 */
export const PONTE = "http://127.0.0.1:47811";
export const PONTE_KIT = "/downloads/ponte-nk.zip";
const CHAVE = "nk.ponte.codigo";

export type Recebido = { id: string; nome: string; destino: "mesa" | "cortes"; perfil: string; plataforma: string; quando: number; tamanho: number };

export function codigoSalvo() {
  try {
    return localStorage.getItem(CHAVE) || "";
  } catch {
    return "";
  }
}
export function salvarCodigo(c: string) {
  try {
    localStorage.setItem(CHAVE, c.trim().toUpperCase());
  } catch {
    /* sem armazenamento */
  }
}

async function pedir(path: string, codigo: string, init: RequestInit = {}) {
  let r: Response;
  try {
    r = await fetch(PONTE + path, { ...init, headers: { "X-NK-Codigo": codigo } });
  } catch {
    throw new Error("A Ponte NK não está aberta no seu PC (ou o navegador bloqueou o acesso à rede local: clique em Permitir).");
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { erro?: string };
    throw new Error(j.erro || `A ponte respondeu ${r.status}`);
  }
  return r;
}

export async function listarRecebidos(codigo: string): Promise<Recebido[]> {
  const j = (await (await pedir("/site/recebidos", codigo)).json()) as { itens?: Recebido[] };
  return (j.itens || []).sort((a, b) => b.quando - a.quando);
}
export async function baixarRecebido(codigo: string, r: Recebido): Promise<File> {
  const blob = await (await pedir(`/site/arquivo/${r.id}`, codigo)).blob();
  return new File([blob], r.nome, { type: blob.type || "video/mp4" });
}
export async function esquecerRecebido(codigo: string, r: Recebido) {
  await pedir(`/site/esquecer/${r.id}`, codigo, { method: "POST" });
}
