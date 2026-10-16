'use strict';
/* global $, $$, esc, toast, basename, state, api */
// Aba Agendador: monta um lote de posts em massa e envia para a nuvem, que publica no horário.

const sch = {
  cfg: null, // { url, apiKey }
  status: null, // resposta de /api/status
  buscaConta: '', // filtro da lista de contas
  lote: [], // { uid, path, nome, kind, tipo, legendaVideo, capa, thumb, quando, legenda, titulo, contas, shareToFeed }
  nuvem: [],
  contas: [], // contas conectadas na nuvem (Instagram, YouTube, TikTok)
  destinos: new Set(JSON.parse(localStorage.getItem('eem.destinos') || '[]')), // contas marcadas para o lote
  nuvemConta: '',
  tab: 'lote',
  tipo: 'reels',
  legMode: 'video',
  sending: false,
  timer: null
};
let uidSeq = 1;
const IMG_EXT = /\.(jpe?g|png|webp)$/i;
const TIPO_NOME = { reels: 'Reels', story: 'Story', foto: 'Foto', short: 'Short', video: 'Vídeo' };
const REDE = {
  instagram: { nome: 'Instagram', sigla: 'IG', abrir: 'Abrir no Instagram ↗' },
  youtube: { nome: 'YouTube', sigla: 'YT', abrir: 'Abrir no YouTube ↗' },
  tiktok: { nome: 'TikTok', sigla: 'TT', abrir: 'Abrir no TikTok ↗' }
};
const contaPorId = (id) => sch.contas.find((c) => c.id === id);
const contaNome = (c) => (c.plataforma === 'instagram' ? '@' + c.nome : c.nome);
const salvarDestinos = () => localStorage.setItem('eem.destinos', JSON.stringify([...sch.destinos]));
const temRede = (it, rede) => it.contas.some((id) => (contaPorId(id) || {}).plataforma === rede);
// contas deste item que realmente recebem o arquivo (foto só vai para o Instagram)
const contasValidas = (it) => it.contas.filter((id) => {
  const c = contaPorId(id);
  return c && (it.kind === 'video' || c.plataforma === 'instagram');
});

// ------------------------------------------------------------ util
const pad2 = (n) => String(n).padStart(2, '0');
const toLocalInput = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const fmtQuando = (ms) =>
  new Date(ms).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDia = (ms) => new Date(ms).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
const countTags = (t) => (String(t).match(/#[\p{L}\p{N}_]+/gu) || []).length;

function parseTimes(txt) {
  const out = [];
  for (const m of String(txt).matchAll(/(\d{1,2})\s*[:h]\s*(\d{2})?/g)) {
    const h = +m[1], mi = +(m[2] || 0);
    if (h < 24 && mi < 60) out.push(h * 60 + mi);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}
function normTags(txt) {
  return String(txt || '')
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : '#' + t))
    .join(' ');
}

// ------------------------------------------------------------ nuvem
const loadCfg = () => {
  try {
    return JSON.parse(localStorage.getItem('eem.cloud')) || null;
  } catch (_) {
    return null;
  }
};
const saveCfg = (c) => localStorage.setItem('eem.cloud', JSON.stringify(c));

async function cloud(method, path, body) {
  if (!sch.cfg || !sch.cfg.url || !sch.cfg.apiKey) throw new Error('Configure a nuvem primeiro');
  const r = await api.cloudApi(sch.cfg, method, path, body);
  if (r.status !== 200) throw new Error((r.data && r.data.erro) || `Erro ${r.status}`);
  return r.data;
}

async function refreshStatus() {
  if (!sch.cfg) {
    sch.status = null;
    renderConn();
    return;
  }
  try {
    sch.status = await cloud('GET', '/api/status');
  } catch (err) {
    sch.status = { erroConexao: err.message };
  }
  renderConn();
}

function renderConn() {
  const st = sch.status;
  const cloudOk = !!(st && st.ok);
  const nova = cloudOk && st.versao >= 2;
  sch.contas = nova ? st.contas || [] : [];
  // contas que sumiram da nuvem saem da seleção
  for (const id of [...sch.destinos]) if (nova && !contaPorId(id)) sch.destinos.delete(id);
  // primeira vez (nada escolhido ainda): já vem com todas as contas marcadas
  if (nova && !sch.destinos.size && sch.contas.length && (localStorage.getItem('eem.destinos') || '[]') === '[]') {
    for (const c of sch.contas) sch.destinos.add(c.id);
    for (const it of sch.lote) if (!it.contas.length) it.contas = [...sch.destinos];
  }

  $('#dotCloud').className = 'dot' + (cloudOk ? ' ok' : sch.cfg ? ' warn' : '');
  $('#txtCloud').textContent = !sch.cfg
    ? 'Nuvem não configurada'
    : cloudOk
      ? 'Nuvem conectada'
      : `Nuvem sem resposta${st && st.erroConexao ? ': ' + st.erroConexao : ''}`;
  $('#txtCloud').title = sch.cfg ? sch.cfg.url : '';
  $('#nuvemVelha').classList.toggle('hidden', !cloudOk || nova);
  // nuvem v3 manda maxContas 0 = sem limite; a v2 ainda tem limite de 5
  const max = st && st.versao >= 3 ? st.maxContas || 0 : 5;
  $('#contasConta').textContent = max ? `${sch.contas.length}/${max}` : `${sch.contas.length} conta${sch.contas.length === 1 ? '' : 's'}`;
  $('#addContas').classList.toggle('hidden', !nova || (max > 0 && sch.contas.length >= max));
  $('#nuvemLimite').classList.toggle('hidden', !(nova && max > 0));
  $('#contasBusca').classList.toggle('hidden', sch.contas.length < 6);
  const q = sch.buscaConta.trim().toLowerCase();
  const filtradas = sch.contas.filter((c) => !q || contaNome(c).toLowerCase().includes(q) || REDE[c.plataforma].nome.toLowerCase().includes(q));
  $('#contasList').innerHTML = sch.contas.length
    ? (filtradas.length ? '' : '<p class="hint">Nenhuma conta com esse nome.</p>') +
      filtradas
        .map((c) => {
          let info = '';
          if (c.erro) info = `<span class="bad">⚠ ${esc(c.erro)}</span>`;
          else if (c.acessoAte) info = `acesso até ${new Date(c.acessoAte).toLocaleDateString('pt-BR')}`;
          else info = 'conectada';
          return `<div class="conta" data-id="${esc(c.id)}">
            <span class="net net-${c.plataforma === 'instagram' ? 'ig' : c.plataforma === 'youtube' ? 'yt' : 'tt'}">${REDE[c.plataforma].sigla}</span>
            <div><b title="${esc(contaNome(c))}">${esc(contaNome(c))}</b><small>${info} · ${c.publicados24h || 0} hoje</small></div>
            <button class="link danger-link" data-rm="${esc(c.id)}" title="Desconectar esta conta">remover</button>
          </div>`;
        })
        .join('')
    : `<p class="hint">${nova ? 'Nenhuma conta ainda. Conecte quantas quiser: Instagram, YouTube ou TikTok.' : cloudOk ? '' : 'Configure a nuvem primeiro.'}</p>`;
  if (nova) {
    $('#ytRedirect').value = st.redirect.youtube;
    $('#ttRedirect').value = st.redirect.tiktok;
  }
  renderDestinos();
  if (cloudOk) {
    const c = st.contagem || {};
    $('#cloudSum').innerHTML =
      `<span>Agendados <b>${c.agendado || 0}</b></span> · <span>Publicando <b>${c.processando || 0}</b></span> · ` +
      `<span>Publicados <b>${c.publicado || 0}</b></span> · <span>Com erro <b>${c.erro || 0}</b></span> · ` +
      `<span>Últimas 24h <b>${st.publicados24h || 0}</b></span>`;
  } else $('#cloudSum').innerHTML = '';
  const sel = $('#nuvemConta');
  sel.innerHTML = '<option value="">Todas as contas</option>' + sch.contas.map((c) => `<option value="${esc(c.id)}">${REDE[c.plataforma].nome} · ${esc(contaNome(c))}</option>`).join('');
  sel.value = contaPorId(sch.nuvemConta) ? sch.nuvemConta : '';
  const pode = nova && sch.contas.length > 0;
  $('#loteSend').disabled = sch.sending || !sch.lote.length || !pode;
  $('#loteSend').title = pode ? '' : 'Conecte a nuvem e pelo menos uma conta primeiro';
}

// Chips das contas para escolher onde o lote vai ser publicado.
function renderDestinos() {
  const porRede = (p) => sch.contas.filter((c) => c.plataforma === p);
  const atalhos = sch.contas.length > 1
    ? `<div class="dest-atalhos"><button class="link" data-dest-todas="">Todas</button> · <button class="link" data-dest-nenhuma="">Nenhuma</button>${['instagram', 'youtube', 'tiktok']
        .filter((p) => porRede(p).length)
        .map((p) => ` · <button class="link" data-dest-rede="${p}">Só ${REDE[p].nome}</button>`)
        .join('')}<span class="hint">${sch.destinos.size} de ${sch.contas.length} marcadas</span></div>`
    : '';
  $('#schDestinos').innerHTML = atalhos + (sch.contas.length
    ? sch.contas
        .map(
          (c) => `<button class="dest${sch.destinos.has(c.id) ? ' on' : ''}" data-dest="${esc(c.id)}">
            <span class="net net-${c.plataforma === 'instagram' ? 'ig' : c.plataforma === 'youtube' ? 'yt' : 'tt'}">${REDE[c.plataforma].sigla}</span>${esc(contaNome(c))}</button>`
        )
        .join('')
    : '<p class="hint">Conecte uma conta na seção Contas, acima.</p>');
  const redes = new Set([...sch.destinos].map((id) => (contaPorId(id) || {}).plataforma));
  $('#optIg').classList.toggle('hidden', sch.contas.length > 0 && !redes.has('instagram'));
  $('#optYt').classList.toggle('hidden', !redes.has('youtube'));
  $('#optTt').classList.toggle('hidden', !redes.has('tiktok'));
}

async function loadNuvem() {
  if (!sch.cfg) return renderNuvem();
  try {
    sch.nuvem = (await cloud('GET', '/api/posts')).posts || [];
  } catch (err) {
    toast('Não consegui ler a agenda da nuvem: ' + err.message, 'err');
  }
  renderNuvem();
}

// ------------------------------------------------------------ lote
function addItems(list) {
  let n = 0;
  for (const it of list) {
    if (sch.lote.some((x) => x.path === it.path)) continue;
    const kind = IMG_EXT.test(it.path) ? 'image' : 'video';
    sch.lote.push({
      uid: 'u' + uidSeq++,
      path: it.path,
      nome: basename(it.path),
      kind,
      tipo: kind === 'image' && sch.tipo === 'reels' ? 'foto' : sch.tipo,
      legendaVideo: it.legenda || '',
      capa: it.capa || null,
      thumb: it.thumb || null,
      quando: null,
      legenda: '',
      titulo: it.titulo || '',
      contas: [...sch.destinos],
      shareToFeed: $('#schFeed').checked
    });
    n++;
  }
  if (n) {
    montarAgenda(true);
    toast(`${n} item(ns) no lote`, 'ok');
  } else toast('Nada novo para adicionar', 'warn');
}

function slots(count) {
  const times = parseTimes($('#schTimes').value);
  const days = new Set($$('#schDays button.on').map((b) => +b.dataset.d));
  if (!times.length || !days.size) return null;
  const [y, m, d] = ($('#schStart').value || '').split('-').map(Number);
  const start = y ? new Date(y, m - 1, d) : new Date();
  start.setHours(0, 0, 0, 0);
  const minMs = Date.now() + 2 * 60 * 1000; // pelo menos 2 min no futuro
  const out = [];
  for (let day = 0; out.length < count && day < 800; day++) {
    const base = new Date(start);
    base.setDate(start.getDate() + day);
    if (!days.has(base.getDay())) continue;
    for (const t of times) {
      const ms = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(t / 60), t % 60).getTime();
      if (ms >= minMs) out.push(ms);
      if (out.length >= count) break;
    }
  }
  return out;
}

function legendaPara(it, i) {
  let base = '';
  if (sch.legMode === 'video') base = it.legendaVideo;
  else if (sch.legMode === 'nova') base = $('#schLegNova').value;
  else base = ($('#schLegLinhas').value.split('\n')[i] || '').replace(/\s*\|\s*/g, '\n');
  base = String(base || '').trim();
  const tags = normTags($('#schTags').value);
  return [base, tags].filter(Boolean).join('\n\n');
}

// Recalcula horário e legenda de todo o lote (edições manuais na lista são refeitas).
function montarAgenda(silencioso) {
  const s = slots(sch.lote.length);
  if (!s) {
    if (!silencioso) toast('Escolha pelo menos um horário e um dia da semana', 'warn');
    return;
  }
  sch.lote.forEach((it, i) => {
    it.quando = s[i];
    it.legenda = legendaPara(it, i);
    it.shareToFeed = $('#schFeed').checked;
    if (sch.destinos.size) it.contas = [...sch.destinos];
  });
  if (!silencioso) toast('Agenda montada. Confira a lista e envie para a nuvem.', 'ok');
  renderLote();
}

function validar(it) {
  const probs = [];
  const ig = temRede(it, 'instagram'), yt = temRede(it, 'youtube'), tk = temRede(it, 'tiktok');
  if (!it.contas.length) probs.push('escolha pelo menos uma conta');
  else if (!contasValidas(it).length) probs.push('foto só pode ir para o Instagram');
  if (ig && it.tipo !== 'story' && it.legenda.length > 2200) probs.push('legenda passa de 2.200 caracteres');
  if (tk && it.legenda.length > 2200) probs.push('legenda do TikTok passa de 2.200 caracteres');
  if (yt && it.kind === 'video' && it.legenda.length > 5000) probs.push('descrição do YouTube passa de 5.000 caracteres');
  if (ig && it.tipo !== 'story' && countTags(it.legenda) > 30) probs.push('mais de 30 hashtags');
  if (ig && it.kind === 'image' && it.tipo === 'reels') probs.push('foto não pode ser Reels');
  if (ig && it.kind === 'video' && it.tipo === 'foto') probs.push('vídeo no feed deve ser Reels');
  if (!it.quando) probs.push('sem horário');
  else if (it.quando < Date.now() + 60000) probs.push('horário já passou');
  return probs;
}

function itemLoteHTML(it, i) {
  const probs = validar(it);
  const ig = temRede(it, 'instagram'), yt = temRede(it, 'youtube') && it.kind === 'video';
  const isStory = ig && it.tipo === 'story' && it.contas.length === 1;
  const opts = ['reels', 'story', 'foto']
    .filter((t) => (it.kind === 'image' ? t !== 'reels' : t !== 'foto'))
    .map((t) => `<option value="${t}" ${t === it.tipo ? 'selected' : ''}>${TIPO_NOME[t]}</option>`)
    .join('');
  const chips = sch.contas
    .map((c) => {
      const on = it.contas.includes(c.id);
      const off = it.kind === 'image' && c.plataforma !== 'instagram';
      return `<button class="dest xs${on ? ' on' : ''}${off ? ' off' : ''}" data-f="conta" data-conta="${esc(c.id)}" title="${off ? 'Foto só vai para o Instagram' : ''}">
        <span class="net net-${c.plataforma === 'instagram' ? 'ig' : c.plataforma === 'youtube' ? 'yt' : 'tt'}">${REDE[c.plataforma].sigla}</span>${esc(contaNome(c))}</button>`;
    })
    .join('');
  return `<div class="item${probs.length ? ' err' : ''}" data-uid="${it.uid}">
    <div class="num">${String(i + 1).padStart(2, '0')}</div>
    <div class="th">${it.thumb ? `<img src="${it.thumb}" alt="">` : it.kind === 'image' ? '🖼' : '🎬'}</div>
    <div class="body">
      <div class="top">
        <span class="nm" title="${esc(it.path)}">${esc(it.nome)}</span>
        ${ig ? `<select data-f="tipo" title="Tipo no Instagram">${opts}</select>` : ''}
        <input type="datetime-local" data-f="quando" value="${it.quando ? toLocalInput(it.quando) : ''}">
        <button class="btn ghost xs" data-f="up" title="Subir">↑</button>
        <button class="btn ghost xs" data-f="down" title="Descer">↓</button>
        <button class="btn ghost xs danger" data-f="rm" title="Tirar do lote">✕</button>
      </div>
      ${chips ? `<div class="dests">${chips}</div>` : ''}
      ${yt ? `<input type="text" data-f="titulo" maxlength="100" placeholder="Título no YouTube (vazio = 1ª linha da legenda)" value="${esc(it.titulo)}">` : ''}
      ${
        isStory
          ? '<div class="hint">Story não tem legenda na API do Instagram: se quiser texto, coloque no próprio vídeo (aba Texto).</div>'
          : `<textarea data-f="legenda" rows="3" placeholder="Legenda do post">${esc(it.legenda)}</textarea>`
      }
      <div class="meta">
        ${isStory ? '' : `<span>${it.legenda.length} caracteres</span><span>${countTags(it.legenda)} #</span>`}
        ${ig && it.capa && it.tipo === 'reels' && $('#schCapa').checked ? '<span>✓ capa JPG</span>' : ''}
        ${probs.length ? `<span class="bad">⚠ ${esc(probs.join(' · '))}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function renderLote() {
  $('#loteList').innerHTML = sch.lote.map(itemLoteHTML).join('');
  $('#loteEmpty').classList.toggle('hidden', sch.lote.length > 0);
  $('#loteList').classList.toggle('hidden', !sch.lote.length);
  $('#loteFoot').classList.toggle('hidden', !sch.lote.length);
  $('#nLote').textContent = sch.lote.length;
  const bad = sch.lote.filter((it) => validar(it).length).length;
  const ts = sch.lote.map((it) => it.quando).filter(Boolean).sort((a, b) => a - b);
  $('#loteInfo').textContent = sch.lote.length
    ? `${sch.lote.length} post(s)${ts.length ? ` · de ${fmtQuando(ts[0])} até ${fmtQuando(ts[ts.length - 1])}` : ''}${bad ? ` · ${bad} com aviso` : ''}`
    : '';
  renderRate();
  renderConn();
}

function renderRate() {
  const times = parseTimes($('#schTimes').value);
  const days = $$('#schDays button.on').length;
  const redes = new Set([...sch.destinos].map((id) => (contaPorId(id) || {}).plataforma));
  const lim = [];
  if (redes.has('instagram')) lim.push('Instagram até 100 por conta');
  if (redes.has('youtube')) lim.push('YouTube cerca de 6 envios no total (cota grátis do Google)');
  if (redes.has('tiktok')) lim.push('TikTok uns 15 por conta');
  $('#schRate').textContent = times.length
    ? `${times.length} post(s) por dia em ${days} dia(s) da semana.${lim.length ? ' Limite por dia: ' + lim.join(' · ') + '.' : ''}`
    : 'Digite os horários assim: 09:00, 12:30, 18:00';
}

// ------------------------------------------------------------ nuvem: lista
function itemNuvemHTML(p) {
  const c = contaPorId(p.conta_id);
  const rede = (c && c.plataforma) || p.plataforma || 'instagram';
  const acts = [];
  if (p.status === 'agendado' || p.status === 'erro') acts.push('<button class="btn ghost xs danger" data-a="del">Cancelar</button>');
  if (p.status === 'erro') acts.push('<button class="btn ghost xs" data-a="retry">Tentar de novo</button>');
  if (p.permalink) acts.push(`<button class="btn ghost xs" data-a="open">${REDE[rede].abrir}</button>`);
  if (p.status === 'publicado') acts.push('<button class="btn ghost xs" data-a="del">Tirar da lista</button>');
  const quem = c ? contaNome(c) : 'conta removida';
  return `<div class="item" data-id="${esc(p.id)}">
    <div class="num">${new Date(p.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    <div class="th">${p.media_kind === 'image' ? '🖼' : '🎬'}</div>
    <div class="body">
      <div class="top">
        <span class="chip conta-chip"><span class="net net-${rede === 'instagram' ? 'ig' : rede === 'youtube' ? 'yt' : 'tt'}">${REDE[rede].sigla}</span>${esc(quem)}</span>
        <span class="chip tipo">${TIPO_NOME[p.tipo] || p.tipo}</span>
        <span class="chip ${p.status}">${p.status}</span>
        <span class="nm">${esc(p.titulo || p.nome || '')}</span>
        ${acts.join('')}
      </div>
      ${p.tipo !== 'story' && p.legenda ? `<div class="leg-prev">${esc(p.legenda)}</div>` : ''}
      ${p.aviso ? `<div class="warn-msg">${esc(p.aviso)}</div>` : ''}
      ${p.erro ? `<div class="err-msg">${esc(p.erro)}</div>` : ''}
    </div>
  </div>`;
}

function renderNuvem() {
  const todos = [...sch.nuvem].sort((a, b) => a.quando - b.quando);
  const list = sch.nuvemConta ? todos.filter((p) => p.conta_id === sch.nuvemConta) : todos;
  $('#nNuvem').textContent = todos.filter((p) => p.status !== 'publicado').length;
  if (!list.length) {
    $('#nuvemList').innerHTML = `<div class="empty small"><div class="empty-ico">☁</div><h2>Nada na nuvem</h2><p>${
      sch.cfg ? (sch.nuvemConta ? 'Nenhum post desta conta.' : 'Envie um lote para ver a agenda aqui.') : 'Configure a nuvem na coluna da esquerda.'
    }</p></div>`;
    return;
  }
  let html = '', dia = '';
  for (const p of list) {
    const d = fmtDia(p.quando);
    if (d !== dia) {
      dia = d;
      html += `<div class="day-h">${esc(d)}</div>`;
    }
    html += itemNuvemHTML(p);
  }
  $('#nuvemList').innerHTML = html;
}

// ------------------------------------------------------------ envio
async function enviar() {
  if (sch.sending || !sch.lote.length) return;
  const bad = sch.lote.filter((it) => validar(it).length);
  if (bad.length) return toast(`Resolva os avisos em ${bad.length} item(ns) antes de enviar`, 'warn', 5000);
  sch.sending = true;
  const btn = $('#loteSend');
  btn.disabled = true;
  const usarCapa = $('#schCapa').checked;
  const ytPriv = $('#schYtPriv').value, ttPriv = $('#schTtPriv').value;
  const items = sch.lote.map((it) => ({
    uid: it.uid,
    path: it.path,
    nome: it.nome,
    mediaKind: it.kind,
    capa: usarCapa && it.tipo === 'reels' ? it.capa : null,
    legenda: it.legenda,
    quando: it.quando,
    shareToFeed: it.shareToFeed,
    // um destino por conta marcada (o arquivo sobe uma vez só)
    destinos: contasValidas(it).map((id) => {
      const c = contaPorId(id);
      if (c.plataforma === 'instagram') return { contaId: id, plataforma: 'instagram', tipo: it.tipo, legenda: it.tipo === 'story' ? '' : it.legenda };
      if (c.plataforma === 'youtube') return { contaId: id, plataforma: 'youtube', tipo: 'short', privacidade: ytPriv, titulo: it.titulo.trim() || null };
      return { contaId: id, plataforma: 'tiktok', tipo: 'video', privacidade: ttPriv };
    })
  }));
  try {
    const res = await api.cloudSend(sch.cfg, items);
    const okIds = new Set(res.filter((r) => r.ok).map((r) => r.uid));
    const falhas = res.filter((r) => !r.ok);
    sch.lote = sch.lote.filter((it) => !okIds.has(it.uid));
    if (falhas.length) toast(`${okIds.size} agendado(s). ${falhas.length} falharam: ${falhas[0].error}`, 'err', 8000);
    else toast(`${okIds.size} arquivo(s) agendados na nuvem (${items.filter((x) => okIds.has(x.uid)).reduce((s, x) => s + x.destinos.length, 0)} posts). Pode desligar o PC.`, 'ok', 6000);
    renderLote();
    await Promise.all([loadNuvem(), refreshStatus()]);
    if (!sch.lote.length) switchSchTab('nuvem');
  } catch (err) {
    toast('Falha no envio: ' + err.message, 'err', 6000);
  } finally {
    sch.sending = false;
    btn.textContent = '☁ Enviar para a nuvem';
    renderConn();
  }
}

// ------------------------------------------------------------ navegação
function switchSchTab(t) {
  sch.tab = t;
  $$('#schTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  $('#paneLote').classList.toggle('hidden', t !== 'lote');
  $('#paneNuvem').classList.toggle('hidden', t !== 'nuvem');
  if (t === 'nuvem') loadNuvem();
}

function switchView(v) {
  $$('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  $('.app').classList.toggle('mode-agenda', v === 'agenda');
  $('.app').classList.toggle('mode-cortes', v === 'cortes');
  if (v === 'cortes' && window.Cortes) window.Cortes.aoAbrir();
  clearInterval(sch.timer);
  if (v === 'agenda') {
    refreshStatus();
    if (sch.tab === 'nuvem') loadNuvem();
    sch.timer = setInterval(() => {
      refreshStatus();
      if (sch.tab === 'nuvem') loadNuvem();
    }, 30000);
  }
}

// ------------------------------------------------------------ eventos
function bindAgendador() {
  $('#views').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) switchView(b.dataset.view);
  };
  $('#schTabs').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) switchSchTab(b.dataset.t);
  };

  // conexão
  $('#btnCloudCfg').onclick = () => {
    $('#cloudBox').classList.toggle('hidden');
    $('#cloudUrl').value = sch.cfg ? sch.cfg.url : '';
    $('#cloudKey').value = sch.cfg ? sch.cfg.apiKey : '';
  };
  $('#cloudRead').onclick = async () => {
    const c = await api.cloudConfig();
    if (!c) return toast('Não achei a configuração. Rode o instalar-nuvem.bat primeiro.', 'warn', 5000);
    $('#cloudUrl').value = c.url;
    $('#cloudKey').value = c.apiKey;
  };
  $('#cloudSave').onclick = async () => {
    const url = $('#cloudUrl').value.trim().replace(/\/+$/, '');
    const apiKey = $('#cloudKey').value.trim();
    if (!/^https:\/\//.test(url) || !apiKey) return toast('Preencha o endereço (https://…) e a chave', 'warn');
    sch.cfg = { url, apiKey };
    saveCfg(sch.cfg);
    await refreshStatus();
    if (sch.status && sch.status.ok) {
      $('#cloudBox').classList.add('hidden');
      toast('Nuvem conectada', 'ok');
    } else toast('A nuvem não respondeu. Confira o endereço e a chave.', 'err');
  };
  const abrirBox = (id) => ['igBox', 'ytBox', 'ttBox'].forEach((b) => $('#' + b).classList.toggle('hidden', b !== id || !$('#' + b).classList.contains('hidden')));
  $$('[data-fechar]').forEach((b) => (b.onclick = () => $('#' + b.dataset.fechar).classList.add('hidden')));
  $$('[data-copiar]').forEach(
    (b) =>
      (b.onclick = async (e) => {
        e.preventDefault();
        await navigator.clipboard.writeText($('#' + b.dataset.copiar).value);
        toast('Endereço copiado', 'ok');
      })
  );
  // começa a conexão do YouTube/TikTok: a nuvem devolve o link de login e o app abre no navegador
  async function conectarOauth(plataforma) {
    try {
      const r = await cloud('POST', '/api/oauth/iniciar', { plataforma });
      await api.openExternal(r.url);
      toast(`Entre na conta do ${REDE[plataforma].nome} no navegador e autorize. Ela aparece aqui sozinha.`, 'info', 8000);
      let n = 0;
      const antes = sch.contas.length;
      const t = setInterval(async () => {
        await refreshStatus();
        if (sch.contas.length > antes || ++n > 40) clearInterval(t);
        if (sch.contas.length > antes) toast('Conta conectada!', 'ok');
      }, 4000);
    } catch (err) {
      toast(err.message, 'err', 6000);
    }
  }
  $('#addContas').onclick = (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const p = b.dataset.add;
    if (p === 'instagram') return abrirBox('igBox');
    if (sch.status && sch.status.plataformas && sch.status.plataformas[p]) {
      $$('#igBox, #ytBox, #ttBox').forEach((x) => x.classList.add('hidden'));
      return conectarOauth(p);
    }
    abrirBox(p === 'youtube' ? 'ytBox' : 'ttBox');
  };
  // abre o formulário de chaves mesmo quando já existem chaves salvas (ex.: trocar Sandbox por Produção)
  $('#trocarChaves').onclick = (e) => {
    const b = e.target.closest('[data-chaves]');
    if (!b) return;
    e.preventDefault();
    abrirBox(b.dataset.chaves);
    const box = $('#' + b.dataset.chaves);
    if (!box.classList.contains('hidden')) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  $('#igSave').onclick = async () => {
    const token = $('#igToken').value.trim();
    if (!token) return toast('Cole o token de acesso', 'warn');
    try {
      const r = await cloud('POST', '/api/contas/instagram', { token });
      $('#igToken').value = '';
      $('#igBox').classList.add('hidden');
      sch.destinos.add(r.id);
      salvarDestinos();
      toast(`Conta @${r.conta} conectada!`, 'ok');
      refreshStatus();
    } catch (err) {
      toast('Não conectou: ' + err.message, 'err', 6000);
    }
  };
  const salvarChaves = async (plat, idEl, secEl, box) => {
    const id = $(idEl).value.trim(), secret = $(secEl).value.trim();
    if (!id || !secret) return toast('Preencha as duas chaves', 'warn');
    try {
      await cloud('POST', '/api/plataformas', plat === 'youtube' ? { youtube: { clientId: id, clientSecret: secret } } : { tiktok: { clientKey: id, clientSecret: secret } });
      $(secEl).value = '';
      $(box).classList.add('hidden');
      await refreshStatus();
      conectarOauth(plat);
    } catch (err) {
      toast(err.message, 'err', 6000);
    }
  };
  $('#ytSave').onclick = () => salvarChaves('youtube', '#ytId', '#ytSecret', '#ytBox');
  $('#ttSave').onclick = () => salvarChaves('tiktok', '#ttId', '#ttSecret', '#ttBox');
  $('#contasList').onclick = async (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    const c = contaPorId(b.dataset.rm);
    if (!c || !confirm(`Desconectar ${contaNome(c)} (${REDE[c.plataforma].nome})? Os posts agendados dela não vão sair.`)) return;
    try {
      await cloud('DELETE', '/api/contas/' + encodeURIComponent(c.id));
      sch.destinos.delete(c.id);
      salvarDestinos();
      await refreshStatus();
      loadNuvem();
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  $('#schDestinos').onclick = (e) => {
    const at = e.target.closest('[data-dest-todas], [data-dest-nenhuma], [data-dest-rede]');
    const b = e.target.closest('[data-dest]');
    if (at) {
      sch.destinos.clear();
      if (at.hasAttribute('data-dest-todas')) sch.contas.forEach((c) => sch.destinos.add(c.id));
      if (at.dataset.destRede) sch.contas.filter((c) => c.plataforma === at.dataset.destRede).forEach((c) => sch.destinos.add(c.id));
    } else if (b) {
      const id = b.dataset.dest;
      if (sch.destinos.has(id)) sch.destinos.delete(id);
      else sch.destinos.add(id);
    } else return;
    salvarDestinos();
    for (const it of sch.lote) it.contas = [...sch.destinos];
    renderDestinos();
    renderLote();
  };
  $('#contasBusca').oninput = (e) => {
    sch.buscaConta = e.target.value;
    renderConn();
  };
  $('#nuvemConta').onchange = () => {
    sch.nuvemConta = $('#nuvemConta').value;
    renderNuvem();
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-ext]');
    if (!a) return;
    e.preventDefault();
    api.openExternal(a.dataset.ext);
  });

  // montar lote
  $('#addFromTable').onclick = () => {
    const prontos = state.videos.filter((v) => v.status === 'pronto' && v.out);
    if (!prontos.length) return toast('Nenhum vídeo pronto na mesa. Processe os vídeos no Editor primeiro.', 'warn', 5000);
    // cortes virais: a descrição escrita pela IA (com hashtags) vira a legenda do post e o título vai pro YouTube
    addItems(prontos.map((v) => ({ path: v.out, legenda: v.postTexto || (v.corte && v.corte.descricao) || v.legenda, titulo: v.corte ? String(v.corte.titulo || '').slice(0, 100) : '', capa: v.capaOut, thumb: v.thumb })));
  };
  $('#addFiles').onclick = async () => {
    const files = await api.pickMedia();
    if (files.length) addItems(files.map((p) => ({ path: p })));
  };
  $('#schTipo').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    sch.tipo = b.dataset.v;
    $$('#schTipo button').forEach((x) => x.classList.toggle('on', x === b));
    for (const it of sch.lote) it.tipo = it.kind === 'image' && sch.tipo === 'reels' ? 'foto' : it.kind === 'video' && sch.tipo === 'foto' ? 'reels' : sch.tipo;
    renderLote();
  };
  $('#schDays').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    b.classList.toggle('on');
    renderRate();
  };
  $('#schLegMode').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    sch.legMode = b.dataset.v;
    $$('#schLegMode button').forEach((x) => x.classList.toggle('on', x === b));
    $('#schLegNova').classList.toggle('hidden', sch.legMode !== 'nova');
    $('#schLegLinhas').classList.toggle('hidden', sch.legMode !== 'linhas');
    $('#schLegHint').textContent = {
      video: 'Usa a legenda escrita na aba Texto de cada vídeo.',
      nova: 'A mesma legenda em todos os posts do lote.',
      linhas: 'Uma legenda por linha, na ordem do lote. Use | para quebrar linha.'
    }[sch.legMode];
  };
  $('#schTimes').oninput = renderRate;
  $('#schGen').onclick = () => {
    if (!sch.lote.length) return toast('Adicione vídeos ou fotos ao lote primeiro', 'warn');
    montarAgenda(false);
  };
  $('#schCapa').onchange = renderLote;

  // edição na lista
  $('#loteList').addEventListener('input', (e) => {
    const el = e.target.closest('[data-f]');
    const it = sch.lote.find((x) => x.uid === e.target.closest('.item').dataset.uid);
    if (!el || !it) return;
    if (el.dataset.f === 'titulo') it.titulo = el.value;
    if (el.dataset.f === 'legenda') {
      it.legenda = el.value;
      const meta = el.closest('.body').querySelector('.meta');
      const probs = validar(it);
      meta.innerHTML = `<span>${it.legenda.length} caracteres</span><span>${countTags(it.legenda)} #</span>${
        probs.length ? `<span class="bad">⚠ ${esc(probs.join(' · '))}</span>` : ''
      }`;
      el.closest('.item').classList.toggle('err', probs.length > 0);
    }
  });
  $('#loteList').addEventListener('change', (e) => {
    const el = e.target.closest('[data-f]');
    const it = el && sch.lote.find((x) => x.uid === el.closest('.item').dataset.uid);
    if (!it) return;
    if (el.dataset.f === 'tipo') it.tipo = el.value;
    if (el.dataset.f === 'quando') it.quando = el.value ? new Date(el.value).getTime() : null;
    renderLote();
  });
  $('#loteList').addEventListener('click', (e) => {
    const el = e.target.closest('button[data-f]');
    if (!el) return;
    const i = sch.lote.findIndex((x) => x.uid === el.closest('.item').dataset.uid);
    if (i < 0) return;
    const f = el.dataset.f;
    if (f === 'conta') {
      const it = sch.lote[i], id = el.dataset.conta;
      it.contas = it.contas.includes(id) ? it.contas.filter((x) => x !== id) : [...it.contas, id];
    }
    if (f === 'rm') sch.lote.splice(i, 1);
    if ((f === 'up' && i > 0) || (f === 'down' && i < sch.lote.length - 1)) {
      const j = f === 'up' ? i - 1 : i + 1;
      // troca a ordem mas mantém os horários nas posições
      [sch.lote[i], sch.lote[j]] = [sch.lote[j], sch.lote[i]];
      [sch.lote[i].quando, sch.lote[j].quando] = [sch.lote[j].quando, sch.lote[i].quando];
    }
    renderLote();
  });
  $('#loteClear').onclick = () => {
    if (!confirm('Tirar todos os itens do lote? (os arquivos não são apagados)')) return;
    sch.lote = [];
    renderLote();
  };
  $('#loteSend').onclick = enviar;
  api.onCloudProgress(({ i, n, nome }) => {
    $('#loteSend').textContent = i < n ? `Enviando ${i + 1}/${n}…` : 'Registrando…';
    $('#loteInfo').textContent = i < n ? `Enviando ${nome}` : 'Registrando agenda na nuvem…';
  });

  // nuvem
  $('#schRefresh').onclick = () => {
    refreshStatus();
    loadNuvem();
  };
  $('#schRunNow').onclick = async () => {
    try {
      const r = await cloud('POST', '/api/rodar');
      toast(r.pulado ? `Fila não rodou: ${r.pulado}` : `Fila rodou: ${r.iniciados} iniciado(s), ${r.processando} em processamento`, 'info');
      setTimeout(loadNuvem, 800);
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  $('#nuvemList').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    const p = sch.nuvem.find((x) => x.id === b.closest('.item').dataset.id);
    if (!p) return;
    try {
      if (b.dataset.a === 'open') return api.openExternal(p.permalink);
      if (b.dataset.a === 'del') {
        if (p.status !== 'publicado' && !confirm('Cancelar este post agendado?')) return;
        await cloud('DELETE', '/api/posts/' + encodeURIComponent(p.id));
      }
      if (b.dataset.a === 'retry') await cloud('PATCH', '/api/posts/' + encodeURIComponent(p.id), { tentarDeNovo: true });
      await Promise.all([loadNuvem(), refreshStatus()]);
    } catch (err) {
      toast(err.message, 'err');
    }
  });
}

async function initAgendador() {
  const hoje = new Date();
  $('#schStart').value = `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}-${pad2(hoje.getDate())}`;
  sch.cfg = loadCfg();
  if (!sch.cfg) {
    const c = await api.cloudConfig().catch(() => null);
    if (c && c.url && c.apiKey) {
      sch.cfg = c;
      saveCfg(c);
    }
  }
  bindAgendador();
  renderLote();
  renderNuvem();
  renderConn();
}
initAgendador();
