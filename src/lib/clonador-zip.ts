/**
 * Monta o .zip completo de um site clonado: index.html + pasta assets/ com imagens, CSS, JS e fontes.
 * Roda no navegador; os arquivos são baixados pelo servidor (fetchAssets).
 */
import { fetchAssets } from "./clonador";

const MAX_ASSETS = 150;
const BATCH = 25;

type Ref = { el: Element; attr: string; kind: "url" | "srcset" };

function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function resolve(raw: string, base: string): string | null {
  const v = raw.trim();
  if (
    !v ||
    v.startsWith("data:") ||
    v.startsWith("blob:") ||
    v.startsWith("#") ||
    v.startsWith("javascript:")
  )
    return null;
  try {
    const u = new URL(v, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const EXT_BY_TYPE: Record<string, string> = {
  "text/css": "css",
  "application/javascript": "js",
  "text/javascript": "js",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/x-icon": "ico",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
};

function fileName(url: string, index: number, type: string) {
  const path = new URL(url).pathname;
  let base = decodeURIComponent(path.split("/").pop() || "arquivo").replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );
  if (!base || base === "_") base = "arquivo";
  if (!/\.[a-z0-9]{2,5}$/i.test(base)) base += `.${EXT_BY_TYPE[type] ?? "bin"}`;
  return `${index}-${base}`.slice(0, 90);
}

const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

export type ZipReport = { blob: Blob; saved: number; failed: number; skipped: number };

export async function buildSiteZip(
  html: string,
  baseUrl: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ZipReport> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("base").forEach((b) => b.remove());
  doc.querySelectorAll("[integrity]").forEach((el) => el.removeAttribute("integrity"));

  const refs: Ref[] = [];
  const add = (selector: string, attr: string, kind: Ref["kind"] = "url") =>
    doc.querySelectorAll(selector).forEach((el) => refs.push({ el, attr, kind }));
  add("img[src]", "src");
  add("img[srcset]", "srcset", "srcset");
  add("source[src]", "src");
  add("source[srcset]", "srcset", "srcset");
  add("video[poster]", "poster");
  add("link[rel~='stylesheet'][href]", "href");
  add("link[rel~='icon'][href]", "href");
  add("link[rel='apple-touch-icon'][href]", "href");
  add("script[src]", "src");

  // Lista única de arquivos para baixar.
  const wanted = new Set<string>();
  for (const r of refs) {
    const value = r.el.getAttribute(r.attr) || "";
    const parts =
      r.kind === "srcset" ? value.split(",").map((p) => p.trim().split(/\s+/)[0] ?? "") : [value];
    for (const p of parts) {
      const abs = resolve(p, baseUrl);
      if (abs) wanted.add(abs);
    }
  }
  // Imagens de fundo escritas direto no HTML (style="background: url(...)").
  doc.querySelectorAll("[style*='url(']").forEach((el) => {
    for (const m of (el.getAttribute("style") || "").matchAll(CSS_URL_RE)) {
      const abs = resolve(m[2] ?? "", baseUrl);
      if (abs) wanted.add(abs);
    }
  });

  const all = [...wanted];
  const list = all.slice(0, MAX_ASSETS);
  const files: Record<string, Uint8Array> = {};
  const localName = new Map<string, string>();
  let failed = 0;
  let done = 0;

  const download = async (urls: string[]) => {
    for (let i = 0; i < urls.length; i += BATCH) {
      const batch = urls.slice(i, i + BATCH);
      const results = await fetchAssets({ data: { urls: batch } });
      for (const r of results) {
        done++;
        if (!r.ok) {
          failed++;
          continue;
        }
        const name = fileName(r.url, localName.size + 1, r.type);
        localName.set(r.url, name);
        files[`assets/${name}`] = fromBase64(r.base64);
      }
      onProgress?.(done, list.length);
    }
  };

  await download(list);

  // Dentro dos CSS: baixa fontes e imagens citadas e reescreve os caminhos.
  const cssExtra = new Set<string>();
  const cssFiles = [...localName.entries()].filter(([, n]) => n.endsWith(".css"));
  for (const [cssUrl, name] of cssFiles) {
    const text = new TextDecoder().decode(files[`assets/${name}`]);
    for (const m of text.matchAll(CSS_URL_RE)) {
      const abs = resolve(m[2] ?? "", cssUrl);
      if (abs && !localName.has(abs)) cssExtra.add(abs);
    }
  }
  const extra = [...cssExtra].slice(0, Math.max(0, MAX_ASSETS - list.length));
  if (extra.length) await download(extra);

  for (const [cssUrl, name] of cssFiles) {
    const text = new TextDecoder().decode(files[`assets/${name}`]);
    const rewritten = text.replace(CSS_URL_RE, (full, q: string, raw: string) => {
      const abs = resolve(raw, cssUrl);
      const local = abs ? localName.get(abs) : undefined;
      return local ? `url(${q}${local}${q})` : full;
    });
    files[`assets/${name}`] = new TextEncoder().encode(rewritten);
  }

  // Reescreve o HTML para usar os arquivos locais (e aponta o resto para o site original).
  for (const r of refs) {
    const value = r.el.getAttribute(r.attr) || "";
    if (r.kind === "srcset") {
      const out = value
        .split(",")
        .map((part) => {
          const [u = "", ...rest] = part.trim().split(/\s+/);
          const abs = resolve(u, baseUrl);
          const local = abs ? localName.get(abs) : undefined;
          return [local ? `assets/${local}` : (abs ?? u), ...rest].join(" ");
        })
        .join(", ");
      r.el.setAttribute(r.attr, out);
    } else {
      const abs = resolve(value, baseUrl);
      if (!abs) continue;
      const local = localName.get(abs);
      r.el.setAttribute(r.attr, local ? `assets/${local}` : abs);
    }
  }
  doc.querySelectorAll("[style*='url(']").forEach((el) => {
    const style = el.getAttribute("style") || "";
    el.setAttribute(
      "style",
      style.replace(CSS_URL_RE, (full, q: string, raw: string) => {
        const abs = resolve(raw, baseUrl);
        const local = abs ? localName.get(abs) : undefined;
        return local ? `url(${q}assets/${local}${q})` : abs ? `url(${q}${abs}${q})` : full;
      }),
    );
  });
  // Links internos continuam funcionando, apontando para o site original.
  doc.querySelectorAll("a[href]").forEach((a) => {
    const abs = resolve(a.getAttribute("href") || "", baseUrl);
    if (abs) a.setAttribute("href", abs);
  });

  const out = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  files["index.html"] = new TextEncoder().encode(out);

  const { zipSync } = await import("fflate");
  const zipped = zipSync(files, { level: 6 });
  return {
    blob: new Blob([zipped as BlobPart], { type: "application/zip" }),
    saved: localName.size,
    failed,
    skipped: Math.max(0, all.length - list.length),
  };
}
