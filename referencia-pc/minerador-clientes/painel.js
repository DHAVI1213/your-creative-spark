'use strict';
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const { pontuar, telefone } = self.MC;

const MSG_PADRAO = 'Oi, tudo bem? Vi a {nome} no Google Maps, com nota {nota} e {avaliacoes} avaliações, parabéns pelo trabalho!\n\nEu faço sites para negócios aqui de {cidade}: cardápio bonito no celular, com cada produto levando direto para o pedido no iFood ou no WhatsApp.\n\nPosso te mandar um modelo para você ver como ficaria o da {nome}? Sem compromisso.';
const ATALHOS_PADRAO = 'hamburgueria, lanchonete, pizzaria, padaria, açaí, restaurante, doceria, sorveteria, espetinho, marmitaria, barbearia, salão de beleza';

const st = {
  aj: { cidade: '', msg: MSG_PADRAO, atalhos: ATALHOS_PADRAO, max: '40', detalhar: true },
  lojas: [],
  busca: null,       // { id, termo, cidade, quando }
  nivel: '',
  contatados: {},
  rodando: false
};

// ------------------------------------------------------------------ armazenamento
async function carregar() {
  const d = await chrome.storage.local.get(['ajustes', 'contatados', 'ultima']);
  Object.assign(st.aj, d.ajustes || {});
  st.contatados = d.contatados || {};
  $('#cidade').value = st.aj.cidade;
  $('#max').value = st.aj.max;
  $('#detalhar').checked = st.aj.detalhar !== false;
  $('#msg').value = st.aj.msg;
  $('#atalhos').value = st.aj.atalhos;
  desenharChips();
  if (d.ultima) abrirBusca(d.ultima);
}
const salvarAjustes = () => chrome.storage.local.set({ ajustes: st.aj });
let salvarTimer = null;
function salvarBusca() {
  clearTimeout(salvarTimer);
  salvarTimer = setTimeout(async () => {
    if (!st.busca) return;
    const { buscas = [] } = await chrome.storage.local.get('buscas');
    const reg = { ...st.busca, lojas: st.lojas };
    const i = buscas.findIndex((b) => b.id === reg.id);
    if (i >= 0) buscas[i] = reg; else buscas.unshift(reg);
    await chrome.storage.local.set({ buscas: buscas.slice(0, 25), ultima: reg.id });
  }, 400);
}
async function abrirBusca(id) {
  const { buscas = [] } = await chrome.storage.local.get('buscas');
  const b = buscas.find((x) => x.id === id);
  if (!b) return;
  st.busca = { id: b.id, termo: b.termo, cidade: b.cidade, quando: b.quando };
  st.lojas = b.lojas || [];
  $('#termo').value = b.termo;
  if (b.cidade) $('#cidade').value = b.cidade;
  desenhar();
}

// ------------------------------------------------------------------ interface básica
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2400); }
function dica(t, erro) { const el = $('#dica'); el.textContent = t || ''; el.classList.toggle('erro', !!erro); }
function progresso(txt, frac) {
  $('#prog').hidden = txt == null;
  if (txt != null) { $('#progTxt').textContent = txt; $('#progBar').style.width = Math.round((frac || 0) * 100) + '%'; }
}
$$('.aba').forEach((b) => b.addEventListener('click', () => {
  $$('.aba').forEach((x) => x.classList.toggle('on', x === b));
  $('#vBuscar').hidden = b.dataset.aba !== 'buscar';
  $('#vHistorico').hidden = b.dataset.aba !== 'historico';
  $('#vAjustes').hidden = b.dataset.aba !== 'ajustes';
  $('#rodape').hidden = b.dataset.aba !== 'buscar' || !st.lojas.length;
  if (b.dataset.aba === 'historico') desenharHistorico();
}));
function desenharChips() {
  const lista = st.aj.atalhos.split(',').map((s) => s.trim()).filter(Boolean);
  $('#chips').innerHTML = lista.map((t) => `<button class="chip" data-t="${esc(t)}">${esc(t)}</button>`).join('');
  $$('.chip').forEach((c) => c.addEventListener('click', () => { $('#termo').value = c.dataset.t; $$('.chip').forEach((x) => x.classList.toggle('on', x === c)); }));
}

// ------------------------------------------------------------------ busca
function esperarCarregar(tabId, ms = 25000) {
  return new Promise((res) => {
    const fim = setTimeout(() => { chrome.tabs.onUpdated.removeListener(ouvir); res(false); }, ms);
    function ouvir(id, info) { if (id === tabId && info.status === 'complete') { clearTimeout(fim); chrome.tabs.onUpdated.removeListener(ouvir); res(true); } }
    chrome.tabs.onUpdated.addListener(ouvir);
  });
}
async function abaAtual() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }
const ehMaps = (u) => /^https:\/\/www\.google\.com(\.br)?\/maps/.test(u || '');

async function buscar() {
  const termo = $('#termo').value.trim();
  const cidade = $('#cidade').value.trim();
  if (!termo) { dica('Escreva o que procurar, por exemplo "hamburgueria".', true); $('#termo').focus(); return; }
  if (!cidade) { dica('Escreva a cidade, por exemplo "Formosa GO".', true); $('#cidade').focus(); return; }
  st.aj.cidade = cidade; salvarAjustes();
  const url = 'https://www.google.com/maps/search/' + encodeURIComponent(`${termo} ${cidade}`).replace(/%20/g, '+') + '?hl=pt-BR';
  let tab = await abaAtual();
  if (tab && ehMaps(tab.url)) tab = await chrome.tabs.update(tab.id, { url });
  else tab = await chrome.tabs.create({ url, active: true });
  progresso('Abrindo o Google Maps…', .03);
  await esperarCarregar(tab.id);
  await dorme(2200);
  await lerLista(tab.id, { termo, cidade });
}

async function lerAberta() {
  const tab = await abaAtual();
  if (!tab || !ehMaps(tab.url)) { dica('Abra o Google Maps nesta aba e faça uma busca, ou use "Buscar no Maps".', true); return; }
  await lerLista(tab.id, { termo: $('#termo').value.trim(), cidade: $('#cidade').value.trim() });
}

async function lerLista(tabId, { termo, cidade }) {
  if (st.rodando) return;
  st.rodando = true;
  travar(true);
  dica('');
  try {
    const max = +$('#max').value;
    progresso('Lendo a lista do Maps… deixe esta aba à vista', .05);
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: mcColetarLista, args: [max] });
    const res = r && r.result;
    if (!res || !res.ok) { dica(res ? res.erro : 'Não consegui ler esta página.', true); return; }
    if (!res.itens.length) { dica('A busca não trouxe nenhuma loja. Tente outro termo.', true); return; }
    const termoFinal = termo || res.busca || 'busca';
    st.busca = { id: Date.now().toString(36), termo: termoFinal, cidade, quando: Date.now() };
    st.lojas = res.itens.map((l) => ({ ...l, detalhada: false }));
    st.nivel = '';
    $$('.nv').forEach((x) => x.classList.toggle('on', x.dataset.nivel === ''));
    desenhar();
    salvarBusca();
    let aviso = `${res.itens.length} lojas encontradas${res.fim ? ' (lista completa)' : ''}.`;
    if (res.oculta && !res.fim && res.itens.length < max) aviso += ' O Maps só carrega mais lojas com a aba dele à vista.';
    dica(aviso);
    if ($('#detalhar').checked) await detalharTudo();
    else await checarSites(st.lojas.filter((l) => l.site));
  } catch (e) {
    dica('Erro: ' + (e.message || e), true);
  } finally {
    st.rodando = false;
    travar(false);
    progresso(null);
    salvarBusca();
  }
}

async function detalharTudo() {
  const pend = st.lojas.filter((l) => !l.detalhada);
  if (!pend.length) return;
  progresso(`Abrindo cada loja: 0 de ${pend.length}`, 0);
  const resp = await chrome.runtime.sendMessage({ tipo: 'detalhar', lojas: pend.map((l) => ({ id: l.id, link: l.link, nome: l.nome })) });
  // sites que ainda não foram checados (por exemplo, se a checagem chegou depois)
  await dorme(300);
  await checarSites(st.lojas.filter((l) => l.site && !l.checagem && !l._checando));
  // espera as checagens que ainda estão em andamento
  for (let i = 0; i < 40 && st.lojas.some((l) => l._checando); i++) { progresso('Terminando de avaliar os sites…', 1); await dorme(500); }
  if (resp && resp.cancelado) toast('Parado. O que já foi lido ficou salvo.');
  else toast('Pronto! Lista completa.');
}

async function checarSites(lojas) {
  for (let i = 0; i < lojas.length; i++) {
    const l = lojas[i];
    progresso(`Avaliando sites: ${i + 1} de ${lojas.length}`, (i + 1) / lojas.length);
    l.checagem = await chrome.runtime.sendMessage({ tipo: 'checarSite', url: l.site });
    atualizarLoja(l);
  }
}

chrome.runtime.onMessage.addListener((m) => {
  if (m.tipo === 'progresso' && m.fase === 'lista') progresso(`Lendo a lista do Maps: ${m.n} lojas…`, Math.min(.95, m.n / m.max));
  if (m.tipo === 'progresso' && m.fase === 'detalhe') progresso(`Abrindo cada loja: ${m.i} de ${m.total} · ${m.nome}`, m.i / m.total);
  if (m.tipo === 'detalhe') {
    const l = st.lojas.find((x) => x.id === m.id);
    if (!l) return;
    const d = m.dados || {};
    if (!d.erro) {
      for (const k of ['site', 'telefone', 'endereco', 'cardapio', 'categoria', 'foto', 'totalFotos']) if (d[k]) l[k] = d[k];
      if (d.nota) l.nota = d.nota;
      if (d.avaliacoes) l.avaliacoes = d.avaliacoes;
      l.pedidoOnline = l.pedidoOnline || d.pedidoOnline;
      l.fechadoDeVez = d.fechadoDeVez; l.fechadoTemporario = d.fechadoTemporario;
    }
    l.detalhada = true;
    atualizarLoja(l);
    salvarBusca();
    if (l.site && !l.checagem && !l._checando) { l._checando = true; chrome.runtime.sendMessage({ tipo: 'checarSite', url: l.site }).then((c) => { l.checagem = c; l._checando = false; atualizarLoja(l); salvarBusca(); }); }
  }
});

function travar(sim) { $('#btnBuscar').disabled = sim; $('#btnLer').disabled = sim; if (sim) $('#btnCompletar').hidden = true; }
$('#btnBuscar').addEventListener('click', buscar);
$('#btnCompletar').addEventListener('click', async () => {
  if (st.rodando) return;
  st.rodando = true; travar(true); desenhar();
  try { await detalharTudo(); } finally { st.rodando = false; travar(false); progresso(null); salvarBusca(); desenhar(); }
});
$('#btnLer').addEventListener('click', lerAberta);
$('#termo').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });
$('#cidade').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });
$('#btnCancelar').addEventListener('click', () => { chrome.runtime.sendMessage({ tipo: 'cancelar' }); progresso('Parando…', 1); });
$('#max').addEventListener('change', () => { st.aj.max = $('#max').value; salvarAjustes(); });
$('#detalhar').addEventListener('change', () => { st.aj.detalhar = $('#detalhar').checked; salvarAjustes(); });

// ------------------------------------------------------------------ lista
function avaliar(l) { l._p = pontuar(l); return l._p; }
function visiveis() {
  const txt = $('#filtroTxt').value.trim().toLowerCase();
  const semSite = $('#soSemSite').checked, esconder = $('#esconderContatados').checked;
  const ordem = $('#ordem').value;
  const out = st.lojas.filter((l) => {
    const p = l._p || avaliar(l);
    if (st.nivel && p.nivel !== st.nivel) return false;
    if (semSite && l.site && !(l.checagem && l.checagem.tipo !== 'site')) return false;
    if (esconder && st.contatados[l.id]) return false;
    if (txt && !(`${l.nome} ${l.endereco} ${l.categoria}`.toLowerCase().includes(txt))) return false;
    return true;
  });
  const val = (l) => (l._p.chance == null ? -1 : l._p.chance);
  if (ordem === 'chance') out.sort((a, b) => val(b) - val(a) || (b.avaliacoes || 0) - (a.avaliacoes || 0));
  if (ordem === 'avaliacoes') out.sort((a, b) => (b.avaliacoes || 0) - (a.avaliacoes || 0));
  if (ordem === 'nota') out.sort((a, b) => (b.nota || 0) - (a.nota || 0) || (b.avaliacoes || 0) - (a.avaliacoes || 0));
  if (ordem === 'nome') out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return out;
}

function mensagem(l) {
  const cidade = (st.busca && st.busca.cidade || st.aj.cidade || '').replace(/\s+[A-Z]{2}$/, '');
  return st.aj.msg
    .replaceAll('{nome}', l.nome)
    .replaceAll('{nota}', l.nota ? String(l.nota).replace('.', ',') : '')
    .replaceAll('{avaliacoes}', l.avaliacoes || '')
    .replaceAll('{cidade}', cidade)
    .replaceAll('{categoria}', (l.categoria || '').toLowerCase());
}

function cartao(l) {
  const p = l._p || avaliar(l);
  const tel = telefone(l.telefone);
  const contatado = !!st.contatados[l.id];
  const badge = p.nivel === 'carregando'
    ? `<span class="badge carregando" title="${l.detalhada ? 'Avaliando o site…' : 'Ligue “Ver site e telefone” para saber'}"><b>…</b>${st.rodando ? 'vendo' : 'sem dados'}</span>`
    : p.nivel === 'fora' ? '<span class="badge fora"><b>—</b>fora</span>'
    : `<span class="badge ${p.nivel}" title="Chance de venda"><b>${p.chance}</b>${p.nivel}</span>`;
  const estrelas = l.nota ? `<span class="estrelas">★ ${String(l.nota).replace('.', ',')}</span> (${l.avaliacoes || 0})` : 'sem avaliações';
  const meta2 = [l.categoria, l.preco].filter(Boolean).join(' · ');
  const zap = tel && tel.wa ? `<a class="acao zap" href="https://wa.me/${tel.wa}?text=${encodeURIComponent(mensagem(l))}" target="_blank" data-contato="${esc(l.id)}">WhatsApp</a>` : '';
  const ligar = tel && !tel.wa ? `<a class="acao" href="tel:+55${tel.digitos}" title="Telefone fixo">☎ ${esc(tel.bonito || tel.digitos)}</a>` : '';
  return `
    <article class="loja${contatado ? ' contatado' : ''}" data-id="${esc(l.id)}">
      <div class="topo">
        ${l.foto ? `<img class="foto" src="${esc(l.foto)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="foto vazia">🏪</div>'}
        <div>
          <h3>${esc(l.nome)}</h3>
          <div class="meta">${estrelas}${meta2 ? ' · ' + esc(meta2) : ''}</div>
          <div class="meta">${esc(l.endereco || '')}${tel && tel.bonito ? ' · ' + esc(tel.bonito) : ''}</div>
          ${l.status ? `<div class="meta">${esc(l.status)}</div>` : ''}
        </div>
        ${badge}
      </div>
      ${p.motivos.length ? `<div class="motivos">${p.motivos.map((m) => `<span class="motivo ${m.tipo}">${esc(m.t)}</span>`).join('')}</div>` : ''}
      ${l.destaque ? `<p class="destaque">“${esc(l.destaque)}”</p>` : ''}
      <div class="acoes">
        <a class="acao" href="${esc(l.link)}" target="_blank">Maps</a>
        ${l.site ? `<a class="acao" href="${esc(l.site)}" target="_blank" title="${esc(l.site)}">Site</a>` : ''}
        ${l.cardapio && l.cardapio !== l.site ? `<a class="acao" href="${esc(l.cardapio)}" target="_blank">Cardápio</a>` : ''}
        ${zap}${ligar}
        <button class="acao" data-copiar="${esc(l.id)}" title="Copia a mensagem pronta">Copiar msg</button>
        <button class="acao direita ${contatado ? 'feito' : ''}" data-marcar="${esc(l.id)}">${contatado ? '✓ contatado' : 'marcar contatado'}</button>
      </div>
    </article>`;
}

function contar() {
  const c = { quente: 0, morna: 0, fria: 0 };
  for (const l of st.lojas) { const p = l._p || avaliar(l); if (c[p.nivel] != null) c[p.nivel]++; }
  $('#nQuente').textContent = c.quente; $('#nMorna').textContent = c.morna; $('#nFria').textContent = c.fria; $('#nTodas').textContent = st.lojas.length;
}

function desenhar() {
  st.lojas.forEach(avaliar);
  $('#res').hidden = !st.lojas.length;
  $('#rodape').hidden = !st.lojas.length || $('#vBuscar').hidden;
  contar();
  const vis = visiveis();
  $('#nVisiveis').textContent = vis.length;
  const pend = st.lojas.filter((l) => !l.detalhada).length;
  $('#btnCompletar').hidden = !pend || st.rodando;
  $('#btnCompletar').textContent = `ver site e telefone de ${pend} loja${pend > 1 ? 's' : ''}`;
  $('#lista').innerHTML = vis.length ? vis.map(cartao).join('') : '<div class="vazio">Nenhuma loja com esses filtros.</div>';
}
let redesenho = null;
function atualizarLoja(l) {
  avaliar(l);
  // redesenha tudo no máximo a cada 400 ms (a ordem pode mudar)
  if (redesenho) return;
  redesenho = setTimeout(() => { redesenho = null; desenhar(); }, 400);
}

$('#lista').addEventListener('click', async (e) => {
  const cop = e.target.closest('[data-copiar]');
  const marc = e.target.closest('[data-marcar]');
  const zap = e.target.closest('[data-contato]');
  if (cop) {
    const l = st.lojas.find((x) => x.id === cop.dataset.copiar);
    await navigator.clipboard.writeText(mensagem(l));
    toast('Mensagem copiada');
  }
  if (marc || zap) {
    const id = (marc || zap).dataset.marcar || zap.dataset.contato;
    if (zap) st.contatados[id] = Date.now();
    else if (st.contatados[id]) delete st.contatados[id]; else st.contatados[id] = Date.now();
    await chrome.storage.local.set({ contatados: st.contatados });
    if (!zap) desenhar(); else setTimeout(desenhar, 300);
  }
});
$$('.nv').forEach((b) => b.addEventListener('click', () => { st.nivel = b.dataset.nivel; $$('.nv').forEach((x) => x.classList.toggle('on', x === b)); desenhar(); }));
['#filtroTxt', '#ordem', '#soSemSite', '#esconderContatados'].forEach((s) => $(s).addEventListener(s === '#filtroTxt' ? 'input' : 'change', desenhar));

// ------------------------------------------------------------------ exportar
function linhaSite(l) {
  const c = l.checagem;
  if (!l.site) return l.detalhada ? 'sem site' : '';
  if (!c) return '';
  if (c.tipo !== 'site') return c.plataforma;
  return (l._p.motivos || []).map((m) => m.t).join('; ');
}
$('#btnCsv').addEventListener('click', () => {
  const vis = visiveis();
  const cab = ['chance', 'nivel', 'nome', 'categoria', 'nota', 'avaliacoes', 'telefone', 'whatsapp', 'site', 'situacao_do_site', 'endereco', 'maps', 'cardapio', 'contatado'];
  const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = vis.map((l) => {
    const t = telefone(l.telefone);
    return [l._p.chance ?? '', l._p.nivel, l.nome, l.categoria, l.nota ? String(l.nota).replace('.', ',') : '', l.avaliacoes || '', t ? t.bonito || t.digitos : '', t && t.wa ? `https://wa.me/${t.wa}` : '', l.site, linhaSite(l), l.endereco, l.link, l.cardapio || '', st.contatados[l.id] ? 'sim' : ''].map(csv).join(';');
  });
  const blob = new Blob(['﻿' + [cab.join(';'), ...linhas].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  const nome = `clientes-${(st.busca?.termo || 'busca')}-${(st.busca?.cidade || '')}`.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/-+$/, '');
  a.href = URL.createObjectURL(blob); a.download = nome + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`Planilha com ${vis.length} lojas baixada`);
});
$('#btnCopiar').addEventListener('click', async () => {
  const vis = visiveis();
  const txt = vis.map((l) => { const t = telefone(l.telefone); return `${l.nome} — ${l._p.nivel}${l._p.chance != null ? ' ' + l._p.chance : ''} — ★${l.nota || '-'} (${l.avaliacoes || 0}) — ${t ? t.bonito || t.digitos : 'sem telefone'} — ${l.site || 'sem site'}`; }).join('\n');
  await navigator.clipboard.writeText(txt);
  toast('Lista copiada');
});

// ------------------------------------------------------------------ histórico
async function desenharHistorico() {
  const { buscas = [] } = await chrome.storage.local.get('buscas');
  $('#hVazio').hidden = !!buscas.length;
  $('#hLista').innerHTML = buscas.map((b) => {
    const q = (b.lojas || []).filter((l) => pontuar(l).nivel === 'quente').length;
    return `<div class="hitem" data-id="${esc(b.id)}"><div><b>${esc(b.termo)} · ${esc(b.cidade || '')}</b><small>${new Date(b.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${(b.lojas || []).length} lojas · <span class="q">${q} quentes</span></small></div><button class="link perigo" data-apagar="${esc(b.id)}">apagar</button></div>`;
  }).join('');
}
$('#hLista').addEventListener('click', async (e) => {
  const ap = e.target.closest('[data-apagar]');
  if (ap) {
    e.stopPropagation();
    const { buscas = [] } = await chrome.storage.local.get('buscas');
    await chrome.storage.local.set({ buscas: buscas.filter((b) => b.id !== ap.dataset.apagar) });
    return desenharHistorico();
  }
  const it = e.target.closest('.hitem');
  if (it) { await abrirBusca(it.dataset.id); $$('.aba')[0].click(); }
});
$('#btnLimpar').addEventListener('click', async () => {
  await chrome.storage.local.remove(['buscas', 'ultima']);
  desenharHistorico();
  toast('Histórico apagado');
});

// ------------------------------------------------------------------ ajustes
$('#msg').addEventListener('input', () => { st.aj.msg = $('#msg').value; salvarAjustes(); });
$('#btnMsgPadrao').addEventListener('click', () => { $('#msg').value = st.aj.msg = MSG_PADRAO; salvarAjustes(); toast('Texto padrão de volta'); });
$('#atalhos').addEventListener('change', () => { st.aj.atalhos = $('#atalhos').value; salvarAjustes(); desenharChips(); });
$('#versao').textContent = 'Minerador de Clientes v' + chrome.runtime.getManifest().version;

carregar();
