// Limpa os metadados de vídeos SEM refazer o vídeo: copia imagem, áudio e capa embutida do jeito
// que estão (mesma qualidade, mesmo tamanho, nada cortado) e só apaga os metadados.
// Uso: node limpar-metadados.js <pasta ou vídeos...>   (ou pelo LIMPAR-METADADOS.bat)
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const unpacked = (p) => (p ? p.replace('app.asar', 'app.asar.unpacked') : p);
function bin(mod, pick, nome) {
  try {
    const p = unpacked(pick(require(mod)));
    if (p && fs.existsSync(p)) return p;
  } catch (_) {}
  return nome;
}
const FFMPEG = bin('ffmpeg-static', (m) => m, 'ffmpeg');
const FFPROBE = bin('ffprobe-static', (m) => m.path, 'ffprobe');
const EXT = /\.(mp4|mov|m4v|mkv|webm|avi)$/i;

function perguntar(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => (rl.close(), r(a.trim()))));
}
const limparAspas = (s) => s.replace(/^["']+|["']+$/g, '').trim();

function listar(alvos, subpastas) {
  const out = [];
  const andar = (p, nivel) => {
    let st;
    try {
      st = fs.statSync(p);
    } catch (_) {
      return console.log(`  ! Não achei: ${p}`);
    }
    if (st.isDirectory()) {
      if (nivel > 0 && !subpastas) return;
      for (const f of fs.readdirSync(p)) if (!f.startsWith('.~meta_')) andar(path.join(p, f), nivel + 1);
    } else if (EXT.test(p)) out.push(p);
  };
  for (const a of alvos) andar(a, 0);
  return [...new Set(out)];
}

// Renomeia os vídeos limpos de cada pasta para "vídeo 1", "vídeo 2"... (na ordem do Explorer).
// Usa nomes temporários antes, para não bater com um "vídeo 3" que já exista.
function renomear(arquivos) {
  const porPasta = new Map();
  for (const f of arquivos) {
    const d = path.dirname(f);
    if (!porPasta.has(d)) porPasta.set(d, []);
    porPasta.get(d).push(f);
  }
  const ordem = (a, b) => path.basename(a).localeCompare(path.basename(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
  const feitos = [];
  for (const [dir, lista] of porPasta) {
    lista.sort(ordem);
    const tmps = lista.map((f, i) => {
      const t = path.join(dir, `.~ren_${process.pid}_${i}${path.extname(f).toLowerCase()}`);
      fs.renameSync(f, t);
      return t;
    });
    const nossos = new Set(lista.map((f) => path.basename(f).toLowerCase()));
    let n = 0;
    tmps.forEach((t, i) => {
      let destino;
      do {
        n++;
        destino = path.join(dir, `vídeo ${n}${path.extname(t)}`);
      } while (fs.existsSync(destino) && !nossos.has(path.basename(destino).toLowerCase()));
      fs.renameSync(t, destino);
      feitos.push([lista[i], destino]);
    });
  }
  return feitos;
}

function sondar(arquivo) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', arquivo], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout);
  } catch (_) {
    return null;
  }
}
const contarTags = (j) =>
  Object.keys((j.format && j.format.tags) || {}).filter((k) => !/^(major_brand|minor_version|compatible_brands)$/.test(k)).length +
  (j.streams || []).reduce((a, s) => a + Object.keys(s.tags || {}).filter((k) => !/^(language|vendor_id)$/.test(k) && String(s.tags[k]).trim()).length, 0);

function limpar(arquivo) {
  const j = sondar(arquivo);
  if (!j) throw new Error('não consegui ler o vídeo');
  const streams = j.streams || [];
  const antes = contarTags(j);
  const ext = path.extname(arquivo);
  const tmp = path.join(path.dirname(arquivo), `.~meta_${process.pid}_${Date.now()}${ext}`);
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', arquivo];
  // vídeo (inclusive a capa embutida) e áudio; legendas e faixas de dados ficam de fora
  let nv = 0;
  streams.forEach((s, i) => {
    if (s.codec_type === 'video' || s.codec_type === 'audio') args.push('-map', `0:${i}`);
  });
  args.push('-c', 'copy', '-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact');
  let o = 0;
  streams.forEach((s) => {
    if (s.codec_type !== 'video' && s.codec_type !== 'audio') return;
    args.push(`-metadata:s:${o}`, 'encoder= ', `-metadata:s:${o}`, 'handler_name= ', `-metadata:s:${o}`, 'creation_time=');
    const capa = s.disposition && s.disposition.attached_pic;
    // apaga as informações que o codificador grava dentro do vídeo (SEI)
    if (s.codec_type === 'video' && !capa) {
      if (s.codec_name === 'h264') args.push(`-bsf:${o}`, 'filter_units=remove_types=6');
      else if (s.codec_name === 'hevc') args.push(`-bsf:${o}`, 'filter_units=remove_types=39|40');
      nv++;
    }
    o++;
  });
  if (/\.(mp4|mov|m4v)$/i.test(ext)) args.push('-movflags', '+faststart');
  args.push(tmp);
  const r = spawnSync(FFMPEG, args, { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0 || !fs.existsSync(tmp)) {
    fs.rmSync(tmp, { force: true });
    throw new Error((r.stderr || '').trim().split(/\r?\n/).pop() || 'o FFmpeg falhou');
  }
  // confere antes de trocar: mesma duração e mesmas faixas
  const d = sondar(tmp);
  const dur = (x) => parseFloat((x.format && x.format.duration) || 0);
  const nOrig = streams.filter((s) => s.codec_type === 'video' || s.codec_type === 'audio').length;
  if (!d || (d.streams || []).length !== nOrig || Math.abs(dur(d) - dur(j)) > 0.25) {
    fs.rmSync(tmp, { force: true });
    throw new Error('o resultado não bateu com o original (nada foi alterado)');
  }
  const datas = fs.statSync(arquivo);
  try {
    fs.rmSync(arquivo);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw new Error('o vídeo está aberto em outro programa (feche e rode de novo)');
  }
  fs.renameSync(tmp, arquivo);
  try {
    fs.utimesSync(arquivo, datas.atime, datas.mtime); // mantém a data do arquivo no Windows
  } catch (_) {}
  return { antes, depois: contarTags(d), nv };
}

(async () => {
  console.log('');
  console.log('  ==============================================');
  console.log('   LIMPAR METADADOS DOS VÍDEOS · Editor em Massa');
  console.log('  ==============================================');
  console.log('  O vídeo NÃO é refeito: mesma qualidade, mesmo tamanho,');
  console.log('  nada cortado e a capa embutida continua. Só os metadados saem.');
  console.log('');
  const flags = process.argv.slice(2).filter((a) => /^--/.test(a));
  const sim = flags.includes('--sim'); // não pergunta nada (para usar em scripts)
  let alvos = process.argv.slice(2).filter((a) => !/^--/.test(a)).map(limparAspas).filter(Boolean);
  if (!alvos.length) {
    const r = await perguntar('  Arraste aqui a PASTA (ou os vídeos) e aperte Enter:\n  > ');
    alvos = (r.match(/"[^"]+"|\S+/g) || []).map(limparAspas);
    // caminho com espaço colado sem aspas
    if (alvos.length > 1 && !alvos.every((a) => fs.existsSync(a)) && fs.existsSync(limparAspas(r))) alvos = [limparAspas(r)];
  }
  if (!alvos.length) return console.log('  Nada informado.');
  let subpastas = flags.includes('--subpastas');
  if (!sim && !subpastas && alvos.some((a) => fs.existsSync(a) && fs.statSync(a).isDirectory())) {
    const r = await perguntar('  Incluir os vídeos das SUBPASTAS também? (S/N) [N]: ');
    subpastas = /^s/i.test(r);
  }
  const lista = listar(alvos, subpastas);
  if (!lista.length) return console.log('\n  Nenhum vídeo encontrado (mp4, mov, m4v, mkv, webm, avi).');
  console.log(`\n  ${lista.length} vídeo(s). Os arquivos originais serão substituídos pelos limpos.`);
  let renomearTudo = !flags.includes('--sem-renomear');
  if (!sim && renomearTudo) renomearTudo = !/^n/i.test(await perguntar('  Renomear para "vídeo 1", "vídeo 2", "vídeo 3"...? (S/N) [S]: '));
  const ok = sim ? 's' : await perguntar('  Continuar? (S/N) [S]: ');
  if (/^n/i.test(ok)) return console.log('  Cancelado.');
  console.log('');
  let feitos = 0, falhas = 0;
  const limpos = [];
  const t0 = Date.now();
  lista.forEach((f, i) => {
    const nome = path.basename(f);
    process.stdout.write(`  [${String(i + 1).padStart(String(lista.length).length)}/${lista.length}] ${nome} ... `);
    try {
      const r = limpar(f);
      feitos++;
      limpos.push(f);
      console.log(`ok (${r.antes} metadado(s) removido(s))`);
    } catch (e) {
      falhas++;
      console.log('FALHOU: ' + e.message);
    }
  });
  if (renomearTudo && limpos.length) {
    try {
      const r = renomear(limpos);
      const pastas = new Set(r.map(([a]) => path.dirname(a))).size;
      console.log(`\n  Renomeados: ${r.length} vídeo(s) para "vídeo 1", "vídeo 2", "vídeo 3"...${pastas > 1 ? ` (numeração separada em cada uma das ${pastas} pastas)` : ''}.`);
    } catch (e) {
      console.log('\n  Não consegui renomear: ' + e.message);
    }
  }
  console.log(`\n  Pronto em ${((Date.now() - t0) / 1000).toFixed(1)} s: ${feitos} limpo(s)${falhas ? `, ${falhas} com falha (esses ficaram como estavam)` : ''}.`);
})().catch((e) => console.log('  Erro: ' + e.message));
