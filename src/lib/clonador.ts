/**
 * Clonador de Sites — versão 100% cliente para o NK Software.
 * O fetch direto respeita o CORS do navegador: funciona em sites que liberam
 * CORS ou mesma origem; para os demais, o app oferece o modo "colar HTML".
 */

const MAX_HTML_BYTES = 6 * 1024 * 1024;
const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_BATCH_BYTES = 30 * 1024 * 1024;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Endereço inválido. Use algo como https://site.com.br");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Só dá para clonar endereços http ou https.");
  }
  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^0\./.test(host) ||
    host === "[::1]" ||
    /^\[(fc|fd|fe80)/i.test(host);
  if (isPrivate) throw new Error("Esse endereço não é um site público.");
  return url;
}

async function fetchWithLimit(url: URL, accept: string, maxBytes: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url.toString(), {
      headers: { "user-agent": UA, accept, "accept-language": "pt-BR,pt;q=0.9,en;q=0.8" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`O site respondeu com erro ${res.status}.`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new Error("Arquivo grande demais para clonar.");
    return { res, buf };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw new Error("O site demorou demais para responder.");
    if (e instanceof TypeError)
      throw new Error(
        "O navegador bloqueou a leitura (CORS). Use o modo “Colar HTML” abaixo.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export type ClonePageResult = {
  html: string;
  finalUrl: string;
  title: string;
  stats: { scripts: number; styles: number; images: number; has3d: boolean };
};

export function prepararHtml(html: string, finalUrl: string): ClonePageResult {
  let out = html.replace(
    /<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi,
    "",
  );
  if (!/<base\s/i.test(out)) {
    const base = `<base href="${finalUrl.replace(/"/g, "&quot;")}">`;
    out = /<head[^>]*>/i.test(out)
      ? out.replace(/<head[^>]*>/i, (m) => `${m}${base}`)
      : base + out;
  }
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(out)?.[1]?.trim() || finalUrl;
  const stats = {
    scripts: (out.match(/<script\b/gi) || []).length,
    styles:
      (out.match(/<link[^>]+stylesheet/gi) || []).length + (out.match(/<style\b/gi) || []).length,
    images: (out.match(/<img\b/gi) || []).length,
    has3d: /three(\.module)?(\.min)?\.js|webgl|<canvas\b|babylon|spline/i.test(out),
  };
  return { html: out, finalUrl, title, stats };
}

export async function clonePageUrl(rawUrl: string): Promise<ClonePageResult> {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error("Informe o endereço do site.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = assertPublicUrl(withProtocol);
  const { res, buf } = await fetchWithLimit(url, "text/html,application/xhtml+xml", MAX_HTML_BYTES);
  const type = res.headers.get("content-type") || "";
  if (!type.includes("html")) throw new Error("Esse endereço não é uma página de site.");
  const charset = /charset=([^;]+)/i.exec(type)?.[1]?.trim() || "utf-8";
  let html: string;
  try {
    html = new TextDecoder(charset).decode(buf);
  } catch {
    html = new TextDecoder("utf-8").decode(buf);
  }
  return prepararHtml(html, res.url || url.toString());
}

export function clonePageHtml(html: string, sourceUrl: string): ClonePageResult {
  if (!html.trim()) throw new Error("Cole o HTML da página primeiro.");
  const base = sourceUrl.trim()
    ? /^https?:\/\//i.test(sourceUrl.trim())
      ? sourceUrl.trim()
      : `https://${sourceUrl.trim()}`
    : "https://exemplo.com/";
  return prepararHtml(html, base);
}

export type AssetResult = {
  url: string;
  ok: boolean;
  type: string;
  base64: string;
  error?: string;
};

function toBase64(buf: Uint8Array) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    s += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(s);
}

export async function fetchAssets(urls: string[]): Promise<AssetResult[]> {
  const lista = urls.filter((u): u is string => typeof u === "string").slice(0, 12);
  let total = 0;
  return Promise.all(
    lista.map(async (raw) => {
      try {
        const url = assertPublicUrl(raw);
        const { res, buf } = await fetchWithLimit(url, "*/*", MAX_ASSET_BYTES);
        total += buf.byteLength;
        if (total > MAX_BATCH_BYTES)
          throw new Error("lote grande demais; ficou ligado ao site original");
        return {
          url: raw,
          ok: true,
          type: res.headers.get("content-type")?.split(";")[0] || "application/octet-stream",
          base64: toBase64(buf),
        };
      } catch (e) {
        return {
          url: raw,
          ok: false,
          type: "",
          base64: "",
          error: e instanceof Error ? e.message : "falhou",
        };
      }
    }),
  );
}
