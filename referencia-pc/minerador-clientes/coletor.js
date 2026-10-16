// Roda DENTRO da aba do Google Maps (injetada pelo painel com chrome.scripting).
// Rola a lista de resultados até o fim (ou até o limite) e lê cada cartão.
// Precisa ser uma função autossuficiente: nada de fora dela existe na página.
async function mcColetarLista(max) {
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
  const avisa = (dados) => { try { chrome.runtime.sendMessage({ tipo: 'progresso', fase: 'lista', ...dados }); } catch (e) {} };

  // espera a lista aparecer
  let feed = null;
  for (let i = 0; i < 40 && !feed; i++) { feed = document.querySelector('div[role="feed"]'); if (!feed) await dorme(300); }
  if (!feed) {
    // busca que caiu direto numa loja só
    if (document.querySelector('[data-item-id="address"]')) return { ok: false, erro: 'O Maps abriu uma loja só, não uma lista. Tente um termo mais geral (ex.: "hamburgueria").' };
    return { ok: false, erro: 'Não achei a lista de resultados do Maps nesta aba.' };
  }
  const oculta = document.visibilityState === 'hidden';

  const contar = () => feed.querySelectorAll('a.hfpxzc').length;
  const noFim = () => /chegou ao final da lista|reached the end of the list/i.test(feed.innerText.slice(-600));
  let anterior = -1, parado = 0;
  while (contar() < max && !noFim()) {
    const ultimo = [...feed.querySelectorAll('div[role="article"]')].pop();
    if (ultimo) ultimo.scrollIntoView({ block: 'end' });
    feed.scrollTop = feed.scrollHeight;
    feed.dispatchEvent(new WheelEvent('wheel', { deltaY: 800, bubbles: true }));
    await dorme(1300 + Math.random() * 600);
    const n = contar();
    avisa({ n, max });
    if (n === anterior) { if (++parado >= 6) break; } else parado = 0;
    anterior = n;
  }

  const num = (t) => parseFloat(String(t).replace(/\./g, '').replace(',', '.'));
  const itens = [];
  const vistos = new Set();
  for (const a of feed.querySelectorAll('a.hfpxzc')) {
    if (itens.length >= max) break;
    const card = a.closest('div[role="article"]') || a.parentElement;
    const link = a.href;
    const id = (link.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i) || link.match(/!19s([\w-]+)/) || [])[1] || link;
    if (vistos.has(id)) continue;
    vistos.add(id);
    const imgs = [...card.querySelectorAll('[role="img"][aria-label]')].map((x) => x.getAttribute('aria-label'));
    const est = imgs.find((t) => /estrela|star/i.test(t)) || '';
    const preco = imgs.find((t) => /R\$|\$/.test(t)) || '';
    const linhas = [...card.querySelectorAll('.W4Efsd')].map((x) => x.innerText.trim()).filter(Boolean);
    const linhaCat = linhas.find((l) => /·/.test(l) && !/estrela|\(\d/.test(l) && !/aberto|fechado|abre|fecha/i.test(l.split('\n')[0])) || '';
    const partes = linhaCat.split('\n')[0].split('·').map((s) => s.trim()).filter(Boolean);
    const status = (card.innerText.match(/(Aberto[^\n]*|Fechado[^\n]*|Abre[^\n]*|Fecha[^\n]*)/) || [])[1] || '';
    const destaque = (card.innerText.match(/"([^"\n]{8,200})"/) || card.innerText.match(/“([^”\n]{8,200})”/) || [])[1] || '';
    const img = [...card.querySelectorAll('img')].map((i) => i.src).find((s) => /googleusercontent|ggpht|streetview/.test(s)) || '';
    const site = card.querySelector('a[data-value="Website"], a[data-value="Site"]');
    itens.push({
      id,
      link,
      nome: a.getAttribute('aria-label') || '',
      nota: est ? num((est.match(/(\d+[,.]\d)/) || [])[1]) || null : null,
      avaliacoes: est ? parseInt(((est.match(/([\d.]+)\s*(coment|avalia|review)/i) || [])[1] || '').replace(/\./g, ''), 10) || 0 : 0,
      preco: preco.replace(/\s+a\s+/i, '–'),
      categoria: partes[0] || '',
      endereco: partes.slice(1).filter((p) => !/^\s*$/.test(p)).pop() || '',
      status: status.trim(),
      destaque,
      foto: img.replace(/=w\d+-h\d+[^&]*$/, '=w240-h240-k-no'),
      pedidoOnline: /Pedir on-?line|Fazer pedido/i.test(card.innerText),
      site: site ? site.href : ''
    });
  }
  return { ok: true, itens, fim: noFim(), oculta, busca: decodeURIComponent((location.pathname.match(/\/maps\/search\/([^/]+)/) || [])[1] || '').replace(/\+/g, ' ') };
}
