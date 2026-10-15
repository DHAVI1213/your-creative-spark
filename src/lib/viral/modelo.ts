export type Plataforma = "instagram" | "tiktok" | "youtube";
export type TipoLink = "perfil" | "video" | "musica";
/** O que a pessoa colou: um perfil, um vídeo só ou uma música. Buscas antigas não têm `tipo` (= perfil). */
export type Perfil = {
  plataforma: Plataforma;
  nome: string;
  url: string;
  tipo?: TipoLink;
  id?: string;
};
export type VideoViral = {
  id: string;
  titulo: string;
  link: string;
  capa: string;
  views: number | null;
  likes: number | null;
  comentarios: number | null;
  duracao: number | null;
  publicado: string | null;
  arquivo: string | null;
  /** Som original do vídeo (TikTok), quando o serviço informa. */
  audio?: string | null;
  vezesMediana: number | null;
};
export type Ranking = "viral" | "views" | "likes" | "comentarios" | "engajamento" | "recentes";
export function lerPerfil(valor: string): Perfil {
  let u: URL;
  try {
    u = new URL(valor.trim().match(/^https?:/) ? valor.trim() : `https://${valor.trim()}`);
  } catch {
    throw new Error("Cole o link de um perfil do Instagram, TikTok ou YouTube.");
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    throw new Error("Use um link HTTPS de perfil.");
  const host = u.hostname.replace(/^(www|m)\./, ""),
    p = u.pathname.split("/").filter(Boolean);
  const nome = p[0] ?? "";
  if (
    host === "instagram.com" &&
    /^[a-z0-9._]{1,30}$/i.test(nome) &&
    !["p", "reel", "reels", "stories", "explore", "accounts", "direct"].includes(
      nome.toLowerCase(),
    ) &&
    (p.length === 1 || (p.length === 2 && p[1] === "reels"))
  )
    return { plataforma: "instagram", nome, url: `https://www.instagram.com/${nome}/` };
  if (host === "tiktok.com" && /^@[a-z0-9._-]{2,32}$/i.test(nome) && p.length === 1)
    return { plataforma: "tiktok", nome: nome.slice(1), url: `https://www.tiktok.com/${nome}` };
  if (host === "youtube.com") {
    if (
      /^@[\p{L}\p{N}_.-]{2,100}$/u.test(nome) &&
      (p.length === 1 || (p.length === 2 && ["shorts", "videos"].includes(p[1] ?? "")))
    )
      return { plataforma: "youtube", nome: nome.slice(1), url: `https://www.youtube.com/${nome}` };
    if (
      ["channel", "c", "user"].includes(nome) &&
      /^[a-zA-Z0-9_-]{2,100}$/.test(p[1] ?? "") &&
      (p.length === 2 || (p.length === 3 && ["shorts", "videos"].includes(p[2] ?? "")))
    )
      return { plataforma: "youtube", nome: p[1]!, url: `https://www.youtube.com/${nome}/${p[1]}` };
  }
  throw new Error(
    "Esse link não é de um perfil. Use instagram.com/perfil, tiktok.com/@perfil ou youtube.com/@canal.",
  );
}
const ID_IG = /^[A-Za-z0-9_-]{5,25}$/;
const ID_YT = /^[A-Za-z0-9_-]{11}$/;
function urlDe(valor: string): URL {
  try {
    return new URL(valor.trim().match(/^https?:/) ? valor.trim() : `https://${valor.trim()}`);
  } catch {
    throw new Error(MSG_LINK);
  }
}
const MSG_LINK =
  "Esse link não é aceito. Cole o link de um perfil, de um vídeo ou de uma música (Instagram, TikTok ou YouTube).";
/** Links curtos de compartilhamento do TikTok (vm.tiktok.com/…); o servidor descobre o destino. */
export function ehLinkCurto(valor: string): boolean {
  try {
    const u = urlDe(valor),
      h = u.hostname.replace(/^www\./, ""),
      p = u.pathname.split("/").filter(Boolean);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      (((h === "vm.tiktok.com" || h === "vt.tiktok.com") && p.length === 1) ||
        (h === "tiktok.com" && p[0] === "t" && p.length === 2 && /^[A-Za-z0-9]+$/.test(p[1] ?? "")))
    );
  } catch {
    return false;
  }
}
/**
 * Aceita perfil, vídeo único ou música. Normaliza o endereço (tira rastreadores e parâmetros)
 * e recusa qualquer outro site.
 */
export function lerLink(valor: string): Perfil & { tipo: TipoLink } {
  const u = urlDe(valor);
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    throw new Error("Use um link HTTPS.");
  const host = u.hostname.replace(/^(www|m)\./, ""),
    p = u.pathname.split("/").filter(Boolean);
  const video = (plataforma: Plataforma, id: string, url: string, nome: string) => ({
    plataforma,
    nome,
    url,
    id,
    tipo: "video" as const,
  });
  if (host === "instagram.com") {
    const k = ["p", "reel", "tv"].includes(p[0] ?? "")
      ? 0
      : ["p", "reel"].includes(p[1] ?? "")
        ? 1
        : -1;
    const id = k >= 0 ? (p[k + 1] ?? "") : "";
    if (k >= 0 && ID_IG.test(id))
      return video("instagram", id, `https://www.instagram.com/${p[k]}/${id}/`, id);
    if (p[0] === "reels" && p[1] === "audio")
      throw new Error("Link de áudio do Instagram ainda não é aceito. Cole o link do Reel.");
  }
  if (host === "tiktok.com") {
    if (
      /^@[a-z0-9._-]{2,32}$/i.test(p[0] ?? "") &&
      p[1] === "video" &&
      /^\d{8,25}$/.test(p[2] ?? "")
    )
      return video("tiktok", p[2]!, `https://www.tiktok.com/${p[0]}/video/${p[2]}`, p[2]!);
    const m = p[0] === "music" && p.length === 2 ? (p[1] ?? "").match(/^(.*?)-?(\d{8,25})$/) : null;
    if (m)
      return {
        plataforma: "tiktok",
        nome: (m[1] || "musica").replace(/[^\p{L}\p{N}_-]/gu, "_").slice(0, 60) || "musica",
        url: `https://www.tiktok.com/music/${p[1]}`,
        id: m[2]!,
        tipo: "musica",
      };
  }
  if (host === "youtu.be" && ID_YT.test(p[0] ?? "") && p.length === 1)
    return video("youtube", p[0]!, `https://www.youtube.com/watch?v=${p[0]}`, p[0]!);
  if (host === "youtube.com" || host === "music.youtube.com") {
    const id =
      p[0] === "watch" ? (u.searchParams.get("v") ?? "") : p[0] === "shorts" ? (p[1] ?? "") : "";
    if (ID_YT.test(id)) return video("youtube", id, `https://www.youtube.com/watch?v=${id}`, id);
  }
  try {
    return { ...lerPerfil(valor), tipo: "perfil" };
  } catch {
    throw new Error(MSG_LINK);
  }
}
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
const texto = (v: unknown) => (typeof v === "string" ? v : "");
function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function https(v: unknown): string {
  try {
    const u = new URL(texto(v));
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}
export function normalizarVideos(itens: unknown[], plataforma: Plataforma): VideoViral[] {
  const vistos = new Set<string>(),
    videos: VideoViral[] = [];
  for (const item of itens) {
    const v = obj(item),
      meta = obj(v["videoMeta"]);
    if (v["error"] || (plataforma === "tiktok" && v["isSlideshow"])) continue;
    const id = texto(v["id"] ?? v["videoId"] ?? v["shortCode"]);
    const link = https(v["webVideoUrl"] ?? v["url"] ?? v["sourceUrl"]);
    if (!id || !link || vistos.has(id)) continue;
    const linkHost = new URL(link).hostname;
    if (plataforma === "instagram" && !/(^|\.)instagram\.com$/.test(linkHost)) continue;
    if (plataforma === "tiktok" && !/(^|\.)tiktok\.com$/.test(linkHost)) continue;
    if (plataforma === "youtube" && !/(^|\.)(youtube\.com|youtu\.be)$/.test(linkHost)) continue;
    vistos.add(id);
    const media = Array.isArray(v["mediaUrls"]) ? v["mediaUrls"][0] : undefined;
    const arquivo = https(v["videoUrl"] ?? v["downloadUrl"] ?? media ?? meta["downloadAddr"]);
    videos.push({
      id,
      link,
      titulo: texto(v["caption"] ?? v["text"] ?? v["title"]).slice(0, 1000) || "Vídeo sem título",
      capa: https(v["displayUrl"] ?? v["thumbnailUrl"] ?? v["thumbnail"] ?? meta["coverUrl"]),
      views: numero(v["videoPlayCount"] ?? v["videoViewCount"] ?? v["playCount"] ?? v["viewCount"]),
      likes: numero(v["likesCount"] ?? v["diggCount"] ?? v["likes"] ?? v["likeCount"]),
      comentarios: numero(v["commentsCount"] ?? v["commentCount"] ?? v["comments"]),
      duracao: numero(v["videoDuration"] ?? meta["duration"] ?? v["duration"]),
      publicado:
        texto(v["timestamp"] ?? v["createTimeISO"] ?? v["date"] ?? v["uploadDate"]) || null,
      arquivo: arquivo || null,
      audio: https(obj(v["musicMeta"])["playUrl"]) || null,
      vezesMediana: null,
    });
  }
  const views = videos
    .map((v) => v.views)
    .filter((n): n is number => n !== null && n > 0)
    .sort((a, b) => a - b);
  const i = Math.floor(views.length / 2),
    mediana = views.length ? (views.length % 2 ? views[i]! : (views[i - 1]! + views[i]!) / 2) : 0;
  return videos.map((v) => ({
    ...v,
    vezesMediana: mediana && v.views !== null ? v.views / mediana : null,
  }));
}
export function filtrarVideos(
  videos: VideoViral[],
  f: { views: number; likes: number; texto: string; ranking: Ranking; viral: number },
): VideoViral[] {
  const score = (v: VideoViral) => {
    switch (f.ranking) {
      case "viral":
        return v.vezesMediana ?? -1;
      case "engajamento":
        return v.views && v.likes !== null ? (v.likes + (v.comentarios ?? 0)) / v.views : -1;
      case "recentes":
        return Date.parse(v.publicado ?? "") || -1;
      default:
        return v[f.ranking] ?? -1;
    }
  };
  return videos
    .filter(
      (v) =>
        (!f.views || (v.views !== null && v.views >= f.views)) &&
        (!f.likes || (v.likes !== null && v.likes >= f.likes)) &&
        (!f.viral || (v.vezesMediana !== null && v.vezesMediana >= f.viral)) &&
        v.titulo.toLocaleLowerCase("pt-BR").includes(f.texto.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) => score(b) - score(a));
}
export function urlMidia(valor: string): URL {
  const u = new URL(valor),
    h = u.hostname;
  const dom = [
    "cdninstagram.com",
    "fbcdn.net",
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokcdn-eu.com",
    "tiktokv.com",
    "tiktok.com",
    "byteoversea.com",
  ];
  const apify =
    h === "api.apify.com" && /^\/v2\/key-value-stores\/[a-zA-Z0-9]+\/records\//.test(u.pathname);
  if (
    u.protocol !== "https:" ||
    u.port ||
    u.username ||
    u.password ||
    !(apify || dom.some((d) => h === d || h.endsWith(`.${d}`)))
  )
    throw new Error("O serviço não forneceu um endereço de vídeo permitido.");
  u.searchParams.delete("token");
  return u;
}
