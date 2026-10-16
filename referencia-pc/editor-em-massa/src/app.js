'use strict';
/* global Shared, Render, api */
const S = window.Shared;
const R = window.Render;
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ============================================================ estado
const state = {
  videos: [],          // { id, path, name, meta, thumb, settings, legenda, status, progress, out, error, edited }
  selected: new Set(),
  currentId: null,
  draft: null,         // ajustes do painel (ainda não aplicados)
  scope: 'este',
  tab: 'recorte',
  filter: 'todos',
  search: '',
  profiles: {},
  profile: 'Padrão',
  outDir: '',
  concurrency: 2,
  processing: false,
  batch: null
};
let idSeq = 1;

// ============================================================ utilidades
const basename = (p) => String(p || '').split(/[\\/]/).pop();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (s) => {
  s = Math.max(0, s || 0);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const getPath = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setPath(obj, p, val) {
  const ks = p.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
}
function fileUrl(p) {
  let s = String(p).replace(/\\/g, '/');
  if (!s.startsWith('/')) s = '/' + s;
  return 'file://' + s.split('/').map((seg, i) => (i === 1 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg))).join('/');
}
function toast(msg, type = 'info', ms = 3800) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, ms);
}
async function pool(items, n, fn) {
  let i = 0;
  const worker = async () => {
    while (i < items.length) await fn(items[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}
const DEMO_META = { width: 1920, height: 1080, duration: 10, hasAudio: true };
const byId = (id) => state.videos.find((v) => v.id === id) || null;
const current = () => byId(state.currentId);
const profileSettings = () => state.profiles[state.profile];

// ============================================================ perfis
function loadProfiles() {
  let raw = {};
  try {
    raw = JSON.parse(localStorage.getItem('eem.profiles')) || {};
  } catch (_) {}
  state.profiles = {};
  for (const [k, v] of Object.entries(raw)) state.profiles[k] = S.merge(S.DEFAULTS, v);
  if (!Object.keys(state.profiles).length) state.profiles['Padrão'] = S.clone(S.DEFAULTS);
  state.profile = localStorage.getItem('eem.profile');
  if (!state.profiles[state.profile]) state.profile = Object.keys(state.profiles)[0];
}
function saveProfiles() {
  localStorage.setItem('eem.profiles', JSON.stringify(state.profiles));
  localStorage.setItem('eem.profile', state.profile);
}
function renderProfiles() {
  $('#profileSel').innerHTML = Object.keys(state.profiles)
    .map((n) => `<option ${n === state.profile ? 'selected' : ''}>${esc(n)}</option>`)
    .join('');
  $('#profileDel').disabled = Object.keys(state.profiles).length < 2;
}

// ============================================================ importação
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

// extras (opcional): Map caminho → { legenda, capaTitulo, words, emojis, corte, ajustar(v) } — usado pelos Cortes Virais
async function importPaths(paths, extras) {
  const fresh = [];
  for (const p of paths) {
    if (!VIDEO_EXT.test(p) || state.videos.some((v) => v.path === p)) continue;
    const x = (extras && extras.get(p)) || {};
    const v = {
      id: 'v' + idSeq++,
      path: p,
      name: basename(p),
      meta: null,
      thumb: null,
      // mesa vazia: herda o que está no painel; senão, o padrão do perfil
      settings: S.clone(current() || !state.draft ? profileSettings() : state.draft),
      legenda: x.legenda || '',
      capaTitulo: x.capaTitulo || '',
      words: x.words || null,     // legenda animada: [{ w, s, e }] em segundos do arquivo
      emojis: x.emojis || null,   // [{ s, e, ch }]
      corte: x.corte || null,     // dados do corte viral (nota, título, descrição)
      capVer: 0,
      status: 'carregando',
      progress: 0,
      edited: false
    };
    if (x.ajustar) v._ajustar = x.ajustar;
    state.videos.push(v);
    fresh.push(v);
  }
  if (!fresh.length) {
    if (paths.length) toast('Nenhum vídeo novo para importar', 'warn');
    return;
  }
  renderAll();
  await pool(fresh, 3, async (v) => {
    try {
      v.meta = await api.probe(v.path);
      v.status = 'pendente';
      if (v._ajustar) {
        try {
          v._ajustar(v);
          v.edited = true;
        } catch (_) {}
        delete v._ajustar;
        if (v.id === state.currentId) {
          state.draft = S.clone(v.settings);
          syncControls();
        }
      }
      renderCard(v);
      if (!state.currentId) openVideo(v.id);
      v.thumb = await api.thumb(v.path, v.meta.duration);
    } catch (err) {
      v.status = 'erro';
      v.error = 'Não foi possível ler este arquivo';
    }
    renderCard(v);
  });
  renderAll();
  if (!extras) toast(`${fresh.length} vídeo(s) importado(s)`, 'ok');
  return fresh;
}

// ============================================================ mesa de produção
function visibleVideos() {
  const q = state.search.trim().toLowerCase();
  return state.videos.filter((v) => {
    if (q && !v.name.toLowerCase().includes(q)) return false;
    if (state.filter === 'pendentes') return ['pendente', 'fila', 'processando', 'carregando'].includes(v.status);
    if (state.filter === 'prontos') return v.status === 'pronto';
    if (state.filter === 'erros') return v.status === 'erro';
    return true;
  });
}

function cardHTML(v) {
  const i = state.videos.indexOf(v);
  const sel = state.selected.has(v.id);
  const m = v.meta;
  let st = '';
  switch (v.status) {
    case 'carregando': st = '<span class="st">Carregando…</span>'; break;
    case 'pendente': st = v.edited ? '<span class="st info">● Ajustado · pendente</span>' : '<span class="st">Pendente</span>'; break;
    case 'fila': st = '<span class="st info">Na fila…</span>'; break;
    case 'processando':
      st = `<span class="st info">${esc(v.stage || 'Processando')} ${Math.round(v.progress * 100)}%</span>`;
      break;
    case 'pronto': st = '<span class="st ok">✓ Pronto</span>'; break;
    case 'erro': st = `<span class="st err" title="${esc(v.error)}">✕ ${esc(v.error === 'Cancelado' ? 'Cancelado' : 'Erro')}</span>`; break;
  }
  const legTitle = v.legenda ? esc(v.legenda) : 'Sem legenda';
  return `<div class="card${sel ? ' sel' : ''}${v.id === state.currentId ? ' cur' : ''}" data-id="${v.id}">
    <div class="mini">
      ${m ? '<canvas></canvas>' : '<div class="ph">🎬</div>'}
      <span class="idx">${String(i + 1).padStart(2, '0')}</span>
      <button class="chk${sel ? ' on' : ''}" data-act="sel" title="Selecionar">${sel ? '✓' : ''}</button>
      <span class="previa-tag" title="Mostrando os ajustes do painel. Clique em Aplicar para confirmar.">PRÉVIA</span>
      ${m ? `<span class="dur">${fmtTime(m.duration)}</span>` : ''}
      ${v.corte ? `<span class="corte-tag" title="Corte viral · nota da IA">🔥 ${esc(v.corte.nota)}</span>` : ''}
      ${v.status === 'processando' ? `<div class="bar mini-bar"><i style="width:${(v.progress * 100).toFixed(1)}%"></i></div>` : ''}
    </div>
    <div class="info">
      <div class="name" title="${esc(v.path)}">${esc(v.name)}</div>
      <div class="sub">${m ? `${m.width}×${m.height}${m.hasAudio ? '' : ' · sem áudio'}` : '—'}${v.words && v.words.length ? ' · 💬' : ''}</div>
      <div class="status">${st}</div>
      <div class="acts">
        <button class="btn ghost xs" data-act="leg" title="Legenda: ${legTitle}">✎</button>
        <button class="btn ghost xs" data-act="crop" title="Recortar">✂</button>
        <button class="btn ghost xs" data-act="cap" title="Legenda animada">💬</button>
        ${v.status === 'pronto' ? '<button class="btn ghost xs" data-act="show" title="Mostrar o arquivo pronto">📂</button>' : ''}
        <button class="btn ghost xs danger" data-act="rm" title="Tirar da lista (o arquivo não é apagado)">✕</button>
      </div>
    </div>
  </div>`;
}

function renderGrid() {
  const list = visibleVideos();
  miniIO.disconnect();
  miniVis.clear();
  $('#grid').innerHTML = list.map(cardHTML).join('');
  $$('#grid .mini canvas').forEach((c) => miniIO.observe(c));
  $('#empty').classList.toggle('hidden', state.videos.length > 0);
  $('#grid').classList.toggle('hidden', state.videos.length === 0);
}
function renderCard(v) {
  const el = $(`.card[data-id="${v.id}"]`);
  if (!el) return;
  const old = $('.mini canvas', el);
  if (old) miniIO.unobserve(old);
  el.outerHTML = cardHTML(v);
  const c = $(`.card[data-id="${v.id}"] .mini canvas`);
  if (c) {
    miniIO.observe(c);
    drawCardMini(v);
  }
}

// ============================================================ mesa ao vivo (miniaturas editadas)
// Cada card mostra o quadro final do vídeo. Enquanto você mexe no painel, os vídeos do
// escopo (Este / Seleção / Todos) já mostram os ajustes novos, marcados com "PRÉVIA".
const miniVis = new Set();
const miniIO = new IntersectionObserver(
  (ents) => {
    for (const en of ents) {
      const card = en.target.closest('.card');
      if (!card) continue;
      const id = card.dataset.id;
      if (en.isIntersecting) {
        miniVis.add(id);
        const v = byId(id);
        if (v) drawCardMini(v);
      } else miniVis.delete(id);
    }
  },
  { root: document.querySelector('#grid'), rootMargin: '300px 0px' }
);
let miniCache = null;
function miniInfo() {
  if (!miniCache) {
    miniCache = { dirty: isDirty(), ids: new Set(targets().map((v) => v.id)) };
    queueMicrotask(() => (miniCache = null));
  }
  return miniCache;
}
function miniSettings(v) {
  const mi = miniInfo();
  if (state.draft && mi.dirty && mi.ids.has(v.id)) return { s: state.draft, previa: true };
  return { s: v.settings, previa: false };
}
const thumbImgs = new Map();
function thumbImg(v) {
  if (!v.thumb) return null;
  const t = thumbImgs.get(v.id);
  if (t && t.src === v.thumb) return t.img.complete && t.img.naturalWidth ? t.img : null;
  const img = new Image();
  img.onload = () => drawCardMini(v);
  img.src = v.thumb;
  thumbImgs.set(v.id, { img, src: v.thumb });
  return null;
}
function drawCardMini(v, frame) {
  const card = document.querySelector(`.card[data-id="${v.id}"]`);
  const cv = card && card.querySelector('.mini canvas');
  if (!cv || !v.meta) return;
  const cw = cv.clientWidth;
  if (!cw) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(cw * dpr), H = Math.round((W * 16) / 9);
  if (cv.width !== W) cv.width = W;
  if (cv.height !== H) cv.height = H;
  const { s, previa } = miniSettings(v);
  card.classList.toggle('previa', previa);
  const capa = state.tab === 'capa' && s.capa.ativo;
  const ctx = cv.getContext('2d');
  const quadro = frame || thumbImg(v);
  if (!quadro) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  R.drawMini(ctx, s, {
    meta: v.meta,
    frame: quadro,
    bgImg: s.template.fundoTipo === 'imagem' ? imgSync(s.template.fundoImagem) : null,
    custom: capa && s.capa.fonte === 'imagem' ? imgSync(s.capa.imagem) : null,
    logo: imgSync(s.template.logo),
    legenda: v.legenda,
    capa: capa ? { title: capaTitle(v, s) } : null,
    cap: capDe(v),
    capT: capTempoMini(v, s, quadro)
  });
}
// Legenda animada de um vídeo (ou null se ainda não foi transcrito).
function capDe(v) {
  return v && v.words && v.words.length ? { words: v.words, emojis: v.emojis || [] } : null;
}
// Instante mostrado na miniatura parada: a 2ª palavra do trecho usado (mostra o destaque).
function capTempoMini(v, s, quadro) {
  if (!v.words || !v.words.length) return 0;
  if (quadro && quadro.tagName === 'VIDEO') return quadro.currentTime;
  const T = S.timing(v.meta, s);
  const i = Math.max(0, v.words.findIndex((w) => w.s >= T.start));
  const w = v.words[Math.min(v.words.length - 1, i + 1)];
  return w.s + 0.2;
}
let miniRaf = 0;
function scheduleMinis() {
  if (miniRaf) return;
  miniRaf = requestAnimationFrame(() => {
    miniRaf = 0;
    for (const id of miniVis) {
      if (hov.v && hov.v.id === id) continue; // o card tocando se redesenha sozinho
      const v = byId(id);
      if (v) drawCardMini(v);
    }
  });
}
// Passar o mouse num card toca o vídeo já editado dentro dele.
const hov = { v: null, vid: document.createElement('video'), raf: 0 };
hov.vid.muted = true;
hov.vid.playsInline = true;
hov.vid.preload = 'auto';
function startHover(v) {
  stopHover();
  if (!v || !v.meta) return;
  hov.v = v;
  const T = S.timing(v.meta, miniSettings(v).s);
  hov.vid.src = fileUrl(v.path);
  hov.vid.onloadedmetadata = () => {
    hov.vid.currentTime = T.start;
    hov.vid.play().catch(() => {});
  };
  const loop = () => {
    if (hov.v !== v) return;
    const T2 = S.timing(v.meta, miniSettings(v).s);
    hov.vid.playbackRate = T2.speed;
    if (hov.vid.readyState >= 2) {
      if (hov.vid.currentTime >= T2.end - 0.05 || hov.vid.currentTime < T2.start - 0.3) hov.vid.currentTime = T2.start;
      drawCardMini(v, hov.vid);
    }
    hov.raf = requestAnimationFrame(loop);
  };
  hov.raf = requestAnimationFrame(loop);
}
function stopHover() {
  if (!hov.v) return;
  const v = hov.v;
  hov.v = null;
  cancelAnimationFrame(hov.raf);
  hov.vid.pause();
  hov.vid.removeAttribute('src');
  hov.vid.load();
  drawCardMini(v);
}
function renderCounts() {
  const c = { todos: state.videos.length, pendentes: 0, prontos: 0, erros: 0 };
  for (const v of state.videos) {
    if (['pendente', 'fila', 'processando', 'carregando'].includes(v.status)) c.pendentes++;
    if (v.status === 'pronto') c.prontos++;
    if (v.status === 'erro') c.erros++;
  }
  $$('#filters button').forEach((b) => {
    b.querySelector('b').textContent = c[b.dataset.f];
    b.classList.toggle('on', b.dataset.f === state.filter);
  });
  $('#countPill').textContent = `${state.videos.length} vídeo${state.videos.length === 1 ? '' : 's'}`;
  const vis = visibleVideos();
  $('#btnSelAll').textContent = vis.length && vis.every((v) => state.selected.has(v.id)) ? 'Limpar seleção' : 'Selecionar tudo';
}
function renderAll() {
  renderGrid();
  renderCounts();
  renderScope();
  renderApply();
  renderProcessUI();
}

// ============================================================ escopo e aplicar
function targets() {
  if (state.scope === 'este') return current() ? [current()] : [];
  if (state.scope === 'selecao') return state.videos.filter((v) => state.selected.has(v.id));
  return state.videos.slice();
}
function isDirty() {
  const base = current() ? current().settings : profileSettings();
  return !!state.draft && JSON.stringify(state.draft) !== JSON.stringify(base);
}
function renderScope() {
  const [este, sel, todos] = $$('#scopeSeg button');
  este.disabled = !current();
  sel.textContent = `Seleção (${state.selected.size})`;
  todos.textContent = `Todos (${state.videos.length})`;
  $$('#scopeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === state.scope));
  const hints = {
    este: current()
      ? `Você está editando só o “${current().name}”.`
      : state.videos.length
        ? 'Abra um vídeo clicando nele na mesa.'
        : 'Mesa vazia: o que você ajustar agora vale para os vídeos que importar.',
    selecao: 'Ajuste o painel e clique em Aplicar para mudar todos os vídeos marcados.',
    todos: 'Ajuste o painel e clique em Aplicar para mudar todos os vídeos da mesa.'
  };
  $('#scopeHint').textContent = hints[state.scope];
}
function renderApply() {
  const btn = $('#btnApply');
  if (!state.videos.length) {
    btn.textContent = 'Usar nos próximos vídeos';
    btn.disabled = false;
    btn.classList.toggle('pulse', isDirty());
    return;
  }
  const n = targets().length;
  const label = { este: 'Aplicar neste vídeo', selecao: `Aplicar na seleção (${n})`, todos: `Aplicar em todos (${n})` };
  btn.textContent = label[state.scope];
  btn.disabled = n === 0;
  btn.classList.toggle('pulse', isDirty() && n > 0);
}
function aplicar(quiet) {
  if (quiet === true && !state.videos.length) return;
  if (!state.videos.length) {
    // mesa vazia: os ajustes viram o padrão do perfil para os vídeos que forem importados
    state.profiles[state.profile] = S.clone(state.draft);
    saveProfiles();
    toast(`Ajustes guardados no perfil “${state.profile}”. Os vídeos que você importar já entram com eles.`, 'ok', 5000);
    renderApply();
    return;
  }
  const ts = targets();
  if (!ts.length) return quiet === true ? null : toast('Nenhum vídeo nesse escopo', 'warn');
  let mudouStatus = false;
  for (const v of ts) {
    if (['fila', 'processando'].includes(v.status)) continue;
    v.settings = S.clone(state.draft);
    if (!v.edited) mudouStatus = true;
    v.edited = true;
    if (v.meta && (v.status === 'pronto' || v.status === 'erro')) {
      v.status = 'pendente';
      mudouStatus = true;
    }
  }
  if (quiet === true) {
    if (mudouStatus) renderGrid();
    else scheduleMinis();
    renderCounts();
    renderApply();
    return;
  }
  toast(`Ajustes aplicados em ${ts.length} vídeo(s)`, 'ok');
  renderAll();
}
// "Aplicar na hora": cada ajuste do painel já vale para os vídeos do escopo.
let autoT = 0;
function autoAplicar() {
  if (!state.autoApply || !state.videos.length || !isDirty()) return;
  clearTimeout(autoT);
  autoT = setTimeout(() => aplicar(true), 220);
}

// ============================================================ abrir vídeo
function openVideo(id) {
  const v = byId(id);
  if (!v || !v.meta) {
    if (v && v.error) toast(v.error, 'err');
    return;
  }
  if (state.currentId && state.currentId !== id && isDirty()) toast('Ajustes que não foram aplicados ficaram para trás', 'warn');
  if (crop.open && state.currentId !== id) closeCrop();
  state.currentId = id;
  state.draft = S.clone(v.settings);
  syncControls();
  syncLimpeza();
  syncFiltroThumbs();
  loadPreview();
  renderAll();
}

// ============================================================ controles do painel
const FMT = {
  x: (v) => Number(v).toFixed(2) + '×',
  pct: (v) => Math.round(v * 100) + '%',
  'int%': (v) => Math.round(v) + '%',
  int: (v) => Math.round(v),
  px: (v) => Math.round(v) + 'px',
  n2: (v) => Number(v).toFixed(2),
  mbps: (v) => v + ' Mbps',
  seg: (v) => Number(v).toFixed(1).replace('.', ',') + 's'
};
function updateOutputs() {
  $$('output[data-for]').forEach((o) => {
    const val = getPath(state.draft, o.dataset.for);
    o.textContent = (FMT[o.dataset.fmt] || String)(val);
  });
}
function updateVisibility() {
  $$('[data-show]').forEach((el) => {
    const [p, vals] = el.dataset.show.split('=');
    const val = getPath(state.draft, p);
    const show = vals ? vals.split('|').includes(String(val)) : !!val;
    el.classList.toggle('hidden', !show);
  });
}
function syncControls() {
  if (!state.draft) return;
  $$('[data-k]').forEach((el) => {
    const val = getPath(state.draft, el.dataset.k);
    if (el.classList.contains('seg')) {
      $$('button', el).forEach((b) => b.classList.toggle('on', String(val) === b.dataset.v));
    } else if (el.type === 'checkbox') el.checked = !!val;
    else el.value = val ?? '';
  });
  $$('[data-fname]').forEach((el) => {
    const val = getPath(state.draft, el.dataset.fname);
    el.textContent = val ? basename(val) : 'Nenhum';
    el.title = val || '';
  });
  const v = current();
  const ct = $('#capaTitulo');
  ct.value = v ? v.capaTitulo : '';
  ct.disabled = !v;
  $('#capaTempo').max = v && v.meta ? Math.max(0.1, S.timing(v.meta, state.draft).outDur).toFixed(1) : 60;
  const leg = $('#legenda');
  leg.value = v ? v.legenda : '';
  leg.disabled = !v;
  $('#legCount').textContent = `${leg.value.length} caracteres`;
  updateOutputs();
  updateVisibility();
  syncLegendaPanel();
  const { CW, CH } = S.canvasSize(state.draft, current()?.meta);
  $('#saidaInfo').textContent = `Saída: ${CW}×${CH} · H.264 · AAC · MP4. “Automático” tenta a GPU NVIDIA e cai para CPU se não der. 4K/8K usam uma tarefa por vez; 8K pode ser lento. A melhoria é aplicada na exportação.`;
}
function onDraftChange() {
  syncControls();
  updateOutputs();
  updateVisibility();
  renderApply();
  renderPreview();
  scheduleMinis();
  autoAplicar();
}

function bindControls() {
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-k]');
    if (!el || el.classList.contains('seg') || !state.draft) return;
    let val;
    if (el.type === 'checkbox') val = el.checked;
    else if (el.type === 'range' || el.type === 'number' || el.dataset.type === 'num') val = parseFloat(el.value) || 0;
    else val = el.value;
    setPath(state.draft, el.dataset.k, val);
    // mantém botões de atalho em sincronia com o slider
    $$(`.seg[data-k="${el.dataset.k}"] button`).forEach((b) => b.classList.toggle('on', String(val) === b.dataset.v));
    onDraftChange();
  });

  document.addEventListener('click', async (e) => {
    const segBtn = e.target.closest('.seg[data-k] > button');
    if (segBtn && state.draft) {
      const seg = segBtn.parentElement;
      let val = segBtn.dataset.v;
      if (seg.dataset.type === 'num') val = parseFloat(val);
      setPath(state.draft, seg.dataset.k, val);
      if (seg.dataset.k === 'texto.pos') state.draft.texto.v = { topo: 14, centro: 50, base: 78 }[val];
      syncControls();
      onDraftChange();
      return;
    }
    const pick = e.target.closest('[data-pick]');
    if (pick && state.draft) {
      const f = await api.pickFile(pick.dataset.kind);
      if (f) {
        imgFalhou.delete(f);
        imgCache.delete(f);
        setPath(state.draft, pick.dataset.pick, f);
        syncControls();
        onDraftChange();
      }
      return;
    }
    const clr = e.target.closest('[data-clear]');
    if (clr && state.draft) {
      setPath(state.draft, clr.dataset.clear, null);
      syncControls();
      onDraftChange();
    }
  });
}

// ============================================================ filtros (miniaturas)
function buildFiltros() {
  $('#fxGrid').innerHTML = Object.entries(S.FILTROS)
    .map(([k, f]) => {
      const fx = S.filtroSpec({ filtro: k, filtroForca: 1 });
      const filt = fx ? `url(#${R.filtroId(fx)})` : 'none';
      const vin = fx && fx.vin ? R.vinheta(fx.vin) : 'none';
      return `<button data-v="${k}" title="${esc(f.nome)}"><span class="fx-sw" style="filter:${filt}"><img alt="" hidden><i style="background:${vin}"></i></span>${esc(f.nome)}</button>`;
    })
    .join('');
}
// Mostra o vídeo aberto em cada miniatura de filtro.
function syncFiltroThumbs() {
  const v = current();
  const src = v && v.thumb ? v.thumb : '';
  $$('#fxGrid img').forEach((img) => {
    if (src) {
      if (img.getAttribute('src') !== src) img.src = src;
      img.hidden = false;
    } else img.hidden = true;
  });
}

function switchTab(tab) {
  state.tab = tab;
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.panels section').forEach((s) => s.classList.toggle('on', s.dataset.panel === tab));
  if (tab === 'filtros') syncFiltroThumbs();
  if (tab === 'legendas') syncLegendaPanel();
  renderPreview();
  scheduleMinis();
}

// ============================================================ imagens (logo, fundo)
const imgCache = new Map();
async function loadImg(p) {
  const img = new Image();
  img.src = await api.readDataUrl(p);
  await img.decode();
  return img;
}
const imgFalhou = new Set(); // imagens que não abriram: não tenta de novo nem repete o aviso
function imgSync(p) {
  if (!p || imgFalhou.has(p)) return null;
  const c = imgCache.get(p);
  if (c instanceof HTMLImageElement) return c;
  if (!c) {
    imgCache.set(
      p,
      loadImg(p)
        .then((img) => {
          imgCache.set(p, img);
          renderPreview();
          scheduleMinis();
          return img;
        })
        .catch(() => {
          imgCache.delete(p);
          imgFalhou.add(p);
          toast(`Não foi possível abrir a imagem ${basename(p)}. Ela foi movida ou apagada? Escolha a imagem de novo (Template ou Capa).`, 'err', 7000);
          return null;
        })
    );
  }
  return null;
}
async function imgAsync(p) {
  if (!p) return null;
  const c = imgCache.get(p);
  if (c instanceof HTMLImageElement) return c;
  if (c) return await c;
  const img = await loadImg(p);
  imgCache.set(p, img);
  return img;
}

// ============================================================ preview
// Preview usa uma superfície reduzida; a composição mantém as coordenadas da saída.
function previewContext(canvas, CW, CH) {
  const k = Math.min(1, 1920 / Math.max(CW, CH));
  const w = Math.round(CW * k), h = Math.round(CH * k);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(w / CW, 0, 0, h / CH, 0, 0);
  return ctx;
}
const pv = { fg: $('#fgVideo'), bg: $('#bgVideo'), music: $('#pvMusic'), loadedId: null, musicSrc: null };

function fitStage() {
  if (!state.draft) return;
  const { CW, CH } = S.canvasSize(state.draft, current()?.meta);
  const wrap = $('#stageWrap');
  const k = Math.min(wrap.clientWidth / CW, wrap.clientHeight / CH);
  const st = $('#stage');
  st.style.width = CW + 'px';
  st.style.height = CH + 'px';
  st.style.transform = `translate(${(wrap.clientWidth - CW * k) / 2}px, ${(wrap.clientHeight - CH * k) / 2}px) scale(${k})`;
}

function loadPreview() {
  const v = current();
  if (!v || !v.meta) {
    pv.loadedId = null;
    pv.fg.removeAttribute('src');
    pv.bg.removeAttribute('src');
    pv.fg.load();
    renderPreview();
    return;
  }
  if (pv.loadedId !== v.id) {
    pv.loadedId = v.id;
    const url = fileUrl(v.path);
    pv.fg.src = url;
    pv.bg.src = url;
    pv.fg.onloadedmetadata = () => seekTo(0);
    pv.fg.onerror = () => toast('O preview não abre este formato, mas o processamento funciona normalmente.', 'warn', 5000);
  }
  renderPreview();
}

function renderPreview() {
  const s = state.draft;
  if (!s) return;
  const { CW, CH } = S.canvasSize(s, current()?.meta);
  fitStage();
  $('#pvRes').textContent = `${CW}×${CH}`;
  const v = current();
  const has = !!(v && v.meta);
  // Sem vídeo aberto: usa um quadro de exemplo 16:9 para os ajustes aparecerem.
  const meta = has ? v.meta : DEMO_META;
  $('#pvEmpty').classList.add('hidden');
  $('#fgInner').classList.toggle('demo', !has);
  pv.fg.style.visibility = has ? 'visible' : 'hidden';

  const bgc = $('#bgCanvas');
  const bctx = previewContext(bgc, CW, CH);
  R.drawBackground(bctx, s, CW, CH, s.template.fundoTipo === 'imagem' ? imgSync(s.template.fundoImagem) : null);
  if (!has && s.template.fundoTipo === 'blur') {
    const g = bctx.createLinearGradient(0, 0, CW, CH);
    g.addColorStop(0, '#3b2a6b');
    g.addColorStop(1, '#0f3d4a');
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, CW, CH);
  }

  const e = s.efeitos;
  const filt = R.cssFilter(e);
  const box = $('#fgBox');
  {
    const L = S.layout(meta, s);
    Object.assign(box.style, {
      display: 'block',
      left: L.x + 'px',
      top: L.y + 'px',
      width: L.dw + 'px',
      height: L.dh + 'px',
      borderWidth: L.F + 'px',
      borderColor: s.template.molduraCor
    });
    $('#fgInner').style.transform = e.espelhar ? 'scaleX(-1)' : 'none';
    $('#fgInner').style.filter = has ? 'none' : filt;
    const fxv = S.filtroSpec(e);
    $('#fgVin').style.background = fxv && fxv.vin ? R.vinheta(fxv.vin) : 'none';
    Object.assign(pv.fg.style, {
      width: meta.width * L.k + 'px',
      height: meta.height * L.k + 'px',
      left: -(L.left * L.k) - (L.sw - L.dw) / 2 + 'px',
      top: -(L.top * L.k) - (L.sh - L.dh) / 2 + 'px',
      filter: filt
    });
    const blur = has && s.template.fundoTipo === 'blur';
    pv.bg.style.display = blur ? 'block' : 'none';
    pv.bg.style.filter = `${filt} blur(${Math.round((24 * CW) / 1080)}px) brightness(0.8)`;
    pv.bg.style.transform = (e.espelhar ? 'scaleX(-1) ' : '') + 'scale(1.1)';
    if (has) {
      const rate = S.timing(meta, s).speed;
      pv.fg.playbackRate = rate;
      pv.bg.playbackRate = rate;
      syncAudio();
    }
  }

  const ovc = $('#ovCanvas');
  R.drawOverlay(previewContext(ovc, CW, CH), s, v ? v.legenda : '', CW, CH, imgSync(s.template.logo), {
    placeholder: state.tab === 'texto'
  });
  renderCapaPreview(s, CW, CH, v, has);
  renderTrim();
  renderPvMeta();
  updateSeekUI();
}

function syncAudio() {
  const a = state.draft.audio;
  const music = (a.modo === 'substituir' || a.modo === 'mixar') && a.musica;
  pv.fg.muted = a.modo === 'mudo' || (a.modo === 'substituir' && !!a.musica);
  pv.fg.volume = Math.min(1, Math.max(0, a.volume));
  if (music) {
    if (pv.musicSrc !== a.musica) {
      pv.musicSrc = a.musica;
      pv.music.src = fileUrl(a.musica);
    }
    pv.music.volume = Math.min(1, Math.max(0, a.musicaVolume));
    if (!pv.fg.paused && pv.music.paused) pv.music.play().catch(() => {});
  } else if (!pv.music.paused) pv.music.pause();
}

function trimRange() {
  const v = current();
  if (!v || !v.meta || !state.draft) return null;
  return S.timing(v.meta, state.draft);
}
function seekTo(frac) {
  const T = trimRange();
  if (!T) return;
  const t = T.start + frac * T.inDur;
  pv.fg.currentTime = t;
  pv.bg.currentTime = t;
  if (pv.musicSrc && pv.music.duration) pv.music.currentTime = ((frac * T.inDur) / T.speed) % pv.music.duration;
}
function updateSeekUI() {
  const T = trimRange();
  if (!T) {
    $('#pvTime').textContent = '0:00 / 0:00';
    return;
  }
  const rel = Math.max(0, pv.fg.currentTime - T.start);
  $('#pvSeek').value = Math.round((rel / T.inDur) * 1000);
  $('#pvTime').textContent = `${fmtTime(rel / T.speed)} / ${fmtTime(T.outDur)}`;
  $('#pvPlay').textContent = pv.fg.paused ? '▶' : '❚❚';
}
function togglePlay() {
  if (!current()) return;
  if (pv.fg.paused) {
    pv.fg.play().catch(() => {});
    if (state.draft.template.fundoTipo === 'blur') pv.bg.play().catch(() => {});
    syncAudio();
  } else {
    pv.fg.pause();
    pv.bg.pause();
    pv.music.pause();
  }
  updateSeekUI();
}
// ---------- capa no preview (aparece na aba Capa com o vídeo pausado)
const capaShowing = () => state.tab === 'capa' && state.draft && state.draft.capa.ativo && pv.fg.paused;
// Texto que vai na capa: título próprio, a legenda do vídeo ou nada.
function capaTitle(v, s) {
  if (!v || s.capa.texto === 'nenhum') return '';
  if (s.capa.texto === 'legenda') return v.legenda || '';
  return v.capaTitulo || '';
}
function renderCapaPreview(s, CW, CH, v, has) {
  const cc = $('#capaCanvas');
  const show = capaShowing();
  cc.classList.toggle('on', show);
  if (!show) return;
  const coverCtx = previewContext(cc, CW, CH);
  if (has && s.capa.fonte === 'frame') {
    const want = S.capaSourceTime(v.meta, s);
    if (!pv.fg.seeking && Math.abs(pv.fg.currentTime - want) > 0.04) pv.fg.currentTime = want;
  }
  R.drawCover(coverCtx, s, {
    CW,
    CH,
    meta: has ? v.meta : DEMO_META,
    frame: has && pv.fg.readyState >= 2 ? pv.fg : null,
    bgImg: s.template.fundoTipo === 'imagem' ? imgSync(s.template.fundoImagem) : null,
    custom: s.capa.fonte === 'imagem' ? imgSync(s.capa.imagem) : null,
    logo: imgSync(s.template.logo),
    title: capaTitle(v, s),
    placeholder: s.capa.texto !== 'nenhum'
  });
}

function bindPreview() {
  pv.fg.addEventListener('timeupdate', () => {
    const T = trimRange();
    if (!T) return;
    if (pv.fg.currentTime >= T.end - 0.03 || pv.fg.currentTime < T.start - 0.2) seekTo(0);
    if (Math.abs(pv.bg.currentTime - pv.fg.currentTime) > 0.3) pv.bg.currentTime = pv.fg.currentTime;
    updateTrimHead();
    updateSeekUI();
  });
  pv.fg.addEventListener('pause', updateSeekUI);
  pv.fg.addEventListener('play', () => {
    updateSeekUI();
    $('#capaCanvas').classList.remove('on');
  });
  pv.fg.addEventListener('seeked', () => capaShowing() && renderPreview());
  pv.fg.addEventListener('loadeddata', () => capaShowing() && renderPreview());
  pv.fg.addEventListener('pause', () => capaShowing() && renderPreview());
  $('#pvPlay').onclick = togglePlay;
  $('#pvSeek').oninput = (e) => {
    // na aba Capa a barra escolhe o momento da capa
    if (capaShowing() && current() && state.draft.capa.fonte === 'frame') {
      state.draft.capa.tempo = +((e.target.value / 1000) * S.timing(current().meta, state.draft).outDur).toFixed(2);
      updateOutputs();
      $('#capaTempo').value = state.draft.capa.tempo;
      renderApply();
      renderPreview();
      return;
    }
    seekTo(e.target.value / 1000);
  };
  new ResizeObserver(fitStage).observe($('#stageWrap'));
  document.fonts.addEventListener('loadingdone', () => {
    renderPreview();
    scheduleMinis();
  });
}
function renderPvMeta() {
  const v = current();
  const el = $('#pvMeta');
  if (!v) {
    el.innerHTML = '<b>Prévia com vídeo de exemplo</b><br>Importe vídeos para ver o resultado real.';
    return;
  }
  const T = v.meta ? S.timing(v.meta, state.draft) : null;
  let html = `<b>${esc(v.name)}</b><br>`;
  if (T) html += `Duração final ${fmtTime(T.outDur)} · origem ${v.meta.width}×${v.meta.height}`;
  if (v.status === 'erro' && v.error) html += `<br><span class="err">${esc(v.error)}</span>`;
  if (v.status === 'pronto' && v.out) html += `<br>Salvo em ${esc(v.out)}`;
  el.innerHTML = html;
}

// ============================================================ corte manual de tempo (linha do tempo)
const fmtT = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, '0')}`;
function trimVals() {
  const v = current();
  if (!v || !v.meta || !state.draft) return null;
  const d = v.meta.duration || 0.1, e = state.draft.efeitos;
  const a = Math.min(d, Math.max(0, e.corteInicio || 0));
  const b = Math.max(a, d - Math.max(0, e.corteFim || 0));
  return { v, d, a, b };
}
function updateTrimHead() {
  const t = trimVals();
  if (t) $('#trimHead').style.left = `calc(${((pv.fg.currentTime || 0) / t.d) * 100}% - 1px)`;
}
function renderTrim() {
  const t = trimVals();
  $('#trim').classList.toggle('off', !t);
  ['#btnMarkIn', '#btnMarkOut'].forEach((id) => ($(id).disabled = !t));
  if (!t) {
    Object.assign($('#trimSel').style, { left: '0%', width: '100%' });
    $('#trimInfo').textContent = 'Abra um vídeo para usar a linha do tempo.';
    return;
  }
  $('#trimA').value = Math.round((t.a / t.d) * 1000);
  $('#trimB').value = Math.round((t.b / t.d) * 1000);
  Object.assign($('#trimSel').style, { left: (t.a / t.d) * 100 + '%', width: ((t.b - t.a) / t.d) * 100 + '%' });
  const T = S.timing(t.v.meta, state.draft);
  $('#trimInfo').textContent = `Começa ${fmtT(t.a)} · termina ${fmtT(t.b)} · fica ${fmtT(T.outDur)}`;
  updateTrimHead();
}
function setTrim(a, b, seekAt) {
  const t = trimVals();
  if (!t) return;
  a = Math.max(0, Math.min(a, t.d - 0.5));
  b = Math.min(t.d, Math.max(b, a + 0.5));
  state.draft.efeitos.corteInicio = +a.toFixed(2);
  state.draft.efeitos.corteFim = +(t.d - b).toFixed(2);
  $$('input[data-k="efeitos.corteInicio"]').forEach((el) => (el.value = state.draft.efeitos.corteInicio));
  $$('input[data-k="efeitos.corteFim"]').forEach((el) => (el.value = state.draft.efeitos.corteFim));
  onDraftChange();
  if (seekAt !== undefined) {
    pv.fg.pause();
    pv.bg.pause();
    pv.fg.currentTime = seekAt;
    pv.bg.currentTime = seekAt;
  }
}
function bindTrim() {
  $('#trimA').addEventListener('input', (e) => {
    const t = trimVals();
    if (!t) return;
    const a = Math.min((e.target.value / 1000) * t.d, t.b - 0.5);
    setTrim(a, t.b, Math.max(0, a));
  });
  $('#trimB').addEventListener('input', (e) => {
    const t = trimVals();
    if (!t) return;
    const b = Math.max((e.target.value / 1000) * t.d, t.a + 0.5);
    setTrim(t.a, b, Math.max(t.a, b - 0.1));
  });
  $('#btnMarkIn').onclick = () => {
    const t = trimVals();
    if (t) setTrim(Math.min(pv.fg.currentTime, t.b - 0.5), t.b);
  };
  $('#btnMarkOut').onclick = () => {
    const t = trimVals();
    if (t) setTrim(t.a, Math.max(pv.fg.currentTime, t.a + 0.5));
  };
  $('#btnTrimReset').onclick = () => {
    if (!state.draft) return;
    state.draft.efeitos.corteInicio = 0;
    state.draft.efeitos.corteFim = 0;
    syncControls();
    onDraftChange();
  };
}

// ============================================================ recorte manual de área
const crop = { open: false, r: null, r0: null, ratio: 0, k: 1, ox: 0, oy: 0, W: 0, H: 0, drag: null };
const MIN_CROP = 32;

function openCrop() {
  const v = current();
  if (!v || !v.meta) return toast('Abra um vídeo primeiro (clique nele na mesa)', 'warn');
  pv.fg.pause();
  pv.bg.pause();
  pv.music.pause();
  const W = v.meta.width, H = v.meta.height, r = state.draft.recorte;
  crop.W = W;
  crop.H = H;
  const x = Math.min(W - MIN_CROP, Math.max(0, r.left || 0));
  const y = Math.min(H - MIN_CROP, Math.max(0, r.top || 0));
  crop.r = { x, y, w: Math.max(MIN_CROP, W - x - (r.right || 0)), h: Math.max(MIN_CROP, H - y - (r.bottom || 0)) };
  crop.ratio = 0;
  $$('#cropAspect button').forEach((b) => b.classList.toggle('on', b.dataset.r === '0'));
  crop.open = true;
  $('#cropUI').classList.remove('hidden');
  layoutCrop();
}
function closeCrop() {
  crop.open = false;
  crop.drag = null;
  $('#cropUI').classList.add('hidden');
}
function layoutCrop() {
  if (!crop.open) return;
  const area = $('#cropArea');
  const aw = area.clientWidth, ah = area.clientHeight;
  crop.k = Math.min((aw - 28) / crop.W, (ah - 28) / crop.H);
  const cw = Math.round(crop.W * crop.k), ch = Math.round(crop.H * crop.k);
  crop.ox = Math.round((aw - cw) / 2);
  crop.oy = Math.round((ah - ch) / 2);
  const c = $('#cropCanvas');
  c.width = cw;
  c.height = ch;
  Object.assign(c.style, { left: crop.ox + 'px', top: crop.oy + 'px', width: cw + 'px', height: ch + 'px' });
  drawCropFrame();
  renderCropRect();
}
function drawCropFrame() {
  if (!crop.open) return;
  const c = $('#cropCanvas'), ctx = c.getContext('2d');
  if (pv.fg.readyState >= 2) ctx.drawImage(pv.fg, 0, 0, c.width, c.height);
  else {
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, '#6d28d9');
    g.addColorStop(1, '#f59e0b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
  }
}
function renderCropRect() {
  const { r, k, ox, oy } = crop;
  Object.assign($('#cropRect').style, { left: ox + r.x * k + 'px', top: oy + r.y * k + 'px', width: r.w * k + 'px', height: r.h * k + 'px' });
  $('#cropSize').textContent = `${Math.round(r.w)}×${Math.round(r.h)}`;
}
const clampN = (n, a, b) => Math.min(b, Math.max(a, n));

// Retângulo a partir de um canto fixo (ax, ay) e um tamanho desejado, respeitando proporção e bordas.
function rectFromAnchor(ax, ay, sx, sy, w, h) {
  const { W, H, ratio } = crop;
  const maxW = sx > 0 ? W - ax : ax, maxH = sy > 0 ? H - ay : ay;
  w = clampN(Math.abs(w), MIN_CROP, Math.max(MIN_CROP, maxW));
  h = clampN(Math.abs(h), MIN_CROP, Math.max(MIN_CROP, maxH));
  if (ratio) {
    h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
  }
  return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
}
function applyRatio(ratio) {
  crop.ratio = ratio;
  if (!ratio) return;
  const { W, H, r } = crop;
  let h = Math.min(H, W / ratio), w = h * ratio;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  crop.r = { x: clampN(cx - w / 2, 0, W - w), y: clampN(cy - h / 2, 0, H - h), w, h };
  renderCropRect();
}
function bindCrop() {
  $('#btnCropManual').onclick = openCrop;
  $('#cropCancel').onclick = closeCrop;
  $('#cropFull').onclick = () => {
    crop.ratio = 0;
    $$('#cropAspect button').forEach((b) => b.classList.toggle('on', b.dataset.r === '0'));
    crop.r = { x: 0, y: 0, w: crop.W, h: crop.H };
    renderCropRect();
  };
  $('#cropAspect').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('#cropAspect button').forEach((x) => x.classList.toggle('on', x === b));
    applyRatio(parseFloat(b.dataset.r));
  };
  $('#cropOk').onclick = () => {
    const { r, W, H } = crop;
    const left = S.even(Math.round(r.x)), top = S.even(Math.round(r.y));
    const w = S.even(Math.round(r.w)), h = S.even(Math.round(r.h));
    Object.assign(state.draft.recorte, {
      left,
      top,
      right: Math.max(0, W - left - w),
      bottom: Math.max(0, H - top - h)
    });
    closeCrop();
    syncControls();
    onDraftChange();
    toast(
      state.scope === 'este' ? 'Recorte definido. Clique em “Aplicar neste vídeo”.' : 'Recorte definido. Clique em Aplicar para usar no escopo.',
      'info',
      4500
    );
  };

  const area = $('#cropArea');
  area.addEventListener('pointerdown', (e) => {
    if (!crop.open) return;
    const px = (e.clientX - area.getBoundingClientRect().left - crop.ox) / crop.k;
    const py = (e.clientY - area.getBoundingClientRect().top - crop.oy) / crop.k;
    const h = e.target.dataset && e.target.dataset.h;
    const { r } = crop;
    let mode = 'new';
    if (h) mode = h;
    else if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) mode = 'move';
    if (mode === 'new' && (px < 0 || py < 0 || px > crop.W || py > crop.H)) return;
    crop.drag = { mode, sx: e.clientX, sy: e.clientY, px: clampN(px, 0, crop.W), py: clampN(py, 0, crop.H), r0: { ...r } };
    area.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  area.addEventListener('pointermove', (e) => {
    const d = crop.drag;
    if (!d) return;
    const dx = (e.clientX - d.sx) / crop.k, dy = (e.clientY - d.sy) / crop.k;
    const r0 = d.r0, { W, H, ratio } = crop;
    if (d.mode === 'move') {
      crop.r = { ...r0, x: clampN(r0.x + dx, 0, W - r0.w), y: clampN(r0.y + dy, 0, H - r0.h) };
    } else if (d.mode === 'new') {
      const sx = dx >= 0 ? 1 : -1, sy = dy >= 0 ? 1 : -1;
      crop.r = rectFromAnchor(d.px, d.py, sx, sy, dx, dy);
    } else if (d.mode.length === 2) {
      // canto: o canto oposto fica parado
      const sx = d.mode.includes('e') ? 1 : -1, sy = d.mode.includes('s') ? 1 : -1;
      const ax = sx > 0 ? r0.x : r0.x + r0.w, ay = sy > 0 ? r0.y : r0.y + r0.h;
      crop.r = rectFromAnchor(ax, ay, sx, sy, r0.w + sx * dx, r0.h + sy * dy);
    } else {
      // borda
      let { x, y, w, h } = r0;
      if (d.mode === 'e') w = clampN(r0.w + dx, MIN_CROP, W - x);
      if (d.mode === 'w') { const nx = clampN(r0.x + dx, 0, r0.x + r0.w - MIN_CROP); w = r0.x + r0.w - nx; x = nx; }
      if (d.mode === 's') h = clampN(r0.h + dy, MIN_CROP, H - y);
      if (d.mode === 'n') { const ny = clampN(r0.y + dy, 0, r0.y + r0.h - MIN_CROP); h = r0.y + r0.h - ny; y = ny; }
      if (ratio) {
        if (d.mode === 'e' || d.mode === 'w') {
          const cy = r0.y + r0.h / 2;
          h = Math.min(w / ratio, 2 * Math.min(cy, H - cy));
          const nw = h * ratio;
          if (d.mode === 'w') x = x + w - nw;
          w = nw;
          y = cy - h / 2;
        } else {
          const cx = r0.x + r0.w / 2;
          w = Math.min(h * ratio, 2 * Math.min(cx, W - cx));
          const nh = w / ratio;
          if (d.mode === 'n') y = y + h - nh;
          h = nh;
          x = cx - w / 2;
        }
      }
      crop.r = { x, y, w, h };
    }
    renderCropRect();
  });
  const end = () => (crop.drag = null);
  area.addEventListener('pointerup', end);
  area.addEventListener('pointercancel', end);
  new ResizeObserver(layoutCrop).observe(area);
  pv.fg.addEventListener('loadeddata', drawCropFrame);
  pv.fg.addEventListener('seeked', drawCropFrame);
  window.addEventListener('keydown', (e) => {
    if (!crop.open) return;
    if (e.key === 'Escape') closeCrop();
    if (e.key === 'Enter' && !e.target.closest('input, textarea')) $('#cropOk').click();
  });
}

// ============================================================ recorte automático
async function detectarBordas() {
  const ts = targets().filter((v) => v.meta);
  if (!ts.length) return toast('Nenhum vídeo no escopo. Abra um vídeo ou escolha Seleção/Todos.', 'warn');
  const btn = $('#btnDetect');
  btn.disabled = true;
  btn.textContent = 'Detectando…';
  let found = 0;
  await pool(ts, 2, async (v) => {
    try {
      const c = await api.cropdetect(v.path, v.meta.duration, v.meta.width, v.meta.height);
      Object.assign(v.settings.recorte, c);
      if (v.id === state.currentId) Object.assign(state.draft.recorte, c);
      if (c.top || c.bottom || c.left || c.right) found++;
      v.edited = true;
    } catch (_) {}
  });
  btn.disabled = false;
  btn.textContent = '⌗ Detectar bordas no escopo';
  syncControls();
  renderAll();
  renderPreview();
  toast(found ? `Bordas encontradas e cortadas em ${found} de ${ts.length} vídeo(s)` : 'Nenhuma borda preta encontrada', found ? 'ok' : 'info');
}

// ============================================================ limpeza (somente seleção explícita)
function readLimpeza() {
  const c = { modo: $('#cleanMode').value, fonte: $('#cleanSource').value, papel: $('#cleanRole').value,
    metodo: $('#cleanMethod').value, topo: Number($('#cleanTop').value), base: Number($('#cleanBottom').value) };
  if (![c.topo, c.base].every((n) => Number.isFinite(n) && n >= 0 && n <= 90)) throw Error('Informe faixas entre 0 e 90%');
  for (const role of ['headline', 'legenda']) {
    c[role] = {};
    for (const key of ['x', 'y', 'w', 'h']) c[role][key] = Number($('#clean-' + role + '-' + key).value);
    const r = c[role];
    if (!Object.values(r).every(Number.isFinite) || r.x < 0 || r.y < 0 || r.w <= 0 || r.h <= 0 || r.x + r.w > 100 || r.y + r.h > 100) throw Error('As regiões precisam caber na imagem e ter largura e altura positivas');
  }
  return c;
}
function syncLimpeza() {
  const c = (current() && current().settings.limpeza) || S.DEFAULTS.limpeza;
  for (const [id, key] of [['cleanMode','modo'],['cleanSource','fonte'],['cleanRole','papel'],['cleanMethod','metodo'],['cleanTop','topo'],['cleanBottom','base']]) $('#' + id).value = c[key];
  for (const role of ['headline', 'legenda']) for (const key of ['x', 'y', 'w', 'h']) $('#clean-' + role + '-' + key).value = (c[role] || S.DEFAULTS.limpeza[role])[key];
  $('#cleanCanvas').style.display = 'none';
  $('#cleanResult').style.display = 'none';
}

function bindLimpeza() {
  for (const el of $('[id^=clean]')) if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.addEventListener('input', () => { $('#cleanResult').style.display = 'none'; $('#cleanCanvas').style.display = 'none'; $('#cleanPreviewStatus').textContent = 'Ajustes alterados. Gere um novo teste antes de aplicar.'; });
  for (const id of ['cleanMark', 'cleanPreview']) $('#' + id).addEventListener('click', async () => {
    const v = current();
    if (!v || !v.meta) return toast('Abra um vídeo primeiro', 'warn');
    const button = $('#' + id); button.disabled = true;
    try {
      const s = S.clone(state.draft); s.limpeza = readLimpeza();
      $('#cleanPreviewStatus').textContent = 'Gerando quadro…';
      const time = Number(pv.fg.currentTime) || 0;
      const data = id === 'cleanMark' ? await api.frame(v.path, time) : await api.cleanPreview(v.path, time, v.meta, s);
      if (current() !== v) return;
      if (!data) throw Error('Não foi possível ler o quadro');
      $('#cleanResult').style.display = id === 'cleanPreview' ? 'block' : 'none';
      $('#cleanCanvas').style.display = id === 'cleanMark' ? 'block' : 'none';
      if (id === 'cleanPreview') $('#cleanResult').src = data;
      else {
        const img = new Image(); img.src = data; await img.decode();
        const canvas = $('#cleanCanvas'); canvas.width = 480; canvas.height = Math.round(480 * v.meta.height / v.meta.width);
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (s.limpeza.metodo === 'reconstruir') for (const r of S.limpezaRects(v.meta, s)) {
          ctx.strokeStyle = r.role === 'headline' ? '#ff4040' : '#40ff80'; ctx.lineWidth = 2;
          ctx.strokeRect(r.x / v.meta.width * canvas.width, r.y / v.meta.height * canvas.height, r.w / v.meta.width * canvas.width, r.h / v.meta.height * canvas.height);
        } else {
          const L = S.layout(v.meta, s); ctx.strokeStyle = '#40ff80'; ctx.lineWidth = 2;
          ctx.strokeRect(L.left / v.meta.width * canvas.width, L.top / v.meta.height * canvas.height, L.cw / v.meta.width * canvas.width, L.ch / v.meta.height * canvas.height);
        }
      }
      $('#cleanPreviewStatus').textContent = 'Quadro em ' + time.toFixed(1) + ' s. Para salvar a escolha, aplique na seleção. Teste outros momentos também.';
    } catch (err) { $('#cleanPreviewStatus').textContent = err.message; toast(err.message, 'err'); }
    finally { button.disabled = false; }
  });
  $('#cleanApply').addEventListener('click', () => {
    if (state.processing) return toast('Aguarde o processamento terminar', 'warn');
    const ts = state.videos.filter((v) => state.selected.has(v.id) && v.meta);
    if (!ts.length) return toast('Selecione os vídeos na mesa primeiro', 'warn');
    let limpeza;
    try { limpeza = readLimpeza(); } catch (err) { return toast(err.message, 'warn'); }
    for (const v of ts) {
      v.settings.limpeza = S.clone(limpeza);
      v.edited = true;
      if (v.status === 'pronto' || v.status === 'erro') v.status = 'pendente';
    }
    if (current() && state.selected.has(current().id)) state.draft.limpeza = S.clone(limpeza);
    renderAll();
    renderPreview();
    toast('Limpeza aplicada em ' + ts.length + ' vídeo(s). Confira a prévia e processe a seleção.', 'ok', 6000);
  });
}

// ============================================================ legendas
function bindCapa() {
  $('#capaTitulo').addEventListener('input', (e) => {
    const v = current();
    if (!v) return;
    v.capaTitulo = e.target.value;
    if (v.status === 'pronto') v.status = 'pendente';
    renderCard(v);
    renderPreview();
  });
  $('#btnBatchCapa').onclick = () => $('#batchCapaBox').classList.toggle('hidden');
  $('#batchCapaClose').onclick = () => $('#batchCapaBox').classList.add('hidden');
  $('#batchCapaApply').onclick = () => {
    const lines = $('#batchCapaText').value.split('\n');
    let n = 0;
    state.videos.forEach((v, i) => {
      const line = (lines[i] || '').trim();
      if (!line) return;
      v.capaTitulo = line.replace(/\s*\|\s*/g, '\n');
      if (v.status === 'pronto') v.status = 'pendente';
      n++;
    });
    toast(`${n} título(s) de capa distribuído(s)`, n ? 'ok' : 'warn');
    syncControls();
    renderAll();
    renderPreview();
  };
  $('#btnCapaAgora').onclick = () => {
    const T = trimRange();
    if (!T) return toast('Abra um vídeo primeiro', 'warn');
    state.draft.capa.tempo = +(Math.max(0, pv.fg.currentTime - T.start) / T.speed).toFixed(2);
    pv.fg.pause();
    pv.bg.pause();
    pv.music.pause();
    syncControls();
    onDraftChange();
    toast('Momento da capa definido. Dê play pra escolher outro e clique de novo.', 'info');
  };
}

function bindLegendas() {
  $('#legenda').addEventListener('input', (e) => {
    const v = current();
    if (!v) return;
    v.legenda = e.target.value;
    if (v.status === 'pronto') v.status = 'pendente';
    $('#legCount').textContent = `${v.legenda.length} caracteres`;
    renderCard(v);
    renderPreview();
  });
  $('#btnBatchLeg').onclick = () => $('#batchBox').classList.toggle('hidden');
  $('#batchClose').onclick = () => $('#batchBox').classList.add('hidden');
  $('#batchApply').onclick = () => {
    const lines = $('#batchText').value.split('\n');
    let n = 0;
    state.videos.forEach((v, i) => {
      const line = (lines[i] || '').trim();
      if (!line) return;
      v.legenda = line.replace(/\s*\|\s*/g, '\n');
      if (v.status === 'pronto') v.status = 'pendente';
      n++;
    });
    toast(`${n} legenda(s) distribuída(s)`, n ? 'ok' : 'warn');
    syncControls();
    renderAll();
    renderPreview();
  };
}

// ============================================================ legenda animada
// Preview: a legenda é redesenhada a cada quadro no #capCanvas, no tempo do vídeo.
const capPv = { ultimo: '' };
function capLoop() {
  requestAnimationFrame(capLoop);
  const s = state.draft;
  const cv = $('#capCanvas');
  if (!s || !cv) return;
  const v = current();
  const cap = capDe(v);
  const demo = state.tab === 'legendas' && !cap;
  const ligado = s.legendaAnim.ativo || demo;
  if (!ligado || (!cap && !demo) || capaShowing()) {
    if (capPv.ultimo) {
      cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
      capPv.ultimo = '';
    }
    return;
  }
  const { CW, CH } = S.canvasSize(s, v?.meta);
  const t = demo ? (performance.now() / 1000) % 5.4 : pv.fg.currentTime;
  const chave = [demo ? 'demo' : v.id, v ? v.capVer : 0, t.toFixed(3), JSON.stringify(s.legendaAnim), CW].join('|');
  if (chave === capPv.ultimo) return;
  capPv.ultimo = chave;
  const ctx = previewContext(cv, CW, CH);
  ctx.clearRect(0, 0, CW, CH);
  const sd = demo ? { ...s, legendaAnim: { ...s.legendaAnim, ativo: true } } : s;
  if (demo) ctx.globalAlpha = s.legendaAnim.ativo ? 1 : 0.55;
  window.Legendas.desenhar(ctx, sd, demo ? capExemplo : cap, t, CW, CH);
  ctx.globalAlpha = 1;
}
const capExemplo = window.Legendas.exemplo(0.2);

function capMudou(v) {
  v.capVer = (v.capVer || 0) + 1;
  if (v.status === 'pronto') v.status = 'pendente';
  renderCard(v);
  syncLegendaPanel();
}

function syncLegendaPanel() {
  const v = current();
  const st = $('#legStatus');
  if (!st) return;
  const n = v && v.words ? v.words.length : 0;
  if (!v) st.innerHTML = '<span class="hint">Abra um vídeo para ver a legenda dele.</span>';
  else if (n) st.innerHTML = `<b>💬 ${n} palavras</b> neste vídeo${v.corte ? ' · corte viral 🔥 ' + esc(v.corte.nota) : ''}${state.draft.legendaAnim.ativo ? '' : ' · <span class="warn">legenda desligada</span>'}`;
  else st.innerHTML = '<span class="warn">Este vídeo ainda não tem legenda.</span> Clique em <b>Gerar legenda</b> abaixo.';
  const ta = $('#legTexto');
  if (document.activeElement !== ta) ta.value = n ? v.words.map((w) => w.w).join(' ') : '';
  ta.disabled = !n;
  $('#legTextoSalvar').disabled = !n;
  const lista = (v && v.emojis) || [];
  $('#emojiList').innerHTML = lista.length
    ? lista.map((e, i) => `<span class="emo" data-i="${i}" title="Ir para ${fmtT(e.s)}">${esc(e.ch)}<small>${fmtT(e.s)}</small><button data-rm="${i}" title="Tirar">✕</button></span>`).join('')
    : `<span class="hint">${n ? 'Nenhum emoji neste vídeo.' : 'Os emojis aparecem depois de gerar a legenda.'}</span>`;
}

const legJob = { rodando: false, parar: false };
async function transcreverEscopo() {
  if (legJob.rodando) return;
  const ts = targets().filter((v) => v.meta && v.meta.hasAudio);
  if (!ts.length) return toast(state.videos.length ? 'Nenhum vídeo com áudio no escopo (Este / Seleção / Todos).' : 'Importe vídeos primeiro', 'warn');
  legJob.rodando = true;
  legJob.parar = false;
  $('#btnTranscrever').disabled = true;
  $('#legProgBox').classList.remove('hidden');
  const opts = { idioma: $('#legIdioma').value, modelo: $('#legModelo').value, placa: localStorage.getItem('eem.placa') || 'auto' };
  let ok = 0, i = 0;
  try {
    for (const v of ts) {
      if (legJob.parar) break;
      i++;
      legJob.rotulo = ts.length > 1 ? `Vídeo ${i} de ${ts.length} · ` : '';
      $('#legProg').textContent = legJob.rotulo + 'começando…';
      try {
        const r = await api.transcrever(v.path, opts);
        v.words = r.words;
        v.emojis = window.Legendas.gerarEmojis(v.words, v.corte && v.corte.emojis);
        v.settings.legendaAnim.ativo = true;
        v.edited = true;
        if (v.id === state.currentId) state.draft.legendaAnim.ativo = true;
        capMudou(v);
        ok++;
      } catch (err) {
        const msg = erroIpc(err);
        if (msg === 'Cancelado') break;
        toast(`${v.name}: ${msg}`, 'err', 7000);
      }
    }
  } finally {
    legJob.rodando = false;
    $('#btnTranscrever').disabled = false;
    $('#legProgBox').classList.add('hidden');
    syncControls();
    onDraftChange();
  }
  if (ok) toast(`Legenda gerada em ${ok} vídeo(s). Ajuste o estilo e processe.`, 'ok', 5000);
}
const erroIpc = (err) => String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

const EMOJIS_RAPIDOS = ['🔥', '💰', '😂', '🤯', '💯', '🙏', '❤️', '💪', '🧠', '🎯', '🚀', '😱', '👀', '⚠️', '✅', '🏆'];
function bindLegendaAnim() {
  $('#btnTranscrever').onclick = transcreverEscopo;
  $('#legCancel').onclick = () => {
    legJob.parar = true;
    api.cortesCancelar();
  };
  for (const [id, chave] of [['#legIdioma', 'eem.legIdioma'], ['#legModelo', 'eem.legModelo']]) {
    const el = $(id);
    el.value = localStorage.getItem(chave) || el.value;
    el.onchange = () => localStorage.setItem(chave, el.value);
  }
  api.onCortesProgresso((d) => {
    if (d.origem !== 'mesa') return;
    $('#legBar').style.width = (d.geral * 100).toFixed(1) + '%';
    $('#legProg').textContent = (legJob.rotulo || '') + d.msg;
  });
  $('#legTextoSalvar').onclick = () => {
    const v = current();
    if (!v || !v.words) return;
    const novas = window.Legendas.realinhar(v.words, $('#legTexto').value);
    if (!novas.length) return toast('O texto ficou vazio', 'warn');
    v.words = novas;
    capMudou(v);
    toast('Texto da legenda salvo', 'ok');
  };
  $('#emojiRapidos').innerHTML = EMOJIS_RAPIDOS.map((e) => `<button data-e="${e}">${e}</button>`).join('');
  $('#emojiRapidos').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) $('#emojiNovo').value = b.dataset.e;
  };
  $('#emojiAdd').onclick = () => {
    const v = current();
    if (!v || !v.meta) return toast('Abra um vídeo primeiro', 'warn');
    const ch = $('#emojiNovo').value.trim() || '🔥';
    const t = pv.fg.currentTime || 0;
    v.emojis = (v.emojis || []).filter((x) => Math.abs(x.s - t) > 0.3);
    v.emojis.push({ s: t, e: t + 1.6, ch });
    v.emojis.sort((a, b) => a.s - b.s);
    for (let i = 0; i < v.emojis.length - 1; i++) v.emojis[i].e = Math.min(v.emojis[i].s + 1.6, v.emojis[i + 1].s);
    capMudou(v);
  };
  $('#emojiAuto').onclick = () => {
    const v = current();
    if (!v || !v.words) return toast('Gere a legenda do vídeo primeiro', 'warn');
    v.emojis = window.Legendas.gerarEmojis(v.words, v.corte && v.corte.emojis);
    capMudou(v);
  };
  $('#emojiList').onclick = (e) => {
    const v = current();
    if (!v) return;
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      v.emojis.splice(Number(rm.dataset.rm), 1);
      capMudou(v);
      return;
    }
    const chip = e.target.closest('.emo');
    if (chip) {
      const t = v.emojis[Number(chip.dataset.i)].s;
      pv.fg.currentTime = t;
      pv.bg.currentTime = t;
    }
  };
  requestAnimationFrame(capLoop);
}


// ============================================================ frases com IA (vídeos sem texto)
const TEMAS_RAPIDOS = ['Disciplina', 'Foco', 'Superação', 'Fé em Deus', 'Dinheiro e sucesso', 'Estudos', 'Treino e academia', 'Amor-próprio', 'Família', 'Mentalidade', 'Empreender', 'Recomeço'];
function iaConfigurada() {
  let cfg = {};
  try {
    cfg = JSON.parse(localStorage.getItem('eem.cortes')) || {};
  } catch (_) {}
  const p = (cfg.ia && cfg.ia.provedor) || 'ollama';
  const c = (cfg.ia && cfg.ia[p]) || {};
  return { provedor: p, url: c.url || '', chave: c.chave || '', modelo: c.modelo || '' };
}
const lerUsadas = () => {
  try {
    return JSON.parse(localStorage.getItem('eem.frasesUsadas')) || [];
  } catch (_) {
    return [];
  }
};
const frJob = { rodando: false };
async function gerarFrases() {
  if (frJob.rodando) return;
  const tema = $('#frTema').value.trim();
  if (!tema) return toast('Escreva um tema (ou toque num dos temas prontos)', 'warn');
  let alvo = targets().filter((v) => v.meta);
  if (!alvo.length) return toast(state.videos.length ? 'Nenhum vídeo no escopo (Este / Seleção / Todos)' : 'Importe os vídeos primeiro', 'warn');
  if ($('#frSoVazios').checked) alvo = alvo.filter((v) => !String(v.legenda || '').trim());
  if (!alvo.length) return toast('Todos os vídeos do escopo já têm texto. Desmarque “Só nos vídeos sem texto” para trocar.', 'warn', 6000);
  const ia = iaConfigurada();
  if (ia.provedor === 'nenhum') return toast('Escolha uma IA em 🔥 Cortes Virais → Inteligência (Ollama, Gemini…)', 'warn', 6000);
  frJob.rodando = true;
  const btn = $('#btnFrases');
  btn.disabled = true;
  btn.textContent = `⏳ Criando ${alvo.length} frase(s)…`;
  $('#frStatus').textContent = `Usando ${{ ollama: 'Ollama', gemini: 'Gemini', openai: 'OpenAI', claude: 'Claude' }[ia.provedor] || ia.provedor}…`;
  try {
    const usadas = lerUsadas();
    const frases = await api.iaFrases({
      ia,
      tema,
      estilo: $('#frEstilo').value,
      publico: $('#frPublico').value.trim(),
      emoji: $('#frEmoji').checked,
      legendaPost: $('#frPost').checked,
      quantidade: alvo.length,
      evitar: usadas.slice(-80)
    });
    alvo.forEach((v, i) => {
      const f = frases[i % frases.length];
      v.legenda = f.texto.replace(/\s*\|\s*/g, '\n');
      if (f.legenda) v.postTexto = f.legenda;
      if (v.status === 'pronto') v.status = 'pendente';
      v.edited = true;
    });
    localStorage.setItem('eem.frasesUsadas', JSON.stringify(usadas.concat(frases.map((f) => f.texto)).slice(-400)));
    localStorage.setItem('eem.frTema', tema);
    syncControls();
    renderAll();
    renderPreview();
    $('#frStatus').textContent = `${Math.min(frases.length, alvo.length)} frase(s) diferentes sobre “${tema}”.`;
    toast(`✨ Frases colocadas em ${alvo.length} vídeo(s). Ajuste posição e estilo logo abaixo e processe.`, 'ok', 6000);
  } catch (err) {
    $('#frStatus').textContent = '';
    toast('Não deu para gerar as frases: ' + erroIpc(err), 'err', 8000);
  } finally {
    frJob.rodando = false;
    btn.disabled = false;
    btn.textContent = '✨ Gerar frases';
  }
}
function bindFrases() {
  $('#frTemas').innerHTML = TEMAS_RAPIDOS.map((t) => `<button data-t="${esc(t)}">${esc(t)}</button>`).join('');
  $('#frTemas').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) $('#frTema').value = b.dataset.t;
  };
  $('#frTema').value = localStorage.getItem('eem.frTema') || '';
  for (const id of ['frEstilo', 'frEmoji', 'frPost', 'frSoVazios']) {
    const el = $('#' + id);
    const salvo = localStorage.getItem('eem.' + id);
    if (salvo !== null) el.type === 'checkbox' ? (el.checked = salvo === '1') : (el.value = salvo);
    el.onchange = () => localStorage.setItem('eem.' + id, el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value);
  }
  $('#btnFrases').onclick = gerarFrases;
  $('#frTema').onkeydown = (e) => e.key === 'Enter' && gerarFrases();
  $('#frLimparHist').onclick = () => {
    localStorage.removeItem('eem.frasesUsadas');
    toast('Frases usadas esquecidas', 'ok');
  };
}
// ============================================================ processamento
async function renderLayers(v) {
  const s = v.settings;
  await api.renderPreflight(v.meta, s);
  const { CW, CH } = S.canvasSize(s, v.meta);
  await Promise.all(R.fontsFor(s).map((f) => document.fonts.load(f).catch(() => {})));
  const [logo, bgImg] = await Promise.all([
    imgAsync(s.template.logo).catch(() => null),
    s.template.fundoTipo === 'imagem' ? imgAsync(s.template.fundoImagem).catch(() => null) : null
  ]);
  const c = document.createElement('canvas');
  c.width = CW;
  c.height = CH;
  const ctx = c.getContext('2d');
  R.drawBackground(ctx, s, CW, CH, bgImg);
  const bg = c.toDataURL('image/png');
  if (bg === 'data:,') throw new Error('A placa gráfica não conseguiu criar a camada nesta resolução. Escolha uma resolução menor.');
  R.drawOverlay(ctx, s, v.legenda, CW, CH, logo);
  const ov = c.toDataURL('image/png');
  let capa = null;
  if (s.capa.ativo && (s.capa.noInicio || s.capa.embutir || s.capa.salvarJpg)) {
    let frame = null, custom = null;
    if (s.capa.fonte === 'imagem') custom = await imgAsync(s.capa.imagem).catch(() => null);
    if (s.capa.fonte === 'frame' || !custom) {
      const data = await api.frame(v.path, S.capaSourceTime(v.meta, s), v.meta, s);
      if (data) {
        frame = new Image();
        frame.src = data;
        await frame.decode();
      }
    }
    const s2 = custom ? s : { ...s, capa: { ...s.capa, fonte: 'frame' } };
    R.drawCover(ctx, s2, { CW, CH, meta: v.meta, frame, bgImg, custom, logo, title: capaTitle(v, s) });
    capa = c.toDataURL('image/jpeg', 0.92);
  }
  // legenda animada: gera os PNGs de cada mudança e manda para o processo principal
  let cap = null;
  const c2 = capDe(v);
  if (s.legendaAnim && s.legendaAnim.ativo && c2) {
    const la = s.legendaAnim;
    const T = S.timing(v.meta, s);
    // mesma legenda, mesmo estilo e mesmo trecho: reaproveita a legenda já gerada
    const chave = JSON.stringify([v.path, v.capVer || 0, v.words.length, (v.emojis || []).length, la, T.start, T.end, T.speed, S.canvasSize(s, v.meta).CW, S.canvasSize(s, v.meta).CH]);
    const salvo = capCache.get(chave);
    if (salvo && (await api.capExiste(salvo.list))) cap = salvo;
    else {
      await document.fonts.load(`${la.peso} 80px "${la.fonte}"`).catch(() => {});
      const faixa = await window.Legendas.gerarFaixa(s, c2, T, v.meta);
      if (faixa && faixa.quadros.length) {
        cap = await api.capTrack(v.id, faixa);
        capCache.set(chave, cap);
        while (capCache.size > 60) {
          const [k, velho] = capCache.entries().next().value;
          capCache.delete(k);
          api.capApagar(velho.dir);
        }
      }
    }
  }
  c.width = 1; c.height = 1;
  return { bg, ov, capa, cap };
}
const capCache = new Map(); // legendas já geradas (PNGs prontos no disco) para reprocessar rápido

async function processar() {
  if (state.processing) return;
  if (state.loteAtivo) return toast('Espere o cancelamento terminar', 'warn');
  let alvo = state.selected.size ? state.videos.filter((v) => state.selected.has(v.id)) : state.videos;
  alvo = alvo.filter((v) => v.meta);
  if (!alvo.length) return toast('Importe vídeos primeiro', 'warn');
  if (isDirty() && !confirm('Há ajustes no painel que ainda não foram aplicados.\nProcessar assim mesmo?')) return;

  state.processing = true;
  for (const v of alvo) {
    v.status = 'fila';
    v.progress = 0;
    v.stage = null;
    v.error = null;
  }
  renderAll();
  // cada vídeo vai para o FFmpeg assim que as camadas dele ficam prontas
  // (enquanto um processa, o próximo já está tendo a legenda preparada)
  state.cancelPedido = false;
  state.loteAtivo = true;
  state.batch = { total: alvo.length, done: 0, ok: 0, cpuWarned: false, prep: 0 };
  updateStatusLine();
  let enviados = 0;
  for (const v of alvo) {
    if (state.cancelPedido) {
      v.status = 'erro';
      v.error = 'Cancelado';
      state.batch.total--;
      renderCard(v);
      continue;
    }
    try {
      const { bg, ov, capa, cap } = await renderLayers(v);
      state.batch.prep++;
      if (state.cancelPedido) throw new Error('Cancelado');
      await api.process([{ id: v.id, input: v.path, name: v.name, meta: v.meta, s: v.settings, bgData: bg, ovData: ov, capaData: capa, cap }], {
        outDir: state.outDir,
        concurrency: state.concurrency,
        aberto: true
      });
      enviados++;
    } catch (err) {
      v.status = 'erro';
      v.error = err.message === 'Cancelado' ? 'Cancelado' : 'Falha ao gerar as camadas: ' + err.message;
      state.batch.total--;
      renderCard(v);
    }
    updateStatusLine();
  }
  state.loteAtivo = false;
  await api.processFim(); // o processo principal avisa "fila vazia" quando o último terminar
  if (!enviados) {
    state.processing = false;
    renderAll();
  }
}

function renderProcessUI() {
  $('#btnProcess').disabled = state.processing;
  $('#btnProcess').textContent = state.processing
    ? '⏳ PROCESSANDO…'
    : state.selected.size
      ? `▶ PROCESSAR SELEÇÃO (${state.selected.size})`
      : '▶ PROCESSAR VÍDEOS';
  $('#btnCancel').classList.toggle('hidden', !state.processing);
  updateStatusLine();
}
function updateStatusLine() {
  const el = $('#statusLine');
  el.classList.toggle('busy', state.processing);
  const b = state.batch;
  if (state.processing && b) {
    const running = state.videos.filter((v) => v.status === 'processando');
    const partial = running.reduce((a, v) => a + v.progress, 0);
    const pct = Math.round(((b.done + partial) / Math.max(1, b.total)) * 100);
    const prep = b.prep !== undefined && b.prep < b.total ? ` · legendas ${b.prep}/${b.total}` : '';
    $('span', el).textContent = `Processando ${b.done}/${b.total} · ${pct}%${prep}`;
  } else {
    $('span', el).textContent = 'Pronto';
  }
}

function bindProcessEvents() {
  api.onProgress(({ id, pct, stage }) => {
    const v = byId(id);
    if (!v) return;
    v.status = 'processando';
    v.progress = Math.max(v.progress || 0, pct);
    v.stage = stage;
    renderCard(v);
    updateStatusLine();
  });
  api.onDone(({ id, ok, out, capaOut, error, encoder }) => {
    const v = byId(id);
    if (state.batch) {
      state.batch.done++;
      if (ok) state.batch.ok++;
      if (encoder === 'x264' && !state.batch.cpuWarned && v && v.settings.saida.encoder === 'auto' && Number(v.settings.saida.res) !== 4320) {
        state.batch.cpuWarned = true;
        toast('GPU NVIDIA não disponível: usando CPU (mais lento).', 'warn', 5000);
      }
    }
    if (!v) return;
    if (ok) {
      v.status = 'pronto';
      v.out = out;
      v.capaOut = capaOut || null;
      v.progress = 1;
    } else {
      v.status = 'erro';
      v.error = error || 'Erro desconhecido';
    }
    renderCard(v);
    renderCounts();
    updateStatusLine();
    if (v.id === state.currentId) renderPvMeta();
  });
  api.onQueueEmpty(() => {
    if (!state.processing || state.loteAtivo) return; // ainda preparando vídeos deste lote
    state.processing = false;
    const b = state.batch || { ok: 0, total: 0 };
    if (b.ok === b.total) toast(`Pronto! ${b.ok} vídeo(s) exportado(s).`, 'ok', 6000);
    else toast(`${b.ok} de ${b.total} exportado(s). Veja os erros na aba Erros.`, 'warn', 7000);
    renderAll();
  });
}

// ============================================================ ligações gerais
function bindUI() {
  const pickAndImport = async () => importPaths(await api.pickVideos());
  $('#btnImport').onclick = pickAndImport;
  $('#btnImport2').onclick = pickAndImport;
  $('#btnImport3').onclick = pickAndImport;
  $('#btnProcess').onclick = processar;
  $('#btnCancel').onclick = () => {
    state.cancelPedido = true;
    api.cancel();
  };
  $('#btnOpenOut').onclick = () => api.openPath(state.outDir);
  $('#btnApply').onclick = aplicar;
  $('#btnDetect').onclick = detectarBordas;
  $('#btnZeroCrop').onclick = () => {
    Object.assign(state.draft.recorte, { top: 0, bottom: 0, left: 0, right: 0 });
    syncControls();
    onDraftChange();
  };

  $('#scopeSeg').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    state.scope = b.dataset.v;
    renderScope();
    renderApply();
    scheduleMinis();
    autoAplicar();
  };
  $('#tabs').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) switchTab(b.dataset.tab);
  };
  $('#filters').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.filter = b.dataset.f;
    renderGrid();
    renderCounts();
  };
  $('#search').oninput = (e) => {
    state.search = e.target.value;
    renderGrid();
    renderCounts();
  };
  $('#btnSelAll').onclick = () => {
    const vis = visibleVideos();
    const all = vis.length && vis.every((v) => state.selected.has(v.id));
    vis.forEach((v) => (all ? state.selected.delete(v.id) : state.selected.add(v.id)));
    if (!all && state.selected.size) state.scope = 'selecao';
    renderAll();
  };
  $('#btnRemoveAll').onclick = () => {
    if (!state.videos.length || state.processing) return;
    if (!confirm('Tirar todos os vídeos da mesa? Os arquivos no computador não são apagados.')) return;
    state.videos = [];
    state.selected.clear();
    state.currentId = null;
    state.draft = S.clone(profileSettings());
    loadPreview();
    syncControls();
    renderAll();
  };

  // tema anime: o ícone da marca liga/desliga as pétalas de sakura
  document.body.classList.toggle('sem-petalas', localStorage.getItem('eem.petalas') === '0');
  $('#brandIco').onclick = () => {
    const off = document.body.classList.toggle('sem-petalas');
    localStorage.setItem('eem.petalas', off ? '0' : '1');
  };

  // mesa ao vivo: tamanho das miniaturas, tocar ao passar o mouse, aplicar na hora
  const setMiniSize = (sz) => {
    state.miniSize = sz;
    localStorage.setItem('eem.miniSize', sz);
    $('#grid').dataset.size = sz;
    $$('#miniSize button').forEach((b) => b.classList.toggle('on', b.dataset.v === sz));
    scheduleMinis();
  };
  $('#miniSize').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) setMiniSize(b.dataset.v);
  };
  setMiniSize(localStorage.getItem('eem.miniSize') || 'm');
  $('#grid').addEventListener('mouseover', (e) => {
    const mini = e.target.closest('.mini');
    const id = mini && mini.closest('.card').dataset.id;
    if (!id) return stopHover();
    if (!hov.v || hov.v.id !== id) startHover(byId(id));
  });
  $('#grid').addEventListener('mouseleave', stopHover);
  new ResizeObserver(() => scheduleMinis()).observe($('#grid'));
  const auto = $('#autoApply');
  state.autoApply = localStorage.getItem('eem.autoApply') === '1';
  auto.checked = state.autoApply;
  auto.onchange = () => {
    state.autoApply = auto.checked;
    localStorage.setItem('eem.autoApply', auto.checked ? '1' : '0');
    if (auto.checked) {
      toast('Aplicar na hora ligado: cada ajuste já vale para os vídeos do escopo.', 'ok', 4500);
      autoAplicar();
    }
  };

  $('#grid').onclick = (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const v = byId(card.dataset.id);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'sel') {
      state.selected.has(v.id) ? state.selected.delete(v.id) : state.selected.add(v.id);
      renderAll();
    } else if (act === 'rm') {
      if (state.processing && ['fila', 'processando'].includes(v.status)) return toast('Espere terminar o processamento', 'warn');
      state.videos = state.videos.filter((x) => x !== v);
      state.selected.delete(v.id);
      if (state.currentId === v.id) {
        state.currentId = null;
        const next = state.videos.find((x) => x.meta);
        if (next) openVideo(next.id);
        else {
          state.draft = S.clone(profileSettings());
          loadPreview();
          syncControls();
        }
      }
      renderAll();
    } else if (act === 'show') {
      api.showItem(v.out);
    } else if (act === 'crop') {
      openVideo(v.id);
      switchTab('recorte');
      openCrop();
    } else if (act === 'cap') {
      openVideo(v.id);
      switchTab('legendas');
    } else if (act === 'leg') {
      openVideo(v.id);
      switchTab('texto');
      $('#legenda').focus();
    } else {
      openVideo(v.id);
    }
  };

  // perfis
  $('#profileSel').onchange = (e) => {
    state.profile = e.target.value;
    saveProfiles();
    state.draft = S.clone(profileSettings());
    syncControls();
    onDraftChange();
    toast(`Perfil “${state.profile}” carregado no painel. Clique em Aplicar para usar nos vídeos.`, 'info', 5000);
  };
  $('#profileSave').onclick = () => {
    state.profiles[state.profile] = S.clone(state.draft);
    saveProfiles();
    toast(`Painel salvo no perfil “${state.profile}”. Vídeos novos já entram com ele.`, 'ok');
  };
  $('#profileNew').onclick = () => {
    $('#profileRow').classList.add('hidden');
    $('#newProfBox').classList.remove('hidden');
    $('#newProfName').value = '';
    $('#newProfName').focus();
  };
  const closeNew = () => {
    $('#newProfBox').classList.add('hidden');
    $('#profileRow').classList.remove('hidden');
  };
  $('#newProfCancel').onclick = closeNew;
  $('#newProfOk').onclick = () => {
    const name = $('#newProfName').value.trim();
    if (!name) return;
    if (state.profiles[name]) return toast('Já existe um perfil com esse nome', 'warn');
    state.profiles[name] = S.clone(state.draft);
    state.profile = name;
    saveProfiles();
    renderProfiles();
    closeNew();
    toast(`Perfil “${name}” criado com os ajustes do painel`, 'ok');
  };
  $('#newProfName').onkeydown = (e) => {
    if (e.key === 'Enter') $('#newProfOk').click();
    if (e.key === 'Escape') closeNew();
  };
  $('#profileDel').onclick = () => {
    if (Object.keys(state.profiles).length < 2) return;
    if (!confirm(`Excluir o perfil “${state.profile}”?`)) return;
    delete state.profiles[state.profile];
    state.profile = Object.keys(state.profiles)[0];
    saveProfiles();
    renderProfiles();
  };

  // saída
  $('#outBtn').onclick = async () => {
    const d = await api.pickFolder();
    if (!d) return;
    state.outDir = d;
    localStorage.setItem('eem.outDir', d);
    renderOut();
  };
  $('#concSel').onchange = (e) => {
    state.concurrency = Number(e.target.value);
    localStorage.setItem('eem.conc', state.concurrency);
  };

  // arrastar e soltar
  let depth = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth++;
    $('#dropOverlay').classList.add('on');
  });
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) $('#dropOverlay').classList.remove('on');
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    $('#dropOverlay').classList.remove('on');
    const paths = [...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean);
    if ($('.app').classList.contains('mode-cortes') && window.Cortes) return window.Cortes.soltar(paths);
    importPaths(paths);
  });

  // espaço = play/pause
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target.closest('input, textarea, select')) return;
    e.preventDefault();
    togglePlay();
  });
}

function renderOut() {
  $('#outBtn').textContent = state.outDir;
  $('#outBtn').title = state.outDir;
  $('#concSel').value = String(state.concurrency);
}

// ============================================================ início
async function init() {
  loadProfiles();
  state.draft = S.clone(profileSettings());
  state.outDir = localStorage.getItem('eem.outDir') || (await api.defaultOut());
  state.concurrency = Number(localStorage.getItem('eem.conc')) || 2;
  renderProfiles();
  renderOut();
  buildFiltros();
  bindControls();
  bindPreview();
  bindLegendas();
  bindLimpeza();
  bindCapa();
  bindLegendaAnim();
  bindFrases();
  bindTrim();
  bindCrop();
  bindProcessEvents();
  bindUI();
  // vídeos que chegam da extensão Minerador Viral entram direto na mesa
  let chegando = 0, avisoT;
  api.onExternalImport(({ arquivos, perfil }) => {
    chegando += arquivos.length;
    importPaths(arquivos);
    clearTimeout(avisoT);
    avisoT = setTimeout(() => {
      toast(`Minerador: ${chegando} vídeo(s) de @${perfil} chegaram na mesa`, 'ok', 6000);
      chegando = 0;
    }, 1500);
  });
  syncControls();
  switchTab('recorte');
  renderAll();
  document.fonts.ready.then(() => {
    renderPreview();
    scheduleMinis();
  });
}
init();

