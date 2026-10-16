'use strict';
/* global $, $$, esc, toast, state, api, importPaths, fileUrl, S, erroIpc, switchView, openVideo, renderAll */
// Tela "Cortes Virais": escolhe um vídeo longo, gera N cortes com IA e manda para a mesa.
(function () {
  const ct = { arquivo: null, info: null, rodando: false, res: null, naMesa: new Set(), extrasSel: new Set(), inicio: 0, recebidos: [] };
  const CHAVE = 'eem.cortes';
  const ETAPAS = ['preparar', 'audio', 'transcrever', 'ia', 'cortar'];
  const DICAS = {
    ollama: 'Roda no seu PC: grátis, sem limite e sem mandar nada para fora. Instale em <b>ollama.com</b>, deixe aberto e baixe um modelo (para RTX 3090: <b>qwen2.5:14b</b>). Em vídeo de 10 h a IA leva uns 30–40 min.',
    gemini: 'Rápido e com cota grátis. Crie a chave em <b>aistudio.google.com</b> → “Get API key” e cole aqui.',
    openai: 'OpenAI ou qualquer serviço compatível (Groq, OpenRouter, LM Studio): troque o endereço e o modelo.',
    claude: 'Chave da API da Anthropic (<b>console.anthropic.com</b>).',
    nenhum: 'Sem IA: escolhe pelos ganchos na fala, ritmo e volume. Serve para testar; com IA os cortes ficam bem melhores.'
  };
  const URL_PADRAO = { ollama: 'http://127.0.0.1:11434', openai: 'https://api.openai.com/v1' };
  const MODELO_PADRAO = { ollama: 'qwen2.5:14b', gemini: 'gemini-2.5-flash', openai: 'gpt-4.1-mini', claude: 'claude-haiku-5-5' };

  const hms = (t) => {
    t = Math.max(0, Math.round(t || 0));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  };

  // ------------------------------------------------------------ configurações guardadas
  let cfg = {};
  function carregar() {
    try {
      cfg = JSON.parse(localStorage.getItem(CHAVE)) || {};
    } catch (_) {
      cfg = {};
    }
    cfg.ia = cfg.ia || { provedor: 'ollama' };
    const set = (id, v) => v !== undefined && v !== null && ($(id).value = v);
    set('#ctQtd', cfg.qtd);
    set('#ctMin', cfg.min);
    set('#ctMax', cfg.max);
    set('#ctTipo', cfg.tipo);
    set('#ctIdioma', cfg.idioma);
    set('#ctModelo', cfg.modelo);
    set('#ctPlaca', cfg.placa);
    set('#ctInstr', cfg.instr);
    for (const id of ['ctLegenda', 'ctEmojis', 'ctTitulo', 'ctMesa']) if (cfg[id] !== undefined) $('#' + id).checked = !!cfg[id];
    if (cfg.formato) $$('#ctFormato button').forEach((b) => b.classList.toggle('on', b.dataset.v === cfg.formato));
    $('#ctIa').value = cfg.ia.provedor || 'ollama';
    preencherIa();
    marcarAtalhos();
  }
  function salvar() {
    const p = $('#ctIa').value;
    cfg.ia = cfg.ia || {};
    cfg.ia.provedor = p;
    cfg.ia[p] = { url: $('#ctIaUrl').value.trim(), chave: $('#ctIaChave').value.trim(), modelo: $('#ctIaModelo').value.trim() };
    Object.assign(cfg, {
      qtd: $('#ctQtd').value, min: $('#ctMin').value, max: $('#ctMax').value, tipo: $('#ctTipo').value, idioma: $('#ctIdioma').value,
      modelo: $('#ctModelo').value, placa: $('#ctPlaca').value, instr: $('#ctInstr').value, formato: formato(),
      ctLegenda: $('#ctLegenda').checked, ctEmojis: $('#ctEmojis').checked, ctTitulo: $('#ctTitulo').checked, ctMesa: $('#ctMesa').checked
    });
    try {
      localStorage.setItem(CHAVE, JSON.stringify(cfg));
      localStorage.setItem('eem.placa', $('#ctPlaca').value);
    } catch (_) {}
  }
  const formato = () => ($('#ctFormato button.on') || { dataset: { v: 'cheio' } }).dataset.v;

  function preencherIa() {
    const p = $('#ctIa').value;
    const c = (cfg.ia && cfg.ia[p]) || {};
    $('#ctIaUrl').value = c.url || '';
    $('#ctIaUrl').placeholder = URL_PADRAO[p] || '';
    $('#ctIaChave').value = c.chave || '';
    $('#ctIaModelo').value = c.modelo || '';
    $('#ctIaModelo').placeholder = MODELO_PADRAO[p] || '';
    $('#ctIaUrlRotulo').textContent = p === 'ollama' ? 'Endereço do Ollama' : 'Endereço da API';
    $$('#cortesView [data-ia]').forEach((el) => el.classList.toggle('hidden', !el.dataset.ia.split(' ').includes(p)));
    $('#ctIaTestar').classList.toggle('hidden', p === 'nenhum');
    $('#ctIaDica').innerHTML = DICAS[p] || '';
    $('#ctIaStatus').textContent = '';
    $('#ctIaStatus').className = 'ct-ia-status';
    if (p !== 'ollama') $('#ctIaModelos').innerHTML = '';
  }
  function iaAtual() {
    const p = $('#ctIa').value;
    return { provedor: p, url: $('#ctIaUrl').value.trim() || URL_PADRAO[p] || '', chave: $('#ctIaChave').value.trim(), modelo: $('#ctIaModelo').value.trim() || MODELO_PADRAO[p] || '' };
  }
  function statusIa(msg, ok) {
    const el = $('#ctIaStatus');
    el.textContent = msg;
    el.className = 'ct-ia-status ' + (ok === true ? 'ok' : ok === false ? 'err' : '');
  }
  async function testarIa(quieto) {
    const ia = iaAtual();
    if (!quieto) statusIa('Testando…');
    const r = await api.cortesIaTestar(ia);
    if (r.modelos) $('#ctIaModelos').innerHTML = r.modelos.map((m) => `<option value="${esc(m)}">`).join('');
    if (r.modelos && r.modelos.length && ia.provedor === 'ollama' && !$('#ctIaModelo').value.trim()) {
      const pref = r.modelos.find((m) => /qwen2\.5:14b|qwen3:14b|gemma3:12b|qwen2\.5|llama3/.test(m));
      if (pref && !r.ok) {
        $('#ctIaModelo').value = pref;
        return testarIa(quieto);
      }
    }
    if (!quieto || !r.ok) statusIa(r.msg, r.ok);
    return r.ok;
  }

  function marcarAtalhos() {
    const q = $('#ctQtd').value, mi = $('#ctMin').value, ma = $('#ctMax').value;
    $$('#ctQtdSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === q));
    $$('#ctDurSeg button').forEach((b) => b.classList.toggle('on', b.dataset.min === mi && b.dataset.max === ma));
  }

  // ------------------------------------------------------------ vídeo escolhido
  async function definirArquivo(p) {
    if (!p) return;
    if (ct.rodando) return toast('Espere terminar ou cancele antes de trocar o vídeo', 'warn');
    ct.arquivo = p;
    const box = $('#ctInfo');
    box.classList.remove('hidden');
    box.innerHTML = `<b>${esc(p.split(/[\\/]/).pop())}</b><span class="hint">Lendo o vídeo…</span>`;
    try {
      ct.info = await api.cortesInfo(p, $('#ctIdioma').value, $('#ctModelo').value);
    } catch (err) {
      ct.info = null;
      box.innerHTML = `<b>${esc(p.split(/[\\/]/).pop())}</b><span class="err">Não consegui ler este vídeo.</span>`;
      return;
    }
    renderInfo();
  }
  function renderInfo() {
    const i = ct.info;
    if (!i || !ct.arquivo) return;
    const nome = ct.arquivo.split(/[\\/]/).pop();
    const gpu = $('#ctPlaca').value !== 'cpu';
    const fator = $('#ctModelo').value === 'small' ? (gpu ? 90 : 8) : gpu ? 40 : 3;
    const est = i.duracao / fator;
    let extra = '';
    if (!i.temAudio) extra = '<span class="err">Este vídeo não tem áudio: não dá para achar os momentos.</span>';
    else if (i.duracao > 10.5 * 3600) extra = '<span class="warn">Passa de 10 horas: pode demorar bastante.</span>';
    else if (i.transcrito) extra = '<span class="ok">✓ Já transcrito antes: vai direto para a IA.</span>';
    else extra = `<span class="hint">Transcrição estimada: ~${est > 90 ? Math.round(est / 60) + ' min' : Math.max(10, Math.round(est)) + ' s'}${gpu ? ' na placa NVIDIA' : ' na CPU'}${!i.whisper || !i.modeloOk ? ' + download do Whisper na 1ª vez' : ''}.</span>`;
    $('#ctInfo').innerHTML = `<b title="${esc(ct.arquivo)}">${esc(nome)}</b><span>⏱ ${hms(i.duracao)} · ${i.largura}×${i.altura}</span>${extra}`;
  }

  // Vídeos que chegaram pelo link do YouTube (extensão Minerador Viral → aba Link).
  function renderRecebidos() {
    const box = $('#ctRecebidos');
    box.classList.toggle('hidden', !ct.recebidos.length);
    box.innerHTML = `<div class="eyebrow">Baixados pelo link</div>` + ct.recebidos
      .map((p, i) => `<button class="ct-rec${p === ct.arquivo ? ' on' : ''}" data-r="${i}" title="${esc(p)}">▶ ${esc(p.split(/[\\/]/).pop())}</button>`)
      .join('');
  }
  function receberLink(arquivos) {
    for (const p of arquivos) if (!ct.recebidos.includes(p)) ct.recebidos.unshift(p);
    ct.recebidos = ct.recebidos.slice(0, 8);
    switchView('cortes');
    if (!ct.rodando) definirArquivo(arquivos[0]).then(renderRecebidos);
    renderRecebidos();
    toast(ct.rodando ? 'Vídeo do YouTube baixado. Ele está na lista “Baixados pelo link” para cortar depois.' : 'Vídeo do YouTube baixado e escolhido. Confira os ajustes e clique em Gerar cortes.', 'ok', 7000);
  }

  // ------------------------------------------------------------ gerar
  async function gerar() {
    if (ct.rodando) return;
    if (!ct.arquivo || !ct.info) return toast('Escolha o vídeo longo primeiro', 'warn');
    if (!ct.info.temAudio) return toast('Este vídeo não tem áudio', 'err');
    const qtd = Math.round(Number($('#ctQtd').value));
    let min = Number($('#ctMin').value), max = Number($('#ctMax').value);
    if (!(qtd >= 1 && qtd <= 100)) return toast('Quantidade de cortes: de 1 a 100', 'warn');
    if (!(min >= 5) || !(max >= min + 5)) return toast('A duração máxima precisa ser pelo menos 5 s maior que a mínima', 'warn');
    if (qtd * min > ct.info.duracao * 0.95) return toast(`O vídeo tem ${hms(ct.info.duracao)}: não cabem ${qtd} cortes de ${min}s ou mais. Diminua a quantidade ou a duração.`, 'warn', 7000);
    const ia = iaAtual();
    if (['gemini', 'openai', 'claude'].includes(ia.provedor) && !ia.chave) return toast('Cole a chave da API (ou escolha Ollama / Sem IA)', 'warn');
    salvar();
    if (ia.provedor === 'ollama') {
      statusIa('Conferindo o Ollama…');
      if (!(await testarIa(true))) return toast('O Ollama não está pronto: veja o aviso no quadro da IA.', 'err', 6000);
    }

    ct.rodando = true;
    ct.inicio = Date.now();
    ct.res = null;
    ct.naMesa.clear();
    ct.extrasSel.clear();
    renderResultados();
    $('#ctGerar').disabled = true;
    $('#ctGerar').textContent = '⏳ GERANDO CORTES…';
    $('#ctProg').classList.remove('hidden');
    $('#ctVazio').classList.add('hidden');
    progresso({ etapa: 'preparar', pct: 0, geral: 0, msg: 'Começando…' });
    try {
      ct.res = await api.cortesIniciar({
        arquivo: ct.arquivo,
        quantidade: qtd,
        min,
        max,
        tipo: $('#ctTipo').value,
        idioma: $('#ctIdioma').value,
        modelo: $('#ctModelo').value,
        placa: $('#ctPlaca').value,
        instrucoes: $('#ctInstr').value.trim().slice(0, 500),
        ia,
        pastaSaida: joinPath(state.outDir, 'Cortes')
      });
      ct.info.transcrito = true;
      renderInfo();
      renderResultados();
      const min2 = Math.round((Date.now() - ct.inicio) / 60000);
      if ($('#ctMesa').checked) {
        await mandarParaMesa(ct.res.cortes);
        toast(`🔥 ${ct.res.cortes.length} cortes prontos em ${min2 < 1 ? 'menos de 1 min' : min2 + ' min'} e já estão na mesa do Editor.`, 'ok', 8000);
        switchView('editor');
      } else toast(`🔥 ${ct.res.cortes.length} cortes prontos. Revise e mande para a mesa.`, 'ok', 7000);
    } catch (err) {
      const msg = erroIpc(err);
      if (msg === 'Cancelado') toast('Cortes cancelados. Se gerar de novo no mesmo vídeo, a transcrição continua de onde parou.', 'info', 6000);
      else toast('Não deu para gerar os cortes: ' + msg, 'err', 9000);
      if (!ct.res) $('#ctVazio').classList.remove('hidden');
    } finally {
      ct.rodando = false;
      $('#ctGerar').disabled = false;
      $('#ctGerar').textContent = '🔥 GERAR CORTES';
      $('#ctProg').classList.add('hidden');
    }
  }
  const joinPath = (a, b) => String(a || '').replace(/[\\/]+$/, '') + (String(a).includes('\\') ? '\\' : '/') + b;

  function progresso(d) {
    if (d.origem === 'aviso') return toast(d.msg, 'warn', 14000);
    if (d.origem === 'ollama') {
      statusIa(d.msg);
      return;
    }
    if (d.origem && d.origem !== 'cortes') return;
    const i = ETAPAS.indexOf(d.etapa);
    $$('#ctEtapas li').forEach((li, k) => {
      li.classList.toggle('ok', k < i);
      li.classList.toggle('on', k === i);
    });
    $('#ctBar').style.width = (d.geral * 100).toFixed(1) + '%';
    $('#ctPct').textContent = Math.floor(d.geral * 100) + '%';
    $('#ctMsg').textContent = d.msg || '';
  }

  // ------------------------------------------------------------ resultados
  function renderResultados() {
    const r = ct.res;
    const cortes = (r && r.cortes) || [];
    $('#ctAbrirPasta').disabled = !r;
    $('#ctMandarTodos').disabled = !cortes.length || cortes.every((c) => ct.naMesa.has(c.arquivo));
    $('#ctVazio').classList.toggle('hidden', !!r || ct.rodando);
    $('#ctLista').innerHTML = cortes
      .map((c, i) => {
        const naMesa = ct.naMesa.has(c.arquivo);
        return `<div class="ct-card" data-i="${i}">
          <div class="ct-vid">
            <video muted preload="metadata" src="${esc(fileUrl(c.arquivo))}#t=0.1"></video>
            <span class="ct-n">#${String(c.n || i + 1).padStart(2, '0')}</span>
            <span class="ct-nota${c.nota >= 85 ? ' alta' : ''}" title="${c.origem === 'ia' ? 'Nota da IA' : 'Nota pelas regras'}">🔥 ${esc(c.nota)}</span>
            <span class="ct-dur">${hms(c.dur)}</span>
          </div>
          <div class="ct-body">
            <div class="ct-tit" title="${esc(c.titulo)}">${esc(c.titulo)}</div>
            <div class="ct-tempo">${hms(c.s)} → ${hms(c.e)} no original</div>
            ${c.gancho ? `<div class="ct-gancho">${esc(c.gancho)}</div>` : ''}
            <div class="ct-acts">
              <button class="btn ${naMesa ? 'ghost' : 'primary'} xs" data-a="mesa" ${naMesa ? 'disabled' : ''}>${naMesa ? '✓ Na mesa' : '➜ Mesa'}</button>
              <button class="btn ghost xs" data-a="arquivo" title="Mostrar o arquivo">📂</button>
            </div>
          </div>
        </div>`;
      })
      .join('');
    const extras = (r && r.extras) || [];
    $('#ctExtrasBox').classList.toggle('hidden', !extras.length);
    $('#ctExtras').innerHTML = extras
      .map(
        (c, i) => `<label class="ct-extra">
          <input type="checkbox" data-x="${i}" ${ct.extrasSel.has(i) ? 'checked' : ''}>
          <span class="ct-nota mini">🔥 ${esc(c.nota)}</span>
          <span class="ct-x-body"><b>${esc(c.titulo)}</b><small>${hms(c.s)} → ${hms(c.e)} · ${hms(c.dur)} — ${esc(String(c.texto || '').slice(0, 160))}…</small></span>
        </label>`
      )
      .join('');
    $('#ctCortarExtras').disabled = !ct.extrasSel.size || ct.rodando;
  }

  // ajustes de cada corte na mesa conforme o formato escolhido
  function ajustarCorte(v, opts) {
    const s = v.settings, m = v.meta;
    s.legendaAnim.ativo = !!opts.legenda && !!(v.words && v.words.length);
    s.legendaAnim.emojis = !!opts.emojis;
    if (opts.formato === 'cheio') {
      const alvo = (m.height * 9) / 16;
      const lado = m.width > alvo + 4 ? S.even((m.width - alvo) / 2) : 0;
      s.recorte = { ...s.recorte, left: lado, right: lado, top: 0, bottom: 0, zoom: 1, posV: 0.5 };
      if (s.template.fundoTipo === 'blur') s.template.fundoTipo = 'cor';
    } else if (opts.formato === 'meio') {
      s.recorte = { ...s.recorte, left: 0, right: 0, top: 0, bottom: 0, zoom: 1, posV: 0.5 };
      s.template.fundoTipo = 'blur';
    }
    if (opts.titulo) {
      s.texto.pos = 'topo';
      s.texto.v = opts.formato === 'meio' ? 20 : 14;
    }
  }

  async function mandarParaMesa(lista) {
    const novos = lista.filter((c) => c.arquivo && !ct.naMesa.has(c.arquivo));
    if (!novos.length) return;
    const opts = { formato: formato(), legenda: $('#ctLegenda').checked, emojis: $('#ctEmojis').checked, titulo: $('#ctTitulo').checked };
    const extras = new Map();
    for (const c of novos) {
      const words = c.words && c.words.length ? c.words : null;
      extras.set(c.arquivo, {
        legenda: opts.titulo ? c.titulo : '',
        capaTitulo: c.titulo,
        words,
        emojis: words ? window.Legendas.gerarEmojis(words, c.emojis) : null,
        corte: { nota: c.nota, titulo: c.titulo, descricao: c.descricao, gancho: c.gancho, origem: c.origem },
        ajustar: (v) => ajustarCorte(v, opts)
      });
    }
    await importPaths(novos.map((c) => c.arquivo), extras);
    novos.forEach((c) => ct.naMesa.add(c.arquivo));
    renderResultados();
  }

  async function cortarExtras() {
    if (ct.rodando || !ct.res || !ct.extrasSel.size) return;
    const idx = [...ct.extrasSel].sort((a, b) => a - b);
    const lista = idx.map((i) => ct.res.extras[i]);
    ct.rodando = true;
    $('#ctProg').classList.remove('hidden');
    $('#ctCortarExtras').disabled = true;
    try {
      const feitos = await api.cortesExportar(ct.arquivo, lista);
      ct.res.cortes.push(...feitos);
      ct.res.extras = ct.res.extras.filter((_, i) => !ct.extrasSel.has(i));
      ct.extrasSel.clear();
      if ($('#ctMesa').checked) await mandarParaMesa(feitos);
      toast(`${feitos.length} corte(s) a mais${$('#ctMesa').checked ? ' na mesa' : ''}`, 'ok');
    } catch (err) {
      const msg = erroIpc(err);
      if (msg !== 'Cancelado') toast(msg, 'err', 7000);
    } finally {
      ct.rodando = false;
      $('#ctProg').classList.add('hidden');
      renderResultados();
    }
  }

  // ------------------------------------------------------------ ligações
  function bind() {
    carregar();
    $('#ctEscolher').onclick = async () => definirArquivo(await api.cortesEscolher());
    $('#ctGerar').onclick = gerar;
    $('#ctCancelar').onclick = () => api.cortesCancelar();
    $('#ctQtdSeg').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      $('#ctQtd').value = b.dataset.v;
      marcarAtalhos();
      salvar();
    };
    $('#ctDurSeg').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      $('#ctMin').value = b.dataset.min;
      $('#ctMax').value = b.dataset.max;
      marcarAtalhos();
      salvar();
    };
    $('#ctFormato').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      $$('#ctFormato button').forEach((x) => x.classList.toggle('on', x === b));
      salvar();
    };
    for (const id of ['#ctQtd', '#ctMin', '#ctMax']) $(id).addEventListener('input', () => { marcarAtalhos(); salvar(); });
    for (const id of ['#ctTipo', '#ctInstr', '#ctLegenda', '#ctEmojis', '#ctTitulo', '#ctMesa', '#ctIaUrl', '#ctIaChave', '#ctIaModelo']) $(id).addEventListener('change', salvar);
    for (const id of ['#ctIdioma', '#ctModelo', '#ctPlaca']) $(id).addEventListener('change', () => {
      salvar();
      if (ct.arquivo) definirArquivo(ct.arquivo);
    });
    $('#ctIa').onchange = () => {
      salvar();
      preencherIa();
      if ($('#ctIa').value === 'ollama') testarIa(true).catch(() => {});
    };
    $('#ctIaTestar').onclick = () => {
      salvar();
      testarIa(false).catch((err) => statusIa(erroIpc(err), false));
    };
    $('#ctOllamaBaixar').onclick = async () => {
      if (ct.rodando) return;
      const ia = iaAtual();
      const modelo = ia.modelo || MODELO_PADRAO.ollama;
      if (!confirm(`Baixar o modelo ${modelo} no Ollama?\nSão alguns GB (o qwen2.5:14b tem ~9 GB). Só precisa uma vez.`)) return;
      $('#ctOllamaBaixar').disabled = true;
      try {
        await api.cortesOllamaBaixar(ia.url, modelo);
        $('#ctIaModelo').value = modelo;
        salvar();
        await testarIa(false);
      } catch (err) {
        statusIa(erroIpc(err), false);
      } finally {
        $('#ctOllamaBaixar').disabled = false;
      }
    };
    $('#ctAbrirPasta').onclick = () => ct.res && api.cortesAbrir(ct.res.pasta);
    $('#ctMandarTodos').onclick = async () => {
      if (!ct.res) return;
      await mandarParaMesa(ct.res.cortes);
      toast('Cortes na mesa do Editor', 'ok');
      switchView('editor');
    };
    $('#ctLista').onclick = async (e) => {
      const card = e.target.closest('.ct-card');
      if (!card) return;
      const c = ct.res.cortes[Number(card.dataset.i)];
      const a = e.target.closest('[data-a]');
      if (a && a.dataset.a === 'mesa') {
        await mandarParaMesa([c]);
        toast('Corte na mesa do Editor', 'ok');
      } else if (a && a.dataset.a === 'arquivo') api.showItem(c.arquivo);
      else if (e.target.tagName === 'VIDEO') {
        const vid = e.target;
        vid.muted = false;
        vid.controls = true;
        vid.paused ? vid.play().catch(() => {}) : vid.pause();
      }
    };
    $('#ctLista').addEventListener('mouseover', (e) => {
      const vid = e.target.closest('.ct-vid') && e.target.closest('.ct-vid').querySelector('video');
      if (vid && vid.paused && vid.muted) vid.play().catch(() => {});
    });
    $('#ctLista').addEventListener('mouseout', (e) => {
      const box = e.target.closest('.ct-vid');
      if (!box || box.contains(e.relatedTarget)) return;
      const vid = box.querySelector('video');
      if (vid && vid.muted) vid.pause();
    });
    $('#ctExtras').onchange = (e) => {
      const cb = e.target.closest('[data-x]');
      if (!cb) return;
      const i = Number(cb.dataset.x);
      cb.checked ? ct.extrasSel.add(i) : ct.extrasSel.delete(i);
      $('#ctCortarExtras').disabled = !ct.extrasSel.size || ct.rodando;
    };
    $('#ctCortarExtras').onclick = cortarExtras;
    $('#ctRecebidos').onclick = async (e) => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      await definirArquivo(ct.recebidos[Number(b.dataset.r)]);
      renderRecebidos();
    };
    api.onCortesLink(({ arquivos }) => receberLink(arquivos));
    api.onCortesProgresso(progresso);
  }

  let testouIa = false;
  window.Cortes = {
    aoAbrir() {
      if (!testouIa && $('#ctIa').value === 'ollama') {
        testouIa = true;
        testarIa(true).catch(() => {});
      }
    },
    soltar(paths) {
      const p = paths.find((x) => /\.(mp4|mov|m4v|mkv|webm|avi|ts|flv)$/i.test(x));
      if (p) definirArquivo(p);
      else toast('Solte um arquivo de vídeo', 'warn');
    }
  };
  bind();
})();
