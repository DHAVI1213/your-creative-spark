'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { buildArgs } = require('./ffmpeg-builder');
const AI = require('./ai-upscale');

// ---------- binários do FFmpeg (vêm junto via npm; fallback para o PATH)
const unpacked = (p) => (p ? p.replace('app.asar', 'app.asar.unpacked') : p);
function resolveBin(mod, pick, fallback) {
  try {
    const p = unpacked(pick(require(mod)));
    if (p && fs.existsSync(p)) return p;
  } catch (_) {}
  return fallback;
}
const FFMPEG = resolveBin('ffmpeg-static', (m) => m, 'ffmpeg');
const FFPROBE = resolveBin('ffprobe-static', (m) => m.path, 'ffprobe');

const TMP = path.join(os.tmpdir(), 'editor-em-massa');
fs.mkdirSync(TMP, { recursive: true });
// legendas guardadas de outra vez que o app abriu não servem mais
const limparLegendas = () => {
  try {
    for (const f of fs.readdirSync(TMP)) if (f.startsWith('cap_')) fs.rmSync(path.join(TMP, f), { recursive: true, force: true });
  } catch (_) {}
};
limparLegendas();

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1560,
    height: 940,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#0b0a10',
    title: 'Editor em Massa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}
app.whenReady().then(() => {
  createWindow();
  // ponte com a extensão Minerador Viral (faz o papel do "Companion")
  const { criarPonte } = require('./minerador-ponte');
  const ffmpegDir = FFMPEG && FFMPEG !== 'ffmpeg' ? path.dirname(FFMPEG) : null;
  criarPonte({
    pastaBase: path.join(app.getPath('downloads'), 'Minerador'),
    ffmpeg: ffmpegDir,
    binDir: path.join(app.getPath('userData'), 'bin'),
    aoImportar: (arquivos, job) => send('external-import', { arquivos, perfil: job.perfil, plataforma: job.plataforma }),
    aoCortes: (arquivos) => send('cortes-link', { arquivos }),
    log: (m) => console.log(m)
  }).iniciar();
});

// ---------- Cortes Virais (transcrição local + IA + cortes)
require('./cortes').registrar({
  ipcMain,
  app,
  dialog,
  shell,
  FFMPEG,
  FFPROBE,
  TMP,
  getWin: () => win,
  send: (ch, data) => send(ch, data)
});
app.on('window-all-closed', () => {
  cancelAll();
  limparLegendas();
  app.quit();
});

const send = (ch, data) => {
  if (win && !win.isDestroyed()) win.webContents.send(ch, data);
};

// ---------- executar processos
function run(bin, args) {
  return new Promise((resolve) => {
    const p = spawn(bin, args, { windowsHide: true });
    let stdout = '', stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('error', (err) => resolve({ code: -1, stdout, stderr: String(err) }));
    p.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// ---------- diálogos
ipcMain.handle('pick-videos', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Escolher vídeos',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Vídeos', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'] }]
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('pick-file', async (_e, kind) => {
  const filters =
    kind === 'audio'
      ? [{ name: 'Áudio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] }]
      : [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }];
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('pick-folder', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Pasta de saída', properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('default-out', () => path.join(app.getPath('videos'), 'Editor em Massa'));
ipcMain.handle('open-path', (_e, p) => {
  fs.mkdirSync(p, { recursive: true });
  return shell.openPath(p);
});
ipcMain.handle('show-item', (_e, p) => shell.showItemInFolder(p));

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
ipcMain.handle('read-data-url', (_e, p) => {
  const ext = path.extname(p).slice(1).toLowerCase();
  return `data:${MIME[ext] || 'application/octet-stream'};base64,${fs.readFileSync(p).toString('base64')}`;
});

// ---------- análise dos vídeos
ipcMain.handle('probe', async (_e, file) => {
  const r = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]);
  if (r.code !== 0) throw new Error(r.stderr.trim() || 'ffprobe falhou');
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  if (!v) throw new Error('Arquivo sem faixa de vídeo');
  let w = v.width, h = v.height, rot = 0;
  if (v.tags && v.tags.rotate) rot = parseInt(v.tags.rotate, 10) || 0;
  const sd = (v.side_data_list || []).find((d) => d.rotation !== undefined);
  if (sd) rot = Number(sd.rotation) || 0;
  if (Math.abs(rot) % 180 === 90) [w, h] = [h, w];
  const [fn, fd] = String(v.r_frame_rate || '30/1').split('/').map(Number);
  return {
    duration: parseFloat((j.format && j.format.duration) || v.duration || 0),
    width: w,
    height: h,
    fps: fd ? fn / fd : 30,
    hasAudio: (j.streams || []).some((s) => s.codec_type === 'audio'),
    codec: v.codec_name
  };
});

let thumbSeq = 0;
ipcMain.handle('thumb', async (_e, file, dur) => {
  const out = path.join(TMP, `thumb_${Date.now()}_${thumbSeq++}.jpg`);
  const ss = Math.min(1, (dur || 0) / 2).toFixed(2);
  await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-ss', ss, '-i', file, '-frames:v', '1', '-vf', 'scale=480:480:force_original_aspect_ratio=increase,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-q:v', '4', '-y', out]);
  if (!fs.existsSync(out)) return null;
  const data = 'data:image/jpeg;base64,' + fs.readFileSync(out).toString('base64');
  fs.rmSync(out, { force: true });
  return data;
});

// Quadro do vídeo original num momento exato (usado para montar a capa).
ipcMain.handle('frame', async (_e, file, t, meta, s) => {
  const out = path.join(TMP, `frame_${Date.now()}_${thumbSeq++}.jpg`);
  const filters = meta && s ? require('./src/shared.js').limpezaFilters(meta, s) : [];
  await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-ss', Number(t).toFixed(3), '-i', file, '-frames:v', '1', ...(filters.length ? ['-vf', filters.join(',')] : []), '-q:v', '2', '-y', out]);
  if (!fs.existsSync(out)) return null;
  const data = 'data:image/jpeg;base64,' + fs.readFileSync(out).toString('base64');
  fs.rmSync(out, { force: true });
  return data;
});

// Prévia isolada: não entra na fila, não envia à nuvem e só escreve arquivo temporário.
ipcMain.handle('clean-preview', async (_e, file, t, meta, s) => {
  const S = require('./src/shared.js');
  const filters = S.limpezaFilters(meta, s);
  const L = S.layout(meta, s);
  filters.push('crop=' + L.cw + ':' + L.ch + ':' + L.left + ':' + L.top, 'scale=480:-2');
  const out = path.join(TMP, 'clean_' + Date.now() + '_' + thumbSeq++ + '.jpg');
  try {
    const result = await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-ss', String(Math.max(0, Number(t) || 0)), '-i', file, '-frames:v', '1', '-vf', filters.join(','), '-q:v', '2', '-y', out]);
    if (result.code !== 0 || !fs.existsSync(out)) throw new Error(result.stderr.trim() || 'Não foi possível gerar a prévia');
    return 'data:image/jpeg;base64,' + fs.readFileSync(out).toString('base64');
  } finally { fs.rmSync(out, { force: true }); }
});

// ---------- agendador (conversa com a parte da nuvem)
ipcMain.handle('cloud-config', () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'nuvem', 'config.json'), 'utf8'));
  } catch (_) {
    return null;
  }
});

async function cloudFetch(cfg, method, p, body, headers = {}) {
  const url = String(cfg.url || '').replace(/\/+$/, '') + p;
  const init = { method, headers: { authorization: 'Bearer ' + cfg.apiKey, ...headers } };
  if (body !== undefined) {
    if (Buffer.isBuffer(body)) init.body = body;
    else {
      init.body = JSON.stringify(body);
      init.headers['content-type'] = 'application/json';
    }
  }
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    return { status: 0, data: { erro: 'Sem conexão com a nuvem: ' + err.message } };
  }
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
ipcMain.handle('cloud-api', (_e, cfg, method, p, body) => cloudFetch(cfg, method, p, body));

const CT = { mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
async function uploadFile(cfg, file, key) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const buf = await fs.promises.readFile(file);
  const r = await cloudFetch(cfg, 'PUT', '/api/upload/' + encodeURIComponent(key), buf, { 'content-type': CT[ext] || 'application/octet-stream' });
  if (r.status !== 200) throw new Error(r.data.erro || `Falha no envio (${r.status})`);
}

// O Instagram só aceita foto em JPG: converte PNG/WebP antes de enviar.
async function asJpeg(file) {
  if (/\.jpe?g$/i.test(file)) return { file, tmp: null };
  const out = path.join(TMP, `conv_${Date.now()}_${thumbSeq++}.jpg`);
  const r = await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-q:v', '2', '-y', out]);
  if (r.code !== 0) throw new Error('Não consegui converter a imagem para JPG');
  return { file: out, tmp: out };
}

// Envia os arquivos de cada post e depois registra o lote na nuvem.
ipcMain.handle('cloud-send', async (_e, cfg, items) => {
  const results = [];
  const posts = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    send('cloud-progress', { i, n: items.length, nome: it.nome });
    let tmp = null;
    try {
      if (!fs.existsSync(it.path)) throw new Error('Arquivo não encontrado no PC');
      const isImg = it.mediaKind === 'image';
      let file = it.path;
      if (isImg) ({ file, tmp } = await asJpeg(it.path));
      const id = crypto.randomUUID();
      const mediaKey = `${id}.${isImg ? 'jpg' : path.extname(file).slice(1).toLowerCase() || 'mp4'}`;
      await uploadFile(cfg, file, mediaKey);
      let capaKey = null;
      if (it.capa && fs.existsSync(it.capa)) {
        capaKey = `${id}-capa.jpg`;
        await uploadFile(cfg, it.capa, capaKey);
      }
      // o arquivo sobe uma vez só e vira um post para cada conta escolhida
      for (const d of it.destinos || []) {
        posts.push({
          id: crypto.randomUUID(),
          contaId: d.contaId,
          tipo: d.tipo,
          mediaKey,
          mediaKind: it.mediaKind,
          capaKey: d.plataforma === 'instagram' ? capaKey : null,
          legenda: d.legenda !== undefined ? d.legenda : it.legenda,
          titulo: d.titulo || null,
          privacidade: d.privacidade || null,
          quando: it.quando,
          shareToFeed: it.shareToFeed,
          nome: it.nome
        });
      }
      results.push({ uid: it.uid, ok: true });
    } catch (err) {
      results.push({ uid: it.uid, ok: false, error: err.message });
    } finally {
      if (tmp) fs.rmSync(tmp, { force: true });
    }
  }
  send('cloud-progress', { i: items.length, n: items.length, nome: 'registrando agenda…' });
  if (posts.length) {
    const r = await cloudFetch(cfg, 'POST', '/api/posts', posts);
    if (r.status !== 200) {
      const msg = r.data.erro || `Falha ao registrar (${r.status})`;
      for (const res of results) if (res.ok) Object.assign(res, { ok: false, error: msg });
    }
  }
  return results;
});

ipcMain.handle('pick-media', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Escolher vídeos e fotos para agendar',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Vídeos e fotos', extensions: ['mp4', 'mov', 'm4v', 'jpg', 'jpeg', 'png', 'webp'] }]
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('open-external', (_e, url) => {
  const permitido = /^https:\/\/([\w-]+\.)*(instagram\.com|facebook\.com|cloudflare\.com|google\.com|youtube\.com|tiktok\.com|tiktokapis\.com|workers\.dev)\//;
  if (permitido.test(url)) return shell.openExternal(url);
  return false;
});

// Detecta barras pretas (letterbox) e devolve quanto cortar de cada lado.
ipcMain.handle('cropdetect', async (_e, file, dur, width, height) => {
  const ss = Math.max(0, Math.min((dur || 0) * 0.2, 3)).toFixed(2);
  const r = await run(FFMPEG, [
    '-hide_banner', '-ss', ss, '-i', file, '-t', '6',
    '-vf', 'cropdetect=limit=0.1:round=2:reset=0', '-an', '-f', 'null', '-'
  ]);
  const all = [...r.stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
  if (!all.length) return { top: 0, bottom: 0, left: 0, right: 0 };
  const [cw, ch, x, y] = all[all.length - 1].slice(1).map(Number);
  return {
    left: Math.max(0, x),
    top: Math.max(0, y),
    right: Math.max(0, width - cw - x),
    bottom: Math.max(0, height - ch - y)
  };
});

// ---------- fila de processamento
const Q = { queue: [], running: new Map(), concurrency: 2, outDir: '', reserved: new Set(), cancelled: false };
let nvencOk = null;
let hwdecOk = null;

function uniqueOut(dir, name) {
  const base = name.replace(/\.[^.]+$/, '') + '_editado';
  let p = path.join(dir, base + '.mp4');
  for (let i = 2; fs.existsSync(p) || Q.reserved.has(p); i++) p = path.join(dir, `${base} (${i}).mp4`);
  Q.reserved.add(p);
  return p;
}

function writeDataUrl(file, dataUrl) {
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

function ffmpegJob(job, paths, encoder) {
  return new Promise((resolve) => {
    const { args, outDur } = buildArgs(job, paths, encoder);
    if (Q.cancelled) return resolve({ ok: false, error: 'Cancelado' });
    send('job-progress', { id: job.id, pct: paths.ai ? 0.7 : 0, stage: 'Exportando vídeo' });
    const p = spawn(FFMPEG, args, { windowsHide: true });
    Q.running.set(job.id, p);
    let stderr = '', buf = '';
    p.stdout.on('data', (d) => {
      buf += d;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) {
        const m = line.match(/^out_time_(?:us|ms)=(\d+)/);
        if (m) send('job-progress', { id: job.id, pct: Math.min(0.99, (paths.ai ? 0.7 : 0) + (paths.ai ? 0.3 : 1) * Number(m[1]) / 1e6 / outDur), stage: 'Exportando vídeo' });
      }
    });
    p.stderr.on('data', (d) => (stderr += d));
    p.on('error', (err) => resolve({ ok: false, error: String(err) }));
    p.on('close', (code) => {
      if (code === 0) return resolve({ ok: true });
      fs.rmSync(paths.out, { force: true });
      const msg = stderr.trim().split(/\r?\n/).slice(-4).join(' | ');
      resolve({ ok: false, error: Q.cancelled ? 'Cancelado' : msg || `FFmpeg saiu com código ${code}` });
    });
  });
}

// Legenda animada: a interface manda os PNGs de cada estado da legenda e aqui vira a lista do concat.
const capDirs = new Map();
ipcMain.handle('cap-track', (_e, key, faixa) => {
  const dir = path.join(TMP, `cap_${String(key).replace(/[^\w-]/g, '')}_${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  const linhas = ['ffconcat version 1.0'];
  faixa.quadros.forEach((q, i) => {
    const nome = `q${String(i).padStart(5, '0')}.png`;
    fs.writeFileSync(path.join(dir, nome), Buffer.from(q.png));
    linhas.push(`file '${nome}'`, `duration ${Math.max(0.001, q.dur).toFixed(4)}`);
  });
  // o concat ignora a duração do último item se ele não se repetir
  if (faixa.quadros.length) linhas.push(`file 'q${String(faixa.quadros.length - 1).padStart(5, '0')}.png'`);
  const list = path.join(dir, 'lista.txt');
  fs.writeFileSync(list, linhas.join('\n') + '\n');
  capDirs.set(dir, Date.now());
  return { list, y: faixa.y0, dir };
});
const dentroTmp = (p) => typeof p === 'string' && path.resolve(p).startsWith(TMP + path.sep);
ipcMain.handle('cap-existe', (_e, list) => dentroTmp(list) && fs.existsSync(list));
ipcMain.handle('cap-apagar', (_e, dir) => {
  if (dentroTmp(dir) && path.basename(dir).startsWith('cap_')) fs.rmSync(dir, { recursive: true, force: true });
  capDirs.delete(dir);
});

async function runJob(job) {
  Q.running.set(job.id, null);
  const bg = path.join(TMP, `${job.id}_${Date.now()}_bg.png`);
  const ov = path.join(TMP, `${job.id}_${Date.now()}_ov.png`);
  const capa = job.capaData ? path.join(TMP, `${job.id}_${Date.now()}_capa.jpg`) : null;
  let out, ai;
  try {
    if (job.s.saida.superResolucaoIA) ai = await AI.prepare(job, { ffmpeg: FFMPEG, tmp: TMP, setProcess: p => Q.running.set(job.id, p), isCancelled: () => Q.cancelled, progress: (pct, stage) => send('job-progress', { id: job.id, pct, stage }) });
    writeDataUrl(bg, job.bgData);
    writeDataUrl(ov, job.ovData);
    if (capa) writeDataUrl(capa, job.capaData);
    out = uniqueOut(Q.outDir, job.name);
    const pref = job.s.saida.encoder || 'auto';
    if (Number(job.s.saida.res) === 4320 && pref === 'gpu') throw new Error('8K requer CPU ou Automático: o encoder H.264 NVIDIA pode exceder o limite da placa.');
    const tryGpu = Number(job.s.saida.res) !== 4320 && (pref === 'gpu' || (pref === 'auto' && nvencOk !== false));
    let encoder = tryGpu ? 'nvenc' : 'x264';
    const cap = job.cap && fs.existsSync(job.cap.list) ? job.cap : null;
    // com a placa NVIDIA, a decodificação do vídeo também vai para a placa (se ela aceitar)
    const hwdec = !ai && encoder === 'nvenc' && hwdecOk !== false;
    let res = await ffmpegJob(job, { bg, ov, out, capa, cap, hwdec, ai }, encoder);
    if (!res.ok && hwdec && !Q.cancelled) {
      hwdecOk = false;
      res = await ffmpegJob(job, { bg, ov, out, capa, cap, ai }, encoder);
    } else if (res.ok && hwdec) hwdecOk = true;
    if (!res.ok && tryGpu && pref === 'auto' && !Q.cancelled) {
      nvencOk = false; // sem placa NVIDIA compatível: usa CPU daqui pra frente
      encoder = 'x264';
      res = await ffmpegJob(job, { bg, ov, out, capa, cap }, encoder);
    } else if (res.ok && encoder === 'nvenc') {
      nvencOk = true;
    }
    let capaOut = null;
    if (res.ok && capa && job.s.capa.salvarJpg) {
      capaOut = out.replace(/\.mp4$/i, '_capa.jpg');
      fs.copyFileSync(capa, capaOut);
    }
    send('job-done', { id: job.id, ok: res.ok, out: res.ok ? out : null, capaOut, error: res.error || null, encoder });
  } catch (err) {
    send('job-done', { id: job.id, ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    if (ai) { try { ai.cleanup(); } catch (err) { console.error('Falha ao limpar temporários de IA:', err.message); } }
    fs.rmSync(bg, { force: true });
    fs.rmSync(ov, { force: true });
    if (capa) fs.rmSync(capa, { force: true });
    if (out) Q.reserved.delete(out);
    Q.running.delete(job.id);
    if (!Q.running.size) Q.heavy = false;
    pump();
  }
}

function pump() {
  while (!Q.cancelled && Q.running.size < Q.concurrency && Q.queue.length) {
    const heavy = job => Number(job.s.saida.res) >= 2160 || !!job.s.saida.superResolucaoIA;
    if (Q.running.size && (Q.heavy || heavy(Q.queue[0]))) break;
    Q.heavy = heavy(Q.queue[0]);
    runJob(Q.queue.shift());
    if (Q.heavy) break;
  }
  if (!Q.running.size && !Q.queue.length && !Q.aberto) send('queue-empty');
}

function cancelAll() {
  Q.cancelled = true;
  Q.aberto = false;
  for (const job of Q.queue) send('job-done', { id: job.id, ok: false, error: 'Cancelado' });
  Q.queue = [];
  for (const p of Q.running.values()) if (p) p.kill('SIGKILL');
}

ipcMain.handle('render-preflight', (_e, meta, s) => {
  AI.validate(meta, s);
  const { CW, CH } = require('./src/shared.js').canvasSize(s, meta);
  const required = CW * CH * 64 + 512 * 1024 * 1024;
  if (Number(s.saida.res) >= 2160 && os.freemem() < required) {
    throw new Error('Memória livre insuficiente para esta resolução. Feche outros programas ou escolha 2K/1080p.');
  }
  if (Number(s.saida.res) === 4320 && s.saida.encoder === 'gpu') {
    throw new Error('Para 8K, escolha CPU ou Automático.');
  }
  return true;
});

ipcMain.handle('process', (_e, jobs, opts) => {
  // aberto: a interface ainda vai mandar mais vídeos deste lote (não avisa "fila vazia" antes da hora)
  if (!Q.aberto && !Q.running.size && !Q.queue.length) Q.cancelled = false;
  if (Q.cancelled) {
    for (const job of jobs) send('job-done', { id: job.id, ok: false, error: 'Cancelado' });
    return false;
  }
  Q.aberto = !!opts.aberto;
  Q.concurrency = Math.max(1, Math.min(6, Number(opts.concurrency) || 2));
  Q.outDir = opts.outDir;
  fs.mkdirSync(Q.outDir, { recursive: true });
  Q.queue.push(...jobs);
  pump();
  return true;
});

ipcMain.handle('process-fim', () => {
  Q.aberto = false;
  pump();
  return true;
});

ipcMain.handle('cancel', () => {
  cancelAll();
  if (!Q.running.size) send('queue-empty');
  return true;
});
