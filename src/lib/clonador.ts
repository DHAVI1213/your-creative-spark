import { createServerFn } from "@tanstack/react-start";

/**
 * Funções do Clonador de Sites que rodam no servidor (Cloudflare).
 * O navegador não deixa um site ler o conteúdo de outro (CORS), então a busca acontece aqui.
 */

const MAX_HTML_BYTES = 6 * 1024 * 1024;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

/** Bloqueia endereços internos: o clonador só busca sites públicos. */
function assertPublicUrl(raw: string): URL {
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
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept, "accept-language": "pt-BR,pt;q=0.9,en;q=0.8" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`O site respondeu com erro ${res.status}.`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > maxBytes) throw new Error("Arquivo grande demais para clonar.");
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new Error("Arquivo grande demais para clonar.");
    return { res, buf };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw new Error("O site demorou demais para responder.");
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

export const clonePage = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const url = (input as { url?: unknown })?.url;
    if (typeof url !== "string" || !url.trim()) throw new Error("Informe o endereço do site.");
    const withProtocol = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    return { url: withProtocol };
  })
  .handler(async ({ data }): Promise<ClonePageResult> => {
    const url = assertPublicUrl(data.url);
    const { res, buf } = await fetchWithLimit(
      url,
      "text/html,application/xhtml+xml",
      MAX_HTML_BYTES,
    );
    const type = res.headers.get("content-type") || "";
    if (!type.includes("html")) throw new Error("Esse endereço não é uma página de site.");

    const charset = /charset=([^;]+)/i.exec(type)?.[1]?.trim() || "utf-8";
    let html: string;
    try {
      html = new TextDecoder(charset).decode(buf);
    } catch {
      html = new TextDecoder("utf-8").decode(buf);
    }

    const finalUrl = res.url || url.toString();
    // Remove regras de segurança que impediriam a cópia de funcionar fora do site original.
    html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");
    // Faz os arquivos relativos (imagens, CSS, JS) apontarem para o site original.
    if (!/<base\s/i.test(html)) {
      const base = `<base href="${finalUrl.replace(/"/g, "&quot;")}">`;
      html = /<head[^>]*>/i.test(html)
        ? html.replace(/<head[^>]*>/i, (m) => `${m}${base}`)
        : base + html;
    }

    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || url.hostname;
    const stats = {
      scripts: (html.match(/<script\b/gi) || []).length,
      styles:
        (html.match(/<link[^>]+stylesheet/gi) || []).length +
        (html.match(/<style\b/gi) || []).length,
      images: (html.match(/<img\b/gi) || []).length,
      has3d: /three(\.module)?(\.min)?\.js|webgl|<canvas\b|babylon|spline/i.test(html),
    };
    return { html, finalUrl, title, stats };
  });

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

/** Baixa vários arquivos do site (imagens, CSS, JS, fontes) para montar o .zip completo. */
export const fetchAssets = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const urls = (input as { urls?: unknown })?.urls;
    if (!Array.isArray(urls)) throw new Error("Lista de arquivos inválida.");
    return { urls: urls.filter((u): u is string => typeof u === "string").slice(0, 25) };
  })
  .handler(async ({ data }): Promise<AssetResult[]> => {
    return Promise.all(
      data.urls.map(async (raw) => {
        try {
          const url = assertPublicUrl(raw);
          const { res, buf } = await fetchWithLimit(url, "*/*", MAX_ASSET_BYTES);
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
  });
