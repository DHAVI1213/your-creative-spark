'use strict';
// Gravador de rede (Chrome DevTools Protocol, via chrome.debugger).
// A lista de recursos da página (performance.getEntriesByType) só enxerga o que a página principal pediu.
// Workers (decodificadores .wasm do 3D, texturas KTX2/Basis, importScripts...), iframes e service workers
// ficam de fora. Aqui a gente "escuta" a rede da aba e de todos esses filhos, para a cópia completa
// baixar tudo o que o site realmente usa. Nada sai do computador: fica só na memória enquanto copia.
(function (root) {
  const VERSAO = '1.3';
  let tabId = null;
  let ligado = false;
  const reqs = new Map(); // "sessao|requestId" -> { url, metodo, tipo, status, mime, sessao, requestId, fim }
  let aviso = null;

  const alvo = (sessao) => (sessao ? { tabId, sessionId: sessao } : { tabId });
  const cmd = (sessao, metodo, params) => chrome.debugger.sendCommand(alvo(sessao), metodo, params || {});

  async function preparaSessao(sessao) {
    // buffers grandes: sem isso o Chrome joga fora as respostas grandes (modelos 3D) antes da gente ler
    await cmd(sessao, 'Network.enable', { maxTotalBufferSize: 400 * 1024 * 1024, maxResourceBufferSize: 120 * 1024 * 1024 });
    // workers e iframes novos entram sozinhos, parados no começo, até a gente ligar a escuta neles
    await cmd(sessao, 'Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }).catch(() => {});
  }

  function aoEvento(origem, metodo, p) {
    if (origem.tabId !== tabId) return;
    const sessao = origem.sessionId || '';
    if (metodo === 'Target.attachedToTarget') {
      const sid = p.sessionId;
      (async () => {
        try { await preparaSessao(sid); } catch (_) {}
        // o worker nasceu pausado: agora que a rede está escutada, deixa ele rodar
        if (p.waitingForDebugger) { try { await cmd(sid, 'Runtime.runIfWaitingForDebugger'); } catch (_) {} }
      })();
      return;
    }
    if (metodo === 'Network.requestWillBeSent') {
      const k = sessao + '|' + p.requestId;
      const antigo = reqs.get(k);
      // redirecionamento reaproveita o requestId: guarda o último endereço
      reqs.set(k, { url: p.request.url, metodo: p.request.method, tipo: p.type || '', sessao, requestId: p.requestId, status: antigo && antigo.status, mime: antigo && antigo.mime, fim: false });
    } else if (metodo === 'Network.responseReceived') {
      const r = reqs.get(sessao + '|' + p.requestId);
      if (r) { r.status = p.response.status; r.mime = p.response.mimeType || ''; r.url = p.response.url || r.url; }
    } else if (metodo === 'Network.loadingFinished') {
      const r = reqs.get(sessao + '|' + p.requestId);
      if (r) r.fim = true;
    } else if (metodo === 'Network.loadingFailed') {
      const r = reqs.get(sessao + '|' + p.requestId);
      if (r) { r.falhou = true; r.fim = true; }
    }
  }

  async function liga(tab) {
    if (ligado) return true;
    tabId = tab;
    reqs.clear();
    aviso = null;
    try {
      await chrome.debugger.attach({ tabId }, VERSAO);
    } catch (e) {
      aviso = /another debugger|already attached|Cannot attach/i.test(e.message)
        ? 'Outra ferramenta de depuração (como o DevTools/F12) já está nessa aba. Feche o F12 e tente de novo.'
        : 'Não deu para ligar a gravação avançada: ' + e.message;
      return false;
    }
    ligado = true;
    chrome.debugger.onEvent.addListener(aoEvento);
    chrome.debugger.onDetach.addListener(aoSoltar);
    try { await preparaSessao(''); } catch (e) { aviso = 'Gravação avançada parcial: ' + e.message; }
    return true;
  }
  function aoSoltar(origem) {
    if (origem.tabId === tabId) { ligado = false; aviso = aviso || 'O Chrome soltou a gravação avançada (a aba foi fechada ou o F12 foi aberto).'; }
  }
  async function desliga() {
    if (!ligado) return;
    ligado = false;
    chrome.debugger.onEvent.removeListener(aoEvento);
    chrome.debugger.onDetach.removeListener(aoSoltar);
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
  }

  // arquivos que a aba (e os workers/iframes dela) buscaram com sucesso
  function lista() {
    const vistos = new Map();
    for (const r of reqs.values()) {
      if (!/^https?:/i.test(r.url) || r.metodo !== 'GET' || r.falhou) continue;
      if (r.status && (r.status < 200 || r.status >= 400)) continue;
      if (/\.map(\?|$)/i.test(r.url)) continue;
      vistos.set(r.url.split('#')[0], r);
    }
    return [...vistos.values()].map((r) => ({ url: r.url.split('#')[0], tipo: r.tipo, mime: r.mime, worker: !!r.sessao }));
  }

  // corpo da resposta que o Chrome guardou (usado quando o download normal falha: URL assinada, cookie, etc.)
  async function corpo(url) {
    if (!ligado) return null;
    const u = url.split('#')[0];
    for (const r of reqs.values()) {
      if (r.url.split('#')[0] !== u || !r.fim || r.falhou || (r.status && r.status >= 400)) continue;
      try {
        const x = await cmd(r.sessao, 'Network.getResponseBody', { requestId: r.requestId });
        let bytes;
        if (x.base64Encoded) {
          const bin = atob(x.body);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else bytes = new TextEncoder().encode(x.body);
        return { bytes: bytes.buffer, tipo: r.mime || '' };
      } catch (_) { /* tenta a próxima ocorrência */ }
    }
    return null;
  }

  root.GravadorRede = { liga, desliga, lista, corpo, get aviso() { return aviso; }, get ligado() { return ligado; }, get total() { return reqs.size; } };
})(typeof self !== 'undefined' ? self : window);
