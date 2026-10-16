// Roda dentro da página (mundo principal) antes do site começar.
// Guarda as respostas que o site busca sozinho (cardápio, produtos, preços...) para a cópia completa
// conseguir mostrar tudo sem internet. Fica só na memória da aba; nada é enviado para lugar nenhum.
(function () {
  if (window.__copiadorGravando) return;
  Object.defineProperty(window, '__copiadorGravando', { value: true });
  const lista = [];
  Object.defineProperty(window, '__copiadorRespostas', { get: () => lista });
  const RASTREADOR = /(google-analytics|googletagmanager|analytics\.google|doubleclick|googleadservices|google\.com(\.\w+)?\/(measurement|ads|pagead)|facebook\.(com|net)|hotjar|clarity\.ms|analytics\.tiktok|segment\.(io|com)|sentry\.io|newrelic|nr-data|mixpanel|amplitude|\/\/apm\.)/i;
  const TEXTO = /json|text|javascript|xml|x-component|graphql/i;
  const LIMITE_ITEM = 6 * 1024 * 1024, LIMITE_TOTAL = 40 * 1024 * 1024;
  let total = 0;
  function guarda(url, metodo, corpo, status, tipo, texto) {
    try {
      if (!texto || status < 200 || status >= 300 || texto.length > LIMITE_ITEM) return;
      const u = new URL(url, location.href);
      if (!/^https?:$/.test(u.protocol) || RASTREADOR.test(u.href)) return;
      if (!TEXTO.test(tipo || '')) return;
      if (total + texto.length > LIMITE_TOTAL) return;
      total += texto.length;
      lista.push({ url: u.href, metodo: (metodo || 'GET').toUpperCase(), corpo: typeof corpo === 'string' ? corpo : '', status, tipo: tipo || '', texto });
    } catch (_) {}
  }
  const corpoTexto = (b) => (typeof b === 'string' ? b : b instanceof URLSearchParams ? b.toString() : '');

  const fetchOrig = window.fetch;
  if (fetchOrig) {
    window.fetch = function (entrada, op) {
      const p = fetchOrig.apply(this, arguments);
      try {
        const url = typeof entrada === 'string' || entrada instanceof URL ? String(entrada) : entrada && entrada.url;
        const metodo = (op && op.method) || (entrada && entrada.method) || 'GET';
        const corpo = corpoTexto(op && op.body);
        p.then((r) => {
          const tipo = r.headers.get('content-type') || '';
          if (!TEXTO.test(tipo) || r.type === 'opaque') return;
          r.clone().text().then((t) => guarda(r.url || url, metodo, corpo, r.status, tipo, t)).catch(() => {});
        }).catch(() => {});
      } catch (_) {}
      return p;
    };
    try { Object.defineProperty(window.fetch, 'toString', { value: () => fetchOrig.toString() }); } catch (_) {}
  }

  const X = XMLHttpRequest.prototype;
  const abre = X.open, envia = X.send;
  X.open = function (metodo, url) {
    this.__cop = { metodo, url };
    return abre.apply(this, arguments);
  };
  X.send = function (corpo) {
    const info = this.__cop;
    if (info) {
      info.corpo = corpoTexto(corpo);
      this.addEventListener('loadend', () => {
        try {
          const tipo = this.getResponseHeader('content-type') || '';
          let t = '';
          if (this.responseType === '' || this.responseType === 'text') t = this.responseText;
          else if (this.responseType === 'json' && this.response != null) t = JSON.stringify(this.response);
          guarda(this.responseURL || info.url, info.metodo, info.corpo, this.status, tipo, t);
        } catch (_) {}
      });
    }
    return envia.apply(this, arguments);
  };
})();
