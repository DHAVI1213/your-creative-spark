/**
 * Legenda animada (palavra por palavra) e emojis automáticos — porte do legendas.js do desktop.
 * O mesmo desenho serve para a prévia ao vivo e para a exportação: na exportação, cada mudança da
 * legenda vira um PNG e o FFmpeg sobrepõe a sequência (demuxer concat) no vídeo.
 * Tempos das palavras (s / e) são do arquivo de vídeo original, em segundos.
 */
import type { EmojiMark, Settings, Word } from './model';

type Cfg = Settings['legendaAnim'];
export type Cap = { words: Word[]; emojis?: EmojiMark[] };
type PWord = Word & { i: number };
type Page = { words: PWord[]; s: number; e: number; fim: number; idx: number };

const FALLBACK = '"Segoe UI", Arial, sans-serif';
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const fontStr = (fam: string, weight: number, size: number) => `${weight} ${Math.round(size)}px "${fam}", ${FALLBACK}`;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, Number(n) || 0));

export const ESTILOS: Record<string, string> = {
  destaque: "Palavra colorida",
  karaoke: "Karaokê",
  caixa: "Caixa na palavra",
  palavra: "Uma palavra por vez",
  simples: "Simples",
};

export const semAcento = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chave = (s: string) => semAcento(s).replace(/[^a-z0-9]/g, "");

function limparPalavra(w: string, cfg: Cfg) {
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
const pagCache = new WeakMap<Word[], { key: string; pages: Page[] }>();
export function paginas(words: Word[] | undefined, cfg: Cfg): Page[] {
  if (!words || !words.length) return [];
  const n = cfg.estilo === "palavra" ? 1 : clamp(cfg.palavras, 1, 8);
  const maxLetras = n * 9;
  const key = n + "|" + maxLetras;
  const c = pagCache.get(words);
  if (c && c.key === key) return c.pages;
  const pages: Page[] = [];
  let cur: PWord[] = [];
  let letras = 0;
  const fecha = () => {
    if (cur.length) pages.push({ words: cur, s: cur[0]!.s, e: cur[cur.length - 1]!.e, fim: 0, idx: 0 });
    cur = [];
    letras = 0;
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length && (cur.length >= n || letras + w.w.length > maxLetras || (prev && w.s - prev.e > 0.7))) fecha();
    cur.push({ ...w, i });
    letras += w.w.length + 1;
    if (/[.!?…]$/.test(w.w) && cur.length >= Math.min(2, n)) fecha();
  });
  fecha();
  // cada página fica na tela até a próxima começar (se a pausa for curta)
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!;
    const nx = pages[i + 1];
    p.fim = nx && nx.s - p.e < 0.6 ? nx.s : p.e + 0.35;
    if (nx && p.fim > nx.s) p.fim = nx.s;
    p.idx = i;
  }
  pagCache.set(words, { key, pages });
  return pages;
}

function paginaEm(pages: Page[], t: number): Page | null {
  let lo = 0;
  let hi = pages.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    const p = pages[m]!;
    if (t < p.s) hi = m - 1;
    else if (t >= p.fim) lo = m + 1;
    else return p;
  }
  return null;
}

// "pop": a palavra nasce menor, passa um pouco do tamanho e volta (0 → 0,15 s).
function pop(dt: number) {
  if (dt < 0) return 1;
  if (dt < 0.05) return 0.86;
  if (dt < 0.1) return 1.12;
  if (dt < 0.15) return 1.05;
  return 1;
}
const PASSOS = [0, 0.05, 0.1, 0.15];

// ------------------------------------------------------------ emojis automáticos
const DIC: [RegExp, string][] = [
  [/^(dinheiro|grana|rico|rica|ricos|riqueza|milhao|milhoes|milionario|reais|dolar|dolares|lucro|salario|bilionario)/, "💰"],
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

export function emojiDaPalavra(w: string): string | null {
  const k = chave(w);
  if (k.length < 2) return null;
  for (const [re, e] of DIC) if (re.test(k)) return e;
  return null;
}

/** Emojis do vídeo: sugestões da IA primeiro ({palavra, emoji}), depois o dicionário, com intervalo mínimo. */
export function gerarEmojis(words: Word[] | undefined, sugestoes?: { palavra: string; emoji: string }[], intervalo = 2.6): EmojiMark[] {
  const out: EmojiMark[] = [];
  if (!words || !words.length) return out;
  const sug = new Map<string, string>();
  for (const s of sugestoes || []) {
    const k = chave(s?.palavra);
    if (k && s.emoji) sug.set(k, String(s.emoji).trim());
  }
  let ultimo = -1e9;
  for (const w of words) {
    const e = sug.get(chave(w.w)) || emojiDaPalavra(w.w);
    if (!e || w.s - ultimo < intervalo) continue;
    out.push({ s: w.s, e: w.s + 1.6, ch: e });
    ultimo = w.s;
  }
  for (let i = 0; i < out.length - 1; i++) out[i]!.e = Math.min(out[i]!.e, out[i + 1]!.s);
  return out;
}

// ------------------------------------------------------------ desenho
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const cores = (cfg: Cfg) => [cfg.destaque, cfg.destaque2, cfg.destaque3].filter(Boolean);

/** Desenha a legenda e o emoji do instante t (segundos do vídeo original). Não limpa o canvas. */
export function desenhar(ctx: Ctx, s: Settings, cap: Cap | null | undefined, t: number, CW: number, CH: number) {
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
    const itens = pg.words
      .map((w) => ({ w, txt: limparPalavra(w.w, cfg), larg: 0, ativa: false, k: 1 }))
      .filter((x) => x.txt);
    const esp = ctx.measureText(" ").width * 1.1;
    const ultimaPg = pg.words[pg.words.length - 1];
    for (const x of itens) {
      const w = x.w;
      x.larg = ctx.measureText(x.txt).width;
      x.ativa = t >= w.s && (t < w.e || (w === ultimaPg && t < pg.fim));
      x.k = cfg.animacao === "pop" && cfg.estilo !== "simples" && (x.ativa || cfg.estilo === "palavra") ? pop(t - w.s) : 1;
    }
    // quebra em linhas pela largura normal (as linhas não pulam durante a animação)
    const maxW = (CW * cfg.largura) / 100;
    const linhas: { itens: typeof itens; w: number }[] = [];
    let lin: typeof itens = [];
    let lw = 0;
    for (const x of itens) {
      const add = (lin.length ? esp : 0) + x.larg;
      if (lin.length && lw + add > maxW) {
        linhas.push({ itens: lin, w: 0 });
        lin = [];
        lw = 0;
      }
      lw += add;
      lin.push(x);
    }
    if (lin.length) linhas.push({ itens: lin, w: 0 });
    for (const L of linhas) L.w = L.itens.reduce((a, x, i) => a + x.larg * x.k + (i ? esp : 0), 0);
    const lh = size * 1.12;
    topoBloco = cy - (lh * linhas.length) / 2;

    let dy = 0;
    let alpha = 1;
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
    const corPag = (cfg.trocarCor ? cs[pg.idx % cs.length] : cs[0]) || cfg.cor;
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
        if (cfg.estilo === "palavra") cor = cfg.trocarCor ? cs[pg.idx % cs.length] || cfg.cor : cfg.cor;
        const k = it.k;
        const cx = x + (it.larg * k) / 2;
        ctx.save();
        ctx.translate(cx, y);
        ctx.scale(k, k);
        const naCaixa = cfg.estilo === "caixa" && ativa;
        if (naCaixa) {
          const px = size * 0.2;
          const py = size * 0.08;
          ctx.save();
          if (cfg.sombra) {
            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = size * 0.16;
            ctx.shadowOffsetY = size * 0.06;
          }
          roundRect(ctx, -it.larg / 2 - px, -size * 0.56 - py, it.larg + px * 2, size * 1.12 + py * 2, size * 0.24);
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
}

const EXEMPLO = "Sua legenda animada aparece assim palavra por palavra no vídeo".split(" ");
/** Legenda de exemplo para a prévia quando o vídeo ainda não tem transcrição. */
export function exemplo(t0 = 0): Cap {
  const words = EXEMPLO.map((w, i) => ({ w, s: t0 + i * 0.38, e: t0 + i * 0.38 + 0.36 }));
  return { words, emojis: [{ s: t0 + 1.9, e: t0 + 3.4, ch: "🔥" }] };
}

// ------------------------------------------------------------ exportação
/** Faixa da tela usada pela legenda (só ela vira PNG, para ficar leve). */
export function faixa(s: Settings, CW: number, CH: number) {
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

/** Instantes (tempo do original) em que a legenda muda. */
export function eventos(s: Settings, cap: Cap, a: number, b: number) {
  const cfg = s.legendaAnim;
  const ev = new Set<number>([a]);
  const add = (t: number) => {
    if (t > a && t < b) ev.add(Math.round(t * 1000) / 1000);
  };
  for (const p of paginas(cap.words, cfg)) {
    if (p.fim < a || p.s > b) continue;
    add(p.s);
    add(p.fim);
    if (cfg.animacao === "subir") PASSOS.forEach((d) => add(p.s + d));
    for (const w of p.words) {
      add(w.s);
      add(w.e);
      if (cfg.animacao === "pop") PASSOS.forEach((d) => add(w.s + d));
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

/** "Assinatura" do que aparece no instante t: instantes com a mesma assinatura geram o mesmo quadro. */
export function assinatura(s: Settings, cap: Cap, t: number) {
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
      const k = cfg.animacao === "pop" && cfg.estilo !== "simples" && (ativa || cfg.estilo === "palavra") ? pop(t - w.s) : 1;
      a += (t >= w.s ? "d" : "n") + (ativa ? "A" : "") + k;
    }
  }
  if (cfg.emojis && cap.emojis && cap.emojis.length) {
    const i = cap.emojis.findIndex((e) => t >= e.s && t < e.e);
    if (i >= 0) a += "|e" + i + ":" + pop(t - cap.emojis[i]!.s);
  }
  return a;
}

export type Timing = { start: number; end: number; speed: number };
/** Lista dos quadros diferentes da legenda: [{ t, dur }] (dur já na velocidade final). */
export function planoQuadros(s: Settings, cap: Cap, T: Timing) {
  const ts = eventos(s, cap, T.start, T.end);
  const itens: { t: number; dur: number; sig: string }[] = [];
  let ant: (typeof itens)[number] | null = null;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]!;
    const fim = i + 1 < ts.length ? ts[i + 1]! : T.end;
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

export type Faixa = { y0: number; h: number; quadros: { png: Uint8Array; dur: number }[] };

/** Gera a sequência de PNGs da legenda de um vídeo (ou null se não houver legenda). */
export async function gerarFaixa(s: Settings, cap: Cap | null, T: Timing, CW: number, CH: number): Promise<Faixa | null> {
  const cfg = s.legendaAnim;
  if (!cfg || !cfg.ativo || !cap || !cap.words || !cap.words.length) return null;
  await document.fonts.load(`${cfg.peso} 80px "${cfg.fonte}"`).catch(() => undefined);
  const { y0, h } = faixa(s, CW, CH);
  const itens = planoQuadros(s, cap, T);
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const quadros: Faixa["quadros"] = [];
  let ultimo: Faixa["quadros"][number] | null = null;
  for (const it of itens) {
    ctx.clearRect(0, 0, CW, h);
    ctx.save();
    ctx.translate(0, -y0);
    desenhar(ctx, s, cap, it.t + 0.0005, CW, CH);
    ctx.restore();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (!blob) throw new Error("Não consegui desenhar a legenda.");
    const png = new Uint8Array(await blob.arrayBuffer());
    if (ultimo && iguais(ultimo.png, png)) {
      ultimo.dur += it.dur;
      continue;
    }
    ultimo = { png, dur: it.dur };
    quadros.push(ultimo);
  }
  c.width = 1;
  c.height = 1;
  return { y0, h, quadros };
}

function iguais(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Lista do demuxer concat do FFmpeg para a sequência de PNGs. */
export function listaConcat(nomes: string[], quadros: { dur: number }[]) {
  const linhas = ["ffconcat version 1.0"];
  quadros.forEach((q, i) => linhas.push(`file '${nomes[i]}'`, `duration ${Math.max(0.001, q.dur).toFixed(4)}`));
  // o concat ignora a duração do último item se ele não se repetir
  if (quadros.length) linhas.push(`file '${nomes[quadros.length - 1]}'`);
  return linhas.join("\n") + "\n";
}

// ------------------------------------------------------------ correção do texto
/** O usuário corrige o texto: mantém os tempos das palavras iguais e distribui as novas entre as vizinhas. */
export function realinhar(words: Word[] | undefined, texto: string): Word[] {
  const novas = String(texto || "").split(/\s+/).filter(Boolean);
  if (!words || !words.length || !novas.length) return [];
  const A = words.map((w) => chave(w.w));
  const B = novas.map((w) => chave(w));
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const par = new Array<number>(m).fill(-1);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (A[i] === B[j]) {
      par[j] = i;
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  const out = novas.map((w, j) => (par[j]! >= 0 ? { w, s: words[par[j]!]!.s, e: words[par[j]!]!.e } : { w, s: NaN, e: NaN }));
  const ini = words[0]!.s;
  const fimTot = words[words.length - 1]!.e;
  let j = 0;
  while (j < m) {
    if (!Number.isNaN(out[j]!.s)) {
      j++;
      continue;
    }
    let k = j;
    while (k < m && Number.isNaN(out[k]!.s)) k++;
    const a = j > 0 ? out[j - 1]!.e : ini;
    const b = k < m ? out[k]!.s : fimTot;
    const passo = Math.max(0.05, (b - a) / (k - j));
    for (let x = j; x < k; x++) {
      out[x]!.s = a + passo * (x - j);
      out[x]!.e = out[x]!.s + passo;
    }
    j = k;
  }
  return out;
}
