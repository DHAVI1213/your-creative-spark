// Ferramentas usadas pelos coletores (rodam dentro da aba do perfil).
(function () {
  'use strict';
  if (self.MVC) return;

  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  let cancelado = false;

  function progresso(texto, n, pct) {
    try {
      chrome.runtime.sendMessage({ tipo: 'mv-progresso', texto, n, pct }).catch(() => {});
    } catch (_) {}
  }

  // Pausa quando a plataforma pede (429): espera cada vez mais e tenta de novo.
  // Sem pausas: no 429 a coleta não espera, pula para a próxima rota e entrega o que já leu.
  const PAUSAS_429 = self.MV_PAUSAS_429 || []; // segundos (vazio = não pausa)
  let ultimaPausa = 0;
  async function pausar(seg) {
    for (let s = seg; s > 0; s--) {
      if (cancelado) throw new Error('Cancelado');
      progresso(`A plataforma pediu uma pausa · retomando em ${s}s`);
      await esperar(1000);
    }
  }

  async function getJSON(url, init = {}, tentativas = 3) {
    let ultimo, pausas = 0;
    for (let i = 0; i < tentativas; i++) {
      if (cancelado) throw new Error('Cancelado');
      try {
        const r = await fetch(url, { credentials: 'include', cache: 'no-store', ...init });
        if (r.status === 429) {
          if (pausas < PAUSAS_429.length) {
            await pausar(PAUSAS_429[pausas++]);
            ultimaPausa = Date.now();
            i--; // pausa não conta como tentativa
            continue;
          }
          throw Object.assign(new Error('A plataforma pediu para ir mais devagar (429). Espere alguns minutos e tente de novo.'), { pare: true, limite: true });
        }
        if (r.status === 401 || r.status === 403) {
          const corpo = await r.text().catch(() => '');
          if (/wait a few minutes|tente novamente mais tarde|rate|spam/i.test(corpo))
            throw Object.assign(new Error('A plataforma limitou as consultas. Espere alguns minutos e tente de novo.'), { pare: true, limite: true });
          if (/login_required|require_login|checkpoint/i.test(corpo))
            throw Object.assign(new Error('Sua sessão caiu: faça login de novo nesta aba e tente outra vez.'), { pare: true });
          throw Object.assign(new Error(`Acesso negado (${r.status}). Confira se está logado.`), { pare: true });
        }
        if (!r.ok) throw new Error(`Resposta ${r.status}`);
        const tipo = r.headers.get('content-type') || '';
        if (!tipo.includes('json')) {
          // a plataforma devolveu uma página no lugar dos dados: descobre o motivo
          const destino = r.url || '';
          if (/\/accounts\/login|\/login\b/.test(destino))
            throw Object.assign(new Error('Sua sessão caiu: faça login de novo nesta aba e tente outra vez.'), { pare: true });
          if (/\/challenge|\/checkpoint|\/suspended/.test(destino))
            throw Object.assign(new Error('A plataforma pediu uma verificação. Abra o site, confirme que é você e tente de novo.'), { pare: true });
          throw Object.assign(new Error('A plataforma recusou a consulta (provável limite de uso). Espere alguns minutos.'), { pare: true, limite: true });
        }
        const dados = await r.json();
        // às vezes o aviso vem dentro dos dados, com status 200
        if (dados && (dados.require_login || dados.message === 'login_required'))
          throw Object.assign(new Error('Sua sessão caiu: faça login de novo nesta aba e tente outra vez.'), { pare: true });
        if (dados && dados.status === 'fail' && /wait|minutes|tente/i.test(dados.message || ''))
          throw Object.assign(new Error('A plataforma limitou as consultas. Espere alguns minutos e tente de novo.'), { pare: true, limite: true });
        return dados;
      } catch (e) {
        if (e && e.message === 'Failed to fetch') e = new Error('Falha de conexão com a plataforma');
        ultimo = e;
        if (e.pare) throw e;
        await esperar(150 * (i + 1)); // só para erro de rede, rápido
      }
    }
    throw ultimo;
  }

  async function getTexto(url) {
    const r = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error(`Resposta ${r.status}`);
    return r.text();
  }

  // Lê um objeto JSON que aparece depois de "marcador" dentro de um HTML.
  function jsonApos(texto, marcador) {
    let i = texto.indexOf(marcador);
    if (i < 0) return null;
    i = texto.indexOf('{', i + marcador.length);
    if (i < 0) return null;
    let nivel = 0, str = false, esc = false;
    for (let j = i; j < texto.length; j++) {
      const c = texto[j];
      if (str) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') str = false;
      } else if (c === '"') str = true;
      else if (c === '{') nivel++;
      else if (c === '}' && --nivel === 0) {
        try {
          return JSON.parse(texto.slice(i, j + 1));
        } catch (_) {
          return null;
        }
      }
    }
    return null;
  }

  // Percorre um objeto inteiro chamando fn em cada pedaço.
  function percorrer(obj, fn, vistos = new Set()) {
    if (!obj || typeof obj !== 'object' || vistos.has(obj)) return;
    vistos.add(obj);
    fn(obj);
    for (const v of Array.isArray(obj) ? obj : Object.values(obj)) percorrer(v, fn, vistos);
  }

  // Rola a página até parar de aparecer coisa nova (último recurso).
  async function rolarAte(coletar, alvo, rotulo) {
    const y0 = scrollY;
    let parado = 0, antes = -1;
    try {
      for (let i = 0; i < 300 && parado < 6; i++) {
        if (cancelado) break;
        const n = coletar();
        if (n >= alvo) break;
        parado = n === antes ? parado + 1 : 0;
        antes = n;
        progresso(`${rotulo} · ${n} encontrados`, n);
        scrollTo(0, document.documentElement.scrollHeight);
        await esperar(900);
      }
      coletar();
    } finally {
      scrollTo(0, y0);
    }
  }

  // Conta quantos vídeos já passaram nos filtros (e não foram baixados antes).
  // A mineração para quando chega no "quero"; o "analisar" é só o teto da busca.
  function contador(opts) {
    const pular = new Set((opts.pular || []).map(String));
    const filtros = opts.filtros || {};
    const quero = Math.max(1, Number(opts.quero) || Infinity);
    const corte = filtros.dias ? Date.now() / 1000 - filtros.dias * 86400 : 0;
    let n = 0;
    return {
      recontar(mapa) {
        n = 0;
        for (const v of mapa.values()) if (!pular.has(String(v.id)) && self.MV.filtrar([v], filtros).length) n++;
        return n;
      },
      get aprovados() {
        return n;
      },
      bastou: () => n >= quero,
      quero,
      // página inteira mais antiga que o período escolhido = pode parar (as próximas são mais velhas)
      paginaVelha: (itens) => !!corte && itens.length > 0 && itens.every((v) => v.data && v.data < corte)
    };
  }

  // Perfis que aparecem na página (sugestões, comentários, "quem viu também"), sem repetir.
  function perfisNaPagina(re, perfil, montar) {
    const achados = new Map();
    for (const a of document.querySelectorAll('a[href]')) {
      const m = (a.getAttribute('href') || '').match(re);
      if (!m) continue;
      const u = decodeURIComponent(m[1]).toLowerCase();
      if (!u || u === String(perfil).toLowerCase() || achados.has(u)) continue;
      const img = a.querySelector('img');
      const nome = (a.innerText || '').trim().split('\n')[0].slice(0, 60);
      achados.set(u, montar(u, nome, (img && (img.currentSrc || img.src)) || ''));
      if (achados.size >= 30) break;
    }
    return [...achados.values()];
  }

  // Roda fn em cada item, n ao mesmo tempo, e devolve { id: resultado }.
  async function emParalelo(itens, n, fn, rotulo) {
    const out = {};
    let i = 0, feitos = 0;
    const worker = async () => {
      while (i < itens.length) {
        if (cancelado) return;
        const it = itens[i++];
        try {
          out[it.id] = await fn(it);
        } catch (e) {
          out[it.id] = { erro: e.message };
        }
        feitos++;
        progresso(`${rotulo} · ${feitos}/${itens.length}`, feitos, (100 * feitos) / itens.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(n, itens.length) }, worker));
    return out;
  }

  self.MVC = {
    perfisNaPagina,
    emParalelo,
    contador,
    esperar,
    pausouRecente: () => Date.now() - ultimaPausa < 5 * 60 * 1000,
    progresso,
    getJSON,
    getTexto,
    jsonApos,
    percorrer,
    rolarAte,
    cancelar: () => (cancelado = true),
    reiniciar: () => (cancelado = false)
  };
})();
