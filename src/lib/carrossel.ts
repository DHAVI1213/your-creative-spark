// Criador de carrosséis: motor próprio que desenha cada slide (1080x1350) num canvas.
// Método inspirado no "criador-de-carrosseis-simples" (uso liberado pelo autor).
// Fontes Geist e DM Serif Display (licença OFL) em /fonts/carrossel.

import { desenharEstilo } from "./estilos";
import { aplicar, eventos } from "./vivo";

export const W = 1080;
export const H = 1350;
export const M = 72;

export type Item = { nome: string; definicao: string; texto: string; fecho: string };

export type Estilo = "editorial" | "classico" | "fogo" | "interface" | "premium";

export type Carrossel = {
  estilo: Estilo;
  /** Foto da capa (data URL), opcional. */
  foto: string;
  /** Texto curto do lacre/selo (estilo clássico), ex.: 25.12 */
  selo: string;
  handle: string;
  nome: string;
  capaTopo: string;
  capaPalavra: string;
  capaSub: string;
  recibo: string;
  tese: string;
  itens: Item[];
  viradaA: string;
  viradaB: string;
  ctaPalavra: string;
  ctaEntrega: string;
  extra: string;
};

export const EXEMPLO: Carrossel = {
  estilo: "editorial",
  foto: "",
  selo: "",
  handle: "@seuperfil",
  nome: "Seu Nome",
  capaTopo: "rouba meu",
  capaPalavra: "roteiro",
  capaSub: "de Reels que prende",
  recibo: "3 regras · 1 roteiro · 1 semana",
  tese: "Todo Reels que prende segue o mesmo roteiro. Ninguém conta quais são as três partes.",
  itens: [
    {
      nome: "Gancho",
      definicao: "o que segura o dedo",
      texto: "Os três primeiros segundos decidem tudo. Comece pelo final, nunca pela apresentação.",
      fecho: "Quem começa pelo oi perde a tela.",
    },
    {
      nome: "Prova",
      definicao: "o que mantém a pessoa",
      texto: "Mostre o resultado antes de explicar. Um número real vale mais que dez adjetivos.",
      fecho: "Mostrar vence explicar.",
    },
    {
      nome: "Pedido",
      definicao: "o que vira ação",
      texto: "Peça uma única coisa, no fim, ligada ao que a pessoa acabou de ver.",
      fecho: "Um pedido só. No fim.",
    },
  ],
  viradaA: "Você não precisa de mais ideias.",
  viradaB: "Precisa de um roteiro.",
  ctaPalavra: "ROTEIRO",
  ctaEntrega: "e eu te mando o modelo com as 3 partes: gancho, prova e pedido",
  extra: "Os vídeos que mais cresceram na minha conta usaram exatamente essa ordem.",
};

export const VAZIO: Carrossel = {
  estilo: "editorial",
  foto: "",
  selo: "",
  handle: "",
  nome: "",
  capaTopo: "",
  capaPalavra: "",
  capaSub: "",
  recibo: "",
  tese: "",
  itens: [{ nome: "", definicao: "", texto: "", fecho: "" }],
  viradaA: "",
  viradaB: "",
  ctaPalavra: "",
  ctaEntrega: "",
  extra: "",
};

export type Visual = { bg: string; fg: string; destaque: string; mudo: string; linho: number };
const PAPEL: Visual = {
  bg: "#EDE9E1",
  fg: "#15130F",
  destaque: "#F2511F",
  mudo: "#6B655B",
  linho: 0.06,
};
const MARINHO: Visual = {
  bg: "#181D26",
  fg: "#FBF4E8",
  destaque: "#F2511F",
  mudo: "#9AA0AB",
  linho: 0.05,
};

export type SlideInfo = { chave: string; rotulo: string };

export function listarSlides(c: Carrossel): SlideInfo[] {
  const out: SlideInfo[] = [
    { chave: "capa", rotulo: "Capa" },
    { chave: "mapa", rotulo: "Slide 2 · mapa" },
  ];
  c.itens.forEach((_, i) => out.push({ chave: `item-${i}`, rotulo: `Regra ${i + 1}` }));
  out.push({ chave: "virada", rotulo: "Virada" }, { chave: "cta", rotulo: "CTA" });
  return out;
}

export async function carregarFontes() {
  if (typeof document === "undefined") return;
  const defs: [string, string, FontFaceDescriptors][] = [
    ["Geist", "/fonts/carrossel/Geist-Variable.ttf", { weight: "100 900" }],
    ["GeistMono", "/fonts/carrossel/GeistMono-Variable.ttf", { weight: "100 900" }],
    ["Anton", "/fonts/carrossel/Anton-Regular.woff2", { weight: "400" }],
    ["DMSerif", "/fonts/carrossel/DMSerifDisplay-Regular.ttf", { weight: "400", style: "normal" }],
    ["DMSerif", "/fonts/carrossel/DMSerifDisplay-Italic.ttf", { weight: "400", style: "italic" }],
  ];
  await Promise.all(
    defs.map(async ([nome, url, d]) => {
      try {
        const f = new FontFace(nome, `url(${url})`, d);
        await f.load();
        document.fonts.add(f);
      } catch {
        /* usa fonte do sistema */
      }
    }),
  );
}

// ---------- utilidades de desenho ----------
export function tracking(ctx: CanvasRenderingContext2D, em: string) {
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = em;
  } catch {
    /* sem suporte */
  }
}

const cacheLinho = new Map<string, HTMLCanvasElement>();

export function linho(ctx: CanvasRenderingContext2D, v: Visual) {
  let img = cacheLinho.get(v.bg);
  if (!img) {
    img = document.createElement("canvas");
    img.width = W;
    img.height = H;
    const g = img.getContext("2d")!;
    g.fillStyle = v.bg;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = v.linho;
    g.strokeStyle = v.fg;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x < W; x += 6) {
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, H);
    }
    for (let y = 0; y < H; y += 6) {
      g.moveTo(0, y + 0.5);
      g.lineTo(W, y + 0.5);
    }
    g.stroke();
    cacheLinho.set(v.bg, img);
  }
  ctx.drawImage(img, 0, 0);
}

export function fonte(peso: number, px: number, fam = "Geist", estilo = "") {
  return `${estilo ? estilo + " " : ""}${peso} ${px}px ${fam}, system-ui, sans-serif`;
}

/** Maior tamanho (até max) em que o texto cabe na largura. */
export function ajustar(
  ctx: CanvasRenderingContext2D,
  texto: string,
  peso: number,
  largura: number,
  max: number,
  fam = "Geist",
  estilo = "",
) {
  ctx.font = fonte(peso, 100, fam, estilo);
  const w = ctx.measureText(texto).width || 1;
  return Math.max(24, Math.min(max, Math.floor((100 * largura) / w)));
}

export function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  for (const par of texto.split("\n")) {
    let atual = "";
    for (const palavra of par.split(/\s+/).filter(Boolean)) {
      const t = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(t).width > largura && atual) {
        linhas.push(atual);
        atual = palavra;
      } else atual = t;
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

export function paragrafo(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  largura: number,
  px: number,
  entrelinha: number,
  cor: string,
  peso = 500,
  fam = "Geist",
  estilo = "",
) {
  ctx.font = fonte(peso, px, fam, estilo);
  ctx.fillStyle = cor;
  ctx.textBaseline = "alphabetic";
  const linhas = quebrar(ctx, texto, largura);
  linhas.forEach((l, i) => ctx.fillText(l, x, y + i * px * entrelinha));
  return y + linhas.length * px * entrelinha;
}

export function rodape(ctx: CanvasRenderingContext2D, c: Carrossel, v: Visual, direita: string) {
  tracking(ctx, "0em");
  ctx.font = fonte(500, 22, "GeistMono");
  ctx.fillStyle = v.mudo;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(c.handle || "@seuperfil", M, 1278);
  if (direita) ctx.fillText(direita, 676, 1278);
}

export function cabecalho(ctx: CanvasRenderingContext2D, texto: string, v: Visual) {
  tracking(ctx, "0.04em");
  ctx.font = fonte(500, 22, "GeistMono");
  ctx.fillStyle = v.mudo;
  ctx.textAlign = "left";
  ctx.fillText(texto.toUpperCase(), M, 110);
  tracking(ctx, "0em");
}

// ---------- fotos ----------
const cacheImg = new Map<string, HTMLImageElement>();
let aoCarregar: (() => void) | null = null;
/** Chamado quando uma foto termina de carregar (pra redesenhar). */
export function quandoCarregarFoto(fn: () => void) {
  aoCarregar = fn;
}
export function imagem(src: string): HTMLImageElement | null {
  if (!src) return null;
  let im = cacheImg.get(src);
  if (!im) {
    im = new Image();
    im.onload = () => aoCarregar?.();
    im.src = src;
    cacheImg.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}
/** Desenha a imagem cobrindo a área (corta o excesso). */
export function cobrir(
  ctx: CanvasRenderingContext2D,
  im: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const r = Math.max(w / im.naturalWidth, h / im.naturalHeight);
  const iw = im.naturalWidth * r;
  const ih = im.naturalHeight * r;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}
/** Desenha a imagem inteira dentro da área (sem cortar). */
export function conter(
  ctx: CanvasRenderingContext2D,
  im: HTMLImageElement,
  cx: number,
  cy: number,
  w: number,
  h: number,
) {
  const r = Math.min(w / im.naturalWidth, h / im.naturalHeight);
  const iw = im.naturalWidth * r;
  const ih = im.naturalHeight * r;
  ctx.drawImage(im, cx - iw / 2, cy - ih / 2, iw, ih);
}

// ---------- slides ----------
export function desenhar(ctx: CanvasRenderingContext2D, c: Carrossel, chave: string, t = 0) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  tracking(ctx, "0em");
  if (c.estilo && c.estilo !== "editorial") return desenharEstilo(ctx, c, chave, t);
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const evs = eventos(chave, c.itens.length, c.estilo);
  const mov = (id: string, ax: number, ay: number) => aplicar(ctx, evs, id, t, ax, ay);

  if (chave === "capa") {
    const v = MARINHO;
    linho(ctx, v);
    const foto = imagem(c.foto);
    if (foto) {
      cobrir(ctx, foto, 0, 0, W, H);
      const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
      g.addColorStop(0, "rgba(24,29,38,0)");
      g.addColorStop(0.55, "rgba(24,29,38,0.82)");
      g.addColorStop(1, "rgba(24,29,38,0.95)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    cabecalho(ctx, [c.nome, c.recibo].filter(Boolean).join(" \u00b7 ") || mes, v);
    const palavra = (c.capaPalavra || "palavra").toLowerCase();
    tracking(ctx, "-0.045em");
    const px = ajustar(ctx, palavra, 900, W - 2 * M, 330, "DMSerif", "italic");
    const base = 900;
    mov("palavra", M + 200, base);
    ctx.font = fonte(400, px, "DMSerif", "italic");
    ctx.fillStyle = v.destaque;
    ctx.fillText(palavra, M, base);
    ctx.restore();
    const topo = (c.capaTopo || "").toLowerCase();
    if (topo) {
      const pt = ajustar(ctx, topo, 900, W - 2 * M, 150);
      const yt = base - px * 0.78;
      mov("topo", M, yt);
      ctx.font = fonte(900, pt);
      ctx.fillStyle = v.fg;
      ctx.fillText(topo, M, yt);
      ctx.restore();
    }
    tracking(ctx, "-0.02em");
    const sub = (c.capaSub || "").toLowerCase();
    if (sub) {
      const ps = ajustar(ctx, sub, 800, W - 2 * M, 96);
      const ys = base + ps * 1.25;
      mov("sub", M, ys);
      ctx.font = fonte(800, ps);
      ctx.fillStyle = v.fg;
      ctx.fillText(sub, M, ys);
      ctx.restore();
    }
    tracking(ctx, "0em");
    rodape(ctx, c, v, "");
    return;
  }

  if (chave === "mapa") {
    const v = PAPEL;
    linho(ctx, v);
    cabecalho(ctx, `${mes} \u00b7 ${c.nome || c.handle}`, v);
    tracking(ctx, "-0.04em");
    ctx.font = fonte(900, 72);
    const tese = c.tese || "Escreva a tese do carrossel.";
    mov("tese", M, 330);
    const topo = paragrafo(ctx, tese, M, 260, W - 2 * M, 72, 1.04, v.fg, 900);
    ctx.restore();
    tracking(ctx, "0em");
    let y = Math.max(topo + 60, 640);
    ctx.fillStyle = v.fg;
    ctx.fillRect(M, y - 30, W - 2 * M, 3);
    c.itens.slice(0, 8).forEach((it, i) => {
      mov(`i${i}`, M, y + 44);
      ctx.font = fonte(500, 30, "GeistMono");
      ctx.fillStyle = v.destaque;
      ctx.fillText(String(i + 1).padStart(2, "0"), M, y + 40);
      tracking(ctx, "-0.03em");
      ctx.font = fonte(800, 56);
      ctx.fillStyle = v.fg;
      ctx.fillText(it.nome || "\u2014", M + 110, y + 44);
      tracking(ctx, "0em");
      ctx.restore();
      y += 92;
    });
    rodape(ctx, c, v, "");
    return;
  }

  if (chave.startsWith("item-")) {
    const i = Number(chave.slice(5));
    const it = c.itens[i]!;
    const v = i % 2 === 0 ? MARINHO : PAPEL;
    linho(ctx, v);
    mov("num", M + 86, 312);
    ctx.fillStyle = v.destaque;
    ctx.beginPath();
    ctx.arc(M + 86, 226, 86, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#15130F";
    ctx.font = fonte(800, 88);
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), M + 86, 258);
    ctx.textAlign = "left";
    ctx.restore();
    const nome = (it.nome || "nome").toLowerCase();
    tracking(ctx, "-0.045em");
    const px = ajustar(ctx, nome, 900, 738, 116);
    mov("nome", 268, 246);
    ctx.font = fonte(900, px);
    ctx.fillStyle = v.fg;
    ctx.fillText(nome, 268, 246);
    ctx.restore();
    tracking(ctx, "0em");
    mov("def", M, 420);
    ctx.font = fonte(400, 46, "DMSerif", "italic");
    ctx.fillStyle = v.destaque;
    ctx.fillText(it.definicao || "", M, 420);
    ctx.restore();
    tracking(ctx, "-0.02em");
    const fim = paragrafo(
      ctx,
      it.texto || "Escreva duas frases.",
      M,
      540,
      W - 2 * M,
      54,
      1.28,
      v.fg,
      600,
    );
    tracking(ctx, "0em");
    if (it.fecho) {
      ctx.font = fonte(700, 40);
      const largura = Math.min(W - 2 * M, ctx.measureText(it.fecho).width + 50);
      const lin = quebrar(ctx, it.fecho, W - 2 * M - 50);
      const alt = lin.length * 52 + 40;
      const y0 = Math.max(fim + 70, 1040);
      mov("fecho", M, y0 + alt);
      ctx.fillStyle = v.destaque;
      ctx.fillRect(M, y0, lin.length > 1 ? W - 2 * M : largura, alt);
      ctx.fillStyle = "#15130F";
      lin.forEach((l, k) => ctx.fillText(l, M + 25, y0 + 56 + k * 52));
      ctx.restore();
    }
    rodape(ctx, c, v, `${i + 1} de ${c.itens.length}`);
    return;
  }

  if (chave === "virada") {
    const v = MARINHO;
    linho(ctx, v);
    cabecalho(ctx, "a virada", v);
    tracking(ctx, "-0.045em");
    const a = c.viradaA || "Voc\u00ea n\u00e3o precisa de X.";
    mov("A", M, 480);
    const y1 = paragrafo(ctx, a, M, 480, W - 2 * M, 96, 1.02, v.mudo, 900);
    ctx.restore();
    const b = c.viradaB || "Precisa de Y.";
    const partes = b.split(" ");
    const ult = partes.pop() ?? "";
    const resto = partes.join(" ");
    let pb = 120;
    const medir = () => {
      ctx.font = fonte(900, pb);
      const wr = resto ? ctx.measureText(resto + " ").width : 0;
      ctx.font = fonte(400, pb + 10, "DMSerif", "italic");
      return { wr, wu: ctx.measureText(ult).width };
    };
    let m = medir();
    while (m.wr + m.wu > W - 2 * M && pb > 84) {
      pb -= 6;
      m = medir();
    }
    let linhaY = y1 + 120;
    mov("B", M, linhaY);
    if (m.wr + m.wu > W - 2 * M) {
      linhaY = paragrafo(ctx, resto, M, linhaY, W - 2 * M, pb, 1.02, v.fg, 900);
      mov("U", M, linhaY);
      ctx.font = fonte(400, pb + 10, "DMSerif", "italic");
      ctx.fillStyle = v.destaque;
      ctx.fillText(ult, M, linhaY);
      ctx.restore();
    } else {
      ctx.font = fonte(900, pb);
      ctx.fillStyle = v.fg;
      if (resto) ctx.fillText(resto, M, linhaY);
      mov("U", M + m.wr + m.wu / 2, linhaY);
      ctx.font = fonte(400, pb + 10, "DMSerif", "italic");
      ctx.fillStyle = v.destaque;
      ctx.fillText(ult, M + m.wr, linhaY);
      ctx.restore();
    }
    ctx.restore();
    tracking(ctx, "0em");
    rodape(ctx, c, v, "");
    return;
  }

  // cta
  const v = PAPEL;
  linho(ctx, v);
  ctx.font = fonte(500, 22, "GeistMono");
  ctx.fillStyle = v.mudo;
  ctx.fillText(`Meu nome \u00e9 ${c.nome || "\u2014"}`, M, 110);
  tracking(ctx, "-0.02em");
  mov("comenta", M, 470);
  ctx.font = fonte(700, 64);
  ctx.fillStyle = v.fg;
  ctx.fillText("comenta", M, 470);
  ctx.restore();
  const pal = (c.ctaPalavra || "PALAVRA").toUpperCase();
  tracking(ctx, "-0.05em");
  const px = ajustar(ctx, pal, 900, W - 2 * M, 280);
  const yp = 470 + px * 0.95;
  mov("palavra", M + 160, yp);
  ctx.font = fonte(900, px);
  ctx.fillStyle = v.destaque;
  ctx.fillText(pal, M, yp);
  ctx.restore();
  tracking(ctx, "0em");
  const ye = yp + 90;
  mov("entrega", M, ye + 60);
  paragrafo(ctx, c.ctaEntrega || "e eu te mando o material", M, ye, W - 2 * M, 50, 1.25, v.fg, 600);
  ctx.restore();
  ctx.font = fonte(500, 22, "GeistMono");
  ctx.fillStyle = v.mudo;
  ctx.fillText("PRECISA ESTAR SEGUINDO PRA RECEBER", M, 1278);
}

export function exportarPng(c: Carrossel, chave: string): Promise<Blob> {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  desenhar(cv.getContext("2d")!, c, chave);
  return new Promise((res, rej) =>
    cv.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao gerar a imagem"))), "image/png"),
  );
}

// ---------- legenda e crítica ----------
export function gerarLegenda(c: Carrossel): string {
  const nomes = c.itens.map((i) => i.nome).filter(Boolean);
  const blocos = [
    c.tese,
    ...c.itens
      .filter((i) => i.nome)
      .map((i) => `${i.nome}. ${i.fecho || i.texto.split(/(?<=[.!])\s/)[0] || ""}`.trim()),
    c.extra ? `A parte que ninguém conta: ${c.extra}` : "",
    c.viradaA && c.viradaB ? `${c.viradaA} ${c.viradaB}` : "",
    c.ctaPalavra
      ? `Comenta ${c.ctaPalavra.toUpperCase()} ${c.ctaEntrega || ""}`.trim() +
        ". Precisa estar me seguindo para receber."
      : "",
    c.nome ? `Meu nome é ${c.nome}.` : "",
  ].filter(Boolean);
  void nomes;
  return blocos.join("\n\n");
}

const HYPE = [
  "incrível",
  "incrivel",
  "insano",
  "secreto",
  "absurdo",
  "revolucionário",
  "revolucionario",
  "imperdível",
  "imperdivel",
  "milagre",
];

export function criticar(c: Carrossel): string[] {
  const avisos: string[] = [];
  const todos = [
    c.capaTopo,
    c.capaSub,
    c.tese,
    c.viradaA,
    c.viradaB,
    c.ctaEntrega,
    ...c.itens.flatMap((i) => [i.texto, i.fecho, i.definicao]),
  ].join(" ");
  if (!c.capaPalavra.trim()) avisos.push("Falta a palavra gigante da capa.");
  if (c.capaPalavra.trim().split(/\s+/).length > 1)
    avisos.push("A palavra da capa deveria ser uma só, para ler como forma em miniatura.");
  if (/\?/.test(todos))
    avisos.push("Tem pergunta no texto. Troque por afirmação: pergunta retórica enfraquece.");
  if (HYPE.some((h) => todos.toLowerCase().includes(h)))
    avisos.push(
      "Tem palavra de exagero (incrível, secreto, insano). O peso deve vir do número e do contraste.",
    );
  if (/!/.test(todos)) avisos.push("Evite exclamação. Afirme com calma.");
  const frases = todos
    .split(/[.!?]+\s*/)
    .map((f) => f.trim().split(/\s+/).filter(Boolean).length)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const mediana = frases[Math.floor(frases.length / 2)] ?? 0;
  if (mediana > 12)
    avisos.push(`As frases estão longas (mediana de ${mediana} palavras). Mire em até 10.`);
  if (c.itens.length < 3) avisos.push("Poucas regras. Entre 3 e 8 deixa o carrossel completo.");
  if (c.itens.some((i) => !i.nome.trim() || !i.texto.trim()))
    avisos.push("Tem regra sem nome ou sem texto.");
  if (c.itens.some((i) => i.texto.split(/\s+/).length > 45))
    avisos.push("Alguma regra passa de 45 palavras. Corte: um slide, uma ideia.");
  if (c.ctaPalavra && c.ctaPalavra.trim().split(/\s+/).length > 1)
    avisos.push("A palavra do CTA deve ser uma só.");
  if (!c.ctaPalavra.trim())
    avisos.push(
      "Sem palavra-chave no CTA. “Segue pra mais” é fraco: peça uma palavra ligada ao tema.",
    );
  if (!/\d/.test(c.recibo + c.tese))
    avisos.push("Coloque um número real na capa ou no slide 2 (o recibo).");
  return avisos;
}
