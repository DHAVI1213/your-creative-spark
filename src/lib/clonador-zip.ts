/**
 * Monta o .zip "fiel" de um site clonado.
 *
 * - Mantém a MESMA estrutura de pastas do site original (ex.: /_next/static/chunks/x.js
 *   vira _next/static/chunks/x.js), para os scripts que carregam outros arquivos
 *   (animações, chunks, modelos 3D) continuarem achando tudo.
 * - Além do que está no HTML, lê os CSS (fontes, imagens de fundo, @import) e os JS
 *   (modelos .glb/.gltf, texturas, vídeos, Lottie, chunks) e baixa o que encontrar.
 * - Arquivos de outros domínios (CDNs) vão para _ext/<domínio>/...
 *
 * Roda no navegador; os arquivos são baixados pelo servidor (fetchAssets).
 */
import { limparAdaptador } from "./clonador-analise";
import { fetchAssets } from "./clonador";

const MAX_ARQUIVOS = 400;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;
const LOTE = 12;

const EXT_POR_TIPO: Record<string, string> = {
  "text/css": "css",
  "application/javascript": "js",
  "text/javascript": "js",
  "application/json": "json",
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
  "video/mp4": "mp4",
  "video/webm": "webm",
  "model/gltf-binary": "glb",
  "model/gltf+json": "gltf",
  "application/wasm": "wasm",
};

/** Extensões que já vêm comprimidas (não vale a pena comprimir de novo no zip). */
const JA_COMPRIMIDO =
  /\.(png|jpe?g|webp|avif|gif|mp4|webm|mov|mp3|ogg|m4a|woff2?|glb|ktx2|basis|drc|zip)$/i;

const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?(['"])([^'"]+)\1/g;
/** Caminhos de arquivos citados dentro de JavaScript. */
const JS_ASSET_RE =
  /["'`]((?:https?:)?\/{0,2}[^"'`\s<>{}()|^$*]+?\.(?:glb|gltf|bin|hdr|exr|ktx2|basis|drc|fbx|obj|usdz|riv|lottie|json|png|jpe?g|webp|avif|gif|svg|mp4|webm|mov|mp3|wav|ogg|m4a|woff2?|ttf|otf|wasm|js|mjs|css))(?:\?[^"'`\s]*)?["'`]/gi;

type Ref =
  | { el: Element; attr: string; tipo: "url" | "srcset" | "style" }
  | { el: Element; tipo: "styletag" };

export type ZipReport = {
  blob: Blob;
  saved: number;
  failed: number;
  skipped: number;
  fromScripts: number;
};

function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function resolver(raw: string, base: string): string | null {
  const v = raw.trim();
  if (!v || /^(data:|blob:|#|javascript:|mailto:|tel:|about:)/i.test(v)) return null;
  try {
    const u = new URL(v, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function hash8(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

function segmentoSeguro(seg: string) {
  let s = seg;
  try {
    s = decodeURIComponent(seg);
  } catch {
    /* mantém */
  }
  s = s.replace(/[^\w.\-@~]/g, "_");
  if (!s || s === "." || s === "..") s = "_";
  return s.slice(0, 120);
}

/** Caminho local do arquivo dentro do zip, imitando a estrutura do site. */
export function caminhoLocal(url: string, hostPagina: string, tipo?: string): string {
  const u = new URL(url);
  const partes = u.pathname.split("/").filter(Boolean).map(segmentoSeguro);
  if (partes.length === 0 || u.pathname.endsWith("/")) partes.push("index");
  let nome = partes.pop()!;
  if (u.search) {
    const i = nome.lastIndexOf(".");
    const sufixo = "-" + hash8(u.search);
    nome = i > 0 ? nome.slice(0, i) + sufixo + nome.slice(i) : nome + sufixo;
  }
  if (!/\.[a-z0-9]{1,6}$/i.test(nome) && tipo && EXT_POR_TIPO[tipo])
    nome += "." + EXT_POR_TIPO[tipo];
  const pasta = u.host === hostPagina ? partes : ["_ext", segmentoSeguro(u.host), ...partes];
  return [...pasta, nome].join("/");
}

/** Caminho relativo de um arquivo do zip até outro. */
export function relativo(deArquivo: string, para: string) {
  const a = deArquivo.split("/").slice(0, -1);
  const b = para.split("/");
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  return "../".repeat(a.length - i) + b.slice(i).join("/");
}

/** Acha arquivos citados dentro de um JavaScript. */
export function urlsDoJs(
  texto: string,
  urlDoScript: string,
  origem: string,
  ehNext: boolean,
  /** Para scripts escritos dentro da página: caminhos soltos ("models/a.glb") são relativos a ela. */
  baseSolta?: string,
): string[] {
  const achados = new Set<string>();
  for (const m of texto.matchAll(JS_ASSET_RE)) {
    const s = m[1] ?? "";
    if (s.length < 4 || s.length > 300 || s.includes("${")) continue;
    let abs: string | null = null;
    if (/^https?:\/\//i.test(s) || s.startsWith("//")) abs = resolver(s, origem);
    else if (s.startsWith("/")) abs = resolver(s, origem);
    else if (s.startsWith("./") || s.startsWith("../")) abs = resolver(s, urlDoScript);
    else if (ehNext && /^static\/(chunks|css|media)\//.test(s))
      abs = resolver("/_next/" + s, origem);
    else if (baseSolta && /^[\w@.-]+\//.test(s)) abs = resolver(s, baseSolta);
    else if (/^(assets|static|models|img|images|media|fonts|textures|3d)\//i.test(s))
      abs = resolver("/" + s, origem);
    if (abs) achados.add(abs);
  }
  // Decodificadores de modelos 3D comprimidos: o código só diz a pasta, os nomes são fixos.
  const pastas: [RegExp, string[]][] = [
    [
      /setDecoderPath\(\s*["'`]([^"'`]+)["'`]/g,
      ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"],
    ],
    [
      /setTranscoderPath\(\s*["'`]([^"'`]+)["'`]/g,
      ["basis_transcoder.js", "basis_transcoder.wasm"],
    ],
  ];
  for (const [re, nomes] of pastas) {
    for (const m of texto.matchAll(re)) {
      let pasta = m[1] ?? "";
      if (!pasta.endsWith("/")) pasta += "/";
      const base =
        /^(https?:)?\/\//.test(pasta) || pasta.startsWith("/")
          ? origem
          : (baseSolta ?? urlDoScript);
      for (const n of nomes) {
        const abs = resolver(pasta + n, /^(https?:)?\/\//.test(pasta) ? pasta : base);
        if (abs) achados.add(abs);
      }
    }
  }
  return [...achados];
}

export function urlsDoCss(texto: string, urlDoCss: string): string[] {
  const achados = new Set<string>();
  for (const m of texto.matchAll(CSS_URL_RE)) {
    const abs = resolver(m[2] ?? "", urlDoCss);
    if (abs) achados.add(abs);
  }
  for (const m of texto.matchAll(CSS_IMPORT_RE)) {
    const abs = resolver(m[2] ?? "", urlDoCss);
    if (abs) achados.add(abs);
  }
  return [...achados];
}

function reescreverCss(
  texto: string,
  urlDoCss: string,
  arquivoCss: string,
  local: Map<string, string>,
) {
  const troca = (raw: string) => {
    const abs = resolver(raw, urlDoCss);
    if (!abs) return null;
    const l = local.get(abs);
    return l ? relativo(arquivoCss, l) : abs;
  };
  return texto
    .replace(CSS_URL_RE, (full, q: string, raw: string) => {
      const novo = troca(raw);
      return novo ? `url(${q}${novo}${q})` : full;
    })
    .replace(CSS_IMPORT_RE, (full, q: string, raw: string) => {
      const novo = troca(raw);
      return novo ? full.replace(raw, novo) : full;
    });
}

const LEIA_ME = `COMO ABRIR ESTE SITE
====================

Este .zip mantém a mesma estrutura de pastas do site original, para as animações,
efeitos de rolagem e 3D continuarem funcionando.

Jeitos fáceis de ver o site funcionando (os scripts precisam de um "servidor"):

1) Netlify Drop (grátis, sem instalar nada): abra app.netlify.com/drop e arraste a
   pasta inteira (depois de descompactar). Ele gera um link na hora.
2) VS Code: instale a extensão "Live Server", abra a pasta e clique em "Go Live".
3) Com Node instalado: abra o terminal na pasta e rode  npx serve .

Abrir o index.html com dois cliques funciona para o visual, mas alguns sites com
animações, chunks ou modelos 3D só rodam completos num desses jeitos.

Arquivos que não puderam ser baixados continuam ligados ao site original.
`;

export async function buildSiteZip(
  html: string,
  baseUrl: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ZipReport> {
  const doc = new DOMParser().parseFromString(limparAdaptador(html), "text/html");
  doc.querySelectorAll("base").forEach((b) => b.remove());
  doc.querySelectorAll("[integrity]").forEach((el) => el.removeAttribute("integrity"));

  const pagina = new URL(baseUrl);
  const origem = pagina.origin;
  // A página fica no mesmo lugar que no site original (ex.: examples/demo.html),
  // para os caminhos relativos usados pelos scripts continuarem certos.
  let paginaLocal = caminhoLocal(baseUrl, pagina.host, "text/html");
  if (!/\.html?$/i.test(paginaLocal)) paginaLocal += ".html";
  const deLaPara = (destino: string) => {
    const r = relativo(paginaLocal, destino);
    return r.startsWith("../") ? r : "./" + r;
  };
  const ehNext = /\/_next\//.test(html);

  // ---------- Referências no HTML ----------
  const refs: Ref[] = [];
  const add = (sel: string, attr: string, tipo: "url" | "srcset" = "url") =>
    doc.querySelectorAll(sel).forEach((el) => refs.push({ el, attr, tipo }));
  add("img[src]", "src");
  add("img[data-src]", "data-src");
  add("img[data-lazy-src]", "data-lazy-src");
  add("img[srcset]", "srcset", "srcset");
  add("img[data-srcset]", "data-srcset", "srcset");
  add("source[src]", "src");
  add("source[srcset]", "srcset", "srcset");
  add("source[data-srcset]", "data-srcset", "srcset");
  add("video[src]", "src");
  add("video[poster]", "poster");
  add("audio[src]", "src");
  add("track[src]", "src");
  add("link[rel~='stylesheet'][href]", "href");
  add("link[rel~='icon'][href]", "href");
  add("link[rel='apple-touch-icon'][href]", "href");
  add("link[rel~='preload'][href]", "href");
  add("link[rel~='modulepreload'][href]", "href");
  add("script[src]", "src");
  add("object[data]", "data");
  add("embed[src]", "src");
  add("model-viewer[src]", "src");
  add("model-viewer[poster]", "poster");
  doc
    .querySelectorAll("[style*='url(']")
    .forEach((el) => refs.push({ el, attr: "style", tipo: "style" }));
  doc.querySelectorAll("style").forEach((el) => refs.push({ el, tipo: "styletag" }));
  const mapasDeImport = [...doc.querySelectorAll("script[type='importmap']")];
  const scriptsNaPagina = [...doc.querySelectorAll("script:not([src])")].filter(
    (el) =>
      el.getAttribute("type") !== "importmap" && el.getAttribute("type") !== "application/ld+json",
  );

  const fila: string[] = [];
  const vistos = new Set<string>();
  const enfileirar = (u: string | null) => {
    if (!u || vistos.has(u)) return;
    vistos.add(u);
    fila.push(u);
  };

  for (const r of refs) {
    if (r.tipo === "styletag") {
      urlsDoCss(r.el.textContent || "", baseUrl).forEach(enfileirar);
      continue;
    }
    const valor = r.el.getAttribute(r.attr) || "";
    if (r.tipo === "srcset") {
      valor
        .split(",")
        .forEach((p) => enfileirar(resolver(p.trim().split(/\s+/)[0] ?? "", baseUrl)));
    } else if (r.tipo === "style") {
      urlsDoCss(valor, baseUrl).forEach(enfileirar);
    } else {
      enfileirar(resolver(valor, baseUrl));
    }
  }

  // Import maps (módulos usados por sites com 3D/Three.js e afins).
  const lerMapa = (el: Element) => {
    try {
      return JSON.parse(el.textContent || "{}") as { imports?: Record<string, string> };
    } catch {
      return null;
    }
  };
  for (const el of mapasDeImport) {
    const mapa = lerMapa(el);
    Object.values(mapa?.imports ?? {}).forEach((u) => {
      // Entradas que terminam em "/" são pastas: os arquivos delas aparecem pelos imports dos scripts.
      if (!u.endsWith("/")) enfileirar(resolver(u, baseUrl));
    });
  }
  // Nomes curtos do import map (ex.: "three/addons/") viram o endereço de verdade.
  const prefixos: [string, string][] = [];
  for (const el of mapasDeImport) {
    for (const [chave, alvo] of Object.entries(lerMapa(el)?.imports ?? {})) {
      if (chave.endsWith("/") && alvo.endsWith("/")) {
        const abs = resolver(alvo, baseUrl);
        if (abs) prefixos.push([chave, abs]);
      }
    }
  }
  const viaMapa = (texto: string) => {
    const achados: string[] = [];
    for (const [chave, abs] of prefixos) {
      const chaveEsc = chave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        String.raw`["'\x60]` + chaveEsc + String.raw`([^"'\x60\s]+?\.m?js)["'\x60]`,
        "g",
      );
      for (const m of texto.matchAll(re)) {
        const u = resolver(m[1] ?? "", abs);
        if (u) achados.push(u);
      }
    }
    return achados;
  };
  // Arquivos citados nos scripts escritos dentro da própria página.
  for (const el of scriptsNaPagina) {
    const texto = el.textContent || "";
    viaMapa(texto).forEach(enfileirar);
    const doMapa = new Set(prefixos.map(([k]) => k));
    urlsDoJs(texto, baseUrl, origem, ehNext, baseUrl)
      .filter((u) => ![...doMapa].some((k) => u.startsWith(new URL(k, baseUrl).toString())))
      .forEach(enfileirar);
  }

  // ---------- Download (com descoberta dentro de CSS e JS) ----------
  const arquivos: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  const local = new Map<string, string>();
  const textos = new Map<string, { url: string; caminho: string; tipo: "css" | "js" }>();
  let falhas = 0;
  let totalBytes = 0;
  let feitos = 0;
  let deScripts = 0;
  const doHtml = fila.length;

  while (fila.length && local.size < MAX_ARQUIVOS && totalBytes < MAX_TOTAL_BYTES) {
    const lote = fila.splice(0, LOTE);
    const resultados = await fetchAssets({ data: { urls: lote } });
    for (const r of resultados) {
      feitos++;
      if (!r.ok) {
        falhas++;
        continue;
      }
      const bytes = fromBase64(r.base64);
      totalBytes += bytes.byteLength;
      let caminho = caminhoLocal(r.url, pagina.host, r.type);
      // Evita dois arquivos diferentes no mesmo caminho.
      if (arquivos[caminho]) caminho = caminho.replace(/(\.[^./]+)?$/, `-${hash8(r.url)}$1`);
      local.set(r.url, caminho);
      arquivos[caminho] = [bytes, { level: JA_COMPRIMIDO.test(caminho) ? 0 : 6 }];

      const ehCss = r.type === "text/css" || /\.css$/i.test(caminho);
      const ehJs = /javascript/.test(r.type) || /\.(m?js)$/i.test(caminho);
      if (ehCss || ehJs) {
        const texto = new TextDecoder().decode(bytes);
        textos.set(r.url, { url: r.url, caminho, tipo: ehCss ? "css" : "js" });
        const novos = ehCss ? urlsDoCss(texto, r.url) : urlsDoJs(texto, r.url, origem, ehNext);
        const antes = vistos.size;
        novos.forEach(enfileirar);
        if (ehJs) deScripts += vistos.size - antes;
      }
    }
    onProgress?.(feitos, Math.max(feitos + fila.length, doHtml));
  }
  const pulados = fila.length;

  // ---------- Reescreve os CSS para apontar para os arquivos locais ----------
  for (const t of textos.values()) {
    if (t.tipo !== "css") continue;
    const entrada = arquivos[t.caminho];
    if (!entrada) continue;
    const texto = new TextDecoder().decode(entrada[0]);
    arquivos[t.caminho] = [
      new TextEncoder().encode(reescreverCss(texto, t.url, t.caminho, local)),
      { level: 6 },
    ];
  }

  // ---------- Reescreve o HTML ----------
  const paraLocal = (raw: string) => {
    const abs = resolver(raw, baseUrl);
    if (!abs) return raw;
    const l = local.get(abs);
    return l ? relativo(paginaLocal, l) : abs;
  };
  for (const r of refs) {
    if (r.tipo === "styletag") {
      r.el.textContent = reescreverCss(r.el.textContent || "", baseUrl, paginaLocal, local);
      continue;
    }
    const valor = r.el.getAttribute(r.attr) || "";
    if (r.tipo === "srcset") {
      r.el.setAttribute(
        r.attr,
        valor
          .split(",")
          .map((p) => {
            const [u = "", ...resto] = p.trim().split(/\s+/);
            return [paraLocal(u), ...resto].join(" ");
          })
          .join(", "),
      );
    } else if (r.tipo === "style") {
      r.el.setAttribute(r.attr, reescreverCss(valor, baseUrl, paginaLocal, local));
    } else {
      r.el.setAttribute(r.attr, paraLocal(valor));
    }
  }
  // Import maps apontando para as cópias locais (pastas também, quando houver arquivos baixados nelas).
  for (const el of mapasDeImport) {
    const mapa = lerMapa(el);
    if (!mapa?.imports) continue;
    for (const [chave, alvo] of Object.entries(mapa.imports)) {
      const abs = resolver(alvo, baseUrl);
      if (!abs) continue;
      if (alvo.endsWith("/")) {
        const temArquivo = [...local.keys()].some((u) => u.startsWith(abs));
        const pasta = caminhoLocal(abs + "x", pagina.host).replace(/x$/, "");
        mapa.imports[chave] = temArquivo ? deLaPara(pasta) : abs;
      } else {
        const l = local.get(abs);
        mapa.imports[chave] = l ? deLaPara(l) : abs;
      }
    }
    el.textContent = JSON.stringify(mapa, null, 2);
  }

  // Links continuam funcionando, apontando para o site original.
  doc.querySelectorAll("a[href]").forEach((a) => {
    const abs = resolver(a.getAttribute("href") || "", baseUrl);
    if (abs) a.setAttribute("href", abs);
  });

  arquivos[paginaLocal] = [
    new TextEncoder().encode("<!DOCTYPE html>\n" + doc.documentElement.outerHTML),
    { level: 6 },
  ];
  if (paginaLocal !== "index.html" && !arquivos["index.html"]) {
    // Atalho na raiz que abre a página no lugar certo.
    arquivos["index.html"] = [
      new TextEncoder().encode(
        `<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${paginaLocal}"><a href="${paginaLocal}">Abrir o site</a>`,
      ),
      { level: 6 },
    ];
  }
  arquivos["LEIA-ME.txt"] = [new TextEncoder().encode(LEIA_ME), { level: 6 }];

  const { zipSync } = await import("fflate");
  const zipped = zipSync(arquivos);
  return {
    blob: new Blob([zipped as BlobPart], { type: "application/zip" }),
    saved: local.size,
    failed: falhas,
    skipped: pulados,
    fromScripts: deScripts,
  };
}
