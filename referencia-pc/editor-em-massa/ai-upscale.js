'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('./src/shared');
const MODEL = 'realesrgan-x4plus';
const localRoot = path.join(__dirname, 'vendor', 'realesrgan', 'runtime');
const ROOT = fs.existsSync(localRoot) ? localRoot : path.join(process.resourcesPath || __dirname, 'realesrgan');
const BIN = path.join(ROOT, 'realesrgan-ncnn-vulkan.exe');
const SCALE = 4;
function validate(meta, s) {
  if (!s.saida.superResolucaoIA) return;
  for (const file of [BIN, path.join(ROOT, 'models', MODEL + '.bin'), path.join(ROOT, 'models', MODEL + '.param')]) {
    if (!fs.existsSync(file)) throw new Error('Real-ESRGAN não encontrado. Reinstale os componentes de IA do editor.');
  }
  if (!(meta.width > 0 && meta.height > 0) || meta.width * meta.height > 1920 * 1080) {
    throw new Error('A IA aceita fontes de até 1920×1080 pixels (também verticais). Para fontes maiores, desligue a IA e use a melhoria convencional.');
  }
}
function diskCheck(dir, required) {
  const stat = fs.statfsSync(dir);
  if (stat.bavail * stat.bsize < required) throw new Error('Espaço temporário insuficiente para a IA. Libere espaço no disco do Windows ou exporte um trecho menor.');
}
async function prepare(job, opts) {
  validate(job.meta, job.s);
  const { ffmpeg, tmp, setProcess = () => {}, isCancelled = () => false, progress = () => {} } = opts;
  const check = () => { if (isCancelled()) throw new Error('Cancelado'); };
  check();
  const dir = fs.mkdtempSync(path.join(tmp, 'ai-'));
  const T = S.timing(job.meta, job.s);
  const fps = [24, 30, 60].includes(Number(job.s.saida.fps)) ? Number(job.s.saida.fps) : 30;
  const totalFrames = Math.max(1, Math.ceil(T.inDur * fps));
  const batch = 16;
  const child = (bin, args, onLine) => new Promise((resolve, reject) => {
    try { check(); } catch(e) { reject(e); return; }
    const p = spawn(bin, args, { windowsHide: true, cwd: ROOT });
    setProcess(p);
    let stderr = '', buf = '';
    p.stderr.on('data', d => { stderr = (stderr + d).slice(-8000); });
    p.stdout.on('data', d => {
      buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop();
      if (onLine) lines.forEach(onLine);
    });
    p.on('error', reject);
    p.on('close', code => {
      if (isCancelled()) reject(new Error('Cancelado'));
      else if (code !== 0) reject(new Error(stderr.trim() || `Processo de IA saiu com código ${code}`));
      else resolve();
    });
  });
  try {
    const inputDir = path.join(dir, 'in'), outputDir = path.join(dir, 'out');
    fs.mkdirSync(inputDir); fs.mkdirSync(outputDir);
    const segments = [];
    for (let offset = 0; offset < totalFrames; offset += batch) {
      check();
      diskCheck(dir, job.meta.width * job.meta.height * SCALE * SCALE * batch * 8 + 512 * 1024 * 1024);
      const count = Math.min(batch, totalFrames - offset);
      const duration = Math.min(count / fps, T.inDur - offset / fps);
      progress(0.7 * offset / totalFrames, 'Preparando quadros para IA');
      await child(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(T.start + offset / fps), '-t', String(duration), '-i', job.input,
        '-an', '-vf', `fps=${fps}`, '-frames:v', String(count), '-start_number', '0', path.join(inputDir, '%06d.png')]);
      const frames = fs.readdirSync(inputDir).filter(x => x.endsWith('.png'));
      if (!frames.length) throw new Error('Não foi possível extrair os quadros do trecho selecionado.');
      progress(0.7 * (offset + count * 0.15) / totalFrames, 'Super-resolução por IA');
      try {
        await child(BIN, ['-i', inputDir, '-o', outputDir, '-m', path.join(ROOT, 'models'), '-n', MODEL, '-s', '4', '-t', '128', '-j', '1:1:1', '-f', 'png']);
      } catch (e) {
        check();
        for (const f of fs.readdirSync(outputDir)) fs.unlinkSync(path.join(outputDir, f));
        try { await child(BIN, ['-i', inputDir, '-o', outputDir, '-m', path.join(ROOT, 'models'), '-n', MODEL, '-s', '4', '-t', '64', '-j', '1:1:1', '-f', 'png']); }
        catch (retry) { throw new Error('Falha no Real-ESRGAN. Verifique o driver Vulkan da GPU ou desligue a IA. ' + retry.message); }
      }
      if (fs.readdirSync(outputDir).filter(x => x.endsWith('.png')).length !== frames.length) throw new Error('A IA não gerou todos os quadros deste bloco.');
      const segment = `part-${segments.length}.mkv`;
      await child(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(fps), '-start_number', '0', '-i', path.join(outputDir, '%06d.png'),
        '-frames:v', String(frames.length), '-an', '-c:v', 'ffv1', '-level', '3', '-threads', '2', '-pix_fmt', 'yuv420p', path.join(dir, segment)]);
      segments.push(segment);
      for (const folder of [inputDir, outputDir]) for (const file of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder, file));
      progress(Math.min(0.7, 0.7 * (offset + count) / totalFrames), 'Super-resolução por IA');
    }
    const list = path.join(dir, 'frames.ffconcat');
    fs.writeFileSync(list, 'ffconcat version 1.0\n' + segments.map(f => `file 'file:${path.join(dir, f).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    check();
    return { list, scale: SCALE, cleanup: () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }) };
  } catch (e) { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); throw e; }
}
module.exports = { prepare, validate, diskCheck, BIN, ROOT };
