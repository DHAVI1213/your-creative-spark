// Modo edição: muda textos, imagens, links, cores e seções direto na página e depois exporta.
(function () {
  'use strict';
  if (window.__copiadorEditor) { window.__copiadorEditor.mostra(); return; }

  const ed = (window.__copiadorEdicoes = window.__copiadorEdicoes || { textos: [], imagens: [], cores: [], links: [], ocultar: [] });
  const historico = [];

  // ---------------------------------------------------------------- interface (isolada do CSS do site)
  const host = document.createElement('div');
  host.id = 'copiador-editor-raiz';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  document.documentElement.appendChild(host);
  const raiz = host.attachShadow({ mode: 'open' });
  raiz.innerHTML = `
  <style>
    *{box-sizing:border-box;font-family:"Segoe UI",system-ui,sans-serif}
    .caixa{position:fixed;pointer-events:none;border:2px dashed #e8b94a;border-radius:4px;transition:all .06s;display:none}
    .caixa.sel{border:2px solid #7c3aed;box-shadow:0 0 0 4000px rgba(10,5,20,.12)}
    .rotulo{position:absolute;left:-2px;top:-22px;background:#7c3aed;color:#fff;font:600 11px/1 sans-serif;padding:4px 6px;border-radius:4px 4px 0 0;white-space:nowrap}
    .acoes{position:fixed;display:none;gap:4px;pointer-events:auto;background:#1b1430;border:1px solid #3a2e5e;border-radius:10px;padding:4px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
    .acoes button{border:0;background:#2a2046;color:#f3eefc;border-radius:7px;padding:6px 8px;font-size:12px;cursor:pointer;white-space:nowrap}
    .acoes button:hover{background:#7c3aed}
    .painel{position:fixed;top:16px;right:16px;width:290px;max-height:calc(100vh - 32px);overflow:auto;pointer-events:auto;background:#120d20;color:#f3eefc;border:1px solid #30264e;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);font-size:13px}
    .topo{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #30264e;cursor:move;user-select:none}
    .topo b{flex:1}
    .topo button{background:none;border:0;color:#a99cc6;cursor:pointer;font-size:16px}
    .sec{padding:12px 14px;border-bottom:1px solid #241c3d}
    .sec h3{margin:0 0 8px;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#e8b94a}
    .dica{color:#a99cc6;font-size:11.5px;margin:0 0 8px}
    input[type=text]{width:100%;background:#0b0816;border:1px solid #30264e;color:#fff;border-radius:8px;padding:7px 9px;margin-bottom:6px;font-size:12.5px}
    .btn{width:100%;border:0;border-radius:9px;padding:8px;font-weight:700;cursor:pointer;background:#2a2046;color:#f3eefc;margin-top:4px}
    .btn:hover{background:#3a2d63}
    .btn.ouro{background:linear-gradient(135deg,#f6d98a,#e8b94a);color:#1a1030}
    .linha{display:flex;gap:6px}
    .cores{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
    .cor{position:relative;aspect-ratio:1;border-radius:8px;border:1px solid rgba(255,255,255,.2);cursor:pointer;overflow:hidden}
    .cor input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
    .cor.mudou{outline:2px solid #e8b94a}
    .min .sec{display:none}
    .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1b1430;color:#fff;border:1px solid #7c3aed;padding:10px 16px;border-radius:10px;pointer-events:none;opacity:0;transition:opacity .3s;font-size:13px}
    .toast.on{opacity:1}
  </style>
  <div class="caixa" id="hover"></div>
  <div class="caixa sel" id="sel"><span class="rotulo" id="rotulo"></span></div>
  <div class="acoes" id="acoes">
    <button data-a="texto" title="Editar o texto">✎ Texto</button>
    <button data-a="imagem" title="Trocar a imagem">🖼 Imagem</button>
    <button data-a="link" title="Mudar o link">🔗 Link</button>
    <button data-a="pai" title="Selecionar o bloco de fora">⬆ Bloco</button>
    <button data-a="sobe" title="Mover para cima">↑</button>
    <button data-a="desce" title="Mover para baixo">↓</button>
    <button data-a="duplica" title="Duplicar">⧉</button>
    <button data-a="apaga" title="Apagar">🗑</button>
  </div>
  <div class="painel" id="painel">
    <div class="topo" id="arrasta"><b>✏️ Modo edição</b><button id="min" title="Minimizar">–</button><button id="sair" title="Sair do modo edição">✕</button></div>
    <div class="sec">
      <p class="dica">Clique em qualquer parte do site para selecionar. Clique duas vezes num texto para escrever. Os links ficam desligados enquanto edita.</p>
      <div class="linha"><button class="btn" id="desfaz">↶ Desfazer</button><button class="btn" id="limpaSel">Tirar seleção</button></div>
    </div>
    <div class="sec">
      <h3>Trocar em toda a página</h3>
      <input type="text" id="procura" placeholder="Procurar (ex.: nome da loja antiga)">
      <input type="text" id="trocaPor" placeholder="Trocar por (ex.: nome do cliente)">
      <button class="btn" id="trocar">Trocar tudo</button>
    </div>
    <div class="sec">
      <h3>WhatsApp do cliente</h3>
      <p class="dica">Troca todos os links de WhatsApp do site por este número.</p>
      <input type="text" id="zap" placeholder="Ex.: 61 99999-9999">
      <button class="btn" id="trocaZap">Aplicar nos links</button>
    </div>
    <div class="sec">
      <h3>Cores do site</h3>
      <p class="dica">Clique numa cor para trocar por outra no site inteiro.</p>
      <div class="cores" id="cores"></div>
      <button class="btn" id="lerCores">Ler cores</button>
    </div>
    <div class="sec">
      <h3>Exportar</h3>
      <button class="btn ouro" id="expVisual">⬇ Baixar cópia visual (.zip)</button>
      <button class="btn" id="expUnico">⬇ Baixar como HTML único</button>
      <button class="btn" id="expCompleto">⬇ Cópia completa (com animações)</button>
      <p class="dica" style="margin-top:8px">Na cópia completa, as trocas de texto, foto, cor e link são aplicadas nos arquivos do site. Apagar seções vira "esconder".</p>
    </div>
  </div>
  <div class="toast" id="toast"></div>`;
  const $ = (s) => raiz.getElementById(s);
  const caixaHover = $('hover'), caixaSel = $('sel'), acoes = $('acoes'), painel = $('painel');

  let selecionado = null, ativo = true, editandoTexto = null, textoAntes = '';

  function toast(t) {
    const el = $('toast');
    el.textContent = t;
    el.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('on'), 2400);
  }
  const ehDoEditor = (e) => e.composedPath().includes(host);
  function posiciona(caixa, el) {
    if (!el) { caixa.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    Object.assign(caixa.style, { display: 'block', left: r.left - 2 + 'px', top: r.top - 2 + 'px', width: r.width + 4 + 'px', height: r.height + 4 + 'px' });
  }
  function nomeEl(el) {
    const t = el.tagName.toLowerCase();
    const mapa = { img: 'imagem', a: 'link', p: 'parágrafo', h1: 'título', h2: 'título', h3: 'título', button: 'botão', section: 'seção', header: 'topo', footer: 'rodapé', nav: 'menu', div: 'bloco', span: 'texto', li: 'item', ul: 'lista', video: 'vídeo', canvas: '3D/canvas' };
    return mapa[t] || t;
  }
  function seleciona(el) {
    selecionado = el;
    posiciona(caixaSel, el);
    if (!el) { acoes.style.display = 'none'; return; }
    $('rotulo').textContent = nomeEl(el);
    const r = el.getBoundingClientRect();
    acoes.style.display = 'flex';
    const y = r.top > 60 ? r.top - 48 : Math.min(innerHeight - 50, r.bottom + 8);
    acoes.style.left = Math.max(8, Math.min(innerWidth - 470, r.left)) + 'px';
    acoes.style.top = Math.max(8, y) + 'px';
  }
  function seletor(el) {
    if (el.id && /^[a-zA-Z][\w-]{1,40}$/.test(el.id) && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const partes = [];
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      let p = el.tagName.toLowerCase();
      if (el.parentElement) {
        const irmaos = [...el.parentElement.children].filter((c) => c.tagName === el.tagName);
        if (irmaos.length > 1) p += `:nth-of-type(${irmaos.indexOf(el) + 1})`;
      }
      partes.unshift(p);
      if (el.tagName === 'BODY') break;
      el = el.parentElement;
    }
    return partes.join(' > ');
  }
  // Desfazer: grava só as mudanças que cada ação fez (não recria a página, então o JavaScript/3D do site continua funcionando)
  let gravando = null;
  const obs = new MutationObserver((ms) => { if (gravando) gravando.muts.push(...ms); });
  function guarda(longo) {
    fecha();
    gravando = { muts: [], ed: JSON.stringify(ed) };
    historico.push(gravando);
    if (historico.length > 40) historico.shift();
    obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true });
    if (!longo) setTimeout(fecha, 0);
  }
  function fecha() {
    if (!gravando) return;
    gravando.muts.push(...obs.takeRecords());
    obs.disconnect();
    gravando = null;
  }
  function reverte(muts) {
    for (let i = muts.length - 1; i >= 0; i--) {
      const m = muts[i];
      if (m.target === host || host.contains(m.target)) continue;
      if (m.type === 'characterData') m.target.data = m.oldValue;
      else if (m.type === 'attributes') {
        if (m.oldValue === null) m.target.removeAttribute(m.attributeName); else m.target.setAttribute(m.attributeName, m.oldValue);
      } else {
        m.addedNodes.forEach((n) => { if (n.parentNode === m.target) n.remove(); });
        [...m.removedNodes].reverse().forEach((n) => {
          const ref = m.nextSibling && m.nextSibling.parentNode === m.target ? m.nextSibling : null;
          m.target.insertBefore(n, ref);
        });
      }
    }
  }

  // ---------------------------------------------------------------- mouse: passa por cima, seleciona, bloqueia links
  function aoMover(e) {
    if (!ativo || ehDoEditor(e) || editandoTexto) return;
    const el = e.target;
    if (el === document.documentElement || el === document.body) { caixaHover.style.display = 'none'; return; }
    posiciona(caixaHover, el);
  }
  function aoClicar(e) {
    if (!ativo || ehDoEditor(e)) return;
    if (editandoTexto && editandoTexto.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (editandoTexto) terminaTexto();
    seleciona(e.target);
  }
  function aoDuploClique(e) {
    if (!ativo || ehDoEditor(e)) return;
    e.preventDefault();
    e.stopPropagation();
    seleciona(e.target);
    comecaTexto(e.target);
  }
  const bloqueia = (e) => { if (ativo && !ehDoEditor(e) && !(editandoTexto && editandoTexto.contains(e.target))) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } };
  addEventListener('mousemove', aoMover, true);
  addEventListener('click', aoClicar, true);
  addEventListener('dblclick', aoDuploClique, true);
  ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'submit', 'auxclick'].forEach((t) => addEventListener(t, bloqueia, true));
  addEventListener('scroll', () => { posiciona(caixaSel, selecionado); if (selecionado) seleciona(selecionado); caixaHover.style.display = 'none'; }, true);
  addEventListener('keydown', (e) => {
    if (!ativo || ehDoEditor(e)) return;
    if (editandoTexto) { if (e.key === 'Escape') terminaTexto(); return; }
    if (e.key === 'Escape') seleciona(null);
    if ((e.key === 'Delete') && selecionado) acao('apaga');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); desfaz(); }
  }, true);

  // ---------------------------------------------------------------- texto
  function comecaTexto(el) {
    if (!el || el.tagName === 'IMG') return;
    guarda(true);
    editandoTexto = el;
    textoAntes = el.innerText;
    el.setAttribute('contenteditable', 'true');
    el.focus();
    toast('Escreva o novo texto. Clique fora ou aperte Esc para terminar.');
  }
  function terminaTexto() {
    const el = editandoTexto;
    if (!el) return;
    el.removeAttribute('contenteditable');
    editandoTexto = null;
    setTimeout(fecha, 0);
    const novo = el.innerText;
    if (novo !== textoAntes) {
      // guarda trechos que mudaram (para aplicar também na cópia completa)
      const a = textoAntes.trim(), b = novo.trim();
      if (a && a !== b) {
        const la = a.split('\n').map((s) => s.trim()).filter(Boolean), lb = b.split('\n').map((s) => s.trim()).filter(Boolean);
        if (la.length === lb.length) la.forEach((s, i) => s !== lb[i] && ed.textos.push([s, lb[i]]));
        else ed.textos.push([a, b]);
      }
    }
    seleciona(el);
  }

  // ---------------------------------------------------------------- imagem
  function alvoImagem(el) {
    if (el.tagName === 'IMG') return { tipo: 'img', el };
    const dentro = el.querySelectorAll('img');
    if (dentro.length === 1) return { tipo: 'img', el: dentro[0] };
    let n = el;
    for (let i = 0; i < 4 && n; i++, n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundImage;
      if (bg && bg.includes('url(')) return { tipo: 'bg', el: n, url: (bg.match(/url\(["']?([^"')]+)/) || [])[1] };
    }
    if (el.tagName === 'CANVAS' || el.tagName === 'VIDEO') return { tipo: 'troca', el };
    return null;
  }
  function escolheArquivo() {
    return new Promise((ok) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files[0];
        if (!f) return ok(null);
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.readAsDataURL(f);
      };
      inp.click();
    });
  }
  async function trocaImagem(el) {
    const alvo = alvoImagem(el);
    if (!alvo) return toast('Selecione uma imagem (ou um bloco com imagem de fundo).');
    const dado = await escolheArquivo();
    if (!dado) return;
    guarda();
    if (alvo.tipo === 'img') {
      const orig = alvo.el.currentSrc || alvo.el.src;
      ed.imagens.push([orig, dado]);
      const pic = alvo.el.closest('picture');
      if (pic) pic.querySelectorAll('source').forEach((s) => s.remove());
      alvo.el.removeAttribute('srcset');
      alvo.el.removeAttribute('sizes');
      alvo.el.src = dado;
    } else if (alvo.tipo === 'bg') {
      try { ed.imagens.push([new URL(alvo.url, location.href).href, dado]); } catch (_) {}
      alvo.el.style.setProperty('background-image', `url("${dado}")`, 'important');
    } else {
      const img = document.createElement('img');
      img.src = dado;
      img.style.cssText = `width:${alvo.el.clientWidth}px;height:${alvo.el.clientHeight}px;object-fit:cover;display:block`;
      alvo.el.replaceWith(img);
    }
    toast('Imagem trocada');
    seleciona(selecionado);
  }

  // ---------------------------------------------------------------- link
  function trocaLink(el) {
    const a = el.closest('a') || el.querySelector('a');
    if (!a) return toast('Esse elemento não tem link.');
    const antes = a.getAttribute('href') || '';
    const novo = prompt('Novo link (ex.: https://wa.me/5561999999999 ou https://instagram.com/cliente):', antes);
    if (novo == null || novo === antes) return;
    guarda();
    a.setAttribute('href', novo);
    if (antes) ed.links.push([antes, novo]);
    toast('Link trocado');
  }

  // ---------------------------------------------------------------- ações da barra
  function acao(a) {
    const el = selecionado;
    if (!el) return;
    if (a === 'texto') return comecaTexto(el);
    if (a === 'imagem') return trocaImagem(el);
    if (a === 'link') return trocaLink(el);
    if (a === 'pai') { if (el.parentElement && el.parentElement !== document.documentElement) seleciona(el.parentElement); return; }
    guarda();
    if (a === 'apaga') {
      ed.ocultar.push(seletor(el));
      const prox = el.parentElement;
      el.style.setProperty('display', 'none', 'important');
      seleciona(prox && prox !== document.body ? prox : null);
      toast('Apagado (Ctrl+Z desfaz)');
    } else if (a === 'duplica') {
      const c = el.cloneNode(true);
      el.after(c);
      seleciona(c);
    } else if (a === 'sobe' && el.previousElementSibling) {
      el.previousElementSibling.before(el);
      seleciona(el);
    } else if (a === 'desce' && el.nextElementSibling) {
      el.nextElementSibling.after(el);
      seleciona(el);
    }
  }
  acoes.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) acao(b.dataset.a); });

  function desfaz() {
    if (editandoTexto) terminaTexto();
    fecha();
    const h = historico.pop();
    if (!h) return toast('Nada para desfazer');
    reverte(h.muts);
    const antigo = JSON.parse(h.ed);
    Object.keys(ed).forEach((k) => { ed[k] = antigo[k] || []; });
    seleciona(null);
    toast('Desfeito');
  }
  $('desfaz').onclick = desfaz;
  $('limpaSel').onclick = () => seleciona(null);

  // ---------------------------------------------------------------- trocar em toda a página
  function trocaTextoGlobal(de, para) {
    if (!de) return 0;
    let n = 0;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.parentElement && t.parentElement.closest('#copiador-editor-raiz,script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nos = [];
    while (w.nextNode()) nos.push(w.currentNode);
    nos.forEach((t) => { if (t.nodeValue.includes(de)) { t.nodeValue = t.nodeValue.split(de).join(para); n++; } });
    document.querySelectorAll('[alt],[title],[placeholder],[aria-label],input[type=submit][value],input[type=button][value]').forEach((el) => {
      ['alt', 'title', 'placeholder', 'aria-label', 'value'].forEach((at) => { const v = el.getAttribute(at); if (v && v.includes(de)) { el.setAttribute(at, v.split(de).join(para)); n++; } });
    });
    if (document.title.includes(de)) { document.title = document.title.split(de).join(para); n++; }
    document.querySelectorAll('meta[content]').forEach((m) => { const v = m.getAttribute('content'); if (v.includes(de)) m.setAttribute('content', v.split(de).join(para)); });
    return n;
  }
  $('trocar').onclick = () => {
    const de = $('procura').value, para = $('trocaPor').value;
    if (!de) return toast('Escreva o que procurar.');
    guarda();
    const n = trocaTextoGlobal(de, para);
    if (n) ed.textos.push([de, para]);
    toast(n ? `Trocado em ${n} lugar(es)` : 'Não achei esse texto na página');
  };

  // ---------------------------------------------------------------- WhatsApp
  $('trocaZap').onclick = () => {
    let num = $('zap').value.replace(/\D/g, '');
    if (num.length < 10) return toast('Digite o número com DDD.');
    if (!num.startsWith('55')) num = '55' + num;
    guarda();
    let n = 0;
    document.querySelectorAll('a[href*="wa.me"],a[href*="whatsapp.com"],a[href*="api.whatsapp"]').forEach((a) => {
      const antes = a.getAttribute('href');
      const url = new URL(antes, location.href);
      const texto = url.searchParams.get('text');
      const novo = `https://wa.me/${num}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
      a.setAttribute('href', novo);
      ed.links.push([antes, novo]);
      n++;
    });
    toast(n ? `${n} link(s) de WhatsApp atualizados` : 'Não achei links de WhatsApp. Use 🔗 Link num botão.');
  };

  // ---------------------------------------------------------------- cores
  const PROPS = [['color', 'color'], ['backgroundColor', 'background-color'], ['borderTopColor', 'border-color'], ['fill', 'fill'], ['stroke', 'stroke']];
  function paraHex(c) {
    const m = c && c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
    if (!m) return null;
    if (m[4] !== undefined && Number(m[4]) < 0.25) return null;
    return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  }
  function elementosVisiveis() {
    return [...document.body.querySelectorAll('*')].filter((el) => !el.closest('#copiador-editor-raiz')).slice(0, 6000);
  }
  function lerCores() {
    const conta = new Map();
    elementosVisiveis().forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const area = Math.min(400000, el.offsetWidth * el.offsetHeight) || 1;
      PROPS.forEach(([p], i) => {
        if (i === 2 && parseFloat(cs.borderTopWidth) === 0) return;
        if (i >= 3 && !(el instanceof SVGElement)) return;
        const h = paraHex(cs[p]);
        if (!h) return;
        conta.set(h, (conta.get(h) || 0) + (i === 1 ? area / 400 : 1));
      });
    });
    const lista = [...conta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
    const mudadas = new Map(ed.cores);
    $('cores').innerHTML = lista.map(([h]) => `<label class="cor${mudadas.has(h) ? ' mudou' : ''}" style="background:${mudadas.get(h) || h}" title="${h}"><input type="color" value="${mudadas.get(h) || h}" data-orig="${h}"></label>`).join('');
    toast(`${lista.length} cores encontradas`);
  }
  function aplicaCor(antiga, nova) {
    elementosVisiveis().forEach((el) => {
      const cs = getComputedStyle(el);
      PROPS.forEach(([p, css]) => {
        const h = paraHex(cs[p]);
        if (h === antiga || h === (ed.cores.find((c) => c[0] === antiga) || [])[1]) el.style.setProperty(css, nova, 'important');
      });
    });
    const i = ed.cores.findIndex((c) => c[0] === antiga);
    if (i >= 0) ed.cores[i][1] = nova; else ed.cores.push([antiga, nova]);
  }
  $('lerCores').onclick = lerCores;
  $('cores').addEventListener('change', (e) => {
    const inp = e.target.closest('input[type=color]');
    if (!inp) return;
    guarda();
    aplicaCor(inp.dataset.orig, inp.value);
    inp.parentElement.style.background = inp.value;
    inp.parentElement.classList.add('mudou');
    toast('Cor trocada no site inteiro');
  });

  // ---------------------------------------------------------------- painel: arrastar, minimizar, sair, exportar
  let arr = null;
  $('arrasta').addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = painel.getBoundingClientRect();
    arr = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    $('arrasta').setPointerCapture(e.pointerId);
  });
  $('arrasta').addEventListener('pointermove', (e) => {
    if (!arr) return;
    painel.style.left = Math.max(0, e.clientX - arr.dx) + 'px';
    painel.style.top = Math.max(0, e.clientY - arr.dy) + 'px';
    painel.style.right = 'auto';
  });
  $('arrasta').addEventListener('pointerup', () => (arr = null));
  $('min').onclick = () => painel.classList.toggle('min');
  function esconde() {
    ativo = false;
    if (editandoTexto) terminaTexto();
    seleciona(null);
    caixaHover.style.display = 'none';
    host.style.display = 'none';
  }
  $('sair').onclick = () => { esconde(); };
  function exporta(modo, formato) {
    if (editandoTexto) terminaTexto();
    seleciona(null);
    caixaHover.style.display = 'none';
    chrome.runtime.sendMessage({ tipo: 'copiar', modo, formato });
    toast('Abrindo a cópia numa nova aba…');
  }
  $('expVisual').onclick = () => exporta('visual', 'zip');
  $('expUnico').onclick = () => exporta('visual', 'unico');
  $('expCompleto').onclick = () => exporta('completo', 'zip');

  window.__copiadorEditor = {
    mostra() { ativo = true; host.style.display = ''; toast('Modo edição ligado'); }
  };
  toast('Modo edição ligado: clique para selecionar, dois cliques para escrever');
})();
