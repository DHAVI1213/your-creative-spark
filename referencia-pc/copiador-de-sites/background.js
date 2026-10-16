// Recebe o pedido de exportação vindo do modo de edição e abre a tela de cópia.
chrome.runtime.onMessage.addListener((m, sender, responde) => {
  if (m && m.tipo === 'baixar' && sender.tab) {
    chrome.downloads.download({ url: m.url, filename: m.nome, conflictAction: 'uniquify' })
      .then((id) => responde({ ok: true, id }), (e) => responde({ ok: false, erro: String(e && e.message || e) }));
    return true;
  }
  if (m && m.tipo === 'copiar' && sender.tab) {
    const p = new URLSearchParams({
      tab: sender.tab.id,
      modo: m.modo || 'visual',
      paginas: 1,
      formato: m.formato || 'zip',
      rolar: m.rolar === false ? '0' : '1'
    });
    chrome.tabs.create({ url: chrome.runtime.getURL('copiador.html?' + p), index: sender.tab.index + 1 });
  }
});
