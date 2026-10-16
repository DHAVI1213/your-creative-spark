'use strict';
/* global Zip */
// Monta a cópia do site: busca a página (ou várias), baixa todos os arquivos e gera o .zip ou o .html único.

const qs = new URLSearchParams(location.search);
const OPC = {
  tab: Number(qs.get('tab')),
  modo: qs.get('modo') || 'visual',          // visual | completo
  paginas: Math.max(1, Math.min(30, Number(qs.get('paginas')) || 1)),
  formato: qs.get('formato') || 'zip',       // zip | unico | lovable (só no visual)
  rolar: qs.get('rolar') !== '0',
  cdp: qs.get('cdp') !== '0'                 // gravação avançada de rede (só na cópia completa)
};
const $ = (s) => document.querySelector(s);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- tela de progresso
function log(txt, tipo = '') {
  const li = document.createElement('li');
  li.textContent = txt;
  if (tipo) li.className = tipo;
  $('#log').appendChild(li);
  li.scrollIntoView({ block: 'nearest' });
}
function etapa(txt) { $('#etapa').textContent = txt; }
function barra(f) { $('#barra i').style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; }

// ---------------------------------------------------------------- utilidades
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
const abs = (u, base) => { try { return new URL(u, base).href; } catch (_) { return null; } };
const semHash = (u) => u.split('#')[0];
const EXT_TIPO = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/avif': '.avif', 'image/svg+xml': '.svg',
  'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico', 'font/woff2': '.woff2', 'font/woff': '.woff', 'font/ttf': '.ttf', 'font/otf': '.otf',
  'application/font-woff': '.woff', 'text/css': '.css', 'text/javascript': '.js', 'application/javascript': '.js', 'application/json': '.json',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3', 'model/gltf-binary': '.glb', 'model/gltf+json': '.gltf', 'application/wasm': '.wasm', 'text/html': '.html'
};
const TEXTO = /\.(html?|css|m?js|cjs|json|svg|xml|txt|webmanifest|map)$/i;
function extDe(url, tipo) {
  try {
    const p = new URL(url).pathname;
    const m = p.match(/\.([a-z0-9]{1,6})$/i);
    if (m) return '.' + m[1].toLowerCase();
  } catch (_) {}
  const t = (tipo || '').split(';')[0].trim().toLowerCase();
  return EXT_TIPO[t] || '';
}
function pastaDe(ext) {
  if (/\.(woff2?|ttf|otf|eot)$/.test(ext)) return 'fontes';
  if (/\.(css)$/.test(ext)) return 'css';
  if (/\.(mp4|webm|mov|mp3|wav|ogg)$/.test(ext)) return 'midia';
  if (/\.(m?js|json|wasm)$/.test(ext)) return 'js';
  if (/\.(glb|gltf|bin|hdr|exr|ktx2|obj|fbx)$/.test(ext)) return 'modelos';
  return 'img';
}
function limpaNome(s) {
  return (s || 'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'arquivo';
}
function nomeSite(url) {
  try { return limpaNome(new URL(url).hostname.replace(/^www\./, '')); } catch (_) { return 'site'; }
}
function paraDataURL(bytes, tipo) {
  let bin = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return `data:${tipo || 'application/octet-stream'};base64,${btoa(bin)}`;
}
const decod = (bytes) => new TextDecoder('utf-8').decode(bytes);
const codif = (txt) => new TextEncoder().encode(txt);

// ---------------------------------------------------------------- downloads (com limite de conexões)
const cacheBaixados = new Map(); // url -> Promise<{ok, bytes, tipo, url}>
function baixa(url) {
  if (cacheBaixados.has(url)) return cacheBaixados.get(url);
  const p = (async () => {
    if (url.startsWith('data:')) {
      try { const r = await fetch(url); return { ok: true, bytes: await r.arrayBuffer(), tipo: r.headers.get('content-type'), url }; } catch (_) { return { ok: false, url }; }
    }
    if (!/^https?:/i.test(url)) return { ok: false, url };
    await vaga();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      let r = await fetch(url, { credentials: 'include', signal: ctrl.signal, cache: 'force-cache' }).catch(() => null);
      if (!r || !r.ok) r = await fetch(url, { credentials: 'omit', signal: ctrl.signal }).catch(() => null);
      if (!r || !r.ok) {
        // o download direto falhou (cookie, link assinado...): usa a cópia que o Chrome guardou quando o site pediu
        const alt = await GravadorRede.corpo(url).catch(() => null);
        if (alt) return { ok: true, bytes: alt.bytes, tipo: alt.tipo, url };
        return { ok: false, url, status: r && r.status };
      }
      return { ok: true, bytes: await r.arrayBuffer(), tipo: r.headers.get('content-type') || '', url: r.url || url };
    } catch (_) {
      return { ok: false, url };
    } finally {
      clearTimeout(t);
      libera();
    }
  })();
  cacheBaixados.set(url, p);
  return p;
}
let ativos = 0;
const filaEspera = [];
const vaga = () => (ativos < 6 ? (ativos++, Promise.resolve()) : new Promise((r) => filaEspera.push(r)));
const libera = () => { ativos--; if (filaEspera.length) { ativos++; filaEspera.shift()(); } };

// ---------------------------------------------------------------- captura das páginas
async function injetaCaptura(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['captura.js'] });
}
async function capturaAba(tabId, rolar) {
  await injetaCaptura(tabId);
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: (o) => window.__capturaPagina(o), args: [{ rolar }] });
  if (OPC.modo === 'completo') {
    await esperaDados(tabId, 1500);
    const [{ result: resp }] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: () => window.__copiadorRespostas || null });
    result.respostas = resp || [];
    result.gravou = !!resp;
  }
  return result;
}
// espera o site terminar de buscar os dados (cardápio, produtos...) — para quando fica um tempo sem nada novo
async function esperaDados(tabId, minimo = 2500, maximo = 25000) {
  const t0 = Date.now();
  let ultimo = -1, parado = 0;
  while (Date.now() - t0 < maximo) {
    await espera(700);
    let n = 0;
    try {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: () => (window.__copiadorRespostas || []).length + performance.getEntriesByType('resource').length });
      n = result;
    } catch (_) { return; }
    parado = n === ultimo ? parado + 1 : 0;
    ultimo = n;
    if (parado >= 3 && Date.now() - t0 >= minimo) return;
  }
}
// roda na página: clica nas categorias/sanfonas fechadas (sem seguir links) uma por uma
async function abreFechados() {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const fora = (el) => el.closest('a[href], header, nav, footer, form, [role="dialog"], #copiador-editor-raiz');
  const alvos = [];
  document.querySelectorAll('details:not([open])').forEach((d) => { if (!fora(d)) { d.open = true; alvos.push(null); } });
  document.querySelectorAll('[data-toggle="off"], [data-state="closed"], [aria-expanded="false"]').forEach((el) => {
    if (fora(el) || el.getAttribute('aria-haspopup')) return;
    const clicar = el.matches('[aria-expanded]') ? el : (el.querySelector('button, [role="button"], h2, h3, h4') || el.firstElementChild || el);
    if (clicar && !fora(clicar) && clicar.getBoundingClientRect().height > 0) alvos.push(clicar);
  });
  const y = scrollY;
  let n = 0;
  for (const el of alvos.slice(0, 80)) {
    if (!el) { n++; continue; }
    try {
      el.scrollIntoView({ block: 'center' });
      el.click();
      n++;
      await espera(350);
    } catch (_) {}
  }
  scrollTo(0, y);
  return n;
}
async function lerEdicoes(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: () => window.__copiadorEdicoes || null });
    return result;
  } catch (_) { return null; }
}
function esperaCarregar(tabId) {
  return new Promise((ok) => {
    let feito = false;
    const fim = () => { if (feito) return; feito = true; chrome.tabs.onUpdated.removeListener(ouvir); ok(); };
    const ouvir = (id, info) => { if (id === tabId && info.status === 'complete') fim(); };
    chrome.tabs.onUpdated.addListener(ouvir);
    chrome.tabs.get(tabId).then((t) => t.status === 'complete' && fim()).catch(fim);
    setTimeout(fim, 30000);
  });
}
async function capturaURL(url) {
  const tab = await chrome.tabs.create({ url, active: true });
  try {
    await esperaCarregar(tab.id);
    await espera(1800);
    return await capturaAba(tab.id, OPC.rolar);
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}
const IGNORA_LINK = /\.(pdf|zip|rar|7z|jpe?g|png|gif|webp|svg|mp4|mp3|docx?|xlsx?|pptx?)$/i;
function linksInternos(html, base) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const origem = new URL(base).origin;
  const out = [];
  doc.querySelectorAll('a[href]').forEach((a) => {
    const h = a.getAttribute('href');
    if (!h || /^(mailto:|tel:|javascript:|#)/i.test(h)) return;
    const u = abs(h, base);
    if (!u) return;
    const url = new URL(u);
    if (url.origin !== origem || IGNORA_LINK.test(url.pathname)) return;
    out.push(semHash(url.href));
  });
  return [...new Set(out)];
}

// fotos de canvas 3D (WebGL) que não deixam ler os pixels: tira um print da área na própria aba
async function printDosCanvas(tabId, cap) {
  const faltam = (cap.fotosCanvas || []).map((c, i) => ({ ...c, i })).filter((c) => !c.url && c.w > 40 && c.h > 40).slice(0, 8);
  if (!faltam.length) return;
  const eu = await chrome.tabs.getCurrent();
  const alvo = await chrome.tabs.get(tabId);
  try {
    await chrome.tabs.update(tabId, { active: true });
    await espera(500);
    for (const c of faltam) {
      const [{ result: r }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (idx) => {
          const cv = document.querySelectorAll('canvas')[idx];
          if (!cv) return null;
          cv.scrollIntoView({ block: 'center' });
          const b = cv.getBoundingClientRect();
          return { x: b.left, y: b.top, w: b.width, h: b.height, dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight };
        },
        args: [c.i]
      });
      if (!r) continue;
      await espera(700);
      const dataUrl = await chrome.tabs.captureVisibleTab(alvo.windowId, { format: 'png' }).catch(() => null);
      if (!dataUrl) continue;
      const img = await createImageBitmap(await (await fetch(dataUrl)).blob());
      const k = img.width / r.vw;
      const x = Math.max(0, r.x * k), y = Math.max(0, r.y * k);
      const w = Math.min(img.width - x, r.w * k), h = Math.min(img.height - y, r.h * k);
      if (w < 10 || h < 10) continue;
      const oc = new OffscreenCanvas(Math.round(w), Math.round(h));
      oc.getContext('2d').drawImage(img, x, y, w, h, 0, 0, oc.width, oc.height);
      const blob = await oc.convertToBlob({ type: 'image/png' });
      cap.fotosCanvas[c.i].url = paraDataURL(await blob.arrayBuffer(), 'image/png');
      log(`Print do 3D/canvas ${c.i + 1} salvo como imagem`);
    }
  } finally {
    if (eu) await chrome.tabs.update(eu.id, { active: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------- CSS: acha e troca url(...) e @import
const RX_URL = /url\(\s*(['"]?)([^'")]+?)\1\s*\)/gi;
const RX_IMPORT = /@import\s+(?:url\()?\s*(['"])([^'"]+)\1\s*\)?/gi;
function urlsDoCSS(css, base) {
  const out = [];
  let m;
  RX_URL.lastIndex = 0;
  while ((m = RX_URL.exec(css))) { const u = m[2].trim(); if (!u.startsWith('data:') && !u.startsWith('#')) { const a = abs(u, base); if (a) out.push(a); } }
  RX_IMPORT.lastIndex = 0;
  while ((m = RX_IMPORT.exec(css))) { const a = abs(m[2], base); if (a) out.push(a); }
  return out;
}
function trocaNoCSS(css, base, mapa) {
  return css
    .replace(RX_URL, (tudo, q, u) => {
      const a = abs(u.trim(), base);
      return a && mapa(a) ? `url("${mapa(a)}")` : tudo;
    })
    .replace(RX_IMPORT, (tudo, q, u) => {
      const a = abs(u, base);
      return a && mapa(a) ? `@import url("${mapa(a)}")` : tudo;
    });
}

// ---------------------------------------------------------------- cores (troca feita no modo edição)
function hexParaRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function trocaCores(txt, cores) {
  if (!cores || !cores.length) return txt;
  for (const [antiga, nova] of cores) {
    const [r, g, b] = hexParaRgb(antiga);
    const [nr, ng, nb] = hexParaRgb(nova);
    const h6 = antiga.replace('#', '').toLowerCase();
    const curto = h6[0] === h6[1] && h6[2] === h6[3] && h6[4] === h6[5] ? h6[0] + h6[2] + h6[4] : null;
    txt = txt.replace(new RegExp(`#${h6}(?![0-9a-f])`, 'gi'), nova);
    if (curto) txt = txt.replace(new RegExp(`#${curto}(?![0-9a-f])`, 'gi'), nova);
    txt = txt.replace(new RegExp(`rgb(a?)\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*([,)])`, 'gi'), (t, a, fim) => `rgb${a}(${nr}, ${ng}, ${nb}${fim}`);
    txt = txt.replace(new RegExp(`rgb(a?)\\(\\s*${r}\\s+${g}\\s+${b}\\s*([/)])`, 'gi'), (t, a, fim) => `rgb${a}(${nr} ${ng} ${nb}${fim === '/' ? ' /' : ')'}`);
  }
  return txt;
}
function aplicaTextos(txt, pares) {
  for (const [a, b] of pares || []) if (a && a.length >= 2 && a !== b) txt = txt.split(a).join(b);
  return txt;
}

// ================================================================= MODO VISUAL
async function copiaVisual(paginas, zip, unico) {
  const arquivos = new Map(); // url absoluta -> {caminho, promessa}
  const ehUnico = unico;
  const edicoes = paginas[0].edicoes || {};
  const nomesUsados = new Set();

  function caminhoPara(url, ext) {
    const base = limpaNome(decodeURIComponent((new URL(url).pathname.split('/').pop() || 'arquivo')).replace(/\.[a-z0-9]{1,6}$/i, ''));
    let nome = `${pastaDe(ext)}/${base}-${hash(url).slice(0, 6)}${ext}`;
    while (nomesUsados.has(nome)) nome = nome.replace(/(\.[a-z0-9]+)?$/i, `-${nomesUsados.size}$1`);
    nomesUsados.add(nome);
    return nome;
  }
  // registra um arquivo para baixar e devolve como ele será referenciado
  const registro = new Map();
  async function registra(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return null;
    if (registro.has(url)) return registro.get(url);
    const p = (async () => {
      const r = await baixa(url);
      if (!r.ok) { log(`Não baixou: ${url}`, 'aviso'); return null; }
      const ext = extDe(r.url || url, r.tipo) || '.bin';
      if (ext === '.css') {
        let css = decod(r.bytes);
        const filhos = urlsDoCSS(css, r.url || url);
        const mapa = new Map();
        await Promise.all(filhos.map(async (f) => mapa.set(f, await registra(f))));
        const dentro = (a) => {
          const ref = mapa.get(a);
          if (!ref) return null;
          return ehUnico ? ref : '../' + ref;
        };
        css = trocaNoCSS(css, r.url || url, dentro);
        css = trocaCores(css, edicoes.cores);
        if (ehUnico) return { css, inline: true };
        const caminho = caminhoPara(url, '.css');
        zip.adiciona(caminho, css);
        return caminho;
      }
      if (ehUnico) return paraDataURL(r.bytes, (r.tipo || '').split(';')[0] || 'application/octet-stream');
      const caminho = caminhoPara(url, ext);
      zip.adiciona(caminho, r.bytes);
      return caminho;
    })();
    registro.set(url, p);
    return p;
  }

  const nomesPagina = new Map();
  paginas.forEach((pg, i) => {
    if (i === 0) return nomesPagina.set(semHash(pg.url), 'index.html');
    const p = new URL(pg.url).pathname.replace(/\/$/, '').split('/').filter(Boolean).join('-') || `pagina-${i}`;
    nomesPagina.set(semHash(pg.url), limpaNome(p).replace(/\.html?$/i, '') + '.html');
  });

  let feitas = 0;
  for (const pg of paginas) {
    etapa(`Montando ${nomesPagina.get(semHash(pg.url))}…`);
    const doc = new DOMParser().parseFromString(pg.html, 'text/html');
    const base = pg.url;

    // tira o que não funciona numa cópia estática (scripts, rastreadores, segurança do site original)
    doc.querySelectorAll('script, noscript[data-copiador-skip], link[rel="modulepreload"], link[rel="preload"][as="script"], link[rel="prefetch"], link[rel="dns-prefetch"], link[rel="preconnect"], base, meta[http-equiv="Content-Security-Policy" i]').forEach((n) => n.remove());
    doc.querySelectorAll('*').forEach((el) => {
      for (const at of [...el.attributes]) if (/^on[a-z]+$/i.test(at.name)) el.removeAttribute(at.name);
    });
    // canvas (gráficos/3D) vira a imagem do que estava na tela
    doc.querySelectorAll('canvas[data-copiador-canvas]').forEach((cv) => {
      const f = (pg.fotosCanvas || [])[Number(cv.getAttribute('data-copiador-canvas'))];
      if (!f || !f.url) return;
      const img = doc.createElement('img');
      for (const at of cv.attributes) if (!/^(width|height|data-copiador-canvas)$/.test(at.name)) img.setAttribute(at.name, at.value);
      img.setAttribute('src', f.url);
      img.setAttribute('alt', '');
      img.style.width = (img.style.width || f.w + 'px');
      img.style.height = (img.style.height || f.h + 'px');
      img.style.objectFit = 'cover';
      img.style.display = img.style.display || 'block';
      cv.replaceWith(img);
    });

    const tarefas = [];
    const troca = (el, attr) => {
      const v = el.getAttribute(attr);
      if (!v) return;
      const u = abs(v.trim(), base);
      if (!u) return;
      tarefas.push(registra(u).then((ref) => { if (ref && typeof ref === 'string') el.setAttribute(attr, ref); else if (!ref) el.setAttribute(attr, u); }));
    };
    const trocaSrcset = (el, attr) => {
      const v = el.getAttribute(attr);
      if (!v) return;
      const partes = v.split(/,\s+(?=\S)/).map((p) => p.trim()).filter(Boolean);
      tarefas.push(Promise.all(partes.map(async (p) => {
        const [u, ...resto] = p.split(/\s+/);
        const a = abs(u, base);
        const ref = a && (await registra(a));
        return [typeof ref === 'string' ? ref : a || u, ...resto].join(' ');
      })).then((novas) => el.setAttribute(attr, novas.join(', '))));
    };
    doc.querySelectorAll('img[src], video[src], audio[src], source[src], input[type="image"][src], embed[src], track[src]').forEach((el) => troca(el, 'src'));
    doc.querySelectorAll('video[poster]').forEach((el) => troca(el, 'poster'));
    doc.querySelectorAll('img[srcset], source[srcset]').forEach((el) => trocaSrcset(el, 'srcset'));
    doc.querySelectorAll('img[data-src], img[data-lazy-src]').forEach((el) => { if (!el.getAttribute('src')) el.setAttribute('src', el.getAttribute('data-src') || el.getAttribute('data-lazy-src')); troca(el, 'src'); });
    doc.querySelectorAll('image[href], image[xlink\\:href], use[href^="http"], use[href^="/"]').forEach((el) => { troca(el, el.hasAttribute('href') ? 'href' : 'xlink:href'); });
    doc.querySelectorAll('link[href]').forEach((el) => {
      const rel = (el.getAttribute('rel') || '').toLowerCase();
      if (/stylesheet/.test(rel)) {
        const u = abs(el.getAttribute('href'), base);
        tarefas.push(registra(u).then((ref) => {
          if (ref && ref.inline) { const st = doc.createElement('style'); st.textContent = ref.css; el.replaceWith(st); }
          else if (ref) el.setAttribute('href', ref);
          else el.setAttribute('href', u);
        }));
        el.removeAttribute('integrity');
      } else if (/icon|apple-touch|mask-icon/.test(rel)) troca(el, 'href');
      else if (/preload/.test(rel)) el.remove();
    });
    // estilos dentro da página e no atributo style
    doc.querySelectorAll('style').forEach((st) => {
      const css = st.textContent;
      const urls = urlsDoCSS(css, base);
      tarefas.push(Promise.all(urls.map(async (u) => [u, await registra(u)])).then((pares) => {
        const m = new Map(pares);
        st.textContent = trocaCores(trocaNoCSS(css, base, (a) => { const r = m.get(a); return typeof r === 'string' ? r : null; }), edicoes.cores);
      }));
    });
    doc.querySelectorAll('[style*="url("]').forEach((el) => {
      const css = el.getAttribute('style');
      const urls = urlsDoCSS(css, base);
      tarefas.push(Promise.all(urls.map(async (u) => [u, await registra(u)])).then((pares) => {
        const m = new Map(pares);
        el.setAttribute('style', trocaNoCSS(css, base, (a) => { const r = m.get(a); return typeof r === 'string' ? r : null; }));
      }));
    });
    // links: páginas copiadas apontam para o arquivo local; o resto vai para o endereço original
    doc.querySelectorAll('a[href]').forEach((a) => {
      const h = a.getAttribute('href');
      if (!h || /^(mailto:|tel:|javascript:|#)/i.test(h)) return;
      const u = abs(h, base);
      if (!u) return;
      const local = nomesPagina.get(semHash(u));
      a.setAttribute('href', local ? local + (u.includes('#') ? '#' + u.split('#')[1] : '') : u);
    });
    doc.querySelectorAll('form[action]').forEach((f) => { const u = abs(f.getAttribute('action'), base); if (u) f.setAttribute('action', u); });
    doc.querySelectorAll('[data-copiador-canvas]').forEach((n) => n.removeAttribute('data-copiador-canvas'));

    const total = tarefas.length;
    let ok = 0;
    await Promise.all(tarefas.map((t) => t.catch(() => {}).then(() => { ok++; barra((feitas + ok / Math.max(1, total)) / paginas.length); })));

    // marca da cópia (some ao editar o HTML) e charset
    if (!doc.querySelector('meta[charset]')) { const m = doc.createElement('meta'); m.setAttribute('charset', 'utf-8'); doc.head.prepend(m); }
    doc.documentElement.setAttribute('data-copia-de', base);
    let html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    html = trocaCores(html, edicoes.cores);
    if (ehUnico) return html;
    zip.adiciona(nomesPagina.get(semHash(pg.url)), html);
    feitas++;
    log(`Página pronta: ${nomesPagina.get(semHash(pg.url))}`, 'ok');
  }
  return null;
}

// rastreadores e dados pessoais que não devem ir para a cópia
const RASTREADOR = /(google-analytics|googletagmanager|analytics\.google|doubleclick|googleadservices|google\.com(\.\w+)?\/(measurement|ads|pagead)|facebook\.(com|net)\/(tr|signals|en_US\/fbevents)|connect\.facebook\.net|hotjar|clarity\.ms|analytics\.tiktok|segment\.(io|com)|sentry\.io|newrelic|nr-data|mixpanel|amplitude|\/\/apm\.)/i;
// dados de quem está copiando (pedidos, endereços, carteira...) nunca vão para a cópia
const PESSOAL = /\/(orders?|pedidos?|customers?|clientes?|address(es)?|enderecos?|profile|perfil|wallets?|carteira|payments?|pagamentos?|cards?|cartoes|favorites|favoritos|notifications?)(\/|\?|$)|[?&](customer_?id|user_?id|cliente_?id)=/i;
// chaves que guardam quem está logado (nome, e-mail, endereço, carrinho...)
const CHAVE_PESSOAL = /user|usuario|customer|cliente|profile|perfil|account|conta|address|endereco|cart|carrinho|order|pedido|wallet|carteira|login|logged/i;
const CHAVE_PRIVADA = /token|password|senha|secret|cookie|session|refresh/i;
function limpaPrivado(url, texto, tipo) {
  // tira login/senha/tokens de quem copiou; o resto (cardápio, preços, dados da loja) fica igual
  if (!/json/i.test(tipo)) return texto;
  const ehSessao = /\/(auth|oauth|session|login|signin|me)(\/|\?|$)/i.test(new URL(url).pathname);
  try {
    const limpa = (o) => {
      if (Array.isArray(o)) return o.map(limpa);
      if (o && typeof o === 'object') {
        for (const k of Object.keys(o)) {
          if (ehSessao && /^(user|usuario|profile|perfil|customer|cliente)$/i.test(k) && o[k] && typeof o[k] === 'object') o[k] = {};
          else if (CHAVE_PRIVADA.test(k) && (typeof o[k] === 'string' || typeof o[k] === 'number')) o[k] = 'copia-offline';
          else o[k] = limpa(o[k]);
        }
      }
      return o;
    };
    // sessão de login: a cópia sempre abre como visitante (sem nome, e-mail ou tokens)
    if (ehSessao) return '{}';
    const obj = JSON.parse(texto);
    // sessão de alguém logado: a cópia abre como visitante (sem nome, e-mail ou tokens)
    if (ehSessao && obj && typeof obj === 'object' && !Array.isArray(obj) &&
      Object.keys(obj).some((k) => /^(user|usuario|profile|perfil|customer|cliente)$/i.test(k) && obj[k] && typeof obj[k] === 'object' && Object.keys(obj[k]).length)) return '{}';
    return JSON.stringify(limpa(obj));
  } catch (_) { return ehSessao ? '{}' : texto; }
}

// ================================================================= MODO COMPLETO (com JavaScript, animações e 3D)
async function copiaCompleta(paginas, zip) {
  const origem = new URL(paginas[0].url).origin;
  const edicoes = paginas[0].edicoes || {};
  const rotas = {};
  const tipos = {}; // arquivos sem extensão: guarda o tipo original para o servidor
  const salvos = new Map(); // caminho -> {bytes|texto, ehTexto}
  const urlParaCaminho = new Map();

  const limpaCaminho = (p) => p.replace(/[<>:"|*?]/g, '_');
  function caminhoEspelho(url, ext, ehPagina) {
    const u = new URL(url);
    let p = decodeURIComponent(u.pathname);
    const prefixo = u.origin !== origem ? `/_ext/${u.host.replace(/:/g, '_')}` : '';
    p = prefixo + p;
    if (ehPagina) {
      if (p.endsWith('/')) p += 'index.html';
      else if (!/\.[a-z0-9]{1,6}$/i.test(p)) p += '/index.html';
    } else if (p.endsWith('/')) p += 'index' + (ext || '.html');
    if (u.search && !ehPagina) {
      const e = (p.match(/\.[a-z0-9]{1,6}$/i) || [''])[0] || ext;
      const novo = limpaCaminho(p.replace(/\.[a-z0-9]{1,6}$/i, '') + `__q${hash(u.search)}${e}`);
      rotas[prefixo + decodeURIComponent(u.pathname) + u.search] = novo;
      return novo;
    }
    return limpaCaminho(p);
  }

  // 1) lista tudo o que as páginas carregaram + o que está escrito no HTML
  const todas = new Set();
  for (const pg of paginas) {
    (pg.recursos || []).forEach((r) => { if (/^https?:/i.test(r.url)) todas.add(semHash(r.url)); });
    // vistos pela gravação avançada (inclui o que workers e iframes pediram)
    (pg.cdp || []).forEach((r) => { if (/^https?:/i.test(r.url)) todas.add(semHash(r.url)); });
  }
  // 2) HTML original de cada página (o JavaScript do site vai desenhar tudo de novo, como no original)
  etapa('Baixando as páginas originais…');
  const htmls = [];
  for (const pg of paginas) {
    const r = await baixa(semHash(pg.url));
    let html = r.ok ? decod(r.bytes) : pg.html;
    if (!r.ok) log(`Não deu para baixar o HTML original de ${pg.url}; usei a versão desenhada na tela.`, 'aviso');
    htmls.push({ pg, html });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('[src],[href],[poster],[srcset],[data-src]').forEach((el) => {
      ['src', 'href', 'poster', 'data-src'].forEach((at) => {
        const v = el.getAttribute(at);
        if (!v || el.tagName === 'A' || /^(mailto:|tel:|javascript:|#|data:)/i.test(v)) return;
        const u = abs(v, pg.url);
        if (u && /^https?:/i.test(u)) todas.add(semHash(u));
      });
      const ss = el.getAttribute('srcset');
      if (ss) ss.split(/,\s+(?=\S)/).forEach((p) => { const u = abs(p.trim().split(/\s+/)[0], pg.url); if (u) todas.add(semHash(u)); });
    });
    doc.querySelectorAll('style').forEach((st) => urlsDoCSS(st.textContent, pg.url).forEach((u) => todas.add(u)));
  }
  // páginas não entram como recurso
  const urlsPaginas = new Set(paginas.map((p) => semHash(p.url)));
  urlsPaginas.forEach((u) => todas.delete(u));
  // rastreadores (Google Analytics, Facebook Pixel...) não vão para a cópia
  [...todas].forEach((u) => { if (RASTREADOR.test(u) || PESSOAL.test(u) || /[?&]_rsc=/.test(u)) todas.delete(u); });

  // respostas de dados gravadas na aba (o site busca sozinho: cardápio, produtos, preços...)
  const respostas = new Map(); // chave -> resposta (fica a última)
  for (const pg of paginas) for (const r of pg.respostas || []) {
    if (RASTREADOR.test(r.url) || PESSOAL.test(r.url)) continue;
    respostas.set(`${r.metodo} ${semHash(r.url)} ${r.corpo}`, r);
  }
  for (const r of respostas.values()) {
    todas.delete(semHash(r.url));
    // imagens citadas dentro dos dados (fotos dos produtos que ainda não apareceram na tela)
    const achadas = r.texto.replace(/\\\//g, '/').match(/https?:\/\/[^\s"'<>()\\]+?\.(?:png|jpe?g|webp|gif|svg|avif)(?:\?[^\s"'<>()\\]*)?/gi) || [];
    const semProtocolo = r.texto.replace(/\\\//g, '/').match(/(?<=["'\s(])[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+\/[^\s"'<>()\\]+?\.(?:png|jpe?g|webp|gif|svg|avif)(?=["'\s)?])/gi) || [];
    for (const u of [...achadas, ...semProtocolo.map((x) => 'https://' + x)].slice(0, 800)) if (!RASTREADOR.test(u)) todas.add(semHash(u));
  }

  // 3) baixa tudo (e o que os CSS pedem: fontes, imagens de fundo)
  etapa('Baixando scripts, estilos, imagens, fontes e modelos 3D…');
  const fila = [...todas];
  let i = 0, falhas = 0;
  const falhasUrls = [];
  const vistos = new Set(fila);
  while (i < fila.length) {
    const lote = fila.slice(i, i + 24);
    i += lote.length;
    await Promise.all(lote.map(async (url) => {
      const r = await baixa(url);
      barra(i / Math.max(fila.length, 1));
      if (!r.ok) { falhas++; if (falhasUrls.length < 6) falhasUrls.push(url); return; }
      const ext = extDe(r.url || url, r.tipo);
      const ehHTML = /text\/html/.test(r.tipo || '') && !ext;
      const caminho = caminhoEspelho(url, ext, ehHTML);
      urlParaCaminho.set(url, caminho);
      const ehTexto = TEXTO.test(caminho) || /^(text\/|application\/(javascript|json|xml))/.test(r.tipo || '');
      salvos.set(caminho, { bytes: r.bytes, ehTexto, url });
      if (!/\.[a-z0-9]{1,6}$/i.test(caminho) && r.tipo) tipos[caminho] = r.tipo.split(';')[0].trim();
      if (/\.css$/i.test(caminho) || /text\/css/.test(r.tipo || '')) {
        urlsDoCSS(decod(r.bytes), r.url || url).forEach((f) => { if (!vistos.has(f)) { vistos.add(f); fila.push(f); } });
      }
    }));
    $('#contagem').textContent = `${salvos.size} arquivos`;
  }
  if (falhas) {
    log(`${falhas} arquivo(s) não puderam ser baixados (o site bloqueou ou não existem mais).`, 'aviso');
    falhasUrls.forEach((u) => log('   • ' + u.slice(0, 140), 'aviso'));
  }

  // 4) troca os endereços absolutos pelos locais dentro de HTML/CSS/JS
  const externos = [...urlParaCaminho.entries()].filter(([u]) => new URL(u).origin !== origem).sort((a, b) => b[0].length - a[0].length);
  const origemRx = new RegExp(origem.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/^https?:/, 'https?:') + '(?![\\w.:-])', 'g');
  const origemEsc = origem.replace(/\//g, '\\/');
  // além dos arquivos exatos, troca o endereço inteiro de cada servidor externo usado
  // (pega pastas de import map, URLs montadas pelo JavaScript, modelos 3D carregados depois, etc.)
  const escRx = (t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const hostsExternos = [...new Set([
    ...externos.map(([u]) => new URL(u).host),
    ...[...respostas.values()].map((r) => new URL(r.url)).filter((u) => u.origin !== origem).map((u) => u.host)
  ])].sort((a, b) => b.length - a.length);
  const regrasHost = hostsExternos.map((h) => {
    const local = `/_ext/${h.replace(/:/g, '_')}`;
    return {
      rx: new RegExp(`(?:https?:)?//${escRx(h)}(?![\\w.:-])`, 'g'),
      rxEsc: new RegExp(`(?:https?:)?\\\\/\\\\/${escRx(h)}(?![\\w.:-])`, 'g'),
      local, localEsc: local.replace(/\//g, '\\/')
    };
  });
  function trocaHosts(txt) {
    for (const r of regrasHost) txt = txt.replace(r.rx, r.local).replace(r.rxEsc, r.localEsc);
    return txt;
  }
  function reescreve(txt, ehHTML) {
    for (const [u, c] of externos) {
      if (txt.includes(u)) txt = txt.split(u).join(c);
      const esc = u.replace(/\//g, '\\/');
      if (txt.includes(esc)) txt = txt.split(esc).join(c.replace(/\//g, '\\/'));
    }
    if (ehHTML) {
      // links <a> para outros sites (Instagram, WhatsApp...) continuam apontando para fora
      const guardados = [];
      txt = txt.replace(/<a\b[^>]*>/gi, (m) => { guardados.push(m); return `\u0000A${guardados.length - 1}\u0000`; });
      txt = trocaHosts(txt);
      txt = txt.replace(/\u0000A(\d+)\u0000/g, (_, i) => guardados[+i]);
    } else txt = trocaHosts(txt);
    txt = txt.replace(origemRx, '');
    if (txt.includes(origemEsc)) txt = txt.split(origemEsc).join('');
    return txt;
  }
  // edições feitas no modo edição
  const ocultar = (edicoes.ocultar || []).length ? `\n<style data-copiador="ocultar">${edicoes.ocultar.map((s) => `${s}{display:none!important}`).join('\n')}</style>\n` : '';
  const imagensTrocadas = new Map((edicoes.imagens || []).map(([u, d]) => [semHash(u), d]));
  function aplicaEdicoes(txt, tipo) {
    if (tipo !== 'css') txt = aplicaTextos(txt, [...(edicoes.textos || []), ...(edicoes.links || [])]);
    txt = trocaCores(txt, edicoes.cores);
    return txt;
  }

  etapa('Ajustando os arquivos para funcionar no seu PC…');
  for (const [caminho, f] of salvos) {
    const url = f.url;
    if (imagensTrocadas.has(url)) {
      const d = imagensTrocadas.get(url);
      const bin = await (await fetch(d)).arrayBuffer();
      zip.adiciona(caminho.replace(/^\//, ''), bin);
      continue;
    }
    if (f.ehTexto) {
      let t = decod(f.bytes);
      t = reescreve(t, /\.html?$/i.test(caminho));
      t = aplicaEdicoes(t, /\.css$/i.test(caminho) ? 'css' : 'outro');
      zip.adiciona(caminho.replace(/^\//, ''), t);
    } else zip.adiciona(caminho.replace(/^\//, ''), f.bytes);
  }
  // respostas gravadas: cada uma vira um arquivo em /_dados e o servidor entrega no lugar do endereço original
  let nResp = 0;
  for (const r of respostas.values()) {
    const u = new URL(r.url);
    const local = (u.origin !== origem ? `/_ext/${u.host.replace(/:/g, '_')}` : '') + decodeURIComponent(u.pathname);
    const arquivo = `/_dados/${hash(r.metodo + ' ' + r.url + ' ' + r.corpo)}`;
    let t = limpaPrivado(r.url, r.texto, r.tipo);
    t = aplicaEdicoes(reescreve(t, false), 'outro');
    zip.adiciona(arquivo.slice(1), t);
    tipos[arquivo] = r.tipo.split(';')[0].trim() || 'application/json';
    const ehJson = /json/i.test(r.tipo);
    if (/x-component/i.test(r.tipo)) {
      // resposta "RSC" do Next.js: só é entregue quando o próprio site pede (cabeçalho RSC), nunca no lugar da página
      rotas[`RSC ${local}${u.search}`] = arquivo;
      if (!rotas[`RSC ${local}`]) rotas[`RSC ${local}`] = arquivo;
    } else if (/text\/html/i.test(r.tipo) && !u.search) {
      // páginas HTML buscadas pelo JavaScript: não substituem a página principal
    } else if (r.metodo === 'GET') {
      rotas[local + u.search] = arquivo;
      if (ehJson && !rotas[local]) rotas[local] = arquivo;
    } else {
      if (r.corpo) rotas[`${r.metodo} ${local}${u.search} #${hash(r.corpo)}`] = arquivo;
      rotas[`${r.metodo} ${local}${u.search}`] = arquivo;
      if (!rotas[`${r.metodo} ${local}`]) rotas[`${r.metodo} ${local}`] = arquivo;
    }
    nResp++;
  }
  if (nResp) log(`${nResp} arquivo(s) de dados do site incluídos (funcionam sem internet)`, 'ok');

  // o que o site guardava no navegador (cache de cardápio etc.) é colocado de volta ao abrir a cópia
  const sementes = { local: {}, sessao: {}, cookies: {} };
  const RASTRO_CHAVE = /^(_ga|_gcl|_gid|_fb|_ttp|_tt_|_hj|_clck|_clsk|_uet|amplitude|mp_|ajs_|intercom|__utm)/i;
  for (const pg of paginas) {
    const a = pg.armazenamento || {};
    for (const tipo of ['local', 'sessao']) {
      for (const [k, v] of Object.entries(a[tipo] || {})) {
        if (CHAVE_PRIVADA.test(k) || RASTRO_CHAVE.test(k) || CHAVE_PESSOAL.test(k)) continue;
        let val = v;
        if (/^\s*[[{]/.test(val)) val = limpaPrivado('https://x/dados', val, 'application/json');
        sementes[tipo][k] = aplicaEdicoes(reescreve(val, false), 'outro');
      }
    }
    // cookies que o próprio JavaScript do site lê (ex.: qual loja é). Tokens de acesso viram um valor falso.
    for (const [k, v] of Object.entries(a.cookies || {})) {
      if (RASTRO_CHAVE.test(k) || CHAVE_PESSOAL.test(k)) continue;
      if (/token|session|auth|csrf|jwt/i.test(k) && !/expir/i.test(k)) {
        // token do próprio site (não da pessoa): troca por um valor falso; se for um pacote de dados, não leva
        if (/^\s*(%7B|%5B|[{["])/i.test(v)) continue;
        sementes.cookies[k] = 'copia-offline';
      } else sementes.cookies[k] = v;
    }
  }
  const nSementes = Object.keys(sementes.local).length + Object.keys(sementes.sessao).length + Object.keys(sementes.cookies).length;
  // endereços montados pelo JavaScript na hora (ex.: "https://" + foto) também passam a apontar para a cópia
  const mapaHosts = {};
  hostsExternos.forEach((h) => { mapaHosts[h] = `/_ext/${h.replace(/:/g, '_')}`; });
  const scriptHosts = hostsExternos.length ? `<script data-copiador="enderecos">(function(){var H=${JSON.stringify(mapaHosts)};
function m(u){if(typeof u!=='string')return u;var x=u.match(/^(?:https?:)?\\/\\/([^\\/?#]+)(.*)$/i);if(x&&H[x[1]])return H[x[1]]+(x[2]||'/');return u;}
function ms(v){return typeof v==='string'?v.split(',').map(function(p){p=p.trim();var i=p.search(/\\s/);return i<0?m(p):m(p.slice(0,i))+p.slice(i);}).join(', '):v;}
var f=window.fetch;if(f)window.fetch=function(a,o){if(typeof a==='string')a=m(a);else if(a instanceof URL)a=m(a.href);else if(a&&a.url&&m(a.url)!==a.url)a=new Request(m(a.url),a);return f.call(this,a,o);};
var op=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(me,u){arguments[1]=m(u instanceof URL?u.href:u);return op.apply(this,arguments);};
var sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){var k=String(n).toLowerCase();if(k==='src'||k==='href'||k==='poster'||k==='data-src')v=m(v);else if(k==='srcset')v=ms(v);return sa.call(this,n,v);};
[[HTMLImageElement,'src'],[HTMLImageElement,'srcset'],[HTMLSourceElement,'src'],[HTMLSourceElement,'srcset'],[HTMLScriptElement,'src'],[HTMLLinkElement,'href'],[HTMLMediaElement,'src']].forEach(function(p){try{var d=Object.getOwnPropertyDescriptor(p[0].prototype,p[1]);if(!d||!d.set)return;Object.defineProperty(p[0].prototype,p[1],{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){d.set.call(this,p[1]==='srcset'?ms(v):m(v));}});}catch(e){}});
var sp=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(n,v,p){if(typeof v==='string'&&v.indexOf('url(')>-1)v=v.replace(/url\\((['"]?)([^'")]+)\\1\\)/g,function(a,q,u){return 'url('+q+m(u)+q+')';});return sp.call(this,n,v,p);};
})();</script>` : '';
  const scriptSemente = nSementes ? `<script data-copiador="dados">(function(){var D=${JSON.stringify(sementes).replace(/</g, '\\u003c')};function p(s,o){try{for(var k in o)if(s.getItem(k)===null)s.setItem(k,o[k]);}catch(e){}}p(localStorage,D.local);p(sessionStorage,D.sessao);try{for(var c in D.cookies)if(document.cookie.indexOf(c+'=')<0)document.cookie=c+'='+D.cookies[c]+'; path=/; max-age=31536000';}catch(e){}})();</script>` : '';
  if (nSementes) log(`${nSementes} dado(s) guardados pelo site no navegador incluídos na cópia`, 'ok');

  for (const { pg, html } of htmls) {
    let t = reescreve(html, true);
    // relógio da cópia começa na hora em que foi copiada (horário de funcionamento, validade de cache etc. continuam valendo)
    const t0 = Number(pg.capturadoEm || paginas[0].capturadoEm) || 0;
    const scriptRelogio = t0 ? `<script data-copiador="relogio">(function(){var R=Date,off=${t0}-R.now();function D(){if(!(this instanceof D))return new R(R.now()+off).toString();if(!arguments.length)return new R(R.now()+off);return new (Function.prototype.bind.apply(R,[null].concat([].slice.call(arguments))))();}D.prototype=R.prototype;D.now=function(){return R.now()+off};D.parse=R.parse;D.UTC=R.UTC;try{Object.setPrototypeOf(D,R)}catch(e){}window.Date=D;})();</script>` : '';
    const inicio = scriptRelogio + scriptHosts + scriptSemente;
    if (inicio) t = /<head[^>]*>/i.test(t) ? t.replace(/<head[^>]*>/i, (m) => m + inicio) : inicio + t;
    // tira travas que impedem rodar em outro endereço
    t = t.replace(/\sintegrity=("[^"]*"|'[^']*')/gi, '').replace(/<meta[^>]+http-equiv=["']?content-security-policy[^>]*>/gi, '');
    t = aplicaEdicoes(t, 'html');
    if (ocultar) t = t.replace(/<\/head>/i, ocultar + '</head>');
    const caminho = caminhoEspelho(semHash(pg.url), '.html', true);
    zip.adiciona(caminho.replace(/^\//, ''), t);
    log(`Página pronta: ${caminho}`, 'ok');
  }
  if (!salvos.has('/index.html') && !htmls.some(({ pg }) => caminhoEspelho(semHash(pg.url), '.html', true) === '/index.html')) {
    const primeiro = caminhoEspelho(semHash(paginas[0].url), '.html', true);
    zip.adiciona('index.html', `<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${primeiro}"><a href="${primeiro}">Abrir</a>`);
  }
  zip.adiciona('_rotas.json', JSON.stringify(rotas, null, 1));
  zip.adiciona('_tipos.json', JSON.stringify(tipos, null, 1));
  const [bat, ps1] = await Promise.all([fetch('ABRIR-SITE.bat').then((r) => r.text()), fetch('servidor.ps1').then((r) => r.text())]);
  zip.adiciona('ABRIR-SITE.bat', bat.replace(/\r?\n/g, '\r\n'));
  zip.adiciona('servidor.ps1', ps1.replace(/\r?\n/g, '\r\n'));
  zip.adiciona('LEIA-ME.txt', [
    'CÓPIA COMPLETA (com animações, JavaScript e 3D)',
    '',
    `Copiado de: ${paginas[0].url}`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    '',
    'COMO ABRIR NO SEU PC:',
    '  1. Extraia este .zip numa pasta.',
    '  2. Dê dois cliques em ABRIR-SITE.bat (abre o navegador sozinho).',
    '     Se o Windows avisar, clique em "Mais informações" > "Executar assim mesmo".',
    '  3. Para desligar, feche a janela preta.',
    '',
    'POR QUE NÃO ABRE COM DOIS CLIQUES NO index.html?',
    '  Sites com animações e 3D carregam arquivos pelo endereço (/assets/...).',
    '  O navegador só permite isso quando o site está num servidor, que é o que o ABRIR-SITE.bat faz.',
    '',
    'PARA COLOCAR NA INTERNET:',
    '  Arraste a pasta extraída no app.netlify.com/drop (pode apagar ABRIR-SITE.bat e servidor.ps1).',
    '',
    'LIMITES:',
    '  - Login, carrinho, pagamento e formulários dependem do servidor do site original.',
    '  - Partes que o site só carrega depois de cliques específicos podem faltar.'
  ].join('\r\n'));
}

// ================================================================= principal
async function principal() {
  try {
    const tabOrig = await chrome.tabs.get(OPC.tab);
    $('#site').textContent = tabOrig.url;
    $('#modo').textContent = OPC.modo === 'completo' ? 'Cópia completa (com animações e 3D)' : OPC.formato === 'unico' ? 'Cópia visual · HTML único' : OPC.formato === 'lovable' ? 'Cópia visual · projeto para Lovable/GitHub' : 'Cópia visual · pasta .zip';

    // a aba do site precisa ficar visível enquanto é lida: em segundo plano o Chrome pausa as animações e o carregamento
    const eu = await chrome.tabs.getCurrent();
    const voltaPraCa = () => eu && chrome.tabs.update(eu.id, { active: true }).catch(() => {});
    await chrome.tabs.update(OPC.tab, { active: true }).catch(() => {});
    let edicoes = null;
    if (OPC.modo === 'completo') {
      // recarrega a aba para gravar tudo o que o site busca ao abrir (cardápio, produtos, dados)
      edicoes = await lerEdicoes(OPC.tab);
      let redeLigada = false;
      if (OPC.cdp) {
        etapa('Ligando a gravação avançada de rede (workers, 3D)…');
        redeLigada = await GravadorRede.liga(OPC.tab);
        if (redeLigada) log('Gravação avançada ligada. O Chrome mostra a faixa "depurando este navegador" até o fim da cópia.', 'ok');
        else log(GravadorRede.aviso || 'Gravação avançada indisponível; sigo no modo normal.', 'aviso');
      }
      let gravando = false;
      try {
        const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: OPC.tab }, world: 'MAIN', func: () => !!window.__copiadorRespostas });
        gravando = result;
      } catch (_) {}
      if (!gravando || redeLigada) {
        // aba aberta antes da extensão (ou rede avançada ligada): recarrega para gravar tudo desde o começo
        etapa('Recarregando a página para gravar os dados do site…');
        await chrome.tabs.reload(OPC.tab, redeLigada ? { bypassCache: true } : undefined);
        await espera(400);
        await esperaCarregar(OPC.tab);
      }
      etapa('Esperando o site terminar de carregar os dados (cardápio, produtos…)…');
      await esperaDados(OPC.tab);
      // abre categorias e sanfonas fechadas para os produtos de dentro também serem gravados
      etapa('Abrindo categorias e seções fechadas para gravar os produtos…');
      let abertos = 0;
      try {
        const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: OPC.tab }, func: abreFechados });
        abertos = result || 0;
      } catch (_) {}
      if (abertos) {
        log(`${abertos} categoria(s)/seção(ões) fechadas abertas para gravar o conteúdo`, 'ok');
        await esperaDados(OPC.tab, 2000);
      }
    }
    etapa('Lendo a página…');
    const primeira = await capturaAba(OPC.tab, OPC.rolar);
    if (OPC.modo === 'completo') {
      primeira.edicoes = edicoes || primeira.edicoes;
      if (!primeira.gravou) log('Os dados do site não foram gravados. Recarregue a extensão em chrome://extensions, dê F5 no site e copie de novo.', 'aviso');
    }
    if (OPC.modo === 'completo' && GravadorRede.ligado) {
      primeira.cdp = GravadorRede.lista();
      const dosFilhos = primeira.cdp.filter((x) => x.worker).length;
      log(`Rede avançada: ${primeira.cdp.length} arquivos vistos${dosFilhos ? ` (${dosFilhos} pedidos por workers/iframes)` : ''}.`, 'ok');
    }
    log(`Página lida: ${primeira.titulo || primeira.url}`, 'ok');
    if (OPC.modo === 'visual') await printDosCanvas(OPC.tab, primeira).catch(() => {});
    const paginas = [primeira];

    if (OPC.paginas > 1) {
      const fila = linksInternos(primeira.html, primeira.url).filter((u) => semHash(u) !== semHash(primeira.url));
      const vistas = new Set([semHash(primeira.url)]);
      while (paginas.length < OPC.paginas && fila.length) {
        const u = fila.shift();
        if (vistas.has(u)) continue;
        vistas.add(u);
        etapa(`Abrindo página ${paginas.length + 1} de ${OPC.paginas}: ${u}`);
        try {
          const c = await capturaURL(u);
          c.edicoes = null;
          paginas.push(c);
          log(`Página lida: ${c.titulo || u}`, 'ok');
          linksInternos(c.html, c.url).forEach((l) => { if (!vistas.has(l)) fila.push(l); });
        } catch (e) {
          log(`Não abriu ${u}: ${e.message}`, 'aviso');
        }
        barra(paginas.length / OPC.paginas);
      }
    }

    voltaPraCa();
    const zip = new Zip();
    const nome = nomeSite(primeira.url);
    let blob, arquivo;
    if (OPC.modo === 'completo') {
      await copiaCompleta(paginas, zip);
      blob = zip.gera();
      arquivo = `copias-de-sites/${nome}-completo.zip`;
    } else if (OPC.formato === 'lovable') {
      const tmp = new Zip();
      await copiaVisual(paginas, tmp, false);
      etapa('Montando o projeto para a Lovable…');
      const r = CopiadorLovable.montaLovable(tmp, { url: primeira.url, paginas });
      r.paginas.forEach((p) => log(`Rota pronta: ${p.rota}  (src/routes/${p.rota === '/' ? 'index' : p.rota.slice(1)}.tsx)`, 'ok'));
      blob = r.zip.gera();
      arquivo = `copias-de-sites/${nome}-lovable.zip`;
      const gh = await chrome.storage.local.get(['ghOn', 'ghRepo', 'ghToken']);
      if (gh.ghOn) {
        etapa('Enviando para o GitHub…');
        try {
          const env = await CopiadorLovable.enviaGitHub({ repo: gh.ghRepo, token: gh.ghToken, mensagem: `feat: site copiado de ${new URL(primeira.url).hostname} com o Copiador de Sites` }, r.zip, { log, progresso: barra });
          log(`Enviado para o GitHub: ${env.arquivos} arquivos em ${env.repo} (${env.ramo}). A Lovable atualiza sozinha.`, 'ok');
          log(env.url, 'ok');
        } catch (e) {
          log('Não consegui enviar para o GitHub: ' + e.message, 'erro');
          log('O .zip foi salvo mesmo assim; envie os arquivos pelo site do GitHub (Add file > Upload files).', 'aviso');
        }
      }
    } else if (OPC.formato === 'unico') {
      const html = await copiaVisual(paginas.slice(0, 1), zip, true);
      blob = new Blob([html], { type: 'text/html' });
      arquivo = `copias-de-sites/${nome}.html`;
    } else {
      await copiaVisual(paginas, zip, false);
      zip.adiciona('LEIA-ME.txt', [
        'CÓPIA VISUAL',
        `Copiado de: ${primeira.url}`,
        `Data: ${new Date().toLocaleString('pt-BR')}`,
        '',
        'Extraia o .zip e dê dois cliques em index.html.',
        'Para editar: abra o index.html no Chrome, clique na extensão > Modo edição.',
        'Para colocar na internet: arraste a pasta no app.netlify.com/drop.'
      ].join('\r\n'));
      blob = zip.gera();
      arquivo = `copias-de-sites/${nome}.zip`;
    }
    await GravadorRede.desliga();
    etapa('Salvando…');
    barra(1);
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({ url, filename: arquivo, saveAs: false, conflictAction: 'uniquify' });
    const mb = (blob.size / 1048576).toFixed(1);
    etapa(`Pronto! ${arquivo.split('/').pop()} (${mb} MB) está na pasta Downloads › copias-de-sites.`);
    $('#fim').classList.remove('escondido');
    document.title = '✔ Cópia pronta';
  } catch (e) {
    GravadorRede.desliga();
    chrome.tabs.getCurrent().then((t) => t && chrome.tabs.update(t.id, { active: true })).catch(() => {});
    etapa('Deu erro: ' + (e && e.message ? e.message : e));
    log(String(e && e.stack ? e.stack : e), 'erro');
    document.title = '✖ Erro na cópia';
  }
}
principal();

document.getElementById('abrirPasta').onclick = async () => {
  const [d] = await chrome.downloads.search({ orderBy: ['-startTime'], limit: 1 });
  if (d) chrome.downloads.show(d.id);
};
