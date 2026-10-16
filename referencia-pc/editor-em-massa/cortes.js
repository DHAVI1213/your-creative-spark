// Cortes Virais: pega um vídeo longo (até 10 h), transcreve no PC com o Whisper (placa NVIDIA ou CPU),
// acha os melhores momentos com IA (Ollama local, Gemini, OpenAI/compatível, Claude ou regras sem IA)
// e corta cada momento num MP4 separado, com o texto e o tempo de cada palavra para a legenda animada.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const WHISPER_VER = 'v1.9.2';
const WHISPER_ZIP = {
  // o pacote CUDA 12 traz o cuBLAS junto (o 11.8 vem sem e o Whisper cai para a CPU sem avisar)
  gpu: `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_VER}/whisper-cublas-12.4.0-bin-x64.zip`,
  cpu: `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_VER}/whisper-bin-x64.zip`
};
const HF = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
const MODELOS = {
  turbo: { arquivo: 'ggml-large-v3-turbo.bin', dtw: 'large.v3.turbo', minBytes: 1.4e9, nome: 'Turbo (melhor, 1,6 GB)' },
  small: { arquivo: 'ggml-small.bin', dtw: 'small', minBytes: 4.0e8, nome: 'Small (rápido, 470 MB)' }
};
const PARTE_SEG = Number(process.env.EEM_PARTE_SEG) || 600; // o áudio é transcrito em partes de 10 minutos

const IA_PADRAO = {
  ollama: 'qwen2.5:14b',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  claude: 'claude-haiku-5-5'
};

const TIPOS = {
  auto: 'Descubra sozinho o tipo de conteúdo.',
  podcast: 'Podcast/conversa: procure opiniões fortes, histórias pessoais, revelações, momentos engraçados e debates.',
  motivacao: 'Vídeo motivacional: procure frases de impacto, superação, disciplina, mentalidade e chamadas para ação.',
  palestra: 'Palestra/pregação: procure ensinamentos claros, insights, histórias que ilustram e frases memoráveis.',
  entrevista: 'Entrevista: procure respostas marcantes, revelações e opiniões polêmicas do entrevistado.',
  aula: 'Aula/curso: procure dicas práticas, explicações rápidas que resolvem um problema e "você está fazendo errado".',
  humor: 'Humor: procure piadas completas com preparação e punchline, reações e momentos absurdos.'
};

// ------------------------------------------------------------ utilidades
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const mmss = (t) => {
  t = Math.max(0, Math.floor(t));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
};
const nomeSeguro = (s, p = 'corte') =>
  String(s || '')
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 60) || p;
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function acharArquivo(dir, nome) {
  if (!fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const r = acharArquivo(p, nome);
      if (r) return r;
    } else if (e.name.toLowerCase() === nome.toLowerCase()) return p;
  }
  return null;
}

function registrar(ctx) {
  const { ipcMain, app, dialog, shell, FFMPEG, FFPROBE, getWin } = ctx;
  const send = (d) => ctx.send('cortes-progresso', d);
  const BASE = app.getPath('userData');
  const BIN = path.join(BASE, 'bin');
  const MODEL_DIR = path.join(BASE, 'modelos');
  const CACHE = path.join(BASE, 'cortes-cache');
  for (const d of [BIN, MODEL_DIR, CACHE]) fs.mkdirSync(d, { recursive: true });

  const job = { ativo: false, cancel: false, procs: new Set() };
  const checar = () => {
    if (job.cancel) throw new Error('Cancelado');
  };

  // ---------------------------------------------------------- processos
  function rodar(bin, args, { onOut, onErr } = {}) {
    return new Promise((resolve) => {
      let p;
      try {
        p = spawn(bin, args, { windowsHide: true });
      } catch (err) {
        return resolve({ code: -1, stdout: '', stderr: String(err) });
      }
      job.procs.add(p);
      let stdout = '', stderr = '';
      p.stdout.on('data', (d) => {
        stdout += d;
        if (stdout.length > 4e6) stdout = stdout.slice(-2e6);
        if (onOut) onOut(String(d));
      });
      p.stderr.on('data', (d) => {
        stderr += d;
        if (stderr.length > 2e6) stderr = stderr.slice(-1e6);
        if (onErr) onErr(String(d));
      });
      p.on('error', (err) => {
        job.procs.delete(p);
        resolve({ code: -1, stdout, stderr: stderr + String(err) });
      });
      p.on('close', (code) => {
        job.procs.delete(p);
        resolve({ code, stdout, stderr });
      });
    });
  }

  // ---------------------------------------------------------- downloads (Whisper e modelos)
  async function baixar(url, destino, aoProgresso) {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok || !r.body) throw new Error(`Download falhou (${r.status}) em ${url}`);
    const total = Number(r.headers.get('content-length')) || 0;
    const tmp = destino + '.parte';
    const ws = fs.createWriteStream(tmp);
    const reader = r.body.getReader();
    let got = 0, ultimo = 0;
    try {
      for (;;) {
        if (job.cancel) {
          reader.cancel().catch(() => {});
          throw new Error('Cancelado');
        }
        const { done, value } = await reader.read();
        if (done) break;
        got += value.length;
        if (!ws.write(Buffer.from(value))) await new Promise((res) => ws.once('drain', res));
        if (Date.now() - ultimo > 300) {
          ultimo = Date.now();
          aoProgresso(total ? got / total : 0, got, total);
        }
      }
      await new Promise((res, rej) => ws.end((e) => (e ? rej(e) : res())));
    } catch (err) {
      ws.destroy();
      fs.rmSync(tmp, { force: true });
      throw err;
    }
    fs.renameSync(tmp, destino);
    return destino;
  }
  const mb = (b) => (b / 1048576).toFixed(0) + ' MB';

  async function extrairZip(zip, dir) {
    fs.mkdirSync(dir, { recursive: true });
    let r = await rodar('tar', ['-xf', zip, '-C', dir]);
    if (r.code !== 0) {
      r = await rodar('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`]);
    }
    if (r.code !== 0) throw new Error('Não consegui descompactar o Whisper: ' + r.stderr.slice(-300));
  }

  async function garantirWhisper(tipo) {
    if (process.platform !== 'win32') {
      const r = await rodar('whisper-cli', ['-h']);
      if (r.code === -1) throw new Error('Instale o whisper.cpp (whisper-cli) no PATH para usar fora do Windows.');
      return 'whisper-cli';
    }
    const dir = path.join(BIN, tipo === 'gpu' ? 'whisper-gpu12' : 'whisper-cpu');
    // versão antiga (CUDA 11.8 sem cuBLAS): apaga para liberar espaço
    fs.rmSync(path.join(BIN, 'whisper-gpu'), { recursive: true, force: true });
    let exe = acharArquivo(dir, 'whisper-cli.exe');
    if (exe && (tipo !== 'gpu' || acharArquivo(dir, 'cublas64_12.dll'))) return exe;
    const zip = path.join(BIN, `whisper-${tipo}.zip`);
    const rotulo = tipo === 'gpu' ? 'Whisper para placa NVIDIA' : 'Whisper (CPU)';
    await baixar(WHISPER_ZIP[tipo], zip, (p, got, total) =>
      send({ etapa: 'preparar', pct: p, msg: `Baixando o ${rotulo} (só na primeira vez) · ${mb(got)}${total ? ' de ' + mb(total) : ''}` })
    );
    send({ etapa: 'preparar', pct: 1, msg: `Instalando o ${rotulo}…` });
    fs.rmSync(dir, { recursive: true, force: true });
    await extrairZip(zip, dir);
    fs.rmSync(zip, { force: true });
    exe = acharArquivo(dir, 'whisper-cli.exe');
    if (!exe) throw new Error('O pacote do Whisper veio sem o whisper-cli.exe');
    return exe;
  }

  async function garantirModelo(chave) {
    const m = MODELOS[chave] || MODELOS.turbo;
    const destino = path.join(MODEL_DIR, m.arquivo);
    if (fs.existsSync(destino) && fs.statSync(destino).size >= m.minBytes) return { arquivo: destino, dtw: m.dtw };
    await baixar(HF + m.arquivo, destino, (p, got, total) =>
      send({ etapa: 'preparar', pct: p, msg: `Baixando o modelo de transcrição ${m.nome} (só na primeira vez) · ${mb(got)}${total ? ' de ' + mb(total) : ''}` })
    );
    if (fs.statSync(destino).size < m.minBytes) {
      fs.rmSync(destino, { force: true });
      throw new Error('O modelo baixou incompleto. Tente de novo.');
    }
    return { arquivo: destino, dtw: m.dtw };
  }

  // ---------------------------------------------------------- vídeo
  async function sondar(arquivo) {
    const r = await rodar(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', arquivo]);
    if (r.code !== 0) throw new Error('Não consegui ler o vídeo');
    const j = JSON.parse(r.stdout);
    const v = (j.streams || []).find((s) => s.codec_type === 'video');
    return {
      duracao: parseFloat((j.format && j.format.duration) || 0),
      largura: v ? v.width : 0,
      altura: v ? v.height : 0,
      temAudio: (j.streams || []).some((s) => s.codec_type === 'audio'),
      temVideo: !!v
    };
  }

  function chaveCache(arquivo, idioma, modelo) {
    const st = fs.statSync(arquivo);
    return crypto.createHash('sha1').update([path.resolve(arquivo).toLowerCase(), st.size, Math.round(st.mtimeMs), idioma, modelo].join('|')).digest('hex').slice(0, 16);
  }

  // Tamanho exato (em segundos) de um WAV PCM 16 bits mono 16 kHz pelo cabeçalho.
  function duracaoWav(arquivo) {
    const fd = fs.openSync(arquivo, 'r');
    try {
      const buf = Buffer.alloc(4096);
      const n = fs.readSync(fd, buf, 0, 4096, 0);
      let pos = 12;
      while (pos + 8 <= n) {
        const id = buf.toString('ascii', pos, pos + 4);
        const tam = buf.readUInt32LE(pos + 4);
        if (id === 'data') {
          const real = fs.statSync(arquivo).size - (pos + 8);
          return Math.min(tam || real, real) / 32000;
        }
        pos += 8 + tam + (tam % 2);
      }
    } finally {
      fs.closeSync(fd);
    }
    return Math.max(0, (fs.statSync(arquivo).size - 44) / 32000);
  }

  // Volume (dB) por segundo: ajuda a achar momentos de mais energia (risadas, gritos, ênfase).
  function energiaWav(arquivo) {
    const buf = fs.readFileSync(arquivo);
    let ini = buf.indexOf('data') + 8;
    if (ini < 8) ini = 44;
    const out = [];
    for (let p = ini; p + 32000 <= buf.length; p += 32000) {
      let soma = 0;
      for (let i = p; i < p + 32000; i += 8) {
        const x = buf.readInt16LE(i) / 32768;
        soma += x * x;
      }
      out.push(Math.round(10 * Math.log10(soma / 4000 + 1e-9) * 10) / 10);
    }
    return out;
  }

  async function extrairAudio(arquivo, dir, duracao, aoProgresso) {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) if (/^parte_\d+\.wav$/.test(f)) fs.rmSync(path.join(dir, f), { force: true });
    let buf = '';
    const r = await rodar(
      FFMPEG,
      ['-y', '-hide_banner', '-nostdin', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats', '-i', arquivo, '-vn', '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
        '-f', 'segment', '-segment_time', String(PARTE_SEG), '-reset_timestamps', '1', path.join(dir, 'parte_%03d.wav')],
      {
        onOut: (d) => {
          buf += d;
          const ls = buf.split(/\r?\n/);
          buf = ls.pop();
          for (const l of ls) {
            const m = l.match(/^out_time_(?:us|ms)=(\d+)/);
            if (m && duracao) aoProgresso(Math.min(1, Number(m[1]) / 1e6 / duracao));
          }
        }
      }
    );
    checar();
    if (r.code !== 0) throw new Error('Falha ao extrair o áudio: ' + r.stderr.trim().split(/\r?\n/).slice(-2).join(' '));
    return fs.readdirSync(dir).filter((f) => /^parte_\d+\.wav$/.test(f)).sort().map((f) => path.join(dir, f));
  }

  // ---------------------------------------------------------- Whisper
  // Junta os tokens do whisper.cpp em palavras com início/fim (o -dtw dá o tempo de cada token).
  function lerTranscricao(jsonPath, offset) {
    // o JSON do whisper.cpp pode cortar letras acentuadas entre dois tokens: lê como bytes (latin1)
    // e só converte para UTF-8 depois de juntar a palavra inteira
    const raw = fs.readFileSync(jsonPath).toString('latin1');
    const j = JSON.parse(raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' '));
    const brutas = [];
    let cur = null;
    const textos = [];
    for (const seg of j.transcription || []) {
      const txt = semAcento(Buffer.from(seg.text || '', 'latin1').toString('utf8')).replace(/\W+/g, ' ').trim();
      // alucinação típica: a mesma frase repetida em sequência
      if (txt && textos.length >= 2 && textos[textos.length - 1] === txt && textos[textos.length - 2] === txt) continue;
      textos.push(txt);
      for (const tk of seg.tokens || []) {
        const tx = tk.text || '';
        if (!tx || /^\[_/.test(tx) || /^<\|/.test(tx)) continue;
        const t0 = (tk.offsets ? tk.offsets.from : 0) / 1000;
        const t1 = (tk.offsets ? tk.offsets.to : 0) / 1000;
        const dtw = typeof tk.t_dtw === 'number' && tk.t_dtw >= 0 ? tk.t_dtw / 100 : null;
        if (tx.startsWith(' ') || !cur) {
          if (cur) brutas.push(cur);
          cur = { raw: tx.replace(/^ +/, ''), s: dtw !== null ? dtw : t0, t1 };
        } else {
          cur.raw += tx;
          cur.t1 = t1;
        }
      }
    }
    if (cur) brutas.push(cur);
    const words = [];
    for (const b of brutas) {
      const w = Buffer.from(b.raw, 'latin1').toString('utf8').replace(/\uFFFD/g, '').trim();
      if (!w || /^[\s.,!?…-]+$/.test(w)) {
        if (w && words.length) words[words.length - 1].w += w.trim();
        continue;
      }
      words.push({ w, s: b.s, t1: b.t1 });
    }
    // garante ordem e define o fim de cada palavra
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (i && w.s < words[i - 1].s + 0.02) w.s = words[i - 1].s + 0.02;
    }
    for (let i = 0; i < words.length; i++) {
      const w = words[i], nx = words[i + 1];
      const est = Math.min(1.2, 0.14 + 0.065 * w.w.length);
      let e = w.s + est;
      if (nx) {
        if (nx.s < e || nx.s - e < 0.3) e = nx.s;
      }
      w.e = Math.max(w.s + 0.06, e);
      delete w.t1;
      w.s = Math.round((w.s + offset) * 1000) / 1000;
      w.e = Math.round((w.e + offset) * 1000) / 1000;
    }
    return words;
  }

  async function transcreverParte(exe, modelo, wav, idioma, aoProgresso) {
    const base = wav.replace(/\.wav$/i, '');
    fs.rmSync(base + '.json', { force: true });
    const threads = Math.max(2, Math.min(8, os.cpus().length - 2));
    // -bs 1: decodificação gulosa (bem mais rápida que o beam search, quase a mesma qualidade)
    const args = ['-m', modelo.arquivo, '-f', wav, '-l', idioma || 'pt', '-ojf', '-of', base, '-pp', '-t', String(threads), '-bs', '1', '-dtw', modelo.dtw, '-nfa'];
    let gpu = null;
    const r = await rodar(exe, args, {
      onErr: (d) => {
        const t = String(d);
        if (/using CUDA\d* backend/i.test(t)) gpu = true;
        else if (/no GPU found/i.test(t) && gpu === null) gpu = false;
        const m = [...t.matchAll(/progress\s*=\s*(\d+)%/g)].pop();
        if (m) aoProgresso(Number(m[1]) / 100);
      }
    });
    transcreverParte.gpu = gpu;
    checar();
    if (r.code !== 0 || !fs.existsSync(base + '.json')) {
      const msg = (r.stderr || '').trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ');
      const e = new Error('O Whisper falhou: ' + (msg || `código ${r.code}`));
      e.whisper = true;
      throw e;
    }
    return base + '.json';
  }

  // Transcreve um arquivo inteiro (com cache: rodar de novo no mesmo vídeo é instantâneo).
  async function transcrever(arquivo, opts, prog) {
    const info = await sondar(arquivo);
    if (!info.temAudio) throw new Error('Esse vídeo não tem áudio para transcrever.');
    const idioma = opts.idioma || 'pt';
    const modeloKey = MODELOS[opts.modelo] ? opts.modelo : 'turbo';
    const dir = path.join(CACHE, chaveCache(arquivo, idioma, modeloKey));
    const final = path.join(dir, 'transcricao.json');
    if (fs.existsSync(final)) {
      try {
        const t = JSON.parse(fs.readFileSync(final, 'utf8'));
        if (t && t.words) {
          prog('transcrever', 1, 'Transcrição já feita antes (usando a salva)');
          return { ...t, info };
        }
      } catch (_) {}
    }
    fs.mkdirSync(dir, { recursive: true });

    // 1) Whisper e modelo
    let tipo = opts.placa === 'cpu' || process.platform !== 'win32' ? 'cpu' : 'gpu';
    prog('preparar', 0, 'Preparando o Whisper…');
    let exe = await garantirWhisper(tipo);
    const modelo = await garantirModelo(modeloKey);
    checar();
    prog('preparar', 1, 'Whisper pronto');

    // 2) áudio em partes de 10 min
    // partes.json só é gravado quando a extração termina inteira (marca que dá para retomar)
    const mapaPath = path.join(dir, 'partes.json');
    let mapa = null;
    try {
      mapa = JSON.parse(fs.readFileSync(mapaPath, 'utf8'));
    } catch (_) {}
    if (!mapa || !mapa.length) {
      for (const f of fs.readdirSync(dir)) if (/^parte_\d+\.words\.json$/.test(f)) fs.rmSync(path.join(dir, f), { force: true });
      prog('audio', 0, 'Extraindo o áudio do vídeo…');
      const partes = await extrairAudio(arquivo, dir, info.duracao, (p) => prog('audio', p, `Extraindo o áudio… ${Math.round(p * 100)}%`));
      mapa = partes.map((p) => ({ nome: path.basename(p), dur: duracaoWav(p) })).filter((p) => p.dur > 0.2);
      if (!mapa.length) throw new Error('Não consegui tirar o áudio desse vídeo.');
      fs.writeFileSync(mapaPath, JSON.stringify(mapa));
    }
    prog('audio', 1, 'Áudio pronto');

    // 3) transcrição parte por parte (retoma de onde parou se foi cancelado)
    const words = [];
    const energia = [];
    let offset = 0;
    const t0 = Date.now();
    let feitoSeg = 0;
    let avisouCpu = false;
    const totalSeg = mapa.reduce((a, p) => a + p.dur, 0) || info.duracao;
    for (let i = 0; i < mapa.length; i++) {
      checar();
      const nome = mapa[i].nome;
      const wav = path.join(dir, nome);
      const cacheW = path.join(dir, nome.replace(/\.wav$/, '.words.json'));
      let parte = null;
      if (fs.existsSync(cacheW)) {
        try {
          parte = JSON.parse(fs.readFileSync(cacheW, 'utf8'));
        } catch (_) {}
      }
      if (!parte) {
        if (!fs.existsSync(wav)) throw new Error('Parte do áudio sumiu do cache. Rode de novo.');
        const txt = (p) => {
          const feito = feitoSeg + p * mapa[i].dur;
          const decorrido = (Date.now() - t0) / 1000;
          let eta = '';
          if (feito > 30 && decorrido > 5) {
            const resta = ((totalSeg - feito) * decorrido) / feito;
            eta = ` · falta ~${resta > 90 ? Math.round(resta / 60) + ' min' : Math.round(resta) + ' s'}`;
          }
          prog('transcrever', feito / totalSeg, `Transcrevendo parte ${i + 1} de ${mapa.length} (${mmss(offset)} de ${mmss(totalSeg)})${eta}`);
        };
        txt(0);
        let jsonPath;
        try {
          jsonPath = await transcreverParte(exe, modelo, wav, idioma, txt);
        } catch (err) {
          // placa sem CUDA/driver: troca para a versão CPU uma vez e segue
          if (err.whisper && tipo === 'gpu' && opts.placa !== 'gpu' && !job.cancel) {
            tipo = 'cpu';
            prog('transcrever', feitoSeg / totalSeg, 'A placa não rodou o Whisper GPU. Usando a CPU (mais lento)…');
            exe = await garantirWhisper('cpu');
            jsonPath = await transcreverParte(exe, modelo, wav, idioma, txt);
          } else throw err;
        }
        if (tipo === 'gpu' && transcreverParte.gpu === false && !avisouCpu) {
          avisouCpu = true;
          send({ origem: 'aviso', msg: 'O Whisper não achou a placa NVIDIA e está usando a CPU (bem mais lento). Atualize o driver da NVIDIA (versão 551 ou mais nova) e abra o app de novo.' });
        }
        parte = { words: lerTranscricao(jsonPath, 0), energia: energiaWav(wav) };
        fs.writeFileSync(cacheW, JSON.stringify(parte));
        fs.rmSync(jsonPath, { force: true });
      }
      for (const w of parte.words) words.push({ w: w.w, s: Math.round((w.s + offset) * 1000) / 1000, e: Math.round((w.e + offset) * 1000) / 1000 });
      for (const v of parte.energia || []) energia.push(v);
      offset += mapa[i].dur;
      feitoSeg += mapa[i].dur;
      if (opts.aoParte) opts.aoParte(words, offset);
      prog('transcrever', feitoSeg / totalSeg, `Transcrito ${mmss(feitoSeg)} de ${mmss(totalSeg)}`);
    }
    const t = { words, energia, duracao: info.duracao };
    fs.writeFileSync(final, JSON.stringify(t));
    // libera espaço: os WAVs só servem para transcrever
    for (const f of fs.readdirSync(dir)) if (/\.wav$/.test(f)) fs.rmSync(path.join(dir, f), { force: true });
    prog('transcrever', 1, `Transcrição pronta · ${words.length} palavras`);
    return { ...t, info };
  }

  // ---------------------------------------------------------- frases
  function frases(words) {
    const out = [];
    let ini = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i], nx = words[i + 1];
      const fim = !nx || /[.!?…]["”]?$/.test(w.w) || nx.s - w.e > 1.0 || i - ini >= 34;
      if (fim) {
        const ws = words.slice(ini, i + 1);
        out.push({ id: out.length, s: ws[0].s, e: ws[ws.length - 1].e, w0: ini, w1: i, texto: ws.map((x) => x.w).join(' ') });
        ini = i + 1;
      }
    }
    return out;
  }

  // Ajusta um trecho (frase a até frase b) para caber entre min e max segundos.
  function ajustar(F, words, a, b, min, max) {
    a = Math.max(0, Math.min(a, F.length - 1));
    b = Math.max(a, Math.min(b, F.length - 1));
    while (b > a && F[b].e - F[a].s > max) b--;
    while (F[b].e - F[a].s < min && b + 1 < F.length && F[b + 1].e - F[a].s <= max && F[b + 1].s - F[b].e < 2.5) b++;
    let s = F[a].s;
    let e = F[b].e;
    if (e - s > max) {
      // uma frase só já passa do máximo: corta na última palavra que cabe (de preferência numa vírgula)
      let ultima = null, virgula = null;
      for (let i = F[a].w0; i <= F[b].w1 && words[i].e - s <= max; i++) {
        ultima = words[i];
        if (/[,;:]$/.test(words[i].w)) virgula = words[i];
      }
      if (virgula && virgula.e - s >= max * 0.7) e = virgula.e;
      else if (ultima) e = ultima.e;
    }
    if (e - s < Math.min(min * 0.6, max)) return null;
    const prox = F[b + 1];
    const cauda = prox ? Math.max(0, Math.min(0.4, prox.s - e - 0.03)) : 0.4;
    return { a, b, s: Math.max(0, s - 0.12), e: e + cauda };
  }

  // ---------------------------------------------------------- sem IA: regras de "potencial viral"
  const GANCHOS = /\b(segredo|verdade|ninguem|nunca|sempre|a maioria|o problema|o maior|o pior|o melhor|voce precisa|voce nao|para de|pare de|o que ninguem|eu descobri|a real|presta atencao|escuta|olha so|imagina|sabe por que|por que|como eu|eu perdi|eu ganhei|milhoes|milhao|morri|morreu|erro|mentira|absurdo|incrivel|deus|dinheiro|rico|pobre|fracasso|sucesso)\b/;
  const FRACOS = /^(entao|e ai|tipo|ne|bom|beleza|enfim|e |mas |ai |e entao|ok|certo|uhum|hum|ah|eh)\b/;
  function notaRegra(F, words, energia, c, mediana) {
    const ws = words.slice(F[c.a].w0, F[c.b].w1 + 1);
    const primeira = semAcento(F[c.a].texto);
    const tudo = semAcento(ws.map((w) => w.w).join(' '));
    let n = 40;
    if (GANCHOS.test(primeira)) n += 18;
    if (/\?/.test(F[c.a].texto)) n += 8;
    if (FRACOS.test(primeira)) n -= 14;
    const fortes = (tudo.match(new RegExp(GANCHOS.source, 'g')) || []).length;
    n += Math.min(16, fortes * 3);
    if (/\d/.test(tudo)) n += 4;
    if (/!/.test(ws.map((w) => w.w).join(' '))) n += 4;
    const dur = c.e - c.s;
    const ritmo = ws.length / Math.max(1, dur);
    if (ritmo >= 2.2 && ritmo <= 4.2) n += 8;
    else if (ritmo < 1.5) n -= 10;
    if (energia && energia.length) {
      const seg = energia.slice(Math.floor(c.s), Math.ceil(c.e));
      if (seg.length) {
        const media = seg.reduce((a, b) => a + b, 0) / seg.length;
        const desvio = Math.sqrt(seg.reduce((a, b) => a + (b - media) ** 2, 0) / seg.length);
        n += Math.max(-10, Math.min(12, (media - mediana) * 1.5));
        n += Math.min(6, desvio);
      }
    }
    return Math.max(5, Math.min(95, Math.round(n)));
  }
  function candidatosRegra(F, words, energia, min, max) {
    const ord = (energia || []).slice().sort((a, b) => a - b);
    const mediana = ord.length ? ord[Math.floor(ord.length / 2)] : 0;
    const out = [];
    for (let a = 0; a < F.length; a++) {
      let b = a;
      while (b + 1 < F.length && F[b + 1].e - F[a].s <= (min + max) / 2) b++;
      const c = ajustar(F, words, a, b, min, max);
      if (!c) continue;
      const nota = notaRegra(F, words, energia, c, mediana);
      const titulo = F[c.a].texto.split(/\s+/).slice(0, 8).join(' ').replace(/[,.;:]+$/, '');
      out.push({ ...c, nota, titulo, gancho: 'Escolhido pelas regras (sem IA)', descricao: '', emojis: [], origem: 'regras' });
    }
    return out;
  }

  // ---------------------------------------------------------- IA
  function extrairJSON(txt) {
    let t = String(txt || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    return JSON.parse(t);
  }

  async function chamarIA(ia, sistema, usuario, limiteMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), limiteMs);
    const vigia = setInterval(() => job.cancel && ctrl.abort(), 300);
    try {
      const modelo = (ia.modelo || '').trim() || IA_PADRAO[ia.provedor];
      let r, j;
      if (ia.provedor === 'ollama') {
        const url = (ia.url || 'http://127.0.0.1:11434').replace(/\/+$/, '');
        r = await fetch(url + '/api/chat', {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: modelo,
            stream: false,
            format: 'json',
            think: false,
            options: { temperature: 0.4, num_ctx: 16384 },
            messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }]
          })
        });
        j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `Ollama respondeu ${r.status}`);
        return (j.message && j.message.content) || '';
      }
      if (ia.provedor === 'gemini') {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': ia.chave || '' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sistema }] },
            contents: [{ role: 'user', parts: [{ text: usuario }] }],
            generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
          })
        });
        j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j.error && j.error.message) || `Gemini respondeu ${r.status}`);
        const c = j.candidates && j.candidates[0];
        return ((c && c.content && c.content.parts) || []).map((p) => p.text || '').join('');
      }
      if (ia.provedor === 'openai') {
        const base = (ia.url || 'https://api.openai.com/v1').replace(/\/+$/, '');
        r = await fetch(base + '/chat/completions', {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (ia.chave || '') },
          body: JSON.stringify({
            model: modelo,
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }]
          })
        });
        j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j.error && j.error.message) || `A API respondeu ${r.status}`);
        return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      }
      if (ia.provedor === 'claude') {
        r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'content-type': 'application/json', 'x-api-key': ia.chave || '', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: modelo, max_tokens: 4096, temperature: 0.4, system: sistema, messages: [{ role: 'user', content: usuario }] })
        });
        j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j.error && j.error.message) || `Claude respondeu ${r.status}`);
        return (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      }
      throw new Error('Escolha um motor de IA');
    } catch (err) {
      if (job.cancel) throw new Error('Cancelado');
      if (err.name === 'AbortError') throw new Error('A IA demorou demais para responder');
      if (/fetch failed|ECONNREFUSED/i.test(String(err.message)) && ia.provedor === 'ollama') throw new Error('O Ollama não está aberto. Abra o Ollama e tente de novo.');
      throw err;
    } finally {
      clearTimeout(timer);
      clearInterval(vigia);
    }
  }

  const SISTEMA = `Você é um editor profissional de cortes virais para Reels, TikTok e YouTube Shorts, especialista em podcasts, vídeos motivacionais e palestras.
Seu trabalho é ler a transcrição e escolher os trechos com mais chance de viralizar quando postados sozinhos.
Responda SEMPRE e SOMENTE com JSON válido, sem texto antes ou depois.`;

  function promptJanela(F, i0, i1, k, opts) {
    const linhas = [];
    for (let i = i0; i <= i1; i++) linhas.push(`#${F[i].id} [${mmss(F[i].s)}] ${F[i].texto.slice(0, 400)}`);
    return `Tipo de conteúdo: ${TIPOS[opts.tipo] || TIPOS.auto}
${opts.instrucoes ? 'Pedido do editor: ' + opts.instrucoes + '\n' : ''}
Abaixo está um trecho da transcrição (de ${mmss(F[i0].s)} até ${mmss(F[i1].e)} do vídeo). Cada linha é uma frase no formato: #ID [minuto:segundo] texto.

Encontre até ${k} momentos que dariam os MELHORES cortes virais.
Regras:
- Cada corte deve ter entre ${opts.min} e ${opts.max} segundos. Use os tempos [minuto:segundo] para calcular.
- O corte deve começar numa frase que prenda nos primeiros 3 segundos: afirmação forte ou polêmica, pergunta, número, começo de história ou revelação. Não comece com "então", "e aí", cumprimentos ou contexto morno.
- O corte precisa fazer sentido sozinho, sem o resto do vídeo, e terminar fechando a ideia (conclusão, punchline ou frase de impacto). Não termine no meio de um raciocínio.
- Prefira: frases de impacto, conselhos práticos, histórias pessoais, momentos engraçados, emoção forte, opiniões polêmicas, dados surpreendentes.
- Evite: propaganda/patrocínio, cumprimentos, avisos, partes confusas ou que dependem de imagem.
- Os cortes não podem se sobrepor.
- Dê uma nota de 0 a 100 de potencial viral. Seja exigente: 90 ou mais só para algo realmente forte.
- Escreva título e descrição no mesmo idioma da transcrição.

Formato da resposta:
{"cortes":[{"inicio":ID_da_primeira_frase,"fim":ID_da_ultima_frase,"nota":85,"titulo":"título curto e chamativo para escrever na tela (até 8 palavras)","gancho":"em uma frase, por que esse trecho prende","descricao":"legenda para o post, com 3 a 5 hashtags no final","emojis":[{"palavra":"palavra que aparece no trecho","emoji":"🔥"}]}]}
Use de 2 a 5 emojis por corte, ligados a palavras importantes que são ditas no trecho.
Se nada neste trecho for bom, responda {"cortes":[]}.

TRANSCRIÇÃO:
${linhas.join('\n')}`;
  }

  // Agenda da IA: analisa cada trecho de ~15 min assim que a transcrição dele fica pronta
  // (não espera o vídeo inteiro) e manda 2–3 trechos ao mesmo tempo para a IA.
  function criarAgendaIA(opts, duracao) {
    const janelaSeg = Number(process.env.EEM_JANELA) || (opts.ia.provedor === 'ollama' ? 900 : 1500);
    const passo = janelaSeg - 60; // volta ~1 min para não perder momentos na emenda
    const nJanelas = Math.max(1, Math.ceil(Math.max(1, duracao - 60) / passo));
    const k = Math.max(2, Math.min(10, Math.ceil((opts.quantidade * 2.5) / nJanelas)));
    const limite = opts.ia.provedor === 'ollama' ? 15 * 60e3 : 4 * 60e3;
    const paralelo = opts.ia.provedor === 'ollama' ? 2 : 3;
    const out = [];
    const fila = [];
    let enviadas = 0, feitas = 0, falhas = 0, rodando = 0, ultimoErro = '', erroFatal = null, fim = false;
    let words = [], F = [];
    const dormindo = [];
    // espera trabalho novo (ou 1 s, para notar cancelamento e o fim)
    const esperar = () => Promise.race([new Promise((r) => dormindo.push(r)), pausa(1000)]);
    const cutucar = () => {
      while (dormindo.length) dormindo.shift()();
    };

    async function analisar(jan) {
      const { F: Fj, words: Wj, i0, i1, n } = jan;
      let resp = null;
      for (let tentativa = 0; tentativa < 2 && !resp; tentativa++) {
        try {
          const txt = await chamarIA(opts.ia, SISTEMA, promptJanela(Fj, i0, i1, k, opts), limite);
          resp = extrairJSON(txt);
        } catch (err) {
          if (job.cancel) throw err;
          ultimoErro = err.message;
          if (/chave|key|401|403|permission|não está aberto|not found|não encontrado/i.test(err.message) && n === 0) throw err;
          await pausa(1500);
        }
      }
      if (!resp) {
        falhas++;
        return;
      }
      for (const c of (resp.cortes || resp.clips || []).slice(0, k + 2)) {
        const a = parseInt(c.inicio, 10), b = parseInt(c.fim, 10);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a < i0 - 2 || b > i1 + 2 || !Fj[Math.min(a, b)] || !Fj[Math.max(a, b)]) continue;
        const aj = ajustar(Fj, Wj, Math.min(a, b), Math.max(a, b), opts.min, opts.max);
        if (!aj) continue;
        out.push({
          ...aj,
          sA: Fj[aj.a].s,
          eB: Fj[aj.b].e,
          nota: Math.max(0, Math.min(100, Number(c.nota) || 50)),
          titulo: String(c.titulo || '').trim().slice(0, 90) || Fj[aj.a].texto.split(/\s+/).slice(0, 8).join(' '),
          gancho: String(c.gancho || '').trim().slice(0, 200),
          descricao: String(c.descricao || '').trim().slice(0, 2200),
          emojis: Array.isArray(c.emojis) ? c.emojis.filter((e) => e && e.palavra && e.emoji).slice(0, 6) : [],
          origem: 'ia'
        });
      }
    }

    // trabalhadores que pegam trechos da fila
    const trabalhadores = Array.from({ length: paralelo }, async () => {
      for (;;) {
        if (erroFatal || job.cancel) return;
        const jan = fila.shift();
        if (!jan) {
          if (fim) return;
          await esperar();
          continue;
        }
        rodando++;
        try {
          await analisar(jan);
        } catch (err) {
          erroFatal = err;
        } finally {
          rodando--;
          feitas++;
          cutucar();
        }
      }
    });

    // monta os trechos que já estão totalmente transcritos
    function alimentar(novasWords, ateSeg, final) {
      words = novasWords;
      F = frases(words);
      for (;;) {
        const tIni = enviadas * passo;
        if (enviadas > 0 && tIni >= (final ? duracao : ateSeg) - 30) break;
        const tFim = tIni + janelaSeg;
        const ultima = tFim >= duracao - 30;
        if (!final && ateSeg < Math.min(tFim, duracao) + 30) break; // ainda não terminou de transcrever esse trecho
        const i0 = F.findIndex((x) => x.s >= tIni);
        let i1 = -1;
        for (let i = F.length - 1; i >= 0; i--) if (ultima || F[i].s < tFim) { i1 = i; break; }
        if (i0 >= 0 && i1 >= i0) fila.push({ F, words, i0, i1, n: enviadas });
        enviadas++;
        if (ultima) break;
      }
      if (final) fim = true;
      cutucar();
    }

    async function terminar(prog) {
      fim = true;
      const total = () => Math.max(enviadas, 1);
      for (;;) {
        if (erroFatal) throw erroFatal;
        checar();
        if (!fila.length && rodando === 0) break;
        prog('ia', feitas / total(), `IA analisando os trechos (${feitas} de ${total()} prontos, ${Math.min(paralelo, rodando + fila.length)} ao mesmo tempo) · ${out.length} momentos achados`);
        cutucar();
        await pausa(400);
      }
      await Promise.all(trabalhadores);
      if (erroFatal) throw erroFatal;
      // refaz o ajuste com as frases finais (as frases do fim de cada trecho podem ter crescido)
      const Ff = frases(words);
      const finais = [];
      for (const c of out) {
        const a = Ff.findIndex((x) => Math.abs(x.s - c.sA) < 0.02);
        let b = -1;
        for (let i = Ff.length - 1; i >= 0; i--) if (Ff[i].e <= c.eB + 0.02) { b = i; break; }
        const aj = a >= 0 && b >= a ? ajustar(Ff, words, a, b, opts.min, opts.max) : { a: c.a, b: c.b, s: c.s, e: c.e };
        if (aj) finais.push({ ...c, ...aj });
      }
      prog('ia', 1, `IA terminou · ${finais.length} momentos encontrados`);
      if (!finais.length && falhas) throw new Error('A IA não respondeu direito: ' + ultimoErro);
      return finais;
    }

    return { alimentar, terminar, status: () => ({ feitas, enviadas, achados: out.length }) };
  }

  // Deixa o modelo do Ollama carregado na placa enquanto o Whisper transcreve.
  function aquecerOllama(ia) {
    const url = (ia.url || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    fetch(url + '/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: (ia.modelo || '').trim() || IA_PADRAO.ollama, prompt: '', keep_alive: '30m' })
    }).catch(() => {});
  }

  function escolher(cands, n) {
    const ord = cands.slice().sort((x, y) => y.nota - x.nota || x.s - y.s);
    const esc = [];
    for (const c of ord) {
      if (esc.length >= n) break;
      if (esc.some((x) => c.s < x.e - 0.5 && c.e > x.s + 0.5)) continue;
      esc.push(c);
    }
    return esc;
  }

  // ---------------------------------------------------------- cortar
  let nvencOk = null;
  async function cortar(arquivo, c, saida, aoProgresso) {
    const dur = c.e - c.s;
    const tentar = async (enc) => {
      const v = enc === 'nvenc'
        ? ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '20', '-b:v', '0']
        : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19'];
      let buf = '';
      return rodar(
        FFMPEG,
        ['-y', '-hide_banner', '-nostdin', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats', '-ss', c.s.toFixed(3), '-i', arquivo, '-t', dur.toFixed(3),
          '-map', '0:v:0', '-map', '0:a:0?', ...v, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-map_metadata', '-1', '-movflags', '+faststart', saida],
        {
          onOut: (d) => {
            buf += d;
            const ls = buf.split(/\r?\n/);
            buf = ls.pop();
            for (const l of ls) {
              const m = l.match(/^out_time_(?:us|ms)=(\d+)/);
              if (m) aoProgresso(Math.min(1, Number(m[1]) / 1e6 / dur));
            }
          }
        }
      );
    };
    let r;
    if (nvencOk !== false) {
      r = await tentar('nvenc');
      if (r.code === 0) nvencOk = true;
      else if (!job.cancel) {
        nvencOk = false;
        r = await tentar('x264');
      }
    } else r = await tentar('x264');
    checar();
    if (r.code !== 0) {
      fs.rmSync(saida, { force: true });
      throw new Error('Falha ao cortar: ' + r.stderr.trim().split(/\r?\n/).slice(-2).join(' '));
    }
    return saida;
  }

  function saidaUnica(dir, nome) {
    let p = path.join(dir, nome + '.mp4');
    for (let i = 2; fs.existsSync(p); i++) p = path.join(dir, `${nome} (${i}).mp4`);
    return p;
  }

  // Palavras do trecho com o tempo relativo ao arquivo cortado.
  function palavrasDoCorte(words, c) {
    return words.filter((w) => w.s >= c.s - 0.05 && w.s < c.e - 0.05).map((w) => ({ w: w.w, s: +(w.s - c.s).toFixed(3), e: +(Math.min(w.e, c.e) - c.s).toFixed(3) }));
  }

  async function exportarLista(arquivo, lista, words, pasta, prog, base = 0, total = lista.length) {
    fs.mkdirSync(pasta, { recursive: true });
    // corta 3 de cada vez (a placa NVIDIA codifica vários vídeos ao mesmo tempo)
    const feitos = new Array(lista.length);
    const parcial = new Array(lista.length).fill(0);
    const reservados = new Set();
    let prox = 0, prontos = 0;
    const avisar = () => prog('cortar', (base + parcial.reduce((a, b) => a + b, 0)) / total, `Cortando ${Math.min(total, base + prontos + 1)} de ${total}…`);
    const worker = async () => {
      while (prox < lista.length) {
        checar();
        const i = prox++;
        const c = lista[i];
        const nn = String(c.n || i + 1).padStart(2, '0');
        let saida = saidaUnica(pasta, `${nn} - ${nomeSeguro(c.titulo)}`);
        for (let k = 2; reservados.has(saida); k++) saida = path.join(pasta, `${nn} - ${nomeSeguro(c.titulo)} (${k}).mp4`);
        reservados.add(saida);
        await cortar(arquivo, c, saida, (p) => {
          parcial[i] = p;
          avisar();
        });
        parcial[i] = 1;
        prontos++;
        avisar();
        feitos[i] = { ...c, arquivo: saida, words: palavrasDoCorte(words, c) };
      }
    };
    avisar();
    await Promise.all([worker(), worker(), worker()]);
    return feitos;
  }

  // ---------------------------------------------------------- progresso geral
  const PESOS = { preparar: [0, 0.04], audio: [0.04, 0.1], transcrever: [0.1, 0.68], ia: [0.68, 0.88], cortar: [0.88, 1] };
  function progresso(origem) {
    return (etapa, pct, msg) => {
      const [a, b] = PESOS[etapa] || [0, 1];
      send({ origem, etapa, pct: Math.max(0, Math.min(1, pct)), geral: a + (b - a) * Math.max(0, Math.min(1, pct)), msg });
    };
  }

  async function exclusivo(fn) {
    if (job.ativo) throw new Error('Já tem uma transcrição ou corte rodando. Espere terminar ou cancele.');
    job.ativo = true;
    job.cancel = false;
    try {
      return await fn();
    } finally {
      job.ativo = false;
      job.cancel = false;
    }
  }

  // Guarda a última análise de cada vídeo para poder cortar mais momentos depois.
  const analises = new Map();

  // ---------------------------------------------------------- IPC
  ipcMain.handle('cortes-escolher', async () => {
    const r = await dialog.showOpenDialog(getWin(), {
      title: 'Escolher vídeo longo para cortar',
      properties: ['openFile'],
      filters: [{ name: 'Vídeos', extensions: ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', 'ts', 'flv'] }]
    });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('cortes-info', async (_e, arquivo, idioma, modelo) => {
    const info = await sondar(arquivo);
    let transcrito = false;
    try {
      transcrito = fs.existsSync(path.join(CACHE, chaveCache(arquivo, idioma || 'pt', MODELOS[modelo] ? modelo : 'turbo'), 'transcricao.json'));
    } catch (_) {}
    const whisper = process.platform !== 'win32' || !!acharArquivo(path.join(BIN, 'whisper-gpu'), 'whisper-cli.exe') || !!acharArquivo(path.join(BIN, 'whisper-cpu'), 'whisper-cli.exe');
    const m = MODELOS[modelo] || MODELOS.turbo;
    const mp = path.join(MODEL_DIR, m.arquivo);
    const modeloOk = fs.existsSync(mp) && fs.statSync(mp).size >= m.minBytes;
    return { ...info, transcrito, whisper, modeloOk };
  });

  ipcMain.handle('cortes-iniciar', (_e, opts) =>
    exclusivo(async () => {
      const prog = progresso('cortes');
      const min = Math.max(5, Number(opts.min) || 30);
      const max = Math.max(min + 5, Number(opts.max) || 60);
      const quantidade = Math.max(1, Math.min(100, Number(opts.quantidade) || 10));
      const o = { ...opts, min, max, quantidade };
      const usaIA = o.ia && o.ia.provedor && o.ia.provedor !== 'nenhum';
      let agenda = null;
      if (usaIA) {
        if (o.ia.provedor === 'ollama') aquecerOllama(o.ia);
        const info = await sondar(opts.arquivo);
        agenda = criarAgendaIA(o, info.duracao);
        // a IA já começa nos trechos prontos enquanto o Whisper segue transcrevendo
        o.aoParte = (ws, ate) => agenda.alimentar(ws.slice(), ate, false);
      }
      const progT = (etapa, pct, msg) => {
        if (agenda && etapa === 'transcrever') {
          const st = agenda.status();
          if (st.enviadas) msg += ` · IA já está analisando (${st.feitas}/${st.enviadas} trechos, ${st.achados} momentos)`;
        }
        prog(etapa, pct, msg);
      };
      const t = await transcrever(opts.arquivo, o, progT);
      if (!t.words.length) throw new Error('Não encontrei fala no vídeo.');
      const F = frases(t.words);
      let cands = [];
      if (agenda) {
        agenda.alimentar(t.words, t.duracao, true);
        cands = await agenda.terminar(prog);
      }
      const regras = candidatosRegra(F, t.words, t.energia, min, max);
      if (!cands.length) {
        prog('ia', 1, 'Escolhendo os momentos pelas regras (sem IA)…');
        cands = regras;
      }
      let escolhidos = escolher(cands, quantidade);
      if (escolhidos.length < quantidade && cands !== regras) {
        // a IA achou menos que o pedido: completa com as regras sem repetir trechos
        for (const r of regras.slice().sort((x, y) => y.nota - x.nota)) {
          if (escolhidos.length >= quantidade) break;
          if (escolhidos.some((x) => r.s < x.e - 0.5 && r.e > x.s + 0.5)) continue;
          escolhidos.push({ ...r, nota: Math.min(r.nota, 60) });
        }
      }
      escolhidos.forEach((c, i) => (c.n = i + 1));
      // outros momentos bons que sobraram (para cortar mais depois, sem refazer nada)
      const resto = (cands === regras ? regras : cands.concat(regras.map((r) => ({ ...r, nota: Math.min(r.nota, 60) }))))
        .filter((c) => !escolhidos.some((x) => c.s < x.e - 0.5 && c.e > x.s + 0.5));
      const sobras = escolher(resto, 30);
      const pasta = path.join(o.pastaSaida, nomeSeguro(path.parse(opts.arquivo).name, 'video'));
      const cortes = await exportarLista(opts.arquivo, escolhidos, t.words, pasta, prog);
      analises.set(opts.arquivo, { words: t.words, pasta, n: cortes.length });
      prog('cortar', 1, `Pronto! ${cortes.length} cortes salvos.`);
      return {
        pasta,
        duracao: t.duracao,
        palavras: t.words.length,
        cortes: cortes.map(limparSaida),
        extras: sobras.slice(0, 30).map((c) => limparSaida({ ...c, texto: textoDe(t.words, c) }))
      };
    })
  );

  function textoDe(words, c) {
    return words.filter((w) => w.s >= c.s && w.s < c.e).map((w) => w.w).join(' ');
  }
  function limparSaida(c) {
    return {
      n: c.n || null,
      s: +c.s.toFixed(3),
      e: +c.e.toFixed(3),
      dur: +(c.e - c.s).toFixed(2),
      nota: c.nota,
      titulo: c.titulo,
      gancho: c.gancho || '',
      descricao: c.descricao || '',
      emojis: c.emojis || [],
      origem: c.origem,
      arquivo: c.arquivo || null,
      words: c.words || null,
      texto: c.texto || (c.words ? c.words.map((w) => w.w).join(' ') : '')
    };
  }

  // Corta mais momentos (os "extras" que a análise achou) sem refazer a transcrição.
  ipcMain.handle('cortes-exportar', (_e, arquivo, lista) =>
    exclusivo(async () => {
      const a = analises.get(arquivo);
      if (!a) throw new Error('Gere os cortes desse vídeo de novo para cortar mais.');
      const prog = progresso('cortes');
      lista.forEach((c, i) => (c.n = a.n + i + 1));
      const feitos = await exportarLista(arquivo, lista, a.words, a.pasta, prog);
      a.n += feitos.length;
      prog('cortar', 1, `${feitos.length} corte(s) a mais salvos.`);
      return feitos.map(limparSaida);
    })
  );

  // Legenda automática de um vídeo da mesa (vídeos curtos).
  ipcMain.handle('transcrever', (_e, arquivo, opts) =>
    exclusivo(async () => {
      const t = await transcrever(arquivo, opts || {}, progresso('mesa'));
      return { words: t.words };
    })
  );

  ipcMain.handle('cortes-cancelar', () => {
    if (!job.ativo) return false;
    job.cancel = true;
    for (const p of job.procs) p.kill('SIGKILL');
    return true;
  });

  ipcMain.handle('cortes-abrir', (_e, p) => shell.openPath(p));

  // Testa a IA escolhida (e lista os modelos do Ollama).
  ipcMain.handle('cortes-ia-testar', async (_e, ia) => {
    try {
      if (ia.provedor === 'ollama') {
        const url = (ia.url || 'http://127.0.0.1:11434').replace(/\/+$/, '');
        const r = await fetch(url + '/api/tags').catch(() => null);
        if (!r || !r.ok) return { ok: false, msg: 'O Ollama não está aberto (instale em ollama.com e deixe ele rodando).' };
        const j = await r.json();
        const modelos = (j.models || []).map((m) => m.name);
        if (!modelos.length) return { ok: false, modelos, msg: 'O Ollama está aberto mas sem nenhum modelo. Clique em “Baixar modelo recomendado”.' };
        const escolhido = ia.modelo || IA_PADRAO.ollama;
        if (!modelos.includes(escolhido) && !modelos.includes(escolhido + ':latest')) return { ok: false, modelos, msg: `O modelo ${escolhido} não está instalado. Escolha um da lista ou baixe.` };
        return { ok: true, modelos, msg: `Ollama ok · ${modelos.length} modelo(s)` };
      }
      if (ia.provedor === 'nenhum') return { ok: true, msg: 'Sem IA: os cortes saem pelas regras (gancho, ritmo e volume).' };
      if (!ia.chave) return { ok: false, msg: 'Cole a chave da API' };
      const txt = await chamarIA(ia, 'Responda só JSON.', 'Responda {"ok":true}', 60e3);
      extrairJSON(txt);
      return { ok: true, msg: 'Conectado!' };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  });

  // Baixa um modelo no Ollama (ollama pull) mostrando o progresso.
  ipcMain.handle('cortes-ollama-baixar', (_e, url, modelo) =>
    exclusivo(async () => {
      url = (url || 'http://127.0.0.1:11434').replace(/\/+$/, '');
      const ctrl = new AbortController();
      const vigia = setInterval(() => job.cancel && ctrl.abort(), 300);
      try {
        const r = await fetch(url + '/api/pull', { method: 'POST', signal: ctrl.signal, body: JSON.stringify({ model: modelo, stream: true }) }).catch(() => null);
        if (!r || !r.ok || !r.body) throw new Error('O Ollama não está aberto.');
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const ls = buf.split('\n');
          buf = ls.pop();
          for (const l of ls) {
            if (!l.trim()) continue;
            let j;
            try {
              j = JSON.parse(l);
            } catch (_) {
              continue;
            }
            if (j.error) throw new Error(j.error);
            const pct = j.total ? j.completed / j.total : 0;
            send({ origem: 'ollama', etapa: 'preparar', pct, geral: pct, msg: `Ollama: ${j.status || ''}${j.total ? ' · ' + mb(j.completed || 0) + ' de ' + mb(j.total) : ''}` });
          }
        }
        return true;
      } catch (err) {
        if (job.cancel) throw new Error('Cancelado');
        throw err;
      } finally {
        clearInterval(vigia);
      }
    })
  );

  // ---------------------------------------------------------- Frases com IA (vídeos sem texto)
  const ESTILOS_FRASE = {
    curta: 'frase curta e impactante, de 6 a 14 palavras, que funcione sozinha na tela',
    reflexao: 'reflexão de 2 ou 3 frases curtas (até 35 palavras no total), que faça a pessoa parar e pensar',
    pergunta: 'pergunta provocativa seguida de uma resposta curta e forte (até 25 palavras)',
    lista: 'mini lista em 3 linhas curtas (ex.: "Acorde cedo. | Treine. | Não desista."), separadas por " | "'
  };
  ipcMain.handle('ia-frases', async (_e, o) => {
    const ia = o.ia || {};
    if (!ia.provedor || ia.provedor === 'nenhum') throw new Error('Escolha uma IA em Cortes Virais → “Inteligência” (Ollama, Gemini…)');
    const n = Math.max(1, Math.min(200, Number(o.quantidade) || 1));
    const estilo = ESTILOS_FRASE[o.estilo] || ESTILOS_FRASE.curta;
    const usadas = new Set((o.evitar || []).map((x) => semAcento(x)));
    const out = [];
    let tentativas = 0;
    while (out.length < n && tentativas < Math.ceil(n / 20) + 3) {
      tentativas++;
      const pedir = Math.min(25, n - out.length + 2);
      const evitar = [...(o.evitar || []), ...out.map((x) => x.texto)].slice(-60);
      const usuario = `Crie ${pedir} textos ORIGINAIS para colocar escritos em vídeos curtos (Reels/TikTok/Shorts) sobre o tema: "${String(o.tema || 'motivação').slice(0, 200)}".
Tipo de texto: ${estilo}.
${o.publico ? 'Público: ' + String(o.publico).slice(0, 200) + '\n' : ''}Regras:
- Escreva em português do Brasil, com linguagem simples e direta, que gere identificação e vontade de compartilhar.
- Cada texto precisa ser diferente dos outros (ideia diferente, não só trocar palavras).
- Não invente autor, não use aspas e não cite pessoas famosas.
- ${o.emoji ? 'Pode terminar com no máximo 1 emoji que combine.' : 'Não use emojis.'}
- Use " | " só onde quiser quebrar a linha na tela.
${o.legendaPost ? '- Para cada texto, escreva também "legenda": uma legenda para o post (1 ou 2 frases chamando para comentar ou salvar) terminando com 4 a 6 hashtags do tema.\n' : ''}${evitar.length ? 'Não repita nem parafraseie estes, que já foram usados:\n' + evitar.map((x) => '- ' + x).join('\n') + '\n' : ''}
Responda só JSON: {"textos":[{"texto":"..."${o.legendaPost ? ',"legenda":"..."' : ''}}]}`;
      let resp;
      try {
        resp = extrairJSON(await chamarIA(ia, 'Você é um copywriter brasileiro especialista em conteúdo motivacional viral para redes sociais. Responda SEMPRE e SOMENTE com JSON válido.', usuario, ia.provedor === 'ollama' ? 5 * 60e3 : 2 * 60e3));
      } catch (err) {
        if (!out.length && tentativas >= 2) throw err;
        continue;
      }
      for (const t of resp.textos || resp.frases || []) {
        const texto = String((t && (t.texto || t.frase)) || t || '').replace(/^["“”']+|["“”']+$/g, '').trim();
        if (!texto || texto.length > 300) continue;
        const k = semAcento(texto);
        if (usadas.has(k)) continue;
        usadas.add(k);
        out.push({ texto, legenda: o.legendaPost ? String((t && t.legenda) || '').trim().slice(0, 2200) : '' });
        if (out.length >= n) break;
      }
    }
    if (!out.length) throw new Error('A IA não devolveu frases. Tente de novo ou troque o modelo.');
    return out;
  });

  app.on('before-quit', () => {
    job.cancel = true;
    for (const p of job.procs) p.kill('SIGKILL');
  });

  // para testes
  return { frases, ajustar, candidatosRegra, escolher, lerTranscricao, palavrasDoCorte, promptJanela, extrairJSON };
}

module.exports = { registrar, MODELOS, IA_PADRAO };
