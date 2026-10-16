// Minerador de Clientes — serviço de fundo
// 1) abre o painel lateral ao clicar no ícone
// 2) "detalhar": visita cada loja numa aba de trabalho (em segundo plano) e lê site, telefone, endereço
// 3) "checarSite": baixa a página do site da loja e avalia se ela é boa ou ruim

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
let cancelar = false;
let abaTrabalho = null;

chrome.runtime.onMessage.addListener((msg, _de, responder) => {
  if (msg.tipo === 'detalhar') { detalhar(msg.lojas).then(responder); return true; }
  if (msg.tipo === 'checarSite') { checarSite(msg.url).then(responder); return true; }
  if (msg.tipo === 'cancelar') { cancelar = true; responder({ ok: true }); }
});

// ---------------------------------------------------------------- detalhes da loja
function esperarCarregar(tabId, ms = 20000) {
  return new Promise((res) => {
    const fim = setTimeout(() => { chrome.tabs.onUpdated.removeListener(ouvir); res(false); }, ms);
    function ouvir(id, info) {
      if (id === tabId && info.status === 'complete') { clearTimeout(fim); chrome.tabs.onUpdated.removeListener(ouvir); res(true); }
    }
    chrome.tabs.onUpdated.addListener(ouvir);
  });
}

// roda DENTRO da página da loja no Maps
async function lerDetalhe() {
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  let tentativas = 0;
  while (tentativas++ < 30) {
    const h1 = [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()).find((t) => t && t !== 'Resultados');
    if (h1 && document.querySelector('[data-item-id]')) break;
    await dorme(400);
  }
  await dorme(500);
  const nome = [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()).find((t) => t && t !== 'Resultados') || '';
  const site = q('a[data-item-id="authority"]');
  const tel = q('[data-item-id^="phone:tel:"]');
  const end = q('[data-item-id="address"]');
  const menu = q('a[data-item-id="menu"]');
  const pedir = [...document.querySelectorAll('a[href]')].find((a) => /pedir on-?line|fazer pedido|order online/i.test((a.getAttribute('aria-label') || a.innerText || '')));
  const notaTxt = (q('div.F7nice') || {}).innerText || '';
  const fotos = [...document.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label')).find((t) => /foto \d+ de (\d+)/i.test(t)) || '';
  const heroi = q('button[jsaction*="heroHeaderImage"] img');
  const corpo = document.body.innerText;
  return {
    nome,
    site: site ? site.href : '',
    telefone: tel ? tel.getAttribute('data-item-id').replace('phone:tel:', '') : '',
    endereco: end ? (end.getAttribute('aria-label') || '').replace(/^Endereço:\s*/i, '').trim() : '',
    cardapio: menu ? menu.href : '',
    pedidoOnline: !!pedir,
    categoria: (q('button.DkEaL') || {}).innerText || '',
    nota: parseFloat((notaTxt.match(/(\d[,.]\d)/) || [])[1]?.replace(',', '.')) || null,
    avaliacoes: parseInt((notaTxt.match(/\(([\d.]+)\)/) || [])[1]?.replace(/\./g, ''), 10) || null,
    totalFotos: parseInt((fotos.match(/de (\d+)/i) || [])[1], 10) || null,
    foto: heroi ? heroi.src : '',
    fechadoDeVez: /Fechado permanentemente|Permanently closed/i.test(corpo),
    fechadoTemporario: /Fechado temporariamente|Temporarily closed/i.test(corpo)
  };
}

async function detalhar(lojas) {
  cancelar = false;
  const saida = [];
  try {
    const [atual] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    abaTrabalho = await chrome.tabs.create({ url: 'about:blank', active: false, windowId: atual ? atual.windowId : undefined, index: atual ? atual.index + 1 : undefined });
    for (let i = 0; i < lojas.length; i++) {
      if (cancelar) break;
      const l = lojas[i];
      chrome.runtime.sendMessage({ tipo: 'progresso', fase: 'detalhe', i: i + 1, total: lojas.length, nome: l.nome }).catch(() => {});
      let d = null;
      try {
        await chrome.tabs.update(abaTrabalho.id, { url: l.link });
        await esperarCarregar(abaTrabalho.id);
        const [r] = await chrome.scripting.executeScript({ target: { tabId: abaTrabalho.id }, func: lerDetalhe });
        d = r && r.result;
      } catch (e) { d = { erro: String(e && e.message || e) }; }
      saida.push({ id: l.id, ...(d || {}) });
      chrome.runtime.sendMessage({ tipo: 'detalhe', id: l.id, dados: d }).catch(() => {});
      await dorme(1200 + Math.random() * 1300); // ritmo de gente, para não incomodar o Maps
    }
  } finally {
    if (abaTrabalho) chrome.tabs.remove(abaTrabalho.id).catch(() => {});
    abaTrabalho = null;
  }
  return { ok: true, itens: saida, cancelado: cancelar };
}

// ---------------------------------------------------------------- avaliação do site
const SOCIAL = [
  [/instagram\.com/i, 'Instagram'], [/facebook\.com|fb\.com/i, 'Facebook'], [/linktr\.ee|linktree/i, 'Linktree'],
  [/wa\.me|whatsapp\.com|api\.whatsapp/i, 'WhatsApp'], [/tiktok\.com/i, 'TikTok'], [/beacons\.ai|bio\.link|linkbio|taplink/i, 'Link na bio']
];
const PEDIDO = [
  [/ifood\.com/i, 'iFood'], [/anota\.ai/i, 'Anota AI'], [/goomer/i, 'Goomer'], [/aiqfome/i, 'aiqfome'], [/cardapioweb|cardapio\.web/i, 'Cardápio Web'],
  [/menudino/i, 'MenuDino'], [/deliverydireto|delivery-direto/i, 'Delivery Direto'], [/olaclick|ola\.click/i, 'OlaClick'], [/saipos/i, 'Saipos'],
  [/consumer\.app|goomer\.app|cardapio\.?digital|meucardapio|instadelivery|neemo|pedir\.?online|kyte\.site|ccmpedidos|jotaja/i, 'Cardápio digital']
];
const CONSTRUTOR = [[/\.negocio\.site|business\.site/i, 'Site gratuito do Google (desativado)'], [/wixsite\.com/i, 'Wix grátis'], [/\.wordpress\.com|blogspot\./i, 'Blog grátis'], [/webnode|site123|godaddysites|ueniweb|carrd\.co|sites\.google\.com|weebly/i, 'Construtor grátis']];

async function checarSite(url) {
  const r = { url, tipo: 'site', alcancavel: false, https: /^https:/i.test(url), celular: null, ms: null, titulo: '', ano: null, plataforma: '', motivos: [] };
  for (const [re, nome] of SOCIAL) if (re.test(url)) { r.tipo = 'social'; r.plataforma = nome; return r; }
  for (const [re, nome] of PEDIDO) if (re.test(url)) { r.tipo = 'pedido'; r.plataforma = nome; return r; }
  for (const [re, nome] of CONSTRUTOR) if (re.test(url)) { r.plataforma = nome; }
  const ctrl = new AbortController();
  const t0 = performance.now();
  const corte = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await fetch(url, { redirect: 'follow', signal: ctrl.signal, credentials: 'omit', cache: 'no-store' });
    r.ms = Math.round(performance.now() - t0);
    r.status = resp.status;
    r.final = resp.url;
    r.https = /^https:/i.test(resp.url);
    for (const [re, nome] of SOCIAL) if (re.test(resp.url)) { r.tipo = 'social'; r.plataforma = nome; }
    for (const [re, nome] of PEDIDO) if (re.test(resp.url)) { r.tipo = 'pedido'; r.plataforma = nome; }
    if (!resp.ok) { r.motivos.push(`responde com erro ${resp.status}`); return r; }
    const html = (await resp.text()).slice(0, 800000);
    r.alcancavel = true;
    r.bytes = html.length;
    r.celular = /<meta[^>]+name=["']?viewport/i.test(html);
    r.titulo = ((html.match(/<title[^>]*>([^<]{0,120})/i) || [])[1] || '').trim();
    const gen = (html.match(/<meta[^>]+name=["']?generator["']?[^>]+content=["']([^"']+)/i) || [])[1] || '';
    if (!r.plataforma) {
      if (/wix\.com|wixstatic/i.test(html)) r.plataforma = 'Wix';
      else if (/wp-content|wordpress/i.test(html + gen)) r.plataforma = 'WordPress';
      else if (/squarespace/i.test(html)) r.plataforma = 'Squarespace';
      else if (/shopify/i.test(html)) r.plataforma = 'Shopify';
      else if (/lovable|gptengineer/i.test(html)) r.plataforma = 'Lovable';
    }
    for (const [re, nome] of PEDIDO) if (!r.plataforma && re.test(html.slice(0, 200000)) && html.length < 60000) { r.tipo = 'pedido'; r.plataforma = nome; }
    const anos = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2}|19\d{2})/gi)].map((m) => +m[1]);
    if (anos.length) r.ano = Math.max(...anos);
    if (/<table[^>]+width=|<font\b|<marquee|<frameset|\.swf\b/i.test(html)) r.antigo = true;
    if (/em constru[cç][aã]o|under construction|coming soon|em breve|dom[ií]nio.{0,20}(venda|dispon)|parked|this domain/i.test(html.slice(0, 60000)) && html.length < 40000) r.vazio = true;
  } catch (e) {
    r.ms = Math.round(performance.now() - t0);
    r.erro = e.name === 'AbortError' ? 'não abriu em 15s' : 'não abre';
  } finally { clearTimeout(corte); }
  return r;
}
