// Seleção à mão: você clica nas capas dos vídeos na própria página do perfil.
// Os escolhidos ficam com borda verde; a barra embaixo mostra quantos e manda para o painel.
(function () {
  'use strict';
  if (self.MV_SELECAO) {
    self.MV_SELECAO.abrir();
    return;
  }
  const LIMITE = 500;
  const escolhidos = new Map(); // id → item
  let barra = null, estilo = null, ctx = null, observador = null;

  // Qual link da grade é um vídeo e como tirar o id dele, por plataforma.
  const REGRAS = {
    instagram: { sel: 'a[href*="/reel/"], a[href*="/p/"]', id: (h) => (h.match(/\/(?:reel|reels|p)\/([\w-]{5,40})/) || [])[1], link: (id) => `https://www.instagram.com/reel/${id}/` },
    tiktok: { sel: 'a[href*="/video/"]', id: (h) => (h.match(/\/video\/(\d{8,30})/) || [])[1], link: (id, h) => new URL(h, location.href).origin + new URL(h, location.href).pathname },
    youtube: { sel: 'a[href*="/shorts/"]', id: (h) => (h.match(/\/shorts\/([\w-]{6,20})/) || [])[1], link: (id) => `https://www.youtube.com/shorts/${id}` }
  };

  const regra = () => REGRAS[ctx.plataforma];
  const linkDoEvento = (e) => {
    for (const n of e.composedPath ? e.composedPath() : []) if (n instanceof Element && n.matches(regra().sel)) return n;
    return e.target instanceof Element ? e.target.closest(regra().sel) : null;
  };

  function itemDoLink(a) {
    const h = a.getAttribute('href') || '';
    const id = regra().id(h);
    if (!id) return null;
    const img = a.querySelector('img');
    // a aba Reels do Instagram usa a capa como fundo de uma div, não como <img>
    let fundo = '';
    if (!img) for (const el of a.querySelectorAll('div')) {
      const m = (el.style.backgroundImage || '').match(/url\(["']?(.+?)["']?\)/);
      if (m) { fundo = m[1]; break; }
    }
    const card = a.closest('ytd-rich-item-renderer, ytm-shorts-lockup-view-model-v2, [data-e2e="user-post-item"]') || a;
    const views = self.MV.lerNumero((card.innerText || '').split('\n').find((l) => /\d/.test(l)) || '');
    return {
      id,
      link: regra().link(id, h),
      views: views || 0,
      likes: null,
      comments: null,
      data: 0,
      thumb: (img && (img.currentSrc || img.src)) || fundo,
      video: '',
      legenda: (img && img.alt) || a.getAttribute('title') || a.getAttribute('aria-label') || '',
      ordem: escolhidos.size,
      manual: true
    };
  }

  function marcar() {
    for (const a of document.querySelectorAll(regra().sel)) {
      const id = regra().id(a.getAttribute('href') || '');
      if (id && escolhidos.has(id)) a.setAttribute('data-mv-escolhido', '');
      else a.removeAttribute('data-mv-escolhido');
    }
  }

  function atualizar(msg) {
    if (!barra) return;
    const r = barra.shadowRoot;
    r.querySelector('.n').textContent = escolhidos.size;
    r.querySelector('.usar').disabled = !escolhidos.size;
    if (msg) r.querySelector('.msg').textContent = msg;
  }

  function aoApertar(e) {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (e.composedPath && e.composedPath().includes(barra)) return;
    const a = linkDoEvento(e);
    if (!a) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const it = itemDoLink(a);
    if (!it) return;
    if (escolhidos.has(it.id)) {
      escolhidos.delete(it.id);
      atualizar('Vídeo tirado da seleção.');
    } else if (escolhidos.size >= LIMITE) {
      atualizar(`Limite de ${LIMITE} vídeos por seleção.`);
    } else {
      escolhidos.set(it.id, it);
      atualizar('Vídeo escolhido. Continue clicando ou toque em "Usar escolhidos".');
    }
    marcar();
  }
  // o site abre o vídeo no clique: bloqueia enquanto a seleção está aberta
  function bloquear(e) {
    if (e.composedPath && e.composedPath().includes(barra)) return;
    if (linkDoEvento(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function fechar() {
    removeEventListener('pointerdown', aoApertar, true);
    removeEventListener('click', bloquear, true);
    removeEventListener('auxclick', bloquear, true);
    if (observador) observador.disconnect();
    observador = null;
    document.querySelectorAll('[data-mv-escolhido]').forEach((a) => a.removeAttribute('data-mv-escolhido'));
    if (barra) barra.remove();
    if (estilo) estilo.remove();
    barra = estilo = null;
    escolhidos.clear();
  }

  async function usar() {
    if (!escolhidos.size) return;
    const itens = [...escolhidos.values()].map((v, i) => ({ ...v, ordem: i }));
    await chrome.storage.local.set({ selecaoManual: { plataforma: ctx.plataforma, perfil: ctx.perfil, itens, quando: Date.now() } });
    fechar();
  }

  function abrir() {
    ctx = self.MV.detectar(location.href);
    if (!ctx) return { ok: false, erro: 'Abra a página de um perfil' };
    if (barra) return { ok: true };
    estilo = document.createElement('style');
    estilo.textContent = `[data-mv-escolhido]{position:relative!important;outline:4px solid #22c55e!important;outline-offset:-4px!important;border-radius:6px}
      [data-mv-escolhido]::after{content:"✓";position:absolute;top:8px;right:8px;z-index:9;width:28px;height:28px;border-radius:50%;background:#22c55e;color:#04120a;font:900 17px/28px system-ui;text-align:center;box-shadow:0 3px 10px #0008}`;
    document.documentElement.appendChild(estilo);
    barra = document.createElement('div');
    barra.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483647';
    barra.attachShadow({ mode: 'open' }).innerHTML = `<style>
      .b{display:flex;align-items:center;gap:12px;min-width:min(620px,calc(100vw - 24px));padding:12px 14px;border-radius:14px;background:#0f1115f2;border:1px solid #2c3340;color:#e8ebf0;font:13px system-ui,sans-serif;box-shadow:0 14px 40px #000a}
      .t{flex:1;min-width:0}.t b{display:block;font-size:12px;letter-spacing:.04em}.msg{display:block;color:#9aa3b2;font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .n{font-size:22px;font-weight:800;color:#22c55e}.max{color:#9aa3b2;font-size:11px}
      button{height:36px;padding:0 14px;border-radius:9px;font:700 12px system-ui;cursor:pointer}
      .cancelar{background:transparent;color:#cfd5df;border:1px solid #39404d}.usar{background:#22c55e;color:#04120a;border:0}.usar:disabled{opacity:.4;cursor:default}
    </style><div class="b"><div class="t"><b>ESCOLHER NA PÁGINA · ${self.MV.PLATAFORMAS[ctx.plataforma].nome.toUpperCase()}</b><span class="msg">Clique nas capas dos vídeos que você quer.</span></div>
      <span><span class="n">0</span> <span class="max">/ ${LIMITE}</span></span><button class="cancelar">Cancelar</button><button class="usar" disabled>Usar escolhidos</button></div>`;
    barra.shadowRoot.querySelector('.cancelar').onclick = fechar;
    barra.shadowRoot.querySelector('.usar').onclick = usar;
    document.documentElement.appendChild(barra);
    addEventListener('pointerdown', aoApertar, { capture: true, passive: false });
    addEventListener('click', bloquear, true);
    addEventListener('auxclick', bloquear, true);
    observador = new MutationObserver(() => requestAnimationFrame(marcar)); // a grade recria os cards ao rolar
    observador.observe(document.body || document.documentElement, { childList: true, subtree: true });
    return { ok: true };
  }

  self.MV_SELECAO = { abrir, fechar };
  abrir();
})();
