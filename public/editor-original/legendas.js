// Legenda animada (palavra por palavra) e emojis automáticos.
// O mesmo desenho serve para o preview ao vivo, para as miniaturas da mesa e para a exportação:
// na exportação, cada mudança da legenda vira um PNG e o FFmpeg sobrepõe a sequência no vídeo.
// Tempos das palavras (w.s / w.e) são do arquivo de vídeo original, em segundos.
(function () {
  "use strict";
  // funciona na página e dentro dos ajudantes (Web Workers)
  const raiz = typeof window !== "undefined" ? window : self;
  const FALLBACK = '"Segoe UI", Arial, sans-serif';
  const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  const fontStr = (fam, weight, size) => `${weight} ${Math.round(size)}px "${fam}", ${FALLBACK}`;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, Number(n) || 0));

  const ESTILOS = {
    destaque: "Palavra colorida",
    karaoke: "Karaokê",
    caixa: "Caixa na palavra",
    palavra: "Uma palavra por vez",
    simples: "Simples",
  };

  // ------------------------------------------------------------ texto
  const semAcento = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  function limparPalavra(w, cfg) {
    let t = String(w || "").trim();
    if (cfg.semPontuacao) {
      const pergunta = /\?$/.test(t);
      t = t.replace(/[.,;:!?…"“”()]+/g, "");
      if (pergunta && cfg.manterInterrogacao) t += "?";
    }
    if (cfg.maiusculas) t = t.toLocaleUpperCase("pt-BR");
    return t;
  }

  // ------------------------------------------------------------ páginas (grupos de palavras que aparecem juntos)
  const pagCache = new WeakMap();
  function paginas(words, cfg) {
    if (!words || !words.length) return [];
    const n = cfg.estilo === "palavra" ? 1 : clamp(cfg.palavras, 1, 8);
    const key = n + "|" + (cfg.maxLetras || 0);
    let c = pagCache.get(words);
    if (c && c.key === key) return c.pages;
    const maxLetras = cfg.maxLetras || n * 9;
    const pages = [];
    let cur = [];
    let letras = 0;
    const fecha = () => {
      if (cur.length) pages.push({ words: cur, s: cur[0].s, e: cur[cur.length - 1].e });
      cur = [];
      letras = 0;
    };
    words.forEach((w, i) => {
      const prev = words[i - 1];
      if (
        cur.length &&
        (cur.length >= n || letras + w.w.length > maxLetras || (prev && w.s - prev.e > 0.7))
      )
        fecha();
      cur.push({ ...w, i });
      letras += w.w.length + 1;
      if (/[.!?…]$/.test(w.w) && cur.length >= Math.min(2, n)) fecha();
    });
    fecha();
    // cada página fica na tela até a próxima começar (se a pausa for curta)
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i],
        nx = pages[i + 1];
      p.fim = nx && nx.s - p.e < 0.6 ? nx.s : p.e + 0.35;
      if (nx && p.fim > nx.s) p.fim = nx.s;
      p.idx = i;
    }
    pagCache.set(words, { key, pages });
    return pages;
  }
  function paginaEm(pages, t) {
    let lo = 0,
      hi = pages.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (t < pages[m].s) hi = m - 1;
      else if (t >= pages[m].fim) lo = m + 1;
      else return pages[m];
    }
    return null;
  }

  // ------------------------------------------------------------ animação
  // "pop": a palavra nasce menor, passa um pouco do tamanho e volta (0 → 0,15 s).
  function pop(dt) {
    if (dt < 0) return 1;
    if (dt < 0.05) return 0.86;
    if (dt < 0.1) return 1.12;
    if (dt < 0.15) return 1.05;
    return 1;
  }
  // instantes em que a animação muda (usados na exportação para gerar os quadros)
  const PASSOS = [0, 0.05, 0.1, 0.15];

  // ------------------------------------------------------------ emojis automáticos
  // Palavra-chave (sem acento) → emoji. Usado quando a IA não sugeriu ou para vídeos comuns.
  const DIC = [
    [
      /^(dinheiro|grana|rico|rica|ricos|riqueza|milhao|milhoes|milionario|reais|dolar|dolares|lucro|salario|bilionario)/,
      "💰",
    ],
    [/^(fogo|incrivel|brabo|absurdo|insano|explosivo)/, "🔥"],
    [/^(deus|jesus|fe$|oracao|orar|igreja|senhor$)/, "🙏"],
    [/^(amor|amo$|coracao|paixao|apaixon)/, "❤️"],
    [/^(morte|morrer|morreu|morto|caixao)/, "💀"],
    [/^(rir|risada|engracad|piada|kkk|hahah)/, "😂"],
    [/^(medo|assust|terror|panico)/, "😱"],
    [/^(cerebro|mente|mental|inteligen|pensar|pensamento)/, "🧠"],
    [/^(trabalh|emprego|carreira|chefe)/, "💼"],
    [/^(foco|meta$|metas|objetivo|alvo|disciplina)/, "🎯"],
    [/^(forte|forca|treino|treinar|academia|musculo)/, "💪"],
    [/^(tempo$|horas?$|relogio|minuto|atrasad)/, "⏰"],
    [/^(sucesso|vencer|venceu|vitoria|campeao|ganhar|ganhou)/, "🏆"],
    [/^(crescer|crescimento|resultado|evolu)/, "📈"],
    [/^(perder|perdeu|perda|queda|fracass|falir|faliu)/, "📉"],
    [/^(familia|filho|filha|filhos|mae$|pai$)/, "👨‍👩‍👧"],
    [/^(casa$|casas$|lar$)/, "🏠"],
    [/^(carro|carros)$/, "🚗"],
    [/^(planeta|terra$)/, "🌍"],
    [/^(segredo|secreto)/, "🤫"],
    [/^(verdade|real$|serio$)/, "💯"],
    [/^(ideia|ideias)/, "💡"],
    [/^(livro|livros|leitura|estudar|estudo|aprender)/, "📚"],
    [/^(celular|instagram|tiktok|internet|redes$)/, "📱"],
    [/^(comida|comer|fome|almoco|jantar)/, "🍔"],
    [/^(dormir|sono|cansad)/, "😴"],
    [/^(coragem|guerreiro|batalha|guerra|luta|lutar)/, "⚔️"],
    [/^(sonho|sonhos|sonhar)/, "✨"],
    [/^(chorar|chorou|triste|tristeza|lagrima)/, "😢"],
    [/^(raiva|odio|irritad|bravo)/, "😡"],
    [/^(empresa|negocio|empreend)/, "🏢"],
    [/^(venda|vender|vendas|cliente)/, "🤝"],
    [/^(problema|perigo|cuidado|erro$|erros$)/, "⚠️"],
    [/^(rapido|velocidade|energia)/, "⚡"],
    [/^(saude|medico|doenca|hospital)/, "🏥"],
    [/^(casamento|esposa|marido|namorad)/, "💍"],
    [/^(escola|faculdade|professor|universidade)/, "🎓"],
    [/^(musica|cantar|cancao)/, "🎵"],
    [/^(futebol|gol$|bola$)/, "⚽"],
    [/^(nunca|proibido)/, "🚫"],
    [/^(olha$|olhe$|veja$|olho|olhos)/, "👀"],
    [/^(viagem|viajar|aviao)/, "✈️"],
    [/^(bomba|explod)/, "💣"],
    [/^(rei$|rainha|coroa)/, "👑"],
    [/^(paz$|calma|tranquil)/, "🕊️"],
    [/^(famoso|fama|estrela)/, "⭐"],
    [/^(pergunta|duvida)/, "🤔"],
    [/^(oportunidade|chance)/, "🚪"],
    [/^(liberdade|livre$)/, "🦅"],
    [/^(felicidade|feliz)/, "😁"],
    [/^(ansiedade|ansios|depress)/, "😰"],
  ];
  function emojiDaPalavra(w) {
    const k = semAcento(w).replace(/[^a-z0-9]/g, "");
    if (k.length < 2) return null;
    for (const [re, e] of DIC) if (re.test(k)) return e;
    return null;
  }
  // Monta a lista de emojis do vídeo: sugestões da IA primeiro ({palavra, emoji}), depois o dicionário.
  // Respeita um intervalo mínimo para não poluir.
  function gerarEmojis(words, sugestoes, intervalo = 2.6) {
    const out = [];
    if (!words || !words.length) return out;
    const sug = new Map();
    for (const s of sugestoes || []) {
      const k = semAcento(s && s.palavra).replace(/[^a-z0-9]/g, "");
      if (k && s.emoji) sug.set(k, String(s.emoji).trim());
    }
    let ultimo = -1e9;
    for (const w of words) {
      const k = semAcento(w.w).replace(/[^a-z0-9]/g, "");
      const e = sug.get(k) || emojiDaPalavra(w.w);
      if (!e || w.s - ultimo < intervalo) continue;
      out.push({ s: w.s, e: w.s + 1.6, ch: e });
      ultimo = w.s;
    }
    for (let i = 0; i < out.length - 1; i++) out[i].e = Math.min(out[i].e, out[i + 1].s);
    return out;
  }

  // ------------------------------------------------------------ desenho
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  const cores = (cfg) => [cfg.destaque, cfg.destaque2, cfg.destaque3].filter(Boolean);

  // Desenha a legenda e o emoji do instante t (segundos do vídeo original).
  // cap = { words, emojis }. Não limpa o canvas.
  function desenhar(ctx, s, cap, t, CW, CH, opts = {}) {
    const cfg = s.legendaAnim;
    if (!cfg || !cfg.ativo || !cap) return;
    const U = CW / 1080;
    const pages = paginas(cap.words, cfg);
    const pg = paginaEm(pages, t);
    const grande = cfg.estilo === "palavra" ? 1.3 : 1;
    const size = cfg.tamanho * U * grande;
    const cy = (CH * cfg.v) / 100;
    let topoBloco = cy - size / 2;

    if (pg) {
      ctx.save();
      ctx.font = fontStr(cfg.fonte, cfg.peso, size);
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const itens = pg.words.map((w) => ({ w, txt: limparPalavra(w.w, cfg) })).filter((x) => x.txt);
      const esp = ctx.measureText(" ").width * 1.1;
      const ultimaPg = pg.words[pg.words.length - 1];
      for (const x of itens) {
        const w = x.w;
        x.larg = ctx.measureText(x.txt).width;
        x.ativa = t >= w.s && (t < w.e || (w === ultimaPg && t < pg.fim));
        x.k =
          cfg.animacao === "pop" &&
          cfg.estilo !== "simples" &&
          (x.ativa || cfg.estilo === "palavra")
            ? pop(t - w.s)
            : 1;
      }
      // quebra em linhas pela largura normal (as linhas não pulam durante a animação)
      const maxW = (CW * cfg.largura) / 100;
      const linhas = [];
      let lin = [],
        lw = 0;
      for (const x of itens) {
        const add = (lin.length ? esp : 0) + x.larg;
        if (lin.length && lw + add > maxW) {
          linhas.push({ itens: lin });
          lin = [];
          lw = 0;
        }
        lw += add;
        lin.push(x);
      }
      if (lin.length) linhas.push({ itens: lin });
      // largura real da linha com a palavra animada (as vizinhas abrem espaço para ela)
      for (const L of linhas)
        L.w = L.itens.reduce((a, x, i) => a + x.larg * x.k + (i ? esp : 0), 0);
      const lh = size * 1.12;
      topoBloco = cy - (lh * linhas.length) / 2;

      // entrada da página
      let dy = 0,
        alpha = 1;
      if (cfg.animacao === "subir") {
        const dt = t - pg.s;
        if (dt < 0.05) {
          dy = 26 * U;
          alpha = 0.35;
        } else if (dt < 0.1) {
          dy = 10 * U;
          alpha = 0.75;
        }
      }
      ctx.globalAlpha = alpha;
      const cs = cores(cfg);
      const corPag = cfg.trocarCor ? cs[pg.idx % cs.length] : cs[0];
      linhas.forEach((L, li) => {
        let x = CW / 2 - L.w / 2;
        const y = topoBloco + lh * li + lh / 2 + dy;
        for (const it of L.itens) {
          const w = it.w;
          const ativa = it.ativa;
          const dita = t >= w.s;
          let cor = cfg.cor;
          if (cfg.estilo === "destaque" && ativa) cor = corPag;
          if (cfg.estilo === "karaoke" && dita) cor = corPag;
          if (cfg.estilo === "palavra") cor = cfg.trocarCor ? cs[pg.idx % cs.length] : cfg.cor;
          const k = it.k;
          const cx = x + (it.larg * k) / 2;
          ctx.save();
          ctx.translate(cx, y);
          ctx.scale(k, k);
          const naCaixa = cfg.estilo === "caixa" && ativa;
          if (naCaixa) {
            const px = size * 0.2,
              py = size * 0.08;
            ctx.save();
            if (cfg.sombra) {
              ctx.shadowColor = "rgba(0,0,0,0.45)";
              ctx.shadowBlur = size * 0.16;
              ctx.shadowOffsetY = size * 0.06;
            }
            roundRect(
              ctx,
              -it.larg / 2 - px,
              -size * 0.56 - py,
              it.larg + px * 2,
              size * 1.12 + py * 2,
              size * 0.24,
            );
            ctx.fillStyle = corPag;
            ctx.fill();
            ctx.restore();
          }
          if (cfg.sombra && !naCaixa) {
            ctx.shadowColor = "rgba(0,0,0,0.55)";
            ctx.shadowBlur = size * 0.14;
            ctx.shadowOffsetY = size * 0.05;
          }
          if (cfg.contorno && !naCaixa) {
            ctx.lineJoin = "round";
            ctx.miterLimit = 2;
            ctx.lineWidth = size * 0.17;
            ctx.strokeStyle = cfg.contornoCor;
            ctx.strokeText(it.txt, -it.larg / 2, 0);
            ctx.shadowColor = "transparent";
          }
          ctx.fillStyle = naCaixa ? cfg.caixaTexto || "#ffffff" : cor;
          ctx.fillText(it.txt, -it.larg / 2, 0);
          ctx.restore();
          x += it.larg * k + esp;
        }
      });
      ctx.restore();
    }

    // emoji acima da legenda
    if (cfg.emojis && cap.emojis && cap.emojis.length) {
      const em = cap.emojis.find((e) => t >= e.s && t < e.e);
      if (em) {
        const es = cfg.emojiTam * U;
        const k = pop(t - em.s);
        ctx.save();
        ctx.font = `${Math.round(es)}px ${EMOJI_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.translate(CW / 2, Math.min(topoBloco, cy - size / 2) - es * 0.62);
        ctx.scale(k, k);
        ctx.fillText(em.ch, 0, 0);
        ctx.restore();
      }
    }
    if (opts.debug) return pg;
  }

  // Legenda de exemplo para o preview quando o vídeo ainda não tem transcrição.
  const EXEMPLO = "Sua legenda animada aparece assim palavra por palavra no vídeo".split(" ");
  function exemplo(t0 = 0) {
    const words = EXEMPLO.map((w, i) => ({ w, s: t0 + i * 0.38, e: t0 + i * 0.38 + 0.36 }));
    return { words, emojis: [{ s: t0 + 1.9, e: t0 + 3.4, ch: "🔥" }] };
  }

  // ------------------------------------------------------------ exportação
  // Faixa da tela usada pela legenda (só ela vira PNG, para ficar leve).
  function faixa(s, CW, CH) {
    const cfg = s.legendaAnim;
    const U = CW / 1080;
    const size = cfg.tamanho * U * (cfg.estilo === "palavra" ? 1.3 : 1);
    const cy = (CH * cfg.v) / 100;
    const acima = size * 1.12 * 2.2 + (cfg.emojis ? cfg.emojiTam * U * 1.5 : 0) + size * 0.6;
    const abaixo = size * 1.12 * 2.2;
    let y0 = Math.max(0, Math.floor(cy - acima));
    let y1 = Math.min(CH, Math.ceil(cy + abaixo));
    y0 -= y0 % 2;
    if ((y1 - y0) % 2) y1 = Math.min(CH, y1 + 1);
    if ((y1 - y0) % 2) y0 = Math.max(0, y0 - 1);
    return { y0, h: y1 - y0 };
  }

  // Lista de instantes (tempo do original) em que a legenda muda.
  function eventos(s, cap, a, b) {
    const cfg = s.legendaAnim;
    const ev = new Set([a]);
    const add = (t) => {
      if (t > a && t < b) ev.add(Math.round(t * 1000) / 1000);
    };
    const anima = cfg.animacao !== "nenhuma";
    for (const p of paginas(cap.words, cfg)) {
      if (p.fim < a || p.s > b) continue;
      add(p.s);
      add(p.fim);
      if (cfg.animacao === "subir") PASSOS.forEach((d) => add(p.s + d));
      for (const w of p.words) {
        add(w.s);
        add(w.e);
        if (anima && cfg.animacao === "pop") PASSOS.forEach((d) => add(w.s + d));
      }
    }
    if (cfg.emojis)
      for (const e of cap.emojis || []) {
        add(e.s);
        add(e.e);
        PASSOS.forEach((d) => add(e.s + d));
      }
    return [...ev].sort((x, y) => x - y);
  }

  // "Assinatura" do que aparece na tela no instante t: dois instantes com a mesma assinatura
  // geram exatamente o mesmo quadro, então só um PNG é desenhado (bem menos trabalho).
  function assinatura(s, cap, t) {
    const cfg = s.legendaAnim;
    const pg = paginaEm(paginas(cap.words, cfg), t);
    let a = "x";
    if (pg) {
      a = "p" + pg.idx;
      if (cfg.animacao === "subir") {
        const dt = t - pg.s;
        a += dt < 0.05 ? "a" : dt < 0.1 ? "b" : "c";
      }
      const ult = pg.words[pg.words.length - 1];
      for (const w of pg.words) {
        const ativa = t >= w.s && (t < w.e || (w === ult && t < pg.fim));
        const k =
          cfg.animacao === "pop" && cfg.estilo !== "simples" && (ativa || cfg.estilo === "palavra")
            ? pop(t - w.s)
            : 1;
        a += (t >= w.s ? "d" : "n") + (ativa ? "A" : "") + k;
      }
    }
    if (cfg.emojis && cap.emojis && cap.emojis.length) {
      const i = cap.emojis.findIndex((e) => t >= e.s && t < e.e);
      if (i >= 0) a += "|e" + i + ":" + pop(t - cap.emojis[i].s);
    }
    return a;
  }

  // Lista dos quadros diferentes da legenda: [{ t, dur }] (dur já na velocidade final).
  function planoQuadros(s, cap, T) {
    const ts = eventos(s, cap, T.start, T.end);
    const itens = [];
    let ant = null;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      const fim = i + 1 < ts.length ? ts[i + 1] : T.end;
      const dur = (fim - t) / T.speed;
      if (dur <= 0.0005) continue;
      const sig = assinatura(s, cap, t + 0.0005);
      if (ant && ant.sig === sig) {
        ant.dur += dur;
        continue;
      }
      ant = { t, dur, sig };
      itens.push(ant);
    }
    return itens;
  }

  // ---------- ajudantes em paralelo (Web Workers): cada um desenha e comprime parte dos quadros
  const pool = { workers: [], livres: [], fila: [], falhou: false, seq: 0, pend: new Map() };
  function criarPool() {
    if (pool.workers.length || pool.falhou) return;
    try {
      if (typeof OffscreenCanvas === "undefined" || typeof Worker === "undefined")
        throw new Error("sem suporte");
      const n = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
      for (let i = 0; i < n; i++) {
        const w = new Worker("cap-worker.js");
        w.onmessage = (e) => {
          const p = pool.pend.get(e.data.id);
          pool.pend.delete(e.data.id);
          pool.livres.push(w);
          proximo();
          if (!p) return;
          if (e.data.erro) p.rej(new Error(e.data.erro));
          else p.res(e.data.pngs);
        };
        w.onerror = (ev) => {
          ev.preventDefault();
          pool.falhou = true;
          for (const p of pool.pend.values()) p.rej(new Error("worker falhou"));
          pool.pend.clear();
        };
        pool.workers.push(w);
        pool.livres.push(w);
      }
    } catch (_) {
      pool.falhou = true;
    }
  }
  function proximo() {
    while (pool.livres.length && pool.fila.length) {
      const w = pool.livres.shift();
      const tarefa = pool.fila.shift();
      pool.pend.set(tarefa.msg.id, tarefa);
      w.postMessage(tarefa.msg);
    }
  }
  function noPool(msg) {
    return new Promise((res, rej) => {
      msg.id = ++pool.seq;
      pool.fila.push({ msg, res, rej });
      proximo();
    });
  }

  // Desenha na própria página (caminho antigo, se os ajudantes não funcionarem).
  async function desenharAqui(s, cap, itens, CW, CH, y0, h) {
    const c = document.createElement("canvas");
    c.width = CW;
    c.height = h;
    const ctx = c.getContext("2d");
    const out = [];
    for (const it of itens) {
      ctx.clearRect(0, 0, CW, h);
      ctx.save();
      ctx.translate(0, -y0);
      desenhar(ctx, s, cap, it.t + 0.0005, CW, CH);
      ctx.restore();
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      out.push(await blob.arrayBuffer());
    }
    return out;
  }

  // Gera a sequência de PNGs da legenda para um vídeo.
  // T = Shared.timing(meta, s). Devolve { y0, h, quadros: [{ png: Uint8Array, dur }] } ou null.
  async function gerarFaixa(s, cap, T) {
    const cfg = s.legendaAnim;
    if (!cfg || !cfg.ativo || !cap || !cap.words || !cap.words.length) return null;
    const { CW, CH } = raiz.Shared.canvasSize(s);
    const { y0, h } = faixa(s, CW, CH);
    const itens = planoQuadros(s, cap, T);
    const capLeve = { words: cap.words, emojis: cap.emojis || [] };
    let pngs = null;
    criarPool();
    if (!pool.falhou) {
      try {
        const lote = Math.max(12, Math.ceil(itens.length / (pool.workers.length * 3)));
        const partes = [];
        for (let i = 0; i < itens.length; i += lote) {
          partes.push(
            noPool({
              s,
              cap: capLeve,
              itens: itens.slice(i, i + lote).map((x) => ({ t: x.t })),
              CW,
              CH,
              y0,
              h,
            }),
          );
        }
        pngs = (await Promise.all(partes)).flat();
      } catch (_) {
        pool.falhou = true;
        pngs = null;
      }
    }
    if (!pngs) pngs = await desenharAqui(s, capLeve, itens, CW, CH, y0, h);
    const quadros = [];
    let ultimo = null;
    itens.forEach((it, i) => {
      const png = new Uint8Array(pngs[i]);
      if (ultimo && ultimo.png.length === png.length && iguais(ultimo.png, png)) {
        ultimo.dur += it.dur;
        return;
      }
      ultimo = { png, dur: it.dur };
      quadros.push(ultimo);
    });
    return { y0, h, quadros };
  }
  function iguais(a, b) {
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
    return true;
  }

  // ------------------------------------------------------------ correção do texto
  // O usuário corrige o texto da transcrição: mantém os tempos das palavras que continuam iguais
  // e distribui as novas entre as vizinhas.
  function realinhar(words, texto) {
    const novas = String(texto || "")
      .split(/\s+/)
      .filter(Boolean);
    if (!words || !words.length || !novas.length) return [];
    const A = words.map((w) => semAcento(w.w).replace(/[^a-z0-9]/g, ""));
    const B = novas.map((w) => semAcento(w).replace(/[^a-z0-9]/g, ""));
    const n = A.length,
      m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const par = new Array(m).fill(-1);
    for (let i = 0, j = 0; i < n && j < m;) {
      if (A[i] === B[j]) {
        par[j] = i;
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    const out = novas.map((w, j) =>
      par[j] >= 0 ? { w, s: words[par[j]].s, e: words[par[j]].e } : { w, s: null, e: null },
    );
    // preenche as palavras sem par interpolando entre as conhecidas
    const ini = words[0].s,
      fimTot = words[words.length - 1].e;
    let j = 0;
    while (j < m) {
      if (out[j].s !== null) {
        j++;
        continue;
      }
      let k = j;
      while (k < m && out[k].s === null) k++;
      const a = j > 0 ? out[j - 1].e : ini;
      const b = k < m ? out[k].s : fimTot;
      const passo = Math.max(0.05, (b - a) / (k - j));
      for (let x = j; x < k; x++) {
        out[x].s = a + passo * (x - j);
        out[x].e = out[x].s + passo;
      }
      j = k;
    }
    return out;
  }

  raiz.Legendas = {
    ESTILOS,
    paginas,
    desenhar,
    exemplo,
    gerarFaixa,
    gerarEmojis,
    emojiDaPalavra,
    realinhar,
    faixa,
    eventos,
    planoQuadros,
    assinatura,
  };
})();
