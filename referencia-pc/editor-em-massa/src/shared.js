// Código compartilhado entre a interface (preview) e o processo principal (FFmpeg).
// Tudo que define "onde o vídeo fica" e "quanto tempo dura" mora aqui,
// assim o preview e o arquivo final saem idênticos.
(function (root) {
  'use strict';

  const DEFAULTS = {
    limpeza: { modo: 'nenhum', fonte: 'gravado', papel: 'headline', metodo: 'recorte', topo: 20, base: 25, headline: { x: 10, y: 48, w: 80, h: 15 }, legenda: { x: 20, y: 48, w: 60, h: 8 } },
    recorte: { top: 0, bottom: 0, left: 0, right: 0, zoom: 1, posV: 0.5 },
    efeitos: {
      espelhar: false,
      cortarPontas: false,
      ajusteAuto: false,
      velocidade: 1,
      antiDup: false,
      melhorarAudio: false,
      corteInicio: 0,
      corteFim: 0,
      filtro: 'nenhum', // um dos FILTROS abaixo
      filtroForca: 1 // 0 a 1
    },
    template: {
      fundoTipo: 'cor', // cor | imagem | blur
      fundoCor: '#000000',
      fundoImagem: null,
      logo: null,
      logoPos: 'sup-dir', // sup-esq | sup-centro | sup-dir | inf-esq | inf-centro | inf-dir
      logoTamanho: 0.18,
      logoOpacidade: 0.9,
      molduraEsp: 0,
      molduraCor: '#ffffff'
    },
    texto: {
      pos: 'topo',
      h: 50,
      v: 14,
      largura: 84,
      fonte: 'Poppins',
      peso: 800,
      tamanho: 64,
      espacamento: 1.15,
      maiusculas: false,
      cor: '#ffffff',
      contorno: true,
      contornoCor: '#000000',
      fundo: false,
      fundoCor: '#000000',
      ctaAtivo: false,
      ctaTexto: 'SIGA PARA MAIS 👇',
      ctaV: 88,
      ctaTamanho: 42,
      ctaCor: '#ffffff',
      ctaFundo: '#7c3aed'
    },
    capa: {
      ativo: false,
      fonte: 'frame', // frame | imagem
      tempo: 1, // segundos no vídeo já editado
      imagem: null,
      texto: 'titulo', // titulo | legenda | nenhum
      escurecer: 0.25,
      v: 50,
      tamanho: 110,
      maiusculas: true,
      cor: '#ffffff',
      contorno: true,
      contornoCor: '#000000',
      destaque: false,
      destaqueCor: '#7c3aed',
      noInicio: true,
      duracao: 0.5,
      embutir: true,
      salvarJpg: false
    },
    // legenda animada palavra por palavra (precisa da transcrição do vídeo)
    legendaAnim: {
      ativo: false,
      estilo: 'destaque', // destaque | karaoke | caixa | palavra | simples
      animacao: 'pop', // pop | subir | nenhuma
      palavras: 3,
      fonte: 'Montserrat',
      peso: 900,
      tamanho: 80,
      v: 70,
      largura: 86,
      maiusculas: true,
      semPontuacao: true,
      manterInterrogacao: true,
      cor: '#ffffff',
      destaque: '#ffe14d',
      destaque2: '#3ee6ff',
      destaque3: '#ff4fa3',
      trocarCor: true,
      caixaTexto: '#120a2a',
      contorno: true,
      contornoCor: '#000000',
      sombra: true,
      emojis: true,
      emojiTam: 110
    },
    audio: { modo: 'original', volume: 1, musica: null, musicaVolume: 0.3 },
    saida: { res: 1080, fps: 30, bitrate: 8, encoder: 'auto', semMetadados: true, melhorarVideo: false, superResolucaoIA: false }
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);

  // Mistura um perfil salvo com os padrões (garante chaves novas em perfis antigos).
  function merge(base, over) {
    const out = clone(base);
    if (!isObj(over)) return out;
    for (const k of Object.keys(out)) {
      if (!(k in over)) continue;
      out[k] = isObj(out[k]) ? merge(out[k], over[k]) : over[k];
    }
    return out;
  }

  const even = (n) => {
    n = Math.floor(n);
    return n - (n % 2);
  };
  const clamp = (n, a, b) => Math.min(b, Math.max(a, Number(n) || 0));

  function canvasSize(s, meta) {
    const res = Number(s.saida.res);
    if (![1440, 2160, 4320].includes(res)) {
      const CW = res === 720 ? 720 : 1080;
      return { CW, CH: Math.round(CW * 16 / 9) };
    }
    const w = Number(meta && meta.width) || 1080;
    const h = Number(meta && meta.height) || 1920;
    const long = res * 16 / 9;
    const k = Math.min(long / Math.max(w, h), res / Math.min(w, h));
    return { CW: Math.max(2, even(w * k)), CH: Math.max(2, even(h * k)) };
  }

  // Posição e tamanho do vídeo dentro do quadro 9:16.
  function layout(meta, s) {
    const { CW, CH } = canvasSize(s, meta);
    let r = s.recorte;
    const c = s.limpeza;
    if (c && c.modo !== 'nenhum' && c.metodo !== 'reconstruir' && ['gravado', 'ambos'].includes(c.fonte)) {
      const topCut = ['headline', 'ambos'].includes(c.modo) ? meta.height * clamp(c.topo, 0, 90) / 100 : 0;
      const bottomCut = ['legenda', 'ambos'].includes(c.modo) ? meta.height * clamp(c.base, 0, 90) / 100 : 0;
      const bottom = Math.min(Math.max(Number(r.bottom) || 0, bottomCut), meta.height - 16);
      const top = Math.min(Math.max(Number(r.top) || 0, topCut), meta.height - bottom - 16);
      r = { ...r, top, bottom };
    }
    const left = even(clamp(r.left, 0, meta.width - 16));
    const top = even(clamp(r.top, 0, meta.height - 16));
    const right = Math.max(0, Number(r.right) || 0);
    const bottom = Math.max(0, Number(r.bottom) || 0);
    const cw = Math.max(16, even(meta.width - left - right));
    const ch = Math.max(16, even(meta.height - top - bottom));
    const z = (Number(r.zoom) || 1) * (s.efeitos.antiDup ? 1.04 : 1);
    const F = even(Math.round(((s.template.molduraEsp || 0) * CW) / 1080));
    const boxW = even(CW - 2 * F);
    const boxH = even(CH - 2 * F);
    const k = Math.min((boxW * z) / cw, (boxH * z) / ch);
    const sw = Math.max(2, even(cw * k));
    const sh = Math.max(2, even(ch * k));
    const dw = Math.min(sw, boxW);
    const dh = Math.min(sh, boxH);
    const posV = r.posV === undefined ? 0.5 : clamp(r.posV, 0, 1);
    const x = Math.round((CW - (dw + 2 * F)) / 2);
    const y = Math.round((CH - (dh + 2 * F)) * posV);
    return { CW, CH, left, top, cw, ch, k, sw, sh, dw, dh, F, x, y };
  }

  // Trecho usado do vídeo original e duração final (já com a velocidade).
  function timing(meta, s) {
    const e = s.efeitos;
    const dur = meta.duration || 0;
    let start = Math.max(0, Number(e.corteInicio) || 0);
    let end = dur - Math.max(0, Number(e.corteFim) || 0);
    if (e.cortarPontas) {
      start += 0.5;
      end -= 0.5;
    }
    if (end - start < 0.5) {
      start = 0;
      end = dur;
    }
    const speed = clamp(e.velocidade || 1, 0.5, 2);
    const inDur = Math.max(0.1, end - start);
    return { start, end, inDur, outDur: inDur / speed, speed };
  }

  // Parâmetros de cor (mesmos números no preview CSS e no filtro eq do FFmpeg).
  function eqParams(e) {
    let contrast = 1, saturation = 1, brightness = 0, gamma = 1;
    if (e.ajusteAuto) {
      contrast = 1.06;
      saturation = 1.15;
      brightness = 0.02;
    }
    if (e.antiDup) {
      saturation *= 1.03;
      brightness += 0.01;
      gamma = 1.02;
    }
    const changed = contrast !== 1 || saturation !== 1 || brightness !== 0 || gamma !== 1;
    return { contrast, saturation, brightness, gamma, changed };
  }

  // ---------------- filtros de cor ----------------
  // Cada filtro vira: matriz de cor 3x3 + ajuste linear por canal (contraste/brilho/desbotado) + vinheta.
  // O preview usa a MESMA conta (SVG feColorMatrix + feComponentTransfer) e o FFmpeg usa
  // colorchannelmixer + lutrgb + vignette, então o vídeo final sai igual ao que aparece na tela.
  const FILTROS = {
    nenhum: { nome: 'Nenhum' },
    vivido: { nome: 'Vívido', sat: 1.38, con: 1.12 },
    quente: { nome: 'Quente', mul: [1.09, 1.0, 0.85], sat: 1.08 },
    frio: { nome: 'Frio', mul: [0.9, 1.0, 1.12], sat: 0.98, con: 1.03 },
    pb: { nome: 'P&B', gray: 1, con: 1.12 },
    sepia: { nome: 'Sépia', sepia: 1, con: 1.04 },
    vintage: { nome: 'Vintage', sepia: 0.4, sat: 0.85, fade: 0.07, vin: 0.6 },
    cinema: { nome: 'Cinema', con: 1.18, sat: 0.92, mul: [1.04, 1.0, 0.93], vin: 0.5 },
    desbotado: { nome: 'Desbotado', sat: 0.72, fade: 0.11, con: 0.96 },
    noir: { nome: 'Noir', gray: 1, con: 1.45, bri: -0.04, vin: 0.85 },
    dourado: { nome: 'Dourado', mul: [1.12, 1.03, 0.8], sat: 1.15, con: 1.05 }
  };
  const ID3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const mat = (a, b) => {
    // a * b (3x3, linha a linha)
    const o = [];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) o.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
    return o;
  };
  const mix = (m, t) => ID3.map((v, i) => v + (m[i] - v) * t);
  const LR = 0.2126, LG = 0.7152, LB = 0.0722;

  // Matriz, inclinação, deslocamento e vinheta do filtro escolhido, já com a intensidade aplicada.
  function filtroSpec(e) {
    const f = FILTROS[e && e.filtro] || FILTROS.nenhum;
    const k = clamp(e && e.filtroForca !== undefined ? e.filtroForca : 1, 0, 1);
    if (f === FILTROS.nenhum || k === 0) return null;
    let M = ID3.slice();
    if (f.gray) M = mat(mix([LR, LG, LB, LR, LG, LB, LR, LG, LB], f.gray), M);
    if (f.sepia) M = mat(mix([0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131], f.sepia), M);
    if (f.sat !== undefined) {
      const s = f.sat;
      M = mat([LR + (1 - LR) * s, LG - LG * s, LB - LB * s, LR - LR * s, LG + (1 - LG) * s, LB - LB * s, LR - LR * s, LG - LG * s, LB + (1 - LB) * s], M);
    }
    if (f.mul) M = mat([f.mul[0], 0, 0, 0, f.mul[1], 0, 0, 0, f.mul[2]], M);
    const c = f.con || 1, fade = f.fade || 0, b = f.bri || 0;
    const slope = c * (1 - fade);
    const icpt = 0.5 * (1 - c) * (1 - fade) + fade + b;
    const r4 = (n) => Math.round(n * 10000) / 10000;
    return {
      m: mix(M, k).map(r4),
      slope: r4(1 + (slope - 1) * k),
      icpt: r4(icpt * k),
      vin: r4((f.vin || 0) * k)
    };
  }
  // Ângulo do filtro "vignette" do FFmpeg para a força 0..1 (o preview usa um degradê equivalente).
  const vinAngle = (v) => 0.2 + 0.5 * v;

  // Momento do arquivo original usado como capa (tempo informado é do vídeo já editado).
  function capaSourceTime(meta, s) {
    const T = timing(meta, s);
    const t = Math.min(Math.max(0, Number(s.capa.tempo) || 0), T.outDur);
    return Math.min(T.start + t * T.speed, Math.max(T.start, T.end - 0.05));
  }
  // Segundos de capa colocados antes do vídeo (0 se desligado).
  function capaIntro(s) {
    return s.capa && s.capa.ativo && s.capa.noInicio ? clamp(s.capa.duracao, 0.04, 5) : 0;
  }

  function limpezaRects(meta, s) {
    const c = s.limpeza;
    if (!c || c.modo === 'nenhum' || !['gravado', 'ambos'].includes(c.fonte) || c.metodo !== 'reconstruir') return [];
    const roles = c.modo === 'ambos' ? ['headline', 'legenda'] : [c.modo];
    return roles.filter((role) => c[role]).map((role) => {
      const r = c[role];
      const x = Math.max(1, Math.min(meta.width - 4, Math.round(meta.width * clamp(r.x, 0, 100) / 100)));
      const y = Math.max(1, Math.min(meta.height - 4, Math.round(meta.height * clamp(r.y, 0, 100) / 100)));
      const w = Math.max(2, Math.min(meta.width - x - 2, Math.round(meta.width * clamp(r.w, 0, 100) / 100)));
      const h = Math.max(2, Math.min(meta.height - y - 2, Math.round(meta.height * clamp(r.h, 0, 100) / 100)));
      return { role, x, y, w, h };
    });
  }
  function limpezaFilters(meta, s) {
    return limpezaRects(meta, s).map((r) => 'delogo=x=' + r.x + ':y=' + r.y + ':w=' + r.w + ':h=' + r.h);
  }

  // O editor tem um único bloco de texto: o usuário identifica o seu papel.
  function ocultarTexto(s) {
    const c = s.limpeza;
    return !!(c && ['editor', 'ambos'].includes(c.fonte) &&
      (c.modo === 'ambos' || c.modo === c.papel));
  }

  const api = { limpezaRects, limpezaFilters, ocultarTexto, DEFAULTS, clone, merge, even, canvasSize, layout, timing, eqParams, capaSourceTime, capaIntro, FILTROS, filtroSpec, vinAngle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(typeof window !== 'undefined' ? window : globalThis);

