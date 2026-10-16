// Ponte entre a extensão Minerador Viral e o Editor em Massa.
// Um servidor só no seu PC (127.0.0.1) recebe a lista de vídeos escolhidos na extensão,
// baixa cada um (Instagram direto; TikTok e YouTube pelo yt-dlp) e entrega para a mesa.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const YTDLP_ASSET = { win32: 'yt-dlp.exe', darwin: 'yt-dlp_macos', linux: 'yt-dlp_linux' };
const YTDLP_URL = (a) => `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${a}`;
const ATUALIZAR_MS = 20 * 24 * 3600 * 1000; // as plataformas mudam: renova o yt-dlp a cada 20 dias

const nomeSeguro = (s, p = 'video') =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 50) || p;

// Links do YouTube aceitos na aba "Link" da extensão (vídeo, Shorts, live gravada).
function idYoutube(u) {
  try {
    const url = new URL(String(u).trim());
    const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let id = null;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (host === 'youtube.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else {
        const m = url.pathname.match(/^\/(shorts|live|embed)\/([\w-]{11})/);
        if (m) id = m[2];
      }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch (_) {
    return null;
  }
}

// Qualquer link de vídeo/áudio aceito na aba "Link": YouTube (e YouTube Music), TikTok (vídeo e
// links curtos), Instagram (reel/post/tv) e SoundCloud. Perfil não entra aqui (é na aba Minerar).
function lerLinkMidia(u) {
  const yt = idYoutube(u);
  if (yt) return { id: yt, link: `https://www.youtube.com/watch?v=${yt}`, plataforma: 'youtube' };
  try {
    const url = new URL(String(u).trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.replace(/^(www|m)\./, '');
    const p = url.pathname.split('/').filter(Boolean);
    if (host === 'tiktok.com' && /^@[\w.-]{2,32}$/.test(p[0] || '') && p[1] === 'video' && /^\d{8,25}$/.test(p[2] || ''))
      return { id: p[2], link: `https://www.tiktok.com/${p[0]}/video/${p[2]}`, plataforma: 'tiktok' };
    if ((host === 'vm.tiktok.com' || host === 'vt.tiktok.com') && p.length === 1)
      return { id: 'tt_' + p[0], link: `https://${host}/${p[0]}/`, plataforma: 'tiktok' };
    if (host === 'tiktok.com' && p[0] === 't' && /^[A-Za-z0-9]+$/.test(p[1] || ''))
      return { id: 'tt_' + p[1], link: `https://www.tiktok.com/t/${p[1]}/`, plataforma: 'tiktok' };
    if (host === 'instagram.com') {
      const k = ['p', 'reel', 'tv'].includes(p[0]) ? 0 : ['p', 'reel'].includes(p[1]) ? 1 : -1;
      const id = k >= 0 ? p[k + 1] || '' : '';
      if (k >= 0 && /^[\w-]{5,25}$/.test(id)) return { id, link: `https://www.instagram.com/${p[k]}/${id}/`, plataforma: 'instagram' };
    }
    if (host === 'soundcloud.com' && p.length >= 2 && !['discover', 'you', 'stream', 'search'].includes(p[0]))
      return { id: 'sc_' + p.join('_').slice(0, 60), link: `https://soundcloud.com/${p.join('/')}`, plataforma: 'soundcloud' };
  } catch (_) {}
  return null;
}

function criarPonte({ porta = 47811, pastaBase, ffmpeg, binDir, aoImportar = () => {}, aoCortes = null, log = () => {} }) {
  const jobs = new Map();
  let server = null;
  let ytdlpPronto = null;

  // ---------------------------------------------------------- yt-dlp sob demanda
  const ytdlpPath = () => path.join(binDir, YTDLP_ASSET[process.platform] || 'yt-dlp');
  function garantirYtdlp(job) {
    const p = ytdlpPath();
    let velho = true;
    try {
      velho = Date.now() - fs.statSync(p).mtimeMs > ATUALIZAR_MS;
    } catch (_) {}
    if (!velho) return Promise.resolve(p);
    if (!ytdlpPronto) {
      ytdlpPronto = (async () => {
        if (job) job.etapa = 'Baixando o yt-dlp (só na primeira vez)';
        fs.mkdirSync(binDir, { recursive: true });
        const r = await fetch(YTDLP_URL(YTDLP_ASSET[process.platform] || 'yt-dlp'));
        if (!r.ok) throw new Error(`Não consegui baixar o yt-dlp (${r.status})`);
        const tmp = p + '.novo';
        fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
        fs.chmodSync(tmp, 0o755);
        fs.renameSync(tmp, p);
        return p;
      })().finally(() => (ytdlpPronto = null));
    }
    return ytdlpPronto.catch((e) => {
      if (fs.existsSync(p)) return p; // sem internet pro update: usa o que já tem
      throw e;
    });
  }

  function rodarYtdlp(bin, link, saida, aoProgresso) {
    return new Promise((resolve, reject) => {
      const args = [
        link,
        '-f',
        'bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
        '--merge-output-format',
        'mp4',
        '--no-playlist',
        '--newline',
        '--no-warnings',
        '--no-mtime',
        '-o',
        saida + '.%(ext)s'
      ];
      if (ffmpeg) args.push('--ffmpeg-location', ffmpeg);
      const p = spawn(bin, args, { windowsHide: true });
      let err = '';
      const ler = (d) => {
        for (const l of String(d).split(/\r?\n/)) {
          const m = l.match(/\[download\]\s+([\d.]+)%/);
          if (m) aoProgresso(Number(m[1]) / 100);
          if (/ERROR/.test(l)) err += l + '\n';
        }
      };
      p.stdout.on('data', ler);
      p.stderr.on('data', (d) => {
        ler(d);
        err += d;
      });
      p.on('error', reject);
      p.on('close', (code) => {
        const dir = path.dirname(saida), base = path.basename(saida);
        const achado = fs.readdirSync(dir).find((f) => f.startsWith(base + '.') && /\.(mp4|mkv|webm|mov)$/i.test(f));
        if (code === 0 && achado) return resolve(path.join(dir, achado));
        const msg = (err.match(/ERROR:?\s*(.+)/) || [])[1] || `yt-dlp saiu com código ${code}`;
        reject(new Error(msg.replace(/\[[\w:]+\]\s*/g, '').slice(0, 200)));
      });
    });
  }

  // Baixa um link (vídeo, áudio ou os dois). Devolve { video, mp3 } com os caminhos que existirem.
  function rodarYtdlpLink(bin, item, pasta, qualidade, formato, aoProgresso) {
    return new Promise((resolve, reject) => {
      const h = qualidade === '720' ? 720 : 1080;
      const soMp3 = formato === 'mp3';
      const args = [item.link];
      if (soMp3) args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
      else {
        args.push('-f', `bv*[height<=${h}][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/bv*[height<=${h}]+ba/b[height<=${h}]/b`, '--merge-output-format', 'mp4');
        if (formato === 'ambos') args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0', '-k');
      }
      args.push('--no-playlist', '--match-filter', '!is_live', '--windows-filenames', '--newline', '--progress', '--no-warnings', '--no-mtime', '--encoding', 'utf-8', '-o', path.join(pasta, '%(title).80B [%(id)s].%(ext)s'));
      if (ffmpeg) args.push('--ffmpeg-location', ffmpeg);
      const inicio = Date.now();
      const p = spawn(bin, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
      let out = '', err = '', fase = 0, ultimo = 0;
      const ler = (d) => {
        for (const l of String(d).split(/\r?\n/)) {
          const m = l.match(/\[download\]\s+([\d.]+)%/);
          if (m) {
            const v = Number(m[1]) / 100;
            if (v + 0.3 < ultimo) fase = Math.min(1, fase + 1); // terminou o vídeo, começou o áudio
            ultimo = v;
            aoProgresso(fase ? 0.9 + v * 0.1 : v * 0.9);
          }
          if (/ERROR/.test(l)) err += l + '\n';
        }
      };
      p.stdout.on('data', (d) => {
        out += d;
        ler(d);
      });
      p.stderr.on('data', (d) => {
        ler(d);
        err += d;
      });
      p.on('error', reject);
      p.on('close', (code) => {
        // acha os arquivos novos na pasta (não depende do caminho impresso, que pode vir com acentos
        // trocados no Windows). A fila é de um link por vez, então "novo" = criado depois do início.
        const novos = fs
          .readdirSync(pasta)
          .map((f) => path.join(pasta, f))
          .filter((f) => {
            try {
              return fs.statSync(f).mtimeMs >= inicio - 2000;
            } catch (_) {
              return false;
            }
          })
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        const video = soMp3 ? null : novos.find((f) => /\.(mp4|mkv|webm|mov)$/i.test(f)) || null;
        const mp3 = formato === 'video' ? null : novos.find((f) => /\.mp3$/i.test(f)) || null;
        if (code === 0 && (video || mp3)) return resolve({ video, mp3 });
        const tudo = out + '\n' + err;
        if (code === 0 && /does not pass filter/i.test(tudo)) return reject(new Error('É uma live acontecendo agora: espere ela terminar para baixar'));
        if (code === 0) {
          const fim = tudo.trim().split(/\r?\n/).filter((l) => l && !/\[download\]\s+[\d.]+%/.test(l)).slice(-2).join(' | ');
          return reject(new Error('O yt-dlp terminou mas não achei o arquivo' + (fim ? ': ' + fim.slice(0, 180) : '') + ` (${Math.round((Date.now() - inicio) / 1000)} s)`));
        }
        let msg = (err.match(/ERROR:?\s*(.+)/) || [])[1] || `yt-dlp saiu com código ${code}`;
        if (item.plataforma === 'instagram' && /login|cookies|rate-limit|empty media|not available|restricted/i.test(msg)) msg = 'O Instagram pede login para esse link. Use a aba Minerar (abra o perfil logado) para baixar';
        else if (/Private video|members-only|Sign in/i.test(msg)) msg = 'Vídeo privado, só para membros ou pede login';
        else if (/unavailable/i.test(msg)) msg = 'Vídeo indisponível';
        reject(new Error(msg.replace(/\[[\w:]+\]\s*/g, '').slice(0, 200)));
      });
    });
  }

  // Fila dos links (um de cada vez: podem ser vídeos de horas).
  async function processarLinks(job, itens) {
    fs.mkdirSync(job.pasta, { recursive: true });
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      job.etapa = `Baixando ${i + 1} de ${itens.length}`;
      job.parcial = 0;
      try {
        const bin = await garantirYtdlp(job);
        job.etapa = `Baixando ${i + 1} de ${itens.length}`;
        const r = await rodarYtdlpLink(bin, it, job.pasta, job.qualidade, job.formato, (p) => (job.parcial = p));
        job.feitos++;
        job.ok.push(it.id);
        for (const f of [r.video, r.mp3]) if (f) job.arquivos.push(f);
        // só o vídeo vai para os cortes/mesa; o MP3 fica na pasta
        if (r.video) {
          if (job.destino === 'cortes' && aoCortes && it.plataforma === 'youtube') aoCortes([r.video], job);
          else aoImportar([r.video], job);
        }
      } catch (e) {
        job.falhas.push({ id: it.id, erro: e.message });
        log(`[minerador] falha no link ${it.id}: ${e.message}`);
      }
    }
    job.parcial = 0;
    job.status = job.feitos ? 'concluido' : 'erro';
    if (!job.feitos) job.erro = (job.falhas[0] && job.falhas[0].erro) || 'Nada foi baixado';
    job.etapa = 'Concluído';
    job.fim = Date.now();
  }

  async function baixarDireto(url, arquivo) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'video/mp4,video/*;q=0.9,*/*;q=0.5' } });
    if (!r.ok) throw new Error(`Link direto respondeu ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1000) throw new Error('Arquivo vazio');
    fs.writeFileSync(arquivo, buf);
    return arquivo;
  }

  // ---------------------------------------------------------- fila de downloads
  async function processar(job, itens) {
    fs.mkdirSync(job.pasta, { recursive: true });
    let i = 0;
    const parciais = new Map();
    const atualizarParcial = () => (job.parcial = [...parciais.values()].reduce((a, b) => a + b, 0));
    const worker = async () => {
      while (i < itens.length) {
        const it = itens[i++];
        const nome = `${String(it.posicao || i).padStart(3, '0')}_${nomeSeguro(job.perfil, 'perfil')}_${nomeSeguro(it.id)}`;
        const destino = path.join(job.pasta, nome);
        job.etapa = `Baixando ${nome}`;
        parciais.set(it.id, 0);
        try {
          let arquivo = null;
          if (it.video && /^https:\/\//.test(it.video)) {
            try {
              arquivo = await baixarDireto(it.video, destino + '.mp4');
            } catch (_) {
              arquivo = null; // link vencido: tenta pelo yt-dlp
            }
          }
          if (!arquivo) {
            if (!/^https:\/\/(www\.)?(instagram\.com|tiktok\.com|youtube\.com)\//.test(it.link || '')) throw new Error('Link inválido');
            const bin = await garantirYtdlp(job);
            arquivo = await rodarYtdlp(bin, it.link, destino, (p) => {
              parciais.set(it.id, p);
              atualizarParcial();
            });
          }
          job.feitos++;
          job.ok.push(it.id);
          job.arquivos.push(arquivo);
          aoImportar([arquivo], job);
        } catch (e) {
          job.falhas.push({ id: it.id, erro: e.message });
          log(`[minerador] falha ${it.id}: ${e.message}`);
        } finally {
          parciais.delete(it.id);
          atualizarParcial();
        }
      }
    };
    try {
      await Promise.all([worker(), worker()]);
      job.status = job.feitos ? 'concluido' : 'erro';
      if (!job.feitos) job.erro = (job.falhas[0] && job.falhas[0].erro) || 'Nada foi baixado';
      job.etapa = 'Concluído';
    } catch (e) {
      job.status = 'erro';
      job.erro = e.message;
    }
    job.fim = Date.now();
  }

  // ---------------------------------------------------------- HTTP
  function responder(res, code, data, origem) {
    const h = { 'Content-Type': 'application/json; charset=utf-8' };
    if (origem) {
      h['Access-Control-Allow-Origin'] = origem;
      h['Access-Control-Allow-Headers'] = 'Content-Type, X-Minerador';
      h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    }
    res.writeHead(code, h);
    res.end(JSON.stringify(data));
  }

  function lerCorpo(req) {
    return new Promise((ok, falha) => {
      let tam = 0;
      const partes = [];
      req.on('data', (c) => {
        tam += c.length;
        if (tam > 2e6) {
          falha(new Error('Pedido grande demais'));
          req.destroy();
        } else partes.push(c);
      });
      req.on('end', () => {
        try {
          ok(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'));
        } catch (_) {
          falha(new Error('JSON inválido'));
        }
      });
    });
  }

  async function tratar(req, res) {
    const origem = req.headers.origin || '';
    // Só aceita a extensão. Um site comum que tente mandar o cabeçalho X-Minerador
    // obriga o navegador a dizer de onde veio (Origin https://…), e aí é recusado.
    // A extensão manda Origin chrome-extension://… ou, em pedidos simples, nenhum Origin.
    const daExtensao = /^(chrome|moz)-extension:\/\//.test(origem);
    if (origem && !daExtensao) return responder(res, 403, { ok: false, erro: 'Só a extensão Minerador Viral pode usar esta ponte' });
    if (req.method === 'OPTIONS') return responder(res, 204, {}, origem);
    if (req.headers['x-minerador'] !== '1') return responder(res, 403, { ok: false, erro: 'Só a extensão Minerador Viral pode usar esta ponte' }, origem);
    const url = new URL(req.url, 'http://127.0.0.1');
    try {
      if (req.method === 'GET' && url.pathname === '/saude') {
        let yt = 'ausente';
        try {
          fs.accessSync(ytdlpPath());
          yt = 'pronto';
        } catch (_) {}
        return responder(res, 200, { ok: true, app: 'editor-em-massa', ytdlp: yt }, origem);
      }
      if (req.method === 'POST' && url.pathname === '/api/baixar') {
        const b = await lerCorpo(req);
        const itens = (Array.isArray(b.itens) ? b.itens : []).slice(0, 500).filter((x) => x && x.id && x.link);
        if (!itens.length) return responder(res, 400, { ok: false, erro: 'Nenhum vídeo enviado' }, origem);
        const plataforma = ['instagram', 'tiktok', 'youtube'].includes(b.plataforma) ? b.plataforma : 'video';
        const id = crypto.randomUUID();
        const job = {
          id,
          status: 'rodando',
          plataforma,
          perfil: String(b.perfil || 'perfil'),
          total: itens.length,
          feitos: 0,
          parcial: 0,
          falhas: [],
          ok: [],
          arquivos: [],
          etapa: 'Preparando',
          pasta: path.join(pastaBase, `${plataforma}_${nomeSeguro(b.perfil, 'perfil')}`),
          inicio: Date.now()
        };
        jobs.set(id, job);
        for (const [k, j] of jobs) if (j.fim && Date.now() - j.fim > 3600e3) jobs.delete(k);
        processar(job, itens);
        return responder(res, 200, { ok: true, job: id }, origem);
      }
      if (req.method === 'POST' && url.pathname === '/api/link') {
        const b = await lerCorpo(req);
        if (b.autorizado !== true) return responder(res, 400, { ok: false, erro: 'Confirme que você tem autorização para baixar e cortar esses vídeos' }, origem);
        const vistos = new Set();
        const itens = [];
        for (const l of (Array.isArray(b.links) ? b.links : []).slice(0, 50)) {
          const m = lerLinkMidia(l);
          if (!m || vistos.has(m.id)) continue;
          vistos.add(m.id);
          itens.push(m);
        }
        if (!itens.length) return responder(res, 400, { ok: false, erro: 'Nenhum link válido (aceito: vídeo do YouTube, TikTok, Instagram ou SoundCloud)' }, origem);
        const id = crypto.randomUUID();
        const job = {
          id,
          status: 'rodando',
          plataforma: 'links',
          perfil: 'links',
          destino: b.destino === 'mesa' ? 'mesa' : 'cortes',
          qualidade: b.qualidade === '720' ? '720' : '1080',
          formato: ['mp3', 'ambos'].includes(b.formato) ? b.formato : 'video',
          total: itens.length,
          feitos: 0,
          parcial: 0,
          falhas: [],
          ok: [],
          arquivos: [],
          etapa: 'Preparando',
          pasta: path.join(pastaBase, 'links'),
          inicio: Date.now()
        };
        jobs.set(id, job);
        for (const [k, j] of jobs) if (j.fim && Date.now() - j.fim > 3600e3) jobs.delete(k);
        processarLinks(job, itens);
        return responder(res, 200, { ok: true, job: id, total: itens.length }, origem);
      }
      const m = url.pathname.match(/^\/api\/jobs\/([\w-]+)$/);
      if (req.method === 'GET' && m) {
        const j = jobs.get(m[1]);
        if (!j) return responder(res, 404, { ok: false, erro: 'Download não encontrado' }, origem);
        const { arquivos, ...pub } = j;
        return responder(res, 200, { ok: true, job: pub }, origem);
      }
      return responder(res, 404, { ok: false, erro: 'Rota não encontrada' }, origem);
    } catch (e) {
      return responder(res, 500, { ok: false, erro: e.message }, origem);
    }
  }

  return {
    iniciar() {
      return new Promise((ok) => {
        server = http.createServer((req, res) => tratar(req, res));
        server.on('error', (e) => {
          log(`[minerador] ponte não iniciou: ${e.message}`);
          ok(false);
        });
        server.listen(porta, '127.0.0.1', () => ok(true));
      });
    },
    parar() {
      if (server) server.close();
    },
    _jobs: jobs
  };
}

module.exports = { criarPonte, idYoutube, lerLinkMidia };
