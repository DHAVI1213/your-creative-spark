export type Plataforma = "instagram" | "tiktok" | "youtube";
export type Perfil = { plataforma: Plataforma; nome: string; url: string };
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
