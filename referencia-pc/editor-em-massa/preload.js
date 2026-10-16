'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickVideos: () => ipcRenderer.invoke('pick-videos'),
  pickFile: (kind) => ipcRenderer.invoke('pick-file', kind),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  defaultOut: () => ipcRenderer.invoke('default-out'),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  showItem: (p) => ipcRenderer.invoke('show-item', p),
  readDataUrl: (p) => ipcRenderer.invoke('read-data-url', p),
  probe: (f) => ipcRenderer.invoke('probe', f),
  thumb: (f, d) => ipcRenderer.invoke('thumb', f, d),
  cleanPreview: (f, t, meta, s) => ipcRenderer.invoke('clean-preview', f, t, meta, s),
  frame: (f, t, meta, s) => ipcRenderer.invoke('frame', f, t, meta, s),
  cropdetect: (f, d, w, h) => ipcRenderer.invoke('cropdetect', f, d, w, h),
  renderPreflight: (meta, s) => ipcRenderer.invoke('render-preflight', meta, s),
  process: (jobs, opts) => ipcRenderer.invoke('process', jobs, opts),
  cancel: () => ipcRenderer.invoke('cancel'),
  cloudConfig: () => ipcRenderer.invoke('cloud-config'),
  cloudApi: (cfg, method, p, body) => ipcRenderer.invoke('cloud-api', cfg, method, p, body),
  cloudSend: (cfg, items) => ipcRenderer.invoke('cloud-send', cfg, items),
  onCloudProgress: (cb) => ipcRenderer.on('cloud-progress', (_e, d) => cb(d)),
  pickMedia: () => ipcRenderer.invoke('pick-media'),
  onExternalImport: (cb) => ipcRenderer.on('external-import', (_e, d) => cb(d)),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onProgress: (cb) => ipcRenderer.on('job-progress', (_e, d) => cb(d)),
  onDone: (cb) => ipcRenderer.on('job-done', (_e, d) => cb(d)),
  onQueueEmpty: (cb) => ipcRenderer.on('queue-empty', () => cb()),
  // legenda animada e Cortes Virais
  capTrack: (key, faixa) => ipcRenderer.invoke('cap-track', key, faixa),
  capExiste: (list) => ipcRenderer.invoke('cap-existe', list),
  capApagar: (dir) => ipcRenderer.invoke('cap-apagar', dir),
  processFim: () => ipcRenderer.invoke('process-fim'),
  transcrever: (arquivo, opts) => ipcRenderer.invoke('transcrever', arquivo, opts),
  cortesEscolher: () => ipcRenderer.invoke('cortes-escolher'),
  cortesInfo: (arquivo, idioma, modelo) => ipcRenderer.invoke('cortes-info', arquivo, idioma, modelo),
  cortesIniciar: (opts) => ipcRenderer.invoke('cortes-iniciar', opts),
  cortesExportar: (arquivo, lista) => ipcRenderer.invoke('cortes-exportar', arquivo, lista),
  cortesCancelar: () => ipcRenderer.invoke('cortes-cancelar'),
  cortesAbrir: (p) => ipcRenderer.invoke('cortes-abrir', p),
  cortesIaTestar: (ia) => ipcRenderer.invoke('cortes-ia-testar', ia),
  cortesOllamaBaixar: (url, modelo) => ipcRenderer.invoke('cortes-ollama-baixar', url, modelo),
  onCortesProgresso: (cb) => ipcRenderer.on('cortes-progresso', (_e, d) => cb(d)),
  iaFrases: (opts) => ipcRenderer.invoke('ia-frases', opts),
  onCortesLink: (cb) => ipcRenderer.on('cortes-link', (_e, d) => cb(d)),
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (_) {
      return file.path || null;
    }
  }
});
