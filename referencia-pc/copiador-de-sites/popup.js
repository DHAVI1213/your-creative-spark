'use strict';
const $ = (s) => document.querySelector(s);
const val = (n) => document.querySelector(`input[name="${n}"]:checked`).value;
let aba;

(async () => {
  [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  $('#site').textContent = aba ? aba.url : '—';
  const salvo = await chrome.storage.local.get(['modo', 'pag', 'fmt', 'qtd', 'ghOn', 'ghRepo', 'ghToken', 'cdp']);
  $('#cdp').checked = salvo.cdp !== false;
  $('#ghOn').checked = !!salvo.ghOn; $('#ghRepo').value = salvo.ghRepo || ''; $('#ghToken').value = salvo.ghToken || '';
  if (salvo.modo) document.querySelector(`input[name="modo"][value="${salvo.modo}"]`).checked = true;
  if (salvo.pag) document.querySelector(`input[name="pag"][value="${salvo.pag}"]`).checked = true;
  if (salvo.fmt) document.querySelector(`input[name="fmt"][value="${salvo.fmt}"]`).checked = true;
  if (salvo.qtd) $('#qtd').value = salvo.qtd;
  atualiza();
  if (!aba || !/^(https?|file):/.test(aba.url)) {
    $('#copiar').disabled = $('#editar').disabled = $('#componente').disabled = true;
    $('#site').textContent = 'Abra um site para copiar.';
  }
})();

function atualiza() {
  const completo = val('modo') === 'completo';
  $('#blocoFormato').classList.toggle('escondido', completo);
  $('#blocoCdp').classList.toggle('escondido', !completo);
  $('#blocoGh').classList.toggle('escondido', completo || val('fmt') !== 'lovable');
  $('#linhaQtd').style.opacity = val('pag') === 'varias' ? 1 : 0.5;
  if (val('fmt') === 'unico' && !completo) { document.querySelector('input[name="pag"][value="1"]').checked = true; $('#linhaQtd').style.opacity = 0.5; }
  chrome.storage.local.set({ modo: val('modo'), pag: val('pag'), fmt: val('fmt'), qtd: $('#qtd').value, ghOn: $('#ghOn').checked, ghRepo: $('#ghRepo').value.trim(), ghToken: $('#ghToken').value.trim(), cdp: $('#cdp').checked });
}
document.addEventListener('change', atualiza);
document.addEventListener('input', (e) => { if (e.target.id === 'ghRepo' || e.target.id === 'ghToken') atualiza(); });

$('#copiar').onclick = () => {
  const paginas = val('pag') === 'varias' ? Math.max(2, Math.min(30, Number($('#qtd').value) || 6)) : 1;
  const q = new URLSearchParams({ tab: aba.id, modo: val('modo'), paginas, formato: val('modo') === 'completo' ? 'zip' : val('fmt'), cdp: $('#cdp').checked ? 1 : 0 });
  chrome.tabs.create({ url: chrome.runtime.getURL('copiador.html?' + q), index: aba.index + 1 });
  window.close();
};

$('#editar').onclick = async () => {
  await chrome.scripting.executeScript({ target: { tabId: aba.id }, files: ['editor.js'] });
  window.close();
};

$('#componente').onclick = async () => {
  await chrome.scripting.executeScript({ target: { tabId: aba.id }, files: ['componente.js'] });
  window.close();
};
