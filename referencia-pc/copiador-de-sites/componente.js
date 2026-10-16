'use strict';
// Modo "Copiar só um componente": o usuário passa o mouse, clica no pedaço do site (menu, card, hero,
// rodapé...) e a extensão exporta só aquele bloco, já com os estilos, fontes e imagens dentro.
(function () {
  if (window.__copiadorComponente) { window.__copiadorComponente.abre(); return; }

  const RAIZ_ID = 'copiador-comp-raiz';
  let host, caixa, rotulo, painel, sel = null, travado = false, pilhaFilhos = [], ativo = false;

  // ---------- propriedades que o navegador herda do elemento pai ----------
  const HERDADAS = new Set(['color', 'cursor', 'direction', 'font-family', 'font-size', 'font-style', 'font-variant', 'font-weight', 'font-stretch', 'font-kerning', 'font-feature-settings', 'font-variation-settings', 'font-optical-sizing', 'font-variant-ligatures', 'font-variant-numeric', 'font-variant-caps', 'font-size-adjust', 'letter-spacing', 'line-height', 'list-style-type', 'list-style-position', 'list-style-image', 'text-align', 'text-align-last', 'text-indent', 'text-transform', 'text-shadow', 'text-rendering', 'text-wrap', 'text-justify', 'white-space', 'word-break', 'word-spacing', 'overflow-wrap', 'hyphens', 'visibility', 'quotes', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'paint-order', 'shape-rendering', 'image-rendering', '-webkit-text-fill-color', '-webkit-text-stroke-color', '-webkit-text-stroke-width', 'tab-size', 'caret-color', 'accent-color', 'color-scheme', 'writing-mode', 'text-orientation', 'border-collapse', 'border-spacing', 'empty-cells', 'caption-side', 'pointer-events', 'color-interpolation', 'clip-rule', 'marker-start', 'marker-mid', 'marker-end', 'text-anchor', 'dominant-baseline']);
  // não vale a pena copiar: versões "lógicas" duplicadas, prefixos antigos e coisas que o navegador recalcula
  const PULA = /^(inline-size|block-size|min-inline-size|min-block-size|max-inline-size|max-block-size|perspective-origin|-webkit-(?!text-fill|text-stroke|background-clip|line-clamp|box-orient|mask|box-reflect|backdrop|font-smoothing)|.*-(inline|block)(-|$)|inset-inline.*|inset-block.*|interpolate-size|view-transition-name|anchor-name|position-anchor|position-area|position-try.*|-internal-.*|d|x|y|cx|cy|r|rx|ry|zoom|math-.*|app-region|-apple-.*)$/;

  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const abs = (u, base) => { try { return new URL(u, base || location.href).href; } catch (_) { return u; } };

  // ---------- iframe em branco: dá o estilo "de fábrica" de cada tag, para só copiarmos o que o site mudou ----------
  let ifr = null;
  const padroes = new Map();
  function padraoDe(el) {
    const at = el.getAttribute ? ['href', 'type', 'controls', 'open', 'multiple', 'size'].map((a) => (el.getAttribute(a) == null ? '' : a === 'href' ? 'h' : a + '=' + el.getAttribute(a))).join(',') : '';
    const chave = (el.namespaceURI || '') + '|' + el.localName + '|' + at;
    if (padroes.has(chave)) return padroes.get(chave);
    if (!ifr) {
      ifr = document.createElement('iframe');
      ifr.setAttribute('aria-hidden', 'true');
      ifr.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:800px;border:0;visibility:hidden';
      document.documentElement.appendChild(ifr);
      ifr.contentDocument.open(); ifr.contentDocument.write('<!doctype html><html><body></body></html>'); ifr.contentDocument.close();
    }
    const d = ifr.contentDocument;
    let n;
    try { n = d.createElementNS(el.namespaceURI, el.localName); } catch (_) { n = d.createElement('span'); }
    // o estilo padrão de alguns elementos depende de atributos (link sublinhado só com href, tipo do input...)
    ['href', 'type', 'controls', 'open', 'multiple', 'size'].forEach((a) => { if (el.getAttribute && el.getAttribute(a) != null) n.setAttribute(a, el.getAttribute(a)); });
    d.body.appendChild(n);
    const cs = d.defaultView.getComputedStyle(n);
    const o = {};
    for (let i = 0; i < cs.length; i++) o[cs[i]] = cs.getPropertyValue(cs[i]);
    padroes.set(chave, o);
    return o;
  }

  function estiloDe(cs, padrao, paiCs, forcaHerdadas) {
    const partes = [];
    for (let i = 0; i < cs.length; i++) {
      const p = cs[i];
      if (PULA.test(p)) continue;
      const v = cs.getPropertyValue(p);
      if (!v) continue;
      const herda = HERDADAS.has(p);
      if (herda && forcaHerdadas) { partes.push(p + ':' + v); continue; }
      if (herda && paiCs && paiCs.getPropertyValue(p) === v) continue; // já vem do pai
      if (padrao[p] === v) continue;
      if (p === 'transform-origin' && cs.getPropertyValue('transform') === 'none') continue;
      partes.push(p + ':' + v);
    }
    return partes.join(';');
  }

  // ---------- monta o componente ----------
  async function monta(el, opc) {
    const origens = [el];
    el.querySelectorAll('*').forEach((n) => origens.push(n));
    const clone = el.cloneNode(true);
    const clones = [clone];
    clone.querySelectorAll('*').forEach((n) => clones.push(n));
    if (origens.length !== clones.length) throw new Error('A estrutura mudou durante a cópia. Tente de novo.');

    const familias = new Set(), animacoes = new Set();
    const regrasPseudo = [];
    const remover = [];
    let contador = 0;
    const urls = new Set();
    const pegaUrls = (txt) => { (txt.match(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/g) || []).forEach((m) => { const u = m.replace(/^url\(\s*['"]?/, '').replace(/['"]?\s*\)$/, ''); if (!/^(data:|#)/.test(u)) urls.add(u); }); };

    const notaFontes = (cs) => {
      cs.getPropertyValue('font-family').split(',').forEach((f) => familias.add(f.trim().replace(/^["']|["']$/g, '').toLowerCase()));
      const an = cs.getPropertyValue('animation-name');
      if (an && an !== 'none') an.split(',').forEach((a) => animacoes.add(a.trim()));
    };

    for (let i = 0; i < origens.length; i++) {
      const o = origens[i], c = clones[i];
      const tag = o.localName;
      if (/^(script|noscript|link|style|template|iframe|object|embed|base|meta|title)$/.test(tag)) { if (i) remover.push(c); continue; }
      const cs = getComputedStyle(o);
      if (i && cs.display === 'none') { remover.push(c); continue; }
      const paiCs = i ? getComputedStyle(o.parentElement) : null;
      const padrao = padraoDe(o);
      notaFontes(cs);
      let css = estiloDe(cs, padrao, paiCs, i === 0);
      if (i === 0) css += (css ? ';' : '') + 'max-width:100%;box-sizing:' + cs.boxSizing;

      // atributos: tira classes (os estilos já vão dentro) e comandos da página
      [...c.attributes].forEach((a) => {
        const n = a.name.toLowerCase();
        if (n === 'class' || n === 'style' || n.startsWith('on') || n === 'srcset' || n === 'sizes' || n === 'loading' || n === 'integrity' || n === 'nonce' || n.startsWith('data-copiador')) c.removeAttribute(a.name);
      });
      ['href', 'src', 'poster', 'action'].forEach((a) => { if (c.hasAttribute(a) && !/^(data:|#|javascript:|mailto:|tel:|blob:)/i.test(c.getAttribute(a))) c.setAttribute(a, abs(c.getAttribute(a), o.baseURI)); });
      if (c.hasAttribute('xlink:href')) c.setAttribute('xlink:href', abs(c.getAttribute('xlink:href'), o.baseURI));

      if (tag === 'img') {
        const real = o.currentSrc || o.src;
        if (real && !real.startsWith('blob:')) c.setAttribute('src', real);
        else if (real && real.startsWith('blob:')) { try { const cv = document.createElement('canvas'); cv.width = o.naturalWidth; cv.height = o.naturalHeight; cv.getContext('2d').drawImage(o, 0, 0); c.setAttribute('src', cv.toDataURL('image/png')); } catch (_) {} }
      }
      if (tag === 'video') { if (o.currentSrc && !o.currentSrc.startsWith('blob:')) c.setAttribute('src', o.currentSrc); c.removeAttribute('autoplay'); }
      if (tag === 'source' && c.parentElement && /^(picture)$/i.test(c.parentElement.localName)) remover.push(c);
      if (tag === 'canvas') {
        try {
          const img = document.createElement('img');
          img.setAttribute('src', o.toDataURL('image/png'));
          img.setAttribute('data-copiador-troca', '1');
          img.width = o.clientWidth; img.height = o.clientHeight;
          c.replaceWith(img);
          clones[i] = img;
          img.setAttribute('style', css);
          pegaUrls(css);
          continue;
        } catch (_) { /* canvas protegido: segue com o canvas vazio */ }
      }
      if (tag === 'input' || tag === 'textarea') {
        if (o.type === 'password') c.removeAttribute('value');
        else if (tag === 'textarea') c.textContent = o.value;
        else if (o.type === 'checkbox' || o.type === 'radio') o.checked ? c.setAttribute('checked', '') : c.removeAttribute('checked');
        else if (o.value) c.setAttribute('value', o.value);
      }

      // ::before e ::after (ícones, linhas decorativas, selos...)
      ['::before', '::after'].forEach((ps) => {
        let pcs;
        try { pcs = getComputedStyle(o, ps); } catch (_) { return; }
        const cont = pcs.getPropertyValue('content');
        if (!cont || cont === 'none' || cont === 'normal') return;
        if (!c.hasAttribute('data-cp')) c.setAttribute('data-cp', 'cp' + (++contador));
        const span = { localName: 'span', namespaceURI: 'http://www.w3.org/1999/xhtml' };
        const regra = estiloDe(pcs, padraoDe(span), cs, false);
        notaFontes(pcs);
        pegaUrls(regra);
        regrasPseudo.push(`[data-cp="${c.getAttribute('data-cp')}"]${ps}{content:${cont};${regra}}`);
      });

      c.setAttribute('style', css);
      pegaUrls(css);
    }
    remover.forEach((n) => n.remove());
    // texto "preso" em comentários e atributos de rastreio não interessam
    const it = document.createNodeIterator(clone, NodeFilter.SHOW_COMMENT);
    const comentarios = []; let nn;
    while ((nn = it.nextNode())) comentarios.push(nn);
    comentarios.forEach((n) => n.remove());

    // fontes e animações usadas
    let extra = '';
    const visitaRegras = (regras, base) => {
      for (const r of regras) {
        try {
          if (r.type === CSSRule.FONT_FACE_RULE) {
            const fam = (r.style.getPropertyValue('font-family') || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
            if (!familias.has(fam)) continue;
            const t = r.cssText.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (m, q, u) => (/^(data:|#)/.test(u) ? m : `url("${abs(u, base)}")`));
            pegaUrls(t); extra += t + '\n';
          } else if (r.type === CSSRule.KEYFRAMES_RULE) {
            if (animacoes.has(r.name)) { const t = r.cssText.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (m, q, u) => (/^(data:|#)/.test(u) ? m : `url("${abs(u, base)}")`)); pegaUrls(t); extra += t + '\n'; }
          } else if (r.cssRules && (r.type === CSSRule.MEDIA_RULE || r.type === CSSRule.SUPPORTS_RULE)) visitaRegras(r.cssRules, base);
        } catch (_) {}
      }
    };
    for (const sh of [...document.styleSheets]) {
      try { visitaRegras(sh.cssRules, sh.href || location.href); } catch (_) {}
    }
    let css = (extra + regrasPseudo.join('\n'));

    // imagens e fontes para dentro do arquivo
    let embutidas = 0, falhas = 0;
    if (opc.embutir) {
      const mapa = new Map();
      const lista = [...urls];
      clone.querySelectorAll('img[src],image[href],video[poster],source[src]').forEach((n) => {
        const a = n.hasAttribute('src') ? 'src' : n.hasAttribute('href') ? 'href' : 'poster';
        const u = n.getAttribute(a);
        if (u && !/^(data:|blob:|#)/.test(u)) lista.push(u);
      });
      const unicos = [...new Set(lista)];
      let k = 0;
      const trab = async () => {
        while (k < unicos.length) {
          const u = unicos[k++];
          try {
            const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 12000);
            const r = await fetch(abs(u), { credentials: 'omit', signal: ctl.signal }); clearTimeout(tm);
            if (!r.ok) throw 0;
            const b = await r.blob();
            if (b.size > 4 * 1024 * 1024) throw 0;
            const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
            mapa.set(u, dataUrl); mapa.set(abs(u), dataUrl); embutidas++;
          } catch (_) { falhas++; }
        }
      };
      await Promise.all([trab(), trab(), trab(), trab(), trab(), trab()]);
      const troca = (txt) => txt.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (m, q, u) => (mapa.has(u) ? `url("${mapa.get(u)}")` : mapa.has(abs(u)) ? `url("${mapa.get(abs(u))}")` : m));
      css = troca(css);
      clone.querySelectorAll('[style]').forEach((n) => n.setAttribute('style', troca(n.getAttribute('style'))));
      clone.querySelectorAll('img[src],image[href],video[poster],source[src]').forEach((n) => {
        const a = n.hasAttribute('src') ? 'src' : n.hasAttribute('href') ? 'href' : 'poster';
        const u = n.getAttribute(a);
        if (mapa.has(u)) n.setAttribute(a, mapa.get(u));
      });
    }
    clone.classList.add('cp-raiz');

    // cor de fundo mais próxima, para o arquivo .html aparecer com o mesmo fundo que o componente tinha
    let fundo = '#ffffff';
    for (let p = el; p; p = p.parentElement) {
      const bg = getComputedStyle(p).backgroundColor;
      if (bg && !/rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(bg)) { fundo = bg; break; }
    }
    const r = el.getBoundingClientRect();
    return { html: clone.outerHTML, css, fundo, largura: Math.round(r.width), altura: Math.round(r.height), embutidas, falhas, nos: origens.length };
  }

  function nomeDo(el) {
    let n = (el.id || '').replace(/[^a-z0-9]+/gi, '-');
    if (!n) { const c = [...el.classList].find((x) => /^[a-z][a-z0-9_-]{2,}$/i.test(x) && !/^(css-|sc-|jsx-|__|svelte-|astro-)/.test(x)); n = c || ''; }
    if (!n) n = el.localName === 'div' ? 'componente' : el.localName;
    return n.replace(/^-+|-+$/g, '').toLowerCase().slice(0, 32) || 'componente';
  }
  const pascal = (s) => s.split(/[^a-z0-9]+/i).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1)).join('') || 'Componente';
  const RESET = ':where(.cp-raiz,.cp-raiz *){all:revert}';

  function arquivoHtml(d, nome) {
    return `<!DOCTYPE html>\n<html lang="${document.documentElement.lang || 'pt-BR'}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${nome}</title>\n<style>\nbody{margin:0;padding:24px;background:${d.fundo}}\n${d.css}\n</style>\n</head>\n<body>\n${d.html}\n</body>\n</html>\n`;
  }
  function arquivoTsx(d, nome) {
    const comp = pascal(nome);
    return `// Componente copiado de ${location.hostname} (${d.largura}x${d.altura}px).\n// Use: salve em src/components/${comp}.tsx e escreva <${comp} /> dentro de uma rota.\n// Os estilos vão dentro do próprio componente, então não depende do CSS do projeto.\nconst CSS = ${JSON.stringify(RESET + '\n' + d.css)};\nconst HTML = ${JSON.stringify(d.html)};\n\nexport default function ${comp}() {\n  return (\n    <>\n      <style dangerouslySetInnerHTML={{ __html: CSS }} />\n      <div dangerouslySetInnerHTML={{ __html: HTML }} />\n    </>\n  );\n}\n`;
  }

  function baixa(nomeArq, texto, mime) {
    const blob = new Blob([texto], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const manual = () => { const a = document.createElement('a'); a.href = url; a.download = nomeArq; document.documentElement.appendChild(a); a.click(); a.remove(); };
    try {
      chrome.runtime.sendMessage({ tipo: 'baixar', url, nome: 'copias-de-sites/componentes/' + nomeArq }, (r) => { if (chrome.runtime.lastError || !r || !r.ok) manual(); });
    } catch (_) { manual(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---------- tela de escolha ----------
  function moveCaixa(el) {
    if (!el) { caixa.style.display = 'none'; rotulo.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    caixa.style.cssText += `;display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    const cls = [...el.classList].slice(0, 2).map((c) => '.' + c).join('');
    rotulo.textContent = `${el.localName}${el.id ? '#' + el.id : ''}${cls}  ${Math.round(r.width)}×${Math.round(r.height)}`;
    rotulo.style.display = 'block';
    rotulo.style.left = Math.max(4, Math.min(innerWidth - 260, r.left)) + 'px';
    rotulo.style.top = (r.top > 26 ? r.top - 24 : r.bottom + 4) + 'px';
  }
  const dentroDoPainel = (n) => !!host && n instanceof Node && (n === host || host.contains(n));
  const escolhivel = (n) => n && n.nodeType === 1 && !dentroDoPainel(n) && n !== document.documentElement && n !== document.body;

  function aoMover(e) {
    if (!ativo || travado) return;
    const n = document.elementFromPoint(e.clientX, e.clientY);
    if (!escolhivel(n)) return;
    sel = n; pilhaFilhos = [];
    moveCaixa(sel);
  }
  function aoClicar(e) {
    if (!ativo) return;
    if (dentroDoPainel(e.target) || (e.composedPath && e.composedPath().some(dentroDoPainel))) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const n = document.elementFromPoint(e.clientX, e.clientY);
    if (escolhivel(n)) { sel = n; pilhaFilhos = []; }
    travado = true;
    moveCaixa(sel);
    atualizaPainel();
  }
  function bloqueia(e) { if (ativo && !(e.composedPath && e.composedPath().some(dentroDoPainel))) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } }
  function aoTecla(e) {
    if (!ativo) return;
    if (e.key === 'Escape') { fecha(); e.preventDefault(); return; }
    if (!sel) return;
    if (e.key === 'ArrowUp') { sobe(); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { desce(); e.preventDefault(); }
  }
  function sobe() {
    if (!sel || !escolhivel(sel.parentElement)) return;
    pilhaFilhos.push(sel); sel = sel.parentElement; travado = true; moveCaixa(sel); atualizaPainel();
  }
  function desce() {
    if (!sel) return;
    let f = pilhaFilhos.pop();
    if (!f || !sel.contains(f)) f = [...sel.children].find((x) => !dentroDoPainel(x) && x.getBoundingClientRect().width > 0 && getComputedStyle(x).display !== 'none');
    if (f) { sel = f; travado = true; moveCaixa(sel); atualizaPainel(); }
  }

  const BTN = 'border:0;border-radius:9px;padding:8px 11px;font:700 12.5px system-ui,sans-serif;cursor:pointer;';
  function montaTela() {
    host = document.createElement('div');
    host.id = RAIZ_ID;
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    caixa = document.createElement('div');
    caixa.style.cssText = 'position:fixed;display:none;pointer-events:none;border:2px solid #e8b94a;background:rgba(232,185,74,.16);box-shadow:0 0 0 99999px rgba(10,6,20,.28);border-radius:3px;transition:all .06s';
    rotulo = document.createElement('div');
    rotulo.style.cssText = 'position:fixed;display:none;pointer-events:none;background:#1b1430;color:#f6d98a;font:600 11.5px/1 system-ui,sans-serif;padding:5px 8px;border-radius:6px;white-space:nowrap';
    painel = document.createElement('div');
    painel.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);pointer-events:auto;background:#1b1430;color:#f3eefc;border:1px solid #30264e;border-radius:14px;padding:11px 13px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5);max-width:calc(100vw - 24px);text-align:center';
    host.append(caixa, rotulo, painel);
    document.documentElement.appendChild(host);
    atualizaPainel();
  }
  let ocupado = false, msg = '', embutir = true;
  function atualizaPainel() {
    if (!painel) return;
    painel.innerHTML = '';
    const l1 = document.createElement('div');
    l1.style.cssText = 'margin-bottom:8px;color:#cfc4e8';
    l1.textContent = msg || (travado ? 'Bloco escolhido. Ajuste com ↑ pai / ↓ filho (ou as setas do teclado) e exporte.' : 'Passe o mouse e CLIQUE no pedaço do site que você quer copiar.');
    painel.appendChild(l1);
    if (travado && sel) {
      const b = (txt, fn, estilo) => { const x = document.createElement('button'); x.textContent = txt; x.style.cssText = BTN + (estilo || 'background:#30264e;color:#f3eefc'); x.onclick = fn; x.disabled = ocupado; if (ocupado) x.style.opacity = .5; return x; };
      const linha = document.createElement('div');
      linha.style.cssText = 'display:flex;gap:7px;flex-wrap:wrap;justify-content:center';
      linha.append(
        b('↑ Pai', sobe), b('↓ Filho', desce),
        b('⬇ HTML', () => exporta('html'), 'background:linear-gradient(135deg,#f6d98a,#e8b94a);color:#1a1030'),
        b('⬇ React (.tsx)', () => exporta('tsx'), 'background:linear-gradient(135deg,#f6d98a,#e8b94a);color:#1a1030'),
        b('📋 Copiar código', () => exporta('copia')),
        b('Escolher outro', () => { travado = false; msg = ''; atualizaPainel(); })
      );
      painel.appendChild(linha);
      const l2 = document.createElement('label');
      l2.style.cssText = 'display:flex;gap:6px;justify-content:center;align-items:center;margin-top:8px;font-size:11.5px;color:#a99cc6;cursor:pointer';
      const ck = document.createElement('input'); ck.type = 'checkbox'; ck.checked = embutir; ck.onchange = () => { embutir = ck.checked; };
      l2.append(ck, 'Colocar imagens e fontes dentro do arquivo');
      painel.appendChild(l2);
    }
    const x = document.createElement('button');
    x.textContent = 'Sair (Esc)'; x.style.cssText = BTN + 'background:transparent;color:#a99cc6;margin-top:6px;padding:4px 8px;font-weight:600';
    x.onclick = fecha;
    painel.appendChild(x);
  }

  async function exporta(tipo) {
    if (!sel || ocupado) return;
    ocupado = true; msg = 'Copiando o bloco… (pode levar alguns segundos)'; atualizaPainel();
    try {
      const alvo = sel;
      // some com o destaque para ele não entrar em nada
      caixa.style.display = 'none'; rotulo.style.display = 'none'; await espera(60);
      const d = await monta(alvo, { embutir });
      const nome = nomeDo(alvo);
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12);
      const base = location.hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '') + '-' + nome;
      if (tipo === 'html') baixa(`${base}-${stamp}.html`, arquivoHtml(d, nome), 'text/html');
      else if (tipo === 'tsx') baixa(`${pascal(nome)}-${stamp}.tsx`, arquivoTsx(d, nome), 'text/plain');
      else { await navigator.clipboard.writeText(arquivoTsx(d, nome)); }
      msg = (tipo === 'copia' ? 'Código (React) copiado.' : 'Salvo em Downloads/copias-de-sites/componentes.') + ` ${d.nos} elementos` + (embutir ? `, ${d.embutidas} imagem(ns)/fonte(s) dentro${d.falhas ? `, ${d.falhas} não baixaram` : ''}.` : '.');
    } catch (e) {
      msg = 'Não deu certo: ' + (e && e.message ? e.message : e);
    }
    ocupado = false; moveCaixa(sel); atualizaPainel();
  }

  function abre() {
    if (ativo) return;
    ativo = true; travado = false; sel = null; msg = '';
    if (!host || !host.isConnected) montaTela(); else { host.style.display = ''; atualizaPainel(); }
    window.addEventListener('mousemove', aoMover, true);
    window.addEventListener('click', aoClicar, true);
    ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'submit', 'dblclick', 'contextmenu'].forEach((t) => window.addEventListener(t, bloqueia, true));
    window.addEventListener('keydown', aoTecla, true);
    window.addEventListener('scroll', () => { if (ativo && sel) moveCaixa(sel); }, true);
  }
  function fecha() {
    ativo = false;
    window.removeEventListener('mousemove', aoMover, true);
    window.removeEventListener('click', aoClicar, true);
    ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'submit', 'dblclick', 'contextmenu'].forEach((t) => window.removeEventListener(t, bloqueia, true));
    window.removeEventListener('keydown', aoTecla, true);
    if (host) host.style.display = 'none';
    if (ifr) { ifr.remove(); ifr = null; padroes.clear(); }
  }

  window.__copiadorComponente = { abre, fecha, monta, arquivoHtml, arquivoTsx, nomeDo };
  abre();
})();
