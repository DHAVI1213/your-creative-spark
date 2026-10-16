'use strict';
/* global MV */
// Painel lateral do Minerador Viral.

const APP = 'http://127.0.0.1:47811';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let DEMO = new URLSearchParams(location.search).has('demo');

const AJ_PADRAO = { novos: true, tudo: false, completar: true, csv: true, organizacao: 'unico', lote: 50, salvar: 'auto', demo: false };
const LIMITE_ZIP = 1.5 * 1024 * 1024 * 1024; // acima disso o ZIP é dividido em partes (o navegador não aguenta arquivos gigantes na memória)
const MAX_PERFIS = 30;

const st = {
  tab: null,
  ctx: null, // { plataforma, perfil, naAbaShorts }
  res: null, // { plataforma, perfil, itens, mediana, completo, aviso, quando, manual }
  sel: new Set(),
  baixados: {},
  minerando: false,
  baixando: false,
  appOk: false,
  thumbs: new Map(),
  aj: { ...AJ_PADRAO },
  aba: 'minerar'
};
const chave = (c = st.ctx) => (c ? `${c.plataforma}::${c.perfil}` : '');

// ------------------------------------------------------------ util
let toastT;
function toast(msg, tipo = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast show ${tipo}`;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 4200);
}
const get = (k) => chrome.storage.local.get(k).then((o) => o[k]);
const set = (k, v) => chrome.storage.local.set({ [k]: v });
const hoje = () => new Date().toISOString().slice(0, 10);
const quando = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const urlPerfil = (plataforma, perfil) =>
  plataforma === 'tiktok' ? `https://www.tiktok.com/@${perfil}` : plataforma === 'youtube' ? `https://www.youtube.com/@${perfil}/shorts` : `https://www.instagram.com/${perfil}/`;

function opts() {
  const todo = $('#optEscopo').value === 'todo';
  return {
    escopo: todo ? 'todo' : 'ultimos',
    ultimos: Math.max(1, Math.min(5000, Number($('#optUltimos').value) || 300)),
    analisar: todo ? 5000 : Math.max(1, Math.min(5000, Number($('#optUltimos').value) || 300)),
    quero: Math.max(1, Math.min(500, Number($('#optQuero').value) || 50)),
    dias: Number($('#optDias').value),
    minViews: MV.lerNumero($('#optMinViews').value),
    minLikes: MV.lerNumero($('#optMinLikes').value),
    minComments: MV.lerNumero($('#optMinComments').value),
    esconder: st.aj.novos,
    ordem: $('#optOrdem').value
  };
}
async function salvarOpts() {
  const o = opts();
  await set('opts', {
    escopo: o.escopo,
    ultimos: o.ultimos,
    quero: o.quero,
    dias: o.dias,
    minViews: $('#optMinViews').value,
    minLikes: $('#optMinLikes').value,
    minComments: $('#optMinComments').value,
    ordem: o.ordem
  });
  renderDica();
}
async function carregarOpts() {
  const o = (await get('opts')) || {};
  if (o.escopo) $('#optEscopo').value = o.escopo;
  else if (o.analisar) {
    // versão antiga: "Buscar até"
    $('#optEscopo').value = o.analisar >= 5000 ? 'todo' : 'ultimos';
    $('#optUltimos').value = o.analisar;
  }
  if (o.ultimos) $('#optUltimos').value = o.ultimos;
  if (o.quero) $('#optQuero').value = o.quero;
  if (o.dias !== undefined) $('#optDias').value = o.dias;
  $('#optMinViews').value = o.minViews || '';
  $('#optMinLikes').value = o.minLikes || '';
  $('#optMinComments').value = o.minComments || '';
  if (o.ordem) $('#optOrdem').value = o.ordem;
  $('#optOrdem2').value = $('#optOrdem').value;
  st.aj = { ...AJ_PADRAO, ...((await get('ajustes')) || {}) };
  if (o.esconder === false && !(await get('ajustes'))) st.aj.novos = false; // herda a opção antiga
  if (st.aj.demo) DEMO = true;
  renderEscopo();
}

function renderEscopo() {
  const ultimos = $('#optEscopo').value === 'ultimos';
  $('#lblUltimos').hidden = !ultimos;
  $('#lblUltimos').parentElement.classList.toggle('tres', ultimos);
}

function renderDica() {
  const o = opts();
  const f = [o.minViews && `${MV.formatar(o.minViews)}+ views`, o.minLikes && `${MV.formatar(o.minLikes)}+ curtidas`, o.minComments && `${MV.formatar(o.minComments)}+ comentários`].filter(Boolean).join(' · ');
  $('#dica').textContent = `${o.escopo === 'todo' ? 'Perfil inteiro' : `Últimos ${o.ultimos}`} · ${f || 'sem mínimos'} · até ${o.quero} aprovados${st.aj.novos ? ' · só novos' : ''}`;
}

// ------------------------------------------------------------ abas
function mostrarAba(nome) {
  st.aba = nome;
  document.querySelectorAll('.aba').forEach((b) => b.classList.toggle('on', b.dataset.aba === nome));
  $('#vMinerar').hidden = nome !== 'minerar';
  $('#vHistorico').hidden = nome !== 'historico';
  $('#vLink').hidden = nome !== 'link';
  if (nome === 'link') renderLink();
  $('#vAjustes').hidden = nome !== 'ajustes';
  if (nome === 'historico') renderHistorico();
  if (nome === 'ajustes') renderAjustes();
  render();
}

// ------------------------------------------------------------ aba e perfil
async function lerAba() {
  if (DEMO) {
    st.tab = { id: 0, index: 0, url: 'https://www.instagram.com/perfil.demo/' };
    if (!st.ctx) st.ctx = { plataforma: 'instagram', perfil: 'perfil.demo' };
    return renderPerfil();
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const ctx = tab ? MV.detectar(tab.url || '') : null;
  const mudou = chave() !== chave(ctx);
  st.tab = tab || null;
  st.ctx = ctx;
  if (mudou && !st.minerando) {
    st.sel.clear();
    st.res = ((await get('ultimos')) || {})[chave()] || null;
    st.baixados = ((await get('baixados')) || {})[chave()] || {};
    $('#parecidos').hidden = true;
    if (st.res) selecionarTop(Number($('#optQuero').value) || 50);
    render();
  }
  renderPerfil();
}

function renderPerfil() {
  if (st.aba === 'link' && typeof renderLink === 'function') renderLink();
  const c = st.ctx;
  const badge = $('#platBadge');
  badge.className = 'plat' + (c ? ' ' + c.plataforma : '');
  badge.textContent = c ? MV.PLATAFORMAS[c.plataforma].nome.replace(' Shorts', '') : '—';
  $('#perfilNome').textContent = c ? '@' + c.perfil : 'Abra um perfil';
  const precisaShorts = c && c.plataforma === 'youtube' && !c.naAbaShorts;
  $('#perfilSub').textContent = !c
    ? 'Instagram, TikTok ou a aba Shorts de um canal'
    : precisaShorts
      ? 'Abra a aba Shorts do canal para minerar'
      : `Pronto para minerar os ${MV.PLATAFORMAS[c.plataforma].itens}`;
  $('#btnIrShorts').hidden = !precisaShorts;
  $('#btnMinerar').disabled = !c || precisaShorts || st.minerando;
  $('#btnEscolher').disabled = !c || precisaShorts || st.minerando || DEMO;
  // YouTube não mostra curtidas/comentários na grade
  const yt = c && c.plataforma === 'youtube';
  $('#optMinLikes').disabled = $('#optMinComments').disabled = !!yt;
}

// ------------------------------------------------------------ comunicação com a aba
async function injetar(tabId, plataforma) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/core.js', 'coletores/comum.js', `coletores/${plataforma}.js`] });
}

async function naAba(tabId, plataforma, func, args) {
  await injetar(tabId, plataforma);
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (nome, a) => {
      self.MVC.reiniciar();
      const fn = self.MV_COLETOR[nome];
      if (!fn) return { ok: true, x: null };
      return Promise.resolve(fn(...a)).then(
        (x) => ({ ok: true, x }),
        (e) => ({ ok: false, erro: e.message })
      );
    },
    args: [func, args]
  });
  if (!result || !result.ok) throw new Error((result && result.erro) || 'A página não respondeu');
  return result.x;
}
const rodarColetor = (tabId, op) => naAba(tabId, st.ctx.plataforma, 'coletar', [op]);

// Pede à plataforma (pela sua sessão) os dados completos de alguns vídeos: views, curtidas,
// comentários, data, legenda e link do arquivo.
async function detalharLote(itens, plataforma) {
  if (DEMO || !itens.length || !st.tab) return {};
  try {
    return (await naAba(st.tab.id, plataforma, 'detalhar', [itens.map((v) => ({ id: v.id, pk: v.pk || '', link: v.link }))])) || {};
  } catch (e) {
    return Object.fromEntries(itens.map((v) => [v.id, { video: '', erro: 'Deixe a aba do perfil aberta: ' + e.message }]));
  }
}
function aplicarDetalhes(v, x) {
  if (!x || x.erro) return false;
  // escolhidos à mão: o número da grade pode ser outro (ex.: curtidas no "passar o mouse"), então vale o da plataforma
  for (const k of ['views', 'likes', 'comments']) if (x[k] != null && (v.manual || v[k] == null || x[k] > v[k])) v[k] = x[k];
  if (x.data) v.data = x.data;
  if (x.legenda && !v.legenda) v.legenda = x.legenda;
  if (x.thumb && !v.thumb) v.thumb = x.thumb;
  if (x.video) v.video = x.video;
  if (x.pk) v.pk = x.pk;
  v.detalhado = true;
  return true;
}

// Abre a aba Reels do perfil na mesma guia e espera os vídeos aparecerem.
async function abrirAbaReels(tabId, perfil) {
  const url = `https://www.instagram.com/${perfil}/reels/`;
  await new Promise((ok) => {
    const fim = setTimeout(done, 20000);
    function done() {
      clearTimeout(fim);
      chrome.tabs.onUpdated.removeListener(ouvir);
      ok();
    }
    function ouvir(id, info) {
      if (id === tabId && info.status === 'complete') done();
    }
    chrome.tabs.onUpdated.addListener(ouvir);
    chrome.tabs.update(tabId, { url });
  });
  await new Promise((ok) => setTimeout(ok, 2500)); // a grade carrega depois da página
}

function progresso(txt, pct) {
  $('#prog').hidden = false;
  $('#progTxt').textContent = txt;
  if (pct != null) $('#progBar').style.width = Math.max(2, Math.min(100, pct)) + '%';
}

// ------------------------------------------------------------ mineração
async function minerar() {
  if (!st.ctx || st.minerando) return;
  await salvarOpts();
  const o = opts();
  st.minerando = true;
  $('#parecidos').hidden = true;
  renderPerfil();
  progresso('Preparando…', 2);
  try {
    let r;
    if (DEMO) r = await coletaDemo(o);
    else {
      const tabId = st.tab.id;
      const op = {
        perfil: st.ctx.perfil,
        analisar: o.analisar,
        quero: st.aj.tudo ? 0 : o.quero, // 0 = não para antes do fim do escopo
        filtros: { minViews: o.minViews, minLikes: o.minLikes, minComments: o.minComments, dias: o.dias },
        pular: o.esconder ? Object.keys(st.baixados) : []
      };
      r = await rodarColetor(tabId, op);
      // a leitura rápida não deu certo fora da aba Reels: abre a aba Reels e tenta de novo (ou rola a grade)
      if (r.precisaAbaReels && st.ctx.plataforma === 'instagram') {
        if (/sessão caiu|verificação/.test(r.aviso || '')) throw new Error(r.aviso);
        progresso('Abrindo a aba Reels do perfil…');
        await abrirAbaReels(tabId, st.ctx.perfil);
        const r2 = await rodarColetor(tabId, { ...op, soGrade: /429|limit|devagar|recusou/i.test(r.aviso || '') });
        const junto = new Map(r.itens.map((v) => [v.id, v]));
        for (const v of r2.itens) if (!junto.has(v.id)) junto.set(v.id, v);
        r = { ...r2, itens: [...junto.values()] };
      }
      await completarNumeros(r.itens, o);
      if (r.itens.length && r.itens.every((v) => v.likes == null) && st.ctx.plataforma === 'instagram' && !r.aviso)
        r.aviso = 'Lido pela grade: curtidas e comentários não apareceram nesta leitura.';
    }
    const med = MV.pontuar(r.itens);
    let aviso = r.aviso || '';
    const aprovados = MV.filtrar(r.itens, o).filter((v) => !(o.esconder && st.baixados[v.id])).length;
    if (aprovados < o.quero && (r.completo || !aviso))
      aviso = `O perfil só tem ${aprovados} vídeo(s) que passam nos filtros${o.esconder ? ' (sem contar os já baixados)' : ''}. Pedido: ${o.quero}.`;
    st.res = { plataforma: st.ctx.plataforma, perfil: st.ctx.perfil, nome: r.nome || '', itens: r.itens, mediana: med, completo: r.completo, aviso, quando: Date.now(), quero: o.quero };
    await guardarResultado();
    selecionarTop(o.quero);
    toast(`${Math.min(aprovados, o.quero)} aprovados · ${r.itens.length} analisados`, 'ok');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    st.minerando = false;
    $('#prog').hidden = true;
    renderPerfil();
    render();
  }
}

// Leitura que veio só com views (grade do Instagram): busca curtidas/comentários dos mais vistos.
async function completarNumeros(itens, o) {
  if (!st.aj.completar || DEMO || st.ctx.plataforma !== 'instagram') return;
  const faltam = itens
    .filter((v) => v.likes == null && !(o.esconder && st.baixados[v.id]) && (!o.minViews || (v.views || 0) >= o.minViews))
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, Math.min(100, Math.max(o.quero, 24)));
  if (!faltam.length) return;
  progresso(`Buscando curtidas e comentários de ${faltam.length} vídeo(s)…`, 90);
  const res = await detalharLote(faltam, 'instagram');
  for (const v of faltam) aplicarDetalhes(v, res[v.id]);
}

async function guardarResultado() {
  const ult = (await get('ultimos')) || {};
  ult[chave({ plataforma: st.res.plataforma, perfil: st.res.perfil })] = st.res;
  const ks = Object.keys(ult).sort((a, b) => ult[b].quando - ult[a].quando);
  for (const k of ks.slice(MAX_PERFIS)) delete ult[k];
  await set('ultimos', ult).catch(() => {});
}

async function cancelar() {
  if (!st.tab || DEMO) return;
  await chrome.scripting.executeScript({ target: { tabId: st.tab.id }, func: () => self.MVC && self.MVC.cancelar() }).catch(() => {});
}

chrome.runtime.onMessage.addListener((m, sender) => {
  if (!m || m.tipo !== 'mv-progresso' || !sender.tab || !st.tab || sender.tab.id !== st.tab.id) return;
  if (st.baixando && !st.minerando) return void ($('#dlTxt').textContent = m.texto);
  if (st.minerando) progresso(m.texto, m.pct);
});

// ------------------------------------------------------------ escolher direto na página
async function escolherNaPagina() {
  if (!st.ctx || !st.tab || DEMO) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: st.tab.id }, files: ['lib/core.js', 'coletores/selecao.js'] });
    toast('Clique nas capas dos vídeos na página e depois em "Usar escolhidos".', 'ok');
  } catch (e) {
    toast('Não consegui abrir a seleção nesta página: ' + e.message, 'err');
  }
}

async function usarSelecaoManual(sel) {
  if (!sel || !sel.itens || !sel.itens.length || st.minerando) return;
  await chrome.storage.local.remove('selecaoManual');
  const ctx = { plataforma: sel.plataforma, perfil: sel.perfil };
  st.minerando = true;
  renderPerfil();
  progresso(`Buscando os dados de ${sel.itens.length} vídeo(s) escolhido(s)…`, 5);
  try {
    const itens = sel.itens.map((v) => ({ ...v }));
    const res = await detalharLote(itens, sel.plataforma);
    const ok = itens.filter((v) => aplicarDetalhes(v, res[v.id])).length;
    const med = MV.pontuar(itens);
    const naoVieram = itens.length - ok;
    st.res = {
      plataforma: sel.plataforma,
      perfil: sel.perfil,
      nome: '',
      itens,
      mediana: med,
      completo: true,
      manual: true,
      aviso: naoVieram ? `A plataforma não mostrou os números de ${naoVieram} vídeo(s); eles aparecem com o que a grade mostrava.` : '',
      quando: Date.now(),
      quero: itens.length
    };
    if (chave(ctx) !== chave()) st.baixados = ((await get('baixados')) || {})[chave(ctx)] || {};
    st.sel = new Set(itens.filter((v) => !(st.aj.novos && st.baixados[v.id])).map((v) => v.id));
    await guardarResultado();
    mostrarAba('minerar');
    toast(`${itens.length} vídeo(s) escolhido(s) à mão`, 'ok');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    st.minerando = false;
    $('#prog').hidden = true;
    renderPerfil();
    render();
  }
}

// ------------------------------------------------------------ perfis parecidos
const fotos = new Map();
async function carregarImagem(url) {
  if (!url) return '';
  if (fotos.has(url)) return fotos.get(url);
  const p = fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' })
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => (b ? URL.createObjectURL(b) : ''))
    .catch(() => '');
  fotos.set(url, p);
  return p;
}

async function mostrarParecidos() {
  if (!st.res) return;
  const box = $('#parecidos');
  const lista = $('#parLista');
  box.hidden = false;
  $('#parTitulo').textContent = st.res.plataforma === 'youtube' ? 'Canais parecidos' : 'Perfis parecidos';
  lista.innerHTML = '<div class="vazio mini">Buscando sugestões…</div>';
  let perfis = [];
  try {
    if (DEMO) perfis = ['bastidores.fc', 'golacos.br', 'futdiario', 'torcida.viva'].map((u) => ({ usuario: u, nome: 'Perfil de demonstração' }));
    else if (!st.tab || chave() !== chave({ plataforma: st.res.plataforma, perfil: st.res.perfil })) throw new Error('Abra o perfil na aba atual');
    else perfis = (await naAba(st.tab.id, st.res.plataforma, 'parecidos', [st.res.perfil])) || [];
  } catch (e) {
    lista.innerHTML = `<div class="vazio mini">A plataforma não mostrou sugestões agora (${esc(e.message)}).</div>`;
    return;
  }
  if (!perfis.length) {
    lista.innerHTML = '<div class="vazio mini">Nenhuma sugestão nesta página. No TikTok e no YouTube, role a página até aparecerem outros perfis.</div>';
    return;
  }
  lista.innerHTML = perfis
    .map(
      (p) => `<button class="pp" data-u="${esc(p.usuario)}" title="Abrir @${esc(p.usuario)}"><i data-foto="${esc(p.foto || '')}">@</i>
      <span><b>@${esc(p.usuario)}${p.verificado ? ' ✓' : ''}</b><small>${esc(p.nome || (p.privado ? 'privado' : ''))}</small></span></button>`
    )
    .join('');
  for (const i of lista.querySelectorAll('i[data-foto]'))
    carregarImagem(i.dataset.foto).then((u) => {
      if (u) {
        i.style.backgroundImage = `url("${u}")`;
        i.textContent = '';
      }
    });
}

// ------------------------------------------------------------ resultados
function visiveis() {
  if (!st.res) return [];
  const o = opts();
  let l = st.res.manual ? st.res.itens.slice() : MV.filtrar(st.res.itens, o);
  if (o.esconder) l = l.filter((v) => !st.baixados[v.id]);
  return MV.ordenar(l, o.ordem);
}

function selecionarTop(n) {
  st.sel.clear();
  visiveis()
    .slice(0, n)
    .forEach((v) => st.sel.add(v.id));
  render();
}

function itemHTML(v, i, ordem) {
  const on = st.sel.has(v.id);
  const data = v.data ? new Date(v.data * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
  const thumb = st.thumbs.get(v.id);
  const pot = ordem === 'potencial';
  const nota = pot ? v.potencial : v.score;
  const sub = pot ? 'potencial viral' : v.multiplo ? v.multiplo.toFixed(1).replace('.', ',') + '× a média' : '';
  return `<label class="item${on ? ' on' : ''}${st.baixados[v.id] ? ' baixado' : ''}" data-id="${esc(v.id)}">
    <input type="checkbox" ${on ? 'checked' : ''}>
    <span class="th">${thumb ? `<img src="${thumb}" alt="">` : ''}<span class="pos">${i + 1}</span></span>
    <span class="info">
      <span class="l1"><span class="score${nota >= 70 ? ' alto' : ''}" title="${pot ? 'Alcance + engajamento' : 'Quanto superou a mediana do perfil + engajamento'}">${nota ?? '—'}</span>
        <span class="mult">${sub}</span>
        ${st.baixados[v.id] ? '<span class="tag">BAIXADO</span>' : ''}
        <a class="abrir" href="${esc(v.link)}" target="_blank" rel="noreferrer">abrir</a></span>
      <span class="leg" title="${esc(v.legenda)}">${esc(v.legenda || '(sem legenda)')}</span>
      <span class="met"><span>👁 <b>${v.views ? MV.formatar(v.views) : '—'}</b></span>${v.likes != null ? `<span>♥ <b>${MV.formatar(v.likes)}</b></span>` : ''}${
        v.comments != null ? `<span>💬 <b>${MV.formatar(v.comments)}</b></span>` : ''
      }${data ? `<span>${data}</span>` : ''}</span>
    </span>
  </label>`;
}

function render() {
  const r = st.res;
  const naMinerar = st.aba === 'minerar';
  $('#res').hidden = !r;
  $('#rodape').hidden = !r || !naMinerar;
  $('#demoPill').hidden = !DEMO;
  if (!r) return;
  const o = opts();
  const l = visiveis();
  for (const id of [...st.sel]) if (!l.some((v) => v.id === id)) st.sel.delete(id);
  $('#resTitulo').textContent = r.manual ? `${l.length} escolhidos à mão` : `${l.length} aprovados · ${r.itens.length} analisados`;
  $('#resSub').textContent = r.manual
    ? `seleção direto na página · ${quando(r.quando)}`
    : `mediana ${MV.formatar(r.mediana)} views · ${r.completo ? 'leitura completa' : 'parcial'} · ${quando(r.quando)}`;
  $('#resAviso').hidden = !r.aviso;
  $('#resAviso').textContent = r.aviso;
  $('#lista').innerHTML = l.length ? l.map((v, i) => itemHTML(v, i, o.ordem)).join('') : '<div class="vazio">Nenhum vídeo passou nos filtros.</div>';
  $('#selN').textContent = st.sel.size;
  $('#chkTodos').checked = l.length > 0 && st.sel.size === l.length;
  const zipOk = r.plataforma === 'instagram';
  $('#btnZip').disabled = !st.sel.size || st.baixando || !zipOk;
  $('#btnZip').title = zipOk ? 'Baixar os selecionados em ZIP pelo navegador' : 'TikTok e YouTube não deixam baixar pelo navegador: use “Editor”';
  $('#btnApp').disabled = !st.sel.size || st.baixando || !st.appOk;
  $('#btnApp').title = st.appOk ? 'O Editor em Massa baixa os vídeos e coloca na mesa' : 'Abra o Editor em Massa no PC';
  carregarThumbs(l.slice(0, 150));
}

// miniaturas: as CDNs bloqueiam exibir direto, então o painel busca e mostra
let thumbFila = Promise.resolve();
function carregarThumbs(lista) {
  const falta = lista.filter((v) => v.thumb && !st.thumbs.has(v.id));
  if (!falta.length || DEMO) return;
  for (const v of falta) st.thumbs.set(v.id, '');
  thumbFila = thumbFila.then(async () => {
    let i = 0;
    const worker = async () => {
      while (i < falta.length) {
        const v = falta[i++];
        try {
          const r = await fetch(v.thumb, { credentials: 'omit', referrerPolicy: 'no-referrer' });
          if (!r.ok) continue;
          const url = URL.createObjectURL(await r.blob());
          st.thumbs.set(v.id, url);
          const img = document.querySelector(`.item[data-id="${CSS.escape(v.id)}"] .th`);
          if (img && !img.querySelector('img')) img.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="">`);
        } catch (_) {}
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  });
}

// ------------------------------------------------------------ histórico
async function renderHistorico() {
  const ult = (await get('ultimos')) || {};
  const baix = (await get('baixados')) || {};
  const regs = Object.entries(ult).sort((a, b) => b[1].quando - a[1].quando);
  $('#hVazio').hidden = regs.length > 0;
  $('#hLista').innerHTML = regs
    .map(([k, r]) => {
      const n = Object.keys(baix[k] || {}).length;
      return `<button class="hcard" data-k="${esc(k)}"><span class="plat ${esc(r.plataforma)}">${esc(MV.PLATAFORMAS[r.plataforma].nome.replace(' Shorts', ''))}</span>
        <span class="hinfo"><b>@${esc(r.perfil)}</b><small>${r.manual ? 'escolhidos à mão' : `${r.itens.length} analisados`} · ${quando(r.quando)}</small></span>
        <span class="hnum"><b>${n}</b><small>baixados</small></span></button>`;
    })
    .join('');
}

async function abrirDoHistorico(k) {
  const r = ((await get('ultimos')) || {})[k];
  if (!r) return;
  mostrarAba('minerar');
  if (DEMO || chave() === k) {
    st.res = r;
    st.baixados = ((await get('baixados')) || {})[k] || {};
    selecionarTop(Number($('#optQuero').value) || 50);
    return;
  }
  // abre o perfil na aba atual: o painel mostra o resultado guardado assim que a página carregar
  toast(`Abrindo @${r.perfil}…`);
  await chrome.tabs.update(st.tab.id, { url: urlPerfil(r.plataforma, r.perfil) });
}

// ------------------------------------------------------------ ajustes
async function renderAjustes() {
  const a = st.aj;
  $('#ajNovos').checked = a.novos;
  $('#ajTudo').checked = a.tudo;
  $('#ajCompletar').checked = a.completar;
  $('#ajCsv').checked = a.csv;
  $('#ajOrganizacao').value = a.organizacao;
  $('#ajLote').value = a.lote;
  $('#ajSalvar').value = a.salvar;
  $('#ajDemo').checked = a.demo;
  $('#ajLoteLinha').hidden = a.organizacao !== 'lotes';
  const baix = (await get('baixados')) || {};
  const total = Object.values(baix).reduce((s, x) => s + Object.keys(x || {}).length, 0);
  $('#ajBaixadosTxt').textContent = `${total} vídeo(s) marcados em ${Object.keys(baix).length} perfil(s)`;
  $('#versao').textContent = `Minerador Viral ${chrome.runtime.getManifest().version}`;
}

async function salvarAjustes() {
  const antesDemo = st.aj.demo;
  st.aj = {
    novos: $('#ajNovos').checked,
    tudo: $('#ajTudo').checked,
    completar: $('#ajCompletar').checked,
    csv: $('#ajCsv').checked,
    organizacao: $('#ajOrganizacao').value,
    lote: Math.max(1, Math.min(500, Number($('#ajLote').value) || 50)),
    salvar: $('#ajSalvar').value,
    demo: $('#ajDemo').checked
  };
  await set('ajustes', st.aj);
  if (antesDemo !== st.aj.demo) return location.reload();
  renderAjustes();
  renderDica();
  render();
}

// ------------------------------------------------------------ baixados
async function marcarBaixados(ids) {
  const todos = (await get('baixados')) || {};
  const k = chave({ plataforma: st.res.plataforma, perfil: st.res.perfil });
  todos[k] = todos[k] || {};
  for (const id of ids) todos[k][id] = Date.now();
  await set('baixados', todos);
  st.baixados = todos[k];
}

function selecionados() {
  return visiveis().filter((v) => st.sel.has(v.id));
}

function mostrarDl(txt, pct) {
  $('#dl').hidden = false;
  $('#dlTxt').textContent = txt;
  $('#dlBar').style.width = Math.max(2, Math.min(100, pct)) + '%';
}

const renovarLote = (itens) => detalharLote(itens, 'instagram');

// ------------------------------------------------------------ ZIP pelo navegador (Instagram)
// Baixa em grupos pequenos e grava cada ZIP assim que fecha um lote (ou passa de 1,5 GB),
// para não segurar centenas de vídeos na memória.
async function baixarZip() {
  const lista = selecionados();
  if (!lista.length || st.baixando) return;
  st.baixando = true;
  render();
  const r = st.res;
  const pasta = MV.nomeArquivo(r.perfil);
  const porLote = st.aj.organizacao === 'lotes' ? st.aj.lote : lista.length;
  const totalLotes = Math.ceil(lista.length / porLote);
  const erros = {};
  const ok = [], falhas = [], arquivos = [];
  let feitos = 0;

  // links que faltam (ex.: vídeos lidos pela grade): busca todos de uma vez antes de baixar
  const semLink = lista.filter((v) => !v.video);
  if (semLink.length && !DEMO) {
    mostrarDl(`Pegando os links de ${semLink.length} vídeo(s)…`, 2);
    const res = await renovarLote(semLink);
    for (const v of semLink) if (!aplicarDetalhes(v, res[v.id]) || !v.video) erros[v.id] = (res[v.id] && res[v.id].erro) || 'O Instagram não liberou este vídeo';
  }
  const tentados = new Set();
  const linkNovo = async (v) => {
    if (tentados.has(v.id)) return '';
    tentados.add(v.id);
    const x = (await renovarLote([v]))[v.id] || {};
    if (!x.video) erros[v.id] = x.erro || 'O Instagram não liberou este vídeo';
    return x.video || '';
  };
  const baixarUm = async (url) => {
    if (DEMO) return new TextEncoder().encode('demonstração');
    const res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return new Uint8Array(await res.arrayBuffer());
  };
  const bytesDe = async (v) => {
    try {
      if (!v.video) throw new Error('sem link');
      return await baixarUm(v.video);
    } catch (_) {
      const novo = await linkNovo(v); // link vencido: pede um novo ao Instagram
      if (!novo) throw new Error(erros[v.id] || 'O Instagram não liberou este vídeo');
      v.video = novo;
      return baixarUm(novo);
    }
  };

  let zip = null, noZip = [], parte = 0, dividiu = false;
  const fecharZip = async () => {
    if (!zip || !noZip.length) return;
    parte++;
    if (st.aj.csv) zip.adicionar(`${pasta}/metricas.csv`, MV.csv(noZip, r.plataforma, r.perfil));
    const rotulo = totalLotes > 1 || dividiu ? `_parte${String(parte).padStart(2, '0')}` : '';
    const nome = `Minerador/${r.plataforma}_${pasta}_${hoje()}${rotulo}.zip`;
    mostrarDl(`Gravando o ZIP${rotulo ? ' ' + parte : ''}…`, (feitos / lista.length) * 96);
    await salvarArquivo(new Blob(zip.partes(), { type: 'application/zip' }), nome);
    arquivos.push(nome);
    await marcarBaixados(noZip.map((v) => v.id));
    zip = null;
    noZip = [];
  };

  try {
    for (let l = 0; l < totalLotes; l++) {
      const lote = lista.slice(l * porLote, (l + 1) * porLote);
      for (let g = 0; g < lote.length; g += 9) {
        const grupo = lote.slice(g, g + 9);
        const bytes = new Array(grupo.length);
        let i = 0;
        const worker = async () => {
          while (i < grupo.length) {
            const k = i++, v = grupo[k];
            try {
              bytes[k] = await bytesDe(v);
            } catch (e) {
              falhas.push(`${v.id}: ${e.message}`);
            }
            feitos++;
            mostrarDl(`Baixando ${feitos}/${lista.length}${totalLotes > 1 ? ` · lote ${l + 1}/${totalLotes}` : ''}${falhas.length ? ` · ${falhas.length} falha(s)` : ''}`, (feitos / lista.length) * 94);
          }
        };
        await Promise.all([worker(), worker(), worker()]);
        for (let k = 0; k < grupo.length; k++) {
          if (!bytes[k]) continue;
          if (zip && zip.tamanho + bytes[k].length > LIMITE_ZIP) {
            dividiu = true;
            await fecharZip();
          }
          adicionar(grupo[k], bytes[k]);
        }
      }
      if (st.aj.organizacao === 'lotes') await fecharZip();
    }
    await fecharZip();
    if (!ok.length) {
      const limite = falhas.some((f) => /429/.test(f));
      throw new Error(limite ? 'O Instagram limitou as consultas (429). Espere alguns minutos e tente de novo.' : 'Nenhum vídeo baixou. ' + (falhas[0] || ''));
    }
    if (falhas.length) await salvarArquivo(new Blob([falhas.join('\r\n')], { type: 'text/plain' }), `Minerador/${r.plataforma}_${pasta}_${hoje()}_falhas.txt`);
    toast(`${arquivos.length > 1 ? `${arquivos.length} ZIPs prontos` : 'ZIP pronto'}: ${ok.length} vídeo(s)${falhas.length ? `, ${falhas.length} falharam` : ''}`, falhas.length ? '' : 'ok');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    st.baixando = false;
    $('#dl').hidden = true;
    render();
  }

  function adicionar(v, b) {
    if (!zip) zip = new MV.Zip();
    const pos = lista.indexOf(v) + 1;
    zip.adicionar(`${pasta}/${String(pos).padStart(3, '0')}_${pasta}_${MV.nomeArquivo(v.id)}.mp4`, b);
    noZip.push(v);
    ok.push(v);
  }
}

async function salvarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob);
  try {
    if (DEMO) {
      (self.__arquivos = self.__arquivos || []).push({ nome, tamanho: blob.size });
      return;
    }
    await chrome.downloads.download({ url, filename: nome, conflictAction: 'uniquify', saveAs: st.aj.salvar === 'perguntar' });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
}

// ------------------------------------------------------------ Editor em Massa (substitui o Companion)
async function app(path, init = {}) {
  const r = await fetch(APP + path, { ...init, headers: { 'Content-Type': 'application/json', 'X-Minerador': '1', ...(init.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok === false) throw new Error(d.erro || `App respondeu ${r.status}`);
  return d;
}

async function checarApp() {
  try {
    const d = await app('/saude');
    st.appOk = d.app === 'editor-em-massa';
  } catch (_) {
    st.appOk = false;
  }
  const p = $('#appPill');
  p.textContent = st.appOk ? '● App conectado' : '○ App fechado';
  p.className = 'pill ' + (st.appOk ? 'on' : 'off');
  if (st.res && !st.baixando) render();
  if (st.aba === 'link') renderLink();
}

// ------------------------------------------------------------ aba Link (vídeo, música ou perfil)
// Só baixa com a confirmação de autorização marcada. Quem baixa é o Editor em Massa (yt-dlp).
const lk = { baixando: false, itens: [] };
function idYoutube(u) {
  try {
    const url = new URL(String(u).trim());
    const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let id = null;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (host === 'youtube.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else {
        const m = url.pathname.match(/^\/(shorts|live|embed)\/([\w-]{11})/);
        if (m) id = m[2];
      }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch (_) {
    return null;
  }
}
// Vídeo/áudio que o Editor sabe baixar (mesma regra da ponte): YouTube, TikTok, Instagram, SoundCloud.
function lerLinkMidia(u) {
  const yt = idYoutube(u);
  if (yt) return { id: yt, link: `https://www.youtube.com/watch?v=${yt}`, plataforma: 'youtube' };
  try {
    const url = new URL(String(u).trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.replace(/^(www|m)\./, '');
    const p = url.pathname.split('/').filter(Boolean);
    if (host === 'tiktok.com' && /^@[\w.-]{2,32}$/.test(p[0] || '') && p[1] === 'video' && /^\d{8,25}$/.test(p[2] || ''))
      return { id: p[2], link: `https://www.tiktok.com/${p[0]}/video/${p[2]}`, plataforma: 'tiktok' };
    if ((host === 'vm.tiktok.com' || host === 'vt.tiktok.com') && p.length === 1) return { id: 'tt_' + p[0], link: `https://${host}/${p[0]}/`, plataforma: 'tiktok' };
    if (host === 'tiktok.com' && p[0] === 't' && /^[A-Za-z0-9]+$/.test(p[1] || '')) return { id: 'tt_' + p[1], link: `https://www.tiktok.com/t/${p[1]}/`, plataforma: 'tiktok' };
    if (host === 'instagram.com') {
      const k = ['p', 'reel', 'tv'].includes(p[0]) ? 0 : ['p', 'reel'].includes(p[1]) ? 1 : -1;
      const id = k >= 0 ? p[k + 1] || '' : '';
      if (k >= 0 && /^[\w-]{5,25}$/.test(id)) return { id, link: `https://www.instagram.com/${p[k]}/${id}/`, plataforma: 'instagram' };
    }
    if (host === 'soundcloud.com' && p.length >= 2 && !['discover', 'you', 'stream', 'search'].includes(p[0]))
      return { id: 'sc_' + p.join('_').slice(0, 60), link: `https://soundcloud.com/${p.join('/')}`, plataforma: 'soundcloud' };
  } catch (_) {}
  return null;
}
// Perfil do Instagram/TikTok/YouTube: não baixa aqui, abre o perfil para minerar.
function linkPerfil(u) {
  try {
    const url = new URL(String(u).trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.replace(/^(www|m)\./, '');
    const p = url.pathname.split('/').filter(Boolean);
    if (host === 'instagram.com' && /^[\w.]{1,30}$/.test(p[0] || '') && !['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'direct'].includes(p[0]) && p.length <= 2) return `https://www.instagram.com/${p[0]}/`;
    if (host === 'tiktok.com' && /^@[\w.-]{2,32}$/.test(p[0] || '') && p.length === 1) return `https://www.tiktok.com/${p[0]}`;
    if (host === 'youtube.com' && /^@[^/]{2,100}$/.test(p[0] || '') && p.length <= 2) return `https://www.youtube.com/${p[0]}/shorts`;
  } catch (_) {}
  return null;
}
function lerLinks() {
  const linhas = $('#lkLinks').value.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean);
  const ok = [], vistos = new Set();
  let ruins = 0, perfil = null;
  for (const l of linhas) {
    const m = lerLinkMidia(l);
    if (!m) {
      const pf = linkPerfil(l);
      if (pf && !perfil) perfil = pf;
      else if (!pf) ruins++;
    } else if (!vistos.has(m.id)) {
      vistos.add(m.id);
      ok.push(m);
    }
  }
  return { ok, ruins, perfil };
}
const FORMATO_TXT = { video: 'vídeo', mp3: 'MP3', ambos: 'vídeo + MP3' };
function renderLink() {
  const { ok, ruins, perfil } = lerLinks();
  const aut = $('#lkAutorizo').checked;
  const fmt = $('#lkFormato').value;
  const soPerfil = !ok.length && !!perfil;
  $('#lkBaixar').disabled = lk.baixando; // o motivo de não baixar aparece na dica e ao clicar
  $('#lkBaixar').textContent = soPerfil
    ? '🔎 Abrir o perfil e minerar'
    : ok.length > 1
      ? `⬇ Baixar ${ok.length} links (${FORMATO_TXT[fmt]})`
      : fmt === 'mp3' ? '⬇ Baixar MP3' : '⬇ Baixar no Editor';
  // MP3 puro não vai para cortes/mesa, só fica na pasta
  $('#lkDestino').disabled = fmt === 'mp3';
  let dica;
  if (soPerfil) dica = 'Isso é um perfil: abro na aba do navegador e você minera os vídeos (com os vídeos virais e opção de MP3).';
  else if (!st.appOk) dica = 'Abra o Editor em Massa no PC: é ele que baixa o vídeo.';
  else if (!ok.length) dica = ruins ? 'Nenhum link válido. Aceito vídeo do YouTube, TikTok ou Instagram, música do SoundCloud ou perfil.' : 'Cole o link do vídeo, da música ou do perfil (até 50 de uma vez).';
  else if (!aut) dica = 'Marque a confirmação de autorização para baixar.';
  else dica = `${ok.length} link(s) em ${FORMATO_TXT[fmt]}${ruins ? ` · ${ruins} linha(s) ignorada(s)` : ''} → ${fmt === 'mp3' ? 'pasta Downloads/Minerador/links' : $('#lkDestino').value === 'cortes' ? 'Cortes Virais (YouTube) ou mesa do Editor' : 'mesa do Editor'}`;
  $('#lkDica').textContent = dica;
  const u = st.tab && st.tab.url ? st.tab.url : '';
  const mu = lerLinkMidia(u);
  $('#lkAbaAtual').hidden = !mu || ok.some((x) => x.id === mu.id);
  $('#lkLista').innerHTML = lk.itens
    .map((x) => `<div class="lk-item"><code>${esc(x.id)}</code><span class="${x.st}">${esc(x.txt)}</span></div>`)
    .join('');
}
async function baixarLinks() {
  const { ok, perfil } = lerLinks();
  if (!ok.length && perfil) {
    chrome.tabs.create({ url: perfil });
    $('#lkLinks').value = '';
    mostrarAba('minerar');
    toast('Perfil aberto: clique em Minerar quando a página carregar', 'ok');
    return;
  }
  if (lk.baixando) return;
  if (!ok.length) return toast('Nenhum link válido. Aceito vídeo do YouTube, TikTok ou Instagram, música do SoundCloud ou perfil.', 'err');
  if (!$('#lkAutorizo').checked) return toast('Marque a caixa “Tenho autorização do dono do conteúdo” para baixar.', 'err');
  if (!st.appOk) { await checarApp(); renderLink(); if (!st.appOk) return toast('O Editor em Massa não está respondendo. Abra ele (iniciar.bat) e tente de novo.', 'err'); }
  lk.baixando = true;
  lk.itens = ok.map((x) => ({ id: x.id, plataforma: x.plataforma, st: 'esp', txt: 'na fila' }));
  $('#lkProg').hidden = false;
  renderLink();
  const destino = $('#lkDestino').value;
  const formato = $('#lkFormato').value;
  try {
    const { job } = await app('/api/link', {
      method: 'POST',
      body: JSON.stringify({ links: ok.map((x) => x.link), destino, formato, qualidade: $('#lkQualidade').value, autorizado: true })
    });
    let j;
    for (;;) {
      await new Promise((r) => setTimeout(r, 1500));
      j = (await app('/api/jobs/' + job)).job;
      const feitos = j.feitos + j.falhas.length;
      $('#lkBar').style.width = (((feitos + (j.parcial || 0)) / j.total) * 100).toFixed(1) + '%';
      $('#lkTxt').textContent = `${j.etapa || 'Baixando'}${j.parcial ? ` · ${Math.round(j.parcial * 100)}%` : ''}`;
      for (const x of lk.itens) {
        const f = j.falhas.find((y) => y.id === x.id);
        if (j.ok.includes(x.id)) Object.assign(x, { st: 'ok', txt: formato === 'mp3' ? '✓ MP3 salvo' : (destino === 'cortes' && x.plataforma === 'youtube' ? '✓ em Cortes Virais' : '✓ na mesa') + (formato === 'ambos' ? ' + MP3' : '') });
        else if (f) Object.assign(x, { st: 'err', txt: f.erro });
      }
      const atual = lk.itens.find((x) => x.st === 'esp');
      if (atual && j.status === 'rodando') atual.txt = 'baixando…';
      renderLink();
      if (j.status !== 'rodando') break;
    }
    if (j.feitos) {
      $('#lkLinks').value = '';
      toast(`${j.feitos} link(s) baixado(s)${formato === 'mp3' ? ': MP3 na pasta Downloads/Minerador/links' : destino === 'cortes' ? ': veja na aba Cortes Virais do Editor' : ' na mesa do Editor'}${j.falhas.length ? ` · ${j.falhas.length} falharam` : ''}`, j.falhas.length ? '' : 'ok');
    } else throw new Error(j.erro || 'Nada foi baixado');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    lk.baixando = false;
    $('#lkProg').hidden = true;
    $('#lkAutorizo').checked = false; // confirma de novo a cada lote
    renderLink();
  }
}

async function mandarProApp() {
  const lista = selecionados();
  if (!lista.length || st.baixando) return;
  const r = st.res;
  st.baixando = true;
  render();
  try {
    // Instagram: os links de vídeo vencem em algumas horas. Renova pela sua sessão aberta,
    // assim o app baixa direto (sem Companion e sem precisar de login no app).
    if (r.plataforma === 'instagram' && !DEMO) {
      const precisa = lista.filter((v) => !v.video || Date.now() - r.quando > 20 * 60 * 1000);
      if (precisa.length) {
        mostrarDl(`Renovando ${precisa.length} link(s) pela sua sessão…`, 2);
        const res = await renovarLote(precisa); // se não der, o app tenta pelo link do post
        for (const v of precisa) aplicarDetalhes(v, res[v.id]);
      }
    }
    const { job } = await app('/api/baixar', {
      method: 'POST',
      body: JSON.stringify({
        plataforma: r.plataforma,
        perfil: r.perfil,
        itens: lista.map((v, i) => ({ id: v.id, link: v.link, video: v.video || '', legenda: v.legenda || '', views: v.views, score: v.score, posicao: i + 1 }))
      })
    });
    mostrarDl('O Editor em Massa está baixando…', 3);
    let j;
    for (;;) {
      await new Promise((ok) => setTimeout(ok, 1500));
      j = (await app('/api/jobs/' + job)).job;
      const pct = j.total ? ((j.feitos + j.falhas.length + (j.parcial || 0)) / j.total) * 100 : 5;
      mostrarDl(`${j.etapa || 'Baixando'} · ${j.feitos}/${j.total}${j.falhas.length ? ` · ${j.falhas.length} falha(s)` : ''}`, pct);
      if (j.status !== 'rodando') break;
    }
    await marcarBaixados(j.ok || []);
    if (j.status === 'erro') throw new Error(j.erro || 'O app não conseguiu baixar');
    toast(`${j.feitos} vídeo(s) na mesa do Editor em Massa${j.falhas.length ? ` · ${j.falhas.length} falharam` : ''}`, j.falhas.length ? '' : 'ok');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    st.baixando = false;
    $('#dl').hidden = true;
    render();
  }
}

// ------------------------------------------------------------ eventos
function bind() {
  document.querySelectorAll('.aba').forEach((b) => (b.onclick = () => mostrarAba(b.dataset.aba)));
  $('#btnMinerar').onclick = minerar;
  $('#lkBaixar').onclick = baixarLinks;
  for (const id of ['#lkLinks', '#lkAutorizo', '#lkDestino', '#lkQualidade', '#lkFormato']) $(id).addEventListener('input', renderLink);
  for (const id of ['#lkDestino', '#lkQualidade', '#lkFormato']) $(id).addEventListener('change', () => set('lk', { destino: $('#lkDestino').value, qualidade: $('#lkQualidade').value, formato: $('#lkFormato').value }));
  get('lk').then((o) => {
    if (o && o.destino) $('#lkDestino').value = o.destino;
    if (o && o.qualidade) $('#lkQualidade').value = o.qualidade;
    if (o && o.formato) $('#lkFormato').value = o.formato;
    renderLink();
  });
  $('#lkAbaAtual').onclick = () => {
    const t = $('#lkLinks');
    t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + st.tab.url;
    renderLink();
  };
  $('#btnDeNovo').onclick = minerar;
  $('#btnEscolher').onclick = escolherNaPagina;
  $('#btnCancelar').onclick = cancelar;
  $('#btnParecidos').onclick = mostrarParecidos;
  $('#btnFecharPar').onclick = () => ($('#parecidos').hidden = true);
  $('#parLista').onclick = (e) => {
    const b = e.target.closest('.pp');
    if (!b || !st.res) return;
    chrome.tabs.create({ url: urlPerfil(st.res.plataforma, b.dataset.u), index: st.tab ? st.tab.index + 1 : undefined });
  };
  $('#btnIrShorts').onclick = async () => {
    const u = new URL(st.tab.url);
    const base = u.pathname.split('/').filter(Boolean)[0];
    await chrome.tabs.update(st.tab.id, { url: `${u.origin}/${base}/shorts` });
  };
  $('#optOrdem2').innerHTML = $('#optOrdem').innerHTML;
  for (const id of ['#optOrdem', '#optOrdem2'])
    $(id).addEventListener('change', (e) => {
      $('#optOrdem').value = $('#optOrdem2').value = e.target.value;
      salvarOpts();
      if (st.res) selecionarTop(Number($('#optQuero').value) || 50);
    });
  for (const id of ['#optDias', '#optMinViews', '#optMinLikes', '#optMinComments'])
    $(id).addEventListener('change', () => {
      salvarOpts();
      render();
    });
  $('#optEscopo').addEventListener('change', () => {
    renderEscopo();
    salvarOpts();
  });
  $('#optUltimos').addEventListener('change', salvarOpts);
  $('#optQuero').addEventListener('change', salvarOpts);
  document.querySelector('.rapido').onclick = (e) => {
    const b = e.target.closest('button[data-top]');
    if (b) selecionarTop(Number(b.dataset.top));
  };
  $('#chkTodos').onchange = (e) => selecionarTop(e.target.checked ? 5000 : 0);
  $('#lista').addEventListener('change', (e) => {
    const it = e.target.closest('.item');
    if (!it) return;
    e.target.checked ? st.sel.add(it.dataset.id) : st.sel.delete(it.dataset.id);
    it.classList.toggle('on', e.target.checked);
    render();
  });
  $('#btnZip').onclick = baixarZip;
  $('#btnApp').onclick = mandarProApp;
  $('#btnMais').onclick = () => ($('#menuMais').hidden = !$('#menuMais').hidden);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menuMais, #btnMais')) $('#menuMais').hidden = true;
  });
  $('#btnCsv').onclick = async () => {
    const l = st.sel.size ? selecionados() : visiveis();
    await salvarArquivo(new Blob([MV.csv(l, st.res.plataforma, st.res.perfil)], { type: 'text/csv' }), `Minerador/${st.res.plataforma}_${MV.nomeArquivo(st.res.perfil)}_${hoje()}.csv`);
    toast('Planilha salva em Downloads/Minerador', 'ok');
  };
  $('#btnLinks').onclick = async () => {
    const l = st.sel.size ? selecionados() : visiveis();
    await navigator.clipboard.writeText(l.map((v) => v.link).join('\n'));
    toast(`${l.length} link(s) copiados`, 'ok');
  };
  $('#btnLimparHist').onclick = async () => {
    const todos = (await get('baixados')) || {};
    delete todos[chave({ plataforma: st.res.plataforma, perfil: st.res.perfil })];
    await set('baixados', todos);
    st.baixados = {};
    render();
    toast('Baixados deste perfil esquecidos', 'ok');
  };
  // histórico
  $('#hLista').onclick = (e) => {
    const b = e.target.closest('.hcard');
    if (b) abrirDoHistorico(b.dataset.k);
  };
  $('#btnLimparTudo').onclick = async () => {
    if (!confirm('Apagar o histórico de perfis analisados e a lista de vídeos já baixados?')) return;
    await chrome.storage.local.remove(['ultimos', 'baixados']);
    st.res = null;
    st.baixados = {};
    st.sel.clear();
    renderHistorico();
    render();
  };
  // ajustes
  for (const id of ['#ajNovos', '#ajTudo', '#ajCompletar', '#ajCsv', '#ajOrganizacao', '#ajLote', '#ajSalvar', '#ajDemo']) $(id).addEventListener('change', salvarAjustes);
  $('#btnEsquecerTodos').onclick = async () => {
    if (!confirm('Esquecer todos os vídeos marcados como baixados?')) return;
    await set('baixados', {});
    st.baixados = {};
    renderAjustes();
    render();
  };
  // seleção feita na página
  chrome.storage.onChanged.addListener((mud, area) => {
    if (area === 'local' && mud.selecaoManual && mud.selecaoManual.newValue) usarSelecaoManual(mud.selecaoManual.newValue);
  });
  if (!DEMO) {
    chrome.tabs.onActivated.addListener(lerAba);
    chrome.tabs.onUpdated.addListener((id, info) => {
      if (info.url || info.status === 'complete') lerAba();
    });
    chrome.windows.onFocusChanged.addListener(lerAba);
  }
}

// ------------------------------------------------------------ modo demonstração
async function coletaDemo(o) {
  const n = Math.min(o.analisar, 60);
  const itens = [];
  for (let i = 0; i < n; i++) {
    progresso(`Lendo os vídeos · ${i + 1} encontrados`, ((i + 1) / n) * 100);
    if (i % 15 === 0) await new Promise((r) => setTimeout(r, 30));
    const views = Math.round(20000 * Math.exp(Math.sin(i * 1.7) * 1.6) * (i === 4 ? 25 : 1));
    itens.push({
      id: 'DEMO' + String(i).padStart(3, '0'),
      link: 'https://www.instagram.com/reel/DEMO' + i + '/',
      views,
      likes: Math.round(views * (0.03 + (i % 5) * 0.01)),
      comments: Math.round(views * 0.002),
      data: Math.floor(Date.now() / 1000) - i * 86400 * 2,
      thumb: '',
      video: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
      legenda: ['Golaço no último minuto 🔥', 'Reação da torcida', 'Bastidores do treino', 'Top 5 dribles', 'Isso ninguém esperava'][i % 5] + ' #' + i,
      ordem: i
    });
  }
  return { itens, completo: true, aviso: '' };
}

// ------------------------------------------------------------ início
(async function init() {
  await carregarOpts();
  bind();
  await lerAba();
  renderDica();
  render();
  checarApp();
  setInterval(checarApp, 8000);
  // seleção feita enquanto o painel estava fechado
  const pend = await get('selecaoManual');
  if (pend && Date.now() - pend.quando < 10 * 60 * 1000) usarSelecaoManual(pend);
})();
