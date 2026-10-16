// Fotografa a página do jeito que está na tela (com o que o JavaScript já desenhou).
(function () {
  if (window.__capturaPagina) return;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  async function rolaTudo() {
    // desce a página aos poucos para carregar imagens "preguiçosas" (lazy) e animações de rolagem
    const y0 = scrollY;
    const alt = () => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    for (let y = 0; y < alt() && y < 80000; y += Math.max(300, innerHeight * 0.7)) {
      scrollTo(0, y);
      await espera(220);
    }
    scrollTo(0, alt());
    await espera(500);
    scrollTo(0, y0);
    await espera(700);
  }

  function cssDaFolha(sh) {
    try { return [...sh.cssRules].map((r) => r.cssText).join('\n'); } catch (_) { return null; }
  }

  // dados que o site guarda no navegador (muitos cardápios guardam os produtos aqui)
  function lerArmazenamento() {
    const ler = (st) => {
      const o = {};
      let total = 0;
      try {
        for (let i = 0; i < st.length; i++) {
          const k = st.key(i), v = st.getItem(k);
          if (v == null || v.length > 3000000 || (total += v.length) > 8000000) continue;
          o[k] = v;
        }
      } catch (_) {}
      return o;
    };
    const cookies = {};
    try {
      document.cookie.split(/;\s*/).forEach((c) => {
        const i = c.indexOf('=');
        if (i > 0) cookies[c.slice(0, i)] = c.slice(i + 1);
      });
    } catch (_) {}
    return { local: ler(localStorage), sessao: ler(sessionStorage), cookies };
  }
  window.__capturaPagina = async function (opts = {}) {
    if (opts.rolar) await rolaTudo();

    const recursos = performance.getEntriesByType('resource').map((e) => ({ url: e.name, tipo: e.initiatorType }));

    // estilos criados por JavaScript (styled-components, emotion, Tailwind JIT...) ficam só na memória:
    // copiamos as regras reais de cada <style>
    const styles = [...document.querySelectorAll('style')];
    const dinamicos = styles.map((st) => {
      const t = st.sheet ? cssDaFolha(st.sheet) : null;
      return t && t.length > (st.textContent || '').length ? t : null;
    });
    let adotados = '';
    try { adotados = (document.adoptedStyleSheets || []).map(cssDaFolha).filter(Boolean).join('\n'); } catch (_) {}

    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('#copiador-editor-raiz').forEach((n) => n.remove());
    clone.querySelectorAll('[data-copiador-sel],[data-copiador-hover]').forEach((n) => { n.removeAttribute('data-copiador-sel'); n.removeAttribute('data-copiador-hover'); });
    clone.querySelectorAll('[contenteditable="true"]').forEach((n) => n.removeAttribute('contenteditable'));
    const stylesClone = [...clone.querySelectorAll('style')];
    dinamicos.forEach((t, i) => { if (t && stylesClone[i]) stylesClone[i].textContent = t; });
    if (adotados) {
      const s = document.createElement('style');
      s.setAttribute('data-copiador', 'adotados');
      s.textContent = adotados;
      (clone.querySelector('head') || clone).appendChild(s);
    }

    // imagens: usa a versão que o navegador realmente escolheu e tira o "lazy"
    const imgs = [...document.images], imgsC = [...clone.querySelectorAll('img')];
    imgs.forEach((im, i) => {
      const c = imgsC[i];
      if (!c) return;
      const real = im.currentSrc || im.src;
      if (real && !real.startsWith('data:image/gif') && !real.startsWith('data:image/svg+xml;base64,PHN2Zy')) c.setAttribute('src', real);
      c.removeAttribute('loading');
    });
    // vídeos: idem
    const vids = [...document.querySelectorAll('video')], vidsC = [...clone.querySelectorAll('video')];
    vids.forEach((v, i) => { if (vidsC[i] && v.currentSrc && !v.currentSrc.startsWith('blob:')) vidsC[i].setAttribute('src', v.currentSrc); });
    // valores digitados em formulários
    const ins = [...document.querySelectorAll('input,textarea,select')], insC = [...clone.querySelectorAll('input,textarea,select')];
    ins.forEach((el, i) => {
      const c = insC[i];
      if (!c) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked ? c.setAttribute('checked', '') : c.removeAttribute('checked');
      else if (el.tagName === 'TEXTAREA') c.textContent = el.value;
      else if (el.tagName !== 'SELECT' && el.type !== 'password' && el.type !== 'file') c.setAttribute('value', el.value);
    });
    // canvas (gráficos, 3D): na cópia visual vira uma imagem do que estava na tela
    const cans = [...document.querySelectorAll('canvas')], cansC = [...clone.querySelectorAll('canvas')];
    const fotosCanvas = [];
    // 3D (WebGL) apaga a imagem logo depois de mostrar: tenta ler dentro do próximo quadro da animação
    const vazio = (cv) => {
      try {
        const t = document.createElement('canvas'); t.width = t.height = 24;
        const g = t.getContext('2d'); g.drawImage(cv, 0, 0, 24, 24);
        const d = g.getImageData(0, 0, 24, 24).data;
        for (let k = 3; k < d.length; k += 4) if (d[k] > 0) return false;
        return true;
      } catch (_) { return true; }
    };
    const lerCanvas = (cv) => { try { return vazio(cv) ? '' : cv.toDataURL('image/png'); } catch (_) { return ''; } };
    const quadro = () => new Promise((r) => requestAnimationFrame(() => r()));
    for (let i = 0; i < cans.length; i++) {
      const cv = cans[i];
      let url = '';
      if (cv.width > 1 && cv.height > 1) {
        url = lerCanvas(cv);
        for (let tentativa = 0; !url && tentativa < 6; tentativa++) {
          url = await new Promise((r) => requestAnimationFrame(() => r(lerCanvas(cv))));
          if (!url) await quadro();
        }
      }
      const r = cv.getBoundingClientRect();
      fotosCanvas.push({ url, w: cv.clientWidth, h: cv.clientHeight, x: r.left + scrollX, y: r.top + scrollY });
      if (cansC[i]) cansC[i].setAttribute('data-copiador-canvas', String(i));
    }

    const dt = document.doctype;
    const doctype = dt ? `<!DOCTYPE ${dt.name}${dt.publicId ? ` PUBLIC "${dt.publicId}"` : ''}${dt.systemId ? ` "${dt.systemId}"` : ''}>` : '<!DOCTYPE html>';
    return {
      url: location.href,
      titulo: document.title,
      html: doctype + '\n' + clone.outerHTML,
      recursos,
      fotosCanvas,
      edicoes: window.__copiadorEdicoes || null,
      armazenamento: lerArmazenamento(),
      capturadoEm: Date.now()
    };
  };
})();
