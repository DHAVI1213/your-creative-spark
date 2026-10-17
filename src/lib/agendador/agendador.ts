/**
 * Agendador — lado do navegador (porte do agendador.js do desktop).
 * Quem publica é o servidor grátis do próprio cliente na Cloudflare (kit agendador-nuvem.zip),
 * então o computador pode ficar desligado. O site só conversa com esse servidor pela chave do cliente.
 */
import { supabase } from "../../integrations/supabase/client";

export type Plataforma = "instagram" | "youtube" | "tiktok";
export type Nuvem = { url: string; apiKey: string };
export type Conta = {
  id: string;
  plataforma: Plataforma;
  nome: string;
  usuario: string | null;
  foto: string | null;
  acessoAte: number | null;
  erro: string | null;
  publicados24h: number;
};
export type Status = {
  ok: boolean;
  versao: number;
  maxContas: number;
  contas: Conta[];
  plataformas: { youtube: boolean; tiktok: boolean };
  redirect: { youtube: string; tiktok: string };
  publicados24h: number;
  contagem: Record<string, number>;
};
export type PostNuvem = {
  id: string;
  conta_id: string | null;
  plataforma: Plataforma | null;
  tipo: string;
  media_kind: "video" | "image";
  legenda: string | null;
  titulo: string | null;
  nome: string | null;
  quando: number;
  status: "agendado" | "processando" | "publicado" | "erro";
  permalink: string | null;
  erro: string | null;
  aviso: string | null;
};

export const KIT_URL = "/downloads/agendador-nuvem.zip";
export const REDE: Record<Plataforma, { nome: string; sigla: string; abrir: string; cor: string }> = {
  instagram: { nome: "Instagram", sigla: "IG", abrir: "Abrir no Instagram ↗", cor: "bg-pink-500/20 text-pink-300" },
  youtube: { nome: "YouTube", sigla: "YT", abrir: "Abrir no YouTube ↗", cor: "bg-red-500/20 text-red-300" },
  tiktok: { nome: "TikTok", sigla: "TT", abrir: "Abrir no TikTok ↗", cor: "bg-cyan-500/20 text-cyan-300" },
};
export const TIPO_NOME: Record<string, string> = { reels: "Reels", story: "Story", foto: "Foto", short: "Short", video: "Vídeo" };
export const contaNome = (c: Conta) => (c.plataforma === "instagram" ? "@" + c.nome : c.nome);

// ------------------------------------------------------------ endereço e chave da nuvem
const CHAVE_LOCAL = "nk.agendador.nuvem";
/** Lê a nuvem salva na conta (vale no PC e no celular); sem login, só neste navegador. */
export async function lerNuvem(): Promise<Nuvem | null> {
  const { data: s } = await supabase.auth.getSession();
  if (s.session) {
    const { data } = await supabase.from("agendador_nuvem" as never).select("url,api_key").maybeSingle();
    const linha = data as { url: string; api_key: string } | null;
    if (linha) return { url: linha.url, apiKey: linha.api_key };
  }
  try {
    const n = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || "null");
    return n?.url && n?.apiKey ? n : null;
  } catch {
    return null;
  }
}
export async function salvarNuvem(n: Nuvem) {
  const limpo = { url: n.url.trim().replace(/\/+$/, ""), apiKey: n.apiKey.trim() };
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(limpo));
  } catch {
    /* sem armazenamento */
  }
  const { data: s } = await supabase.auth.getSession();
  if (s.session) {
    await supabase.from("agendador_nuvem" as never).upsert({ user_id: s.session.user.id, url: limpo.url, api_key: limpo.apiKey, atualizado: new Date().toISOString() } as never);
  }
  return limpo;
}

export async function nuvemApi<T = Record<string, unknown>>(n: Nuvem, method: string, path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(n.url + path, {
      method,
      headers: { authorization: "Bearer " + n.apiKey, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("A nuvem não respondeu. Confira o endereço (e se o instalador terminou).");
  }
  const data = (await r.json().catch(() => ({}))) as T & { erro?: string };
  if (!r.ok) throw new Error(data.erro || `Erro ${r.status}`);
  return data;
}

/** Sobe o arquivo uma vez só para a nuvem (R2), com progresso. */
export function subir(n: Nuvem, arquivo: Blob, nome: string, aoProgresso: (p: number) => void): Promise<string> {
  const ext = (nome.match(/\.([a-z0-9]{2,5})$/i)?.[1] || (arquivo.type.startsWith("image/") ? "jpg" : "mp4")).toLowerCase();
  const key = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 12)}.${ext}`;
  return new Promise((ok, falha) => {
    const x = new XMLHttpRequest();
    x.open("PUT", `${n.url}/api/upload/${encodeURIComponent(key)}`);
    x.setRequestHeader("authorization", "Bearer " + n.apiKey);
    x.setRequestHeader("content-type", arquivo.type || (ext === "jpg" ? "image/jpeg" : "video/mp4"));
    x.upload.onprogress = (e) => e.lengthComputable && aoProgresso(e.loaded / e.total);
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) return ok(key);
      if (x.status === 413) return falha(new Error(`${nome}: arquivo grande demais para a nuvem grátis (~100 MB). Exporte em 1080p ou com bitrate menor.`));
      let msg = `Erro ${x.status}`;
      try {
        msg = JSON.parse(x.responseText).erro || msg;
      } catch {
        /* resposta sem JSON */
      }
      falha(new Error(`${nome}: ${msg}`));
    };
    x.onerror = () => falha(new Error(`${nome}: a conexão caiu no envio.`));
    x.send(arquivo);
  });
}

// ------------------------------------------------------------ horários (igual ao desktop)
export function parseTimes(txt: string) {
  const out: number[] = [];
  for (const m of String(txt).matchAll(/(\d{1,2})\s*[:h]\s*(\d{2})?/g)) {
    const h = +m[1]!;
    const mi = +(m[2] || 0);
    if (h < 24 && mi < 60) out.push(h * 60 + mi);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}
export function normTags(txt: string) {
  return String(txt || "")
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : "#" + t))
    .join(" ");
}
export const countTags = (t: string) => (String(t).match(/#[\p{L}\p{N}_]+/gu) || []).length;

/** Horários do lote: começa no dia escolhido, só nos dias da semana marcados, pelo menos 2 min no futuro. */
export function slots(count: number, inicio: string, horarios: number[], dias: Set<number>, agora = Date.now()) {
  if (!horarios.length || !dias.size) return null;
  const [y, m, d] = (inicio || "").split("-").map(Number);
  const start = y ? new Date(y, (m || 1) - 1, d || 1) : new Date(agora);
  start.setHours(0, 0, 0, 0);
  const minMs = agora + 2 * 60 * 1000;
  const out: number[] = [];
  for (let day = 0; out.length < count && day < 800; day++) {
    const base = new Date(start);
    base.setDate(start.getDate() + day);
    if (!dias.has(base.getDay())) continue;
    for (const t of horarios) {
      const ms = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(t / 60), t % 60).getTime();
      if (ms >= minMs) out.push(ms);
      if (out.length >= count) break;
    }
  }
  return out;
}

// ------------------------------------------------------------ vídeos prontos da mesa do Editor
export type ProntoMesa = { id: string; nome: string; blob: Blob; capa: Blob | null; thumb: string; legenda: string; titulo: string };
let prontos: ProntoMesa[] = [];
export function definirProntos(lista: ProntoMesa[]) {
  prontos = lista;
}
export const lerProntos = () => prontos;
