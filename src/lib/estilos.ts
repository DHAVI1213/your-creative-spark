// Os estilos fixos do criador de carrosséis (além do "editorial", que fica em carrossel.ts).
// Gramáticas inspiradas nos carrosséis da aula "Carrossel vivo"; conteúdo, código e desenho próprios.
import {
  H,
  M,
  W,
  ajustar,
  cobrir,
  conter,
  fonte,
  imagem,
  paragrafo,
  quebrar,
  tracking,
  type Carrossel,
  type Estilo,
} from "./carrossel";
import { aplicar, duracao, eventos } from "./vivo";

type Paleta = {
  claro: string;
  escuro: string;
  tintaClaro: string;
  tintaEscuro: string;
  mudoClaro: string;
  mudoEscuro: string;
  destaque: string;
  destaque2: string;
  /** texto em cima da cor de destaque */
  sobreDestaque: string;
};

type Def = {
  nome: string;
  descricao: string;
  p: Paleta;
  /** fonte do título */
  tit: { fam: string; peso: number; caixa: boolean; track: string; entrelinha: number };
  /** fonte de ênfase (palavra-assinatura, definição) */
  enf: { fam: string; estilo: string; peso: number };
};

export const ESTILOS: Record<Estilo, { nome: string; descricao: string }> = {
  editorial: {
    nome: "Editorial",
    descricao: "Linho, marinho e laranja. Serifa gigante + grotesca.",
  },
  classico: { nome: "Clássico", descricao: "Papel creme, serifa elegante, vermelho e lacre." },
  fogo: { nome: "Fogo", descricao: "Letras condensadas enormes, brasa e chamas. Comida." },
  interface: {
    nome: "Interface",
    descricao: "Lavanda, magenta, cartões de conversa. Serviço/app.",
  },
  premium: { nome: "Premium", descricao: "Preto, dourado, holofote e produto. Lançamento." },
};

const DEF: Record<Exclude<Estilo, "editorial">, Def> = {
  classico: {
    nome: "Clássico",
    descricao: "",
    p: {
      claro: "#EFE6D2",
      escuro: "#17110D",
      tintaClaro: "#1A1410",
      tintaEscuro: "#F3EADB",
      mudoClaro: "#7A6B58",
      mudoEscuro: "#A89A86",
      destaque: "#B3261E",
      destaque2: "#C9A227",
      sobreDestaque: "#F3EADB",
    },
    tit: { fam: "DMSerif", peso: 400, caixa: false, track: "-0.02em", entrelinha: 1.0 },
    enf: { fam: "DMSerif", estilo: "italic", peso: 400 },
  },
  fogo: {
    nome: "Fogo",
    descricao: "",
    p: {
      claro: "#F3E6D0",
      escuro: "#1A0F0C",
      tintaClaro: "#1A0F0C",
      tintaEscuro: "#F3E6D0",
      mudoClaro: "#7B5E4E",
      mudoEscuro: "#B48C74",
      destaque: "#F25C1F",
      destaque2: "#FFB000",
      sobreDestaque: "#1A0F0C",
    },
    tit: { fam: "Anton", peso: 400, caixa: true, track: "0em", entrelinha: 1.06 },
    enf: { fam: "Anton", estilo: "", peso: 400 },
  },
  interface: {
    nome: "Interface",
    descricao: "",
    p: {
      claro: "#ECEAF6",
      escuro: "#17122B",
      tintaClaro: "#1B1530",
      tintaEscuro: "#F1EEFB",
      mudoClaro: "#7C7695",
      mudoEscuro: "#A39CC0",
      destaque: "#B0127A",
      destaque2: "#6B4DFF",
      sobreDestaque: "#FFFFFF",
    },
    tit: { fam: "Geist", peso: 900, caixa: false, track: "-0.045em", entrelinha: 1.0 },
    enf: { fam: "DMSerif", estilo: "italic", peso: 400 },
  },
  premium: {
    nome: "Premium",
    descricao: "",
    p: {
      claro: "#141416",
      escuro: "#08080A",
      tintaClaro: "#F4F1EA",
      tintaEscuro: "#F4F1EA",
      mudoClaro: "#8C877C",
      mudoEscuro: "#8C877C",
      destaque: "#C8A35A",
      destaque2: "#E7D3A1",
      sobreDestaque: "#08080A",
    },
    tit: { fam: "Anton", peso: 400, caixa: true, track: "0.01em", entrelinha: 1.06 },
    enf: { fam: "DMSerif", estilo: "italic", peso: 400 },
  },
};

// ---------- exemplos prontos de cada estilo ----------
export const EXEMPLOS: Record<Exclude<Estilo, "editorial">, Partial<Carrossel>> = {
  classico: {
    handle: "@barbeariadoze",
    nome: "Barbearia do Zé",
    capaTopo: "Sua barbearia sempre teve um",
    capaPalavra: "ritual.",
    capaSub: "A gente só chamava de corte.",
    recibo: "desde 1998 · 3 passos",
    selo: "1998",
    tese: "Todo corte bom segue o mesmo ritual. São três passos, e o cliente sente cada um.",
    itens: [
      {
        nome: "Toalha",
        definicao: "o que acalma",
        texto: "A toalha quente abre os poros. Cinco minutos que o cliente lembra o mês inteiro.",
        fecho: "Calma antes da navalha.",
      },
      {
        nome: "Navalha",
        definicao: "o que define",
        texto: "O acabamento na navalha separa o corte comum do corte que chama atenção.",
        fecho: "Detalhe é assinatura.",
      },
      {
        nome: "Conversa",
        definicao: "o que fideliza",
        texto: "O cliente volta pela conversa tanto quanto pelo corte. Ninguém troca de amigo.",
        fecho: "Cliente fiel é amigo.",
      },
    ],
    viradaA: "Você não vende corte.",
    viradaB: "Vende um ritual.",
    ctaPalavra: "RITUAL",
    ctaEntrega: "e eu te mando a agenda da semana com 10% no primeiro horário",
    extra: "Os clientes que fazem o ritual completo voltam em média a cada 21 dias.",
  },
  fogo: {
    handle: "@smashdabrasa",
    nome: "Smash da Brasa",
    capaTopo: "Chegou",
    capaPalavra: "o smash",
    capaSub: "duplo",
    recibo: "lançamento · sexta 19h",
    selo: "",
    tese: "Dois blends prensados na chapa, queijo derretido e pão na manteiga. Três partes, uma mordida.",
    itens: [
      {
        nome: "Blend",
        definicao: "prensado na chapa",
        texto: "Carne fresca, 90 gramas cada, esmagada na chapa quente até a borda caramelizar.",
        fecho: "A borda crocante é o segredo.",
      },
      {
        nome: "Queijo",
        definicao: "derretido no vapor",
        texto: "Duas fatias de cheddar derretidas na tampa, escorrendo pelas bordas.",
        fecho: "Escorreu, acertou.",
      },
      {
        nome: "Pão",
        definicao: "selado na manteiga",
        texto: "Brioche selado na manteiga segura tudo sem desmanchar até a última mordida.",
        fecho: "Pão bom não desmonta.",
      },
    ],
    viradaA: "Você não precisa de mais um lanche.",
    viradaB: "Precisa do smash.",
    ctaPalavra: "SMASH",
    ctaEntrega: "e eu te mando o cupom da batata grátis na estreia",
    extra: "Na estreia, os primeiros 50 pedidos levam a batata de graça.",
  },
  interface: {
    handle: "@clinicavida",
    nome: "Clínica Vida",
    capaTopo: "Seu WhatsApp",
    capaPalavra: "não para.",
    capaSub: "Preço. Horário. Endereço. Convênio.",
    recibo: "1.284 mensagens",
    selo: "",
    tese: "O atendimento que responde sozinho resolve 9 em cada 10 mensagens. Você só entra no que importa.",
    itens: [
      {
        nome: "Responde",
        definicao: "em segundos",
        texto: "Preço, horário e endereço respondidos na hora, até de madrugada.",
        fecho: "Ninguém espera.",
      },
      {
        nome: "Agenda",
        definicao: "sem ida e volta",
        texto: "O paciente escolhe o horário livre e a consulta entra direto na agenda.",
        fecho: "Uma mensagem, um horário.",
      },
      {
        nome: "Lembra",
        definicao: "um dia antes",
        texto: "O lembrete automático derruba as faltas e libera o horário quando alguém cancela.",
        fecho: "Menos falta, mais consulta.",
      },
    ],
    viradaA: "Você não precisa de mais atendentes.",
    viradaB: "Precisa de um sistema.",
    ctaPalavra: "AGENDA",
    ctaEntrega: "e eu te mando o modelo de atendimento com as 3 respostas prontas",
    extra: "As clínicas que ativaram o lembrete cortaram as faltas pela metade no primeiro mês.",
  },
  premium: {
    handle: "@atelieonix",
    nome: "Ateliê Onix",
    capaTopo: "coleção 01",
    capaPalavra: "noite",
    capaSub: "o drop em que só o dourado brilha",
    recibo: "sábado, 10h",
    selo: "",
    tese: "Três peças, uma coleção. Feitas para a noite e numeradas uma a uma.",
    itens: [
      {
        nome: "Aço",
        definicao: "escovado à mão",
        texto: "Cada peça é escovada à mão até o metal ganhar a luz certa.",
        fecho: "O brilho é contido.",
      },
      {
        nome: "Couro",
        definicao: "curtido sem pressa",
        texto: "Couro curtido em quarenta dias, macio desde o primeiro uso.",
        fecho: "Tempo vira acabamento.",
      },
      {
        nome: "Ouro",
        definicao: "só no detalhe",
        texto: "O dourado aparece em um único ponto. É ali que o olho para.",
        fecho: "Um ponto de luz basta.",
      },
    ],
    viradaA: "Não é sobre ter mais.",
    viradaB: "É sobre ter a peça certa.",
    ctaPalavra: "NOITE",
    ctaEntrega: "e eu te mando o acesso antecipado ao drop",
    extra: "Só 120 peças, numeradas. O acesso antecipado abre uma hora antes.",
  },
};

// ---------- utilidades ----------
const TAU = Math.PI * 2;

function caixa(t: string, d: Def) {
  return d.tit.caixa ? t.toUpperCase() : t;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fundo(
  ctx: CanvasRenderingContext2D,
  est: Estilo,
  d: Def,
  escuro: boolean,
  chave: string,
  t: number,
) {
  const p = d.p;
  ctx.fillStyle = escuro ? p.escuro : p.claro;
  ctx.fillRect(0, 0, W, H);
  if (est === "classico") {
    // papel com fibras finas + moldura dupla
    ctx.save();
    ctx.globalAlpha = escuro ? 0.05 : 0.07;
    ctx.strokeStyle = escuro ? p.tintaEscuro : p.tintaClaro;
    ctx.beginPath();
    for (let y = 0; y < H; y += 5) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = escuro ? p.destaque2 : p.tintaClaro;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, W - 72, H - 72);
    ctx.lineWidth = 1;
    ctx.strokeRect(46, 46, W - 92, H - 92);
    ctx.globalAlpha = 1;
  } else if (est === "fogo") {
    // tijolinho sutil
    ctx.save();
    ctx.globalAlpha = escuro ? 0.06 : 0.05;
    ctx.strokeStyle = escuro ? "#F3E6D0" : "#1A0F0C";
    ctx.lineWidth = 2;
    for (let y = 0, k = 0; y < H; y += 60, k++) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      for (let x = k % 2 ? 0 : 60; x < W; x += 120) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 60);
        ctx.stroke();
      }
    }
    ctx.restore();
    if (chave === "capa" || chave === "cta") chamas(ctx, d, chave, t);
  } else if (est === "interface") {
    ctx.save();
    ctx.fillStyle = escuro ? "rgba(241,238,251,0.10)" : "rgba(27,21,48,0.10)";
    for (let y = 30; y < H; y += 36) for (let x = 30; x < W; x += 36) ctx.fillRect(x, y, 2, 2);
    ctx.restore();
  } else if (est === "premium") {
    // holofote radial (não é degradê de tela cheia linear) que respira em loop
    const resp = 0.5 + 0.5 * Math.sin((TAU * t) / duracao(chave));
    const g = ctx.createRadialGradient(W / 2, chave === "capa" ? 420 : 300, 40, W / 2, 500, 760);
    g.addColorStop(0, `rgba(200,163,90,${0.2 + 0.06 * resp})`);
    g.addColorStop(1, "rgba(200,163,90,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(200,163,90,0.35)";
    ctx.fillRect(M, 150, W - 2 * M, 1);
    ctx.fillRect(M, H - 130, W - 2 * M, 1);
  }
}

/** Chamas em loop perfeito: cada ponta oscila com período que divide a duração do slide. */
function chamas(
  ctx: CanvasRenderingContext2D,
  d: Def,
  chave: string,
  t: number,
  escala = chave === "cta" ? 0.5 : 0.8,
) {
  const dur = duracao(chave);
  const camadas: [string, number, number][] = [
    ["#8E1B0E", 300, 0],
    [d.p.destaque, 220, 1.7],
    [d.p.destaque2, 130, 3.1],
  ];
  for (const [cor, alt0, fase] of camadas) {
    const alt = alt0 * escala;
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const n = 9;
    for (let i = 0; i <= n * 2; i++) {
      const x = (i / (n * 2)) * W;
      const ponta = i % 2 === 1;
      const osc = Math.sin((TAU * 2 * t) / dur + i * 1.3 + fase);
      const y = ponta
        ? H - alt - 40 * escala * osc - (i % 4 === 1 ? 50 * escala : 0)
        : H - alt * 0.35 + 10 * osc;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }
}

function cab(ctx: CanvasRenderingContext2D, texto: string, cor: string, y = 110) {
  tracking(ctx, "0.06em");
  ctx.font = fonte(500, 22, "GeistMono");
  ctx.fillStyle = cor;
  ctx.textAlign = "left";
  ctx.fillText(texto.toUpperCase(), M, y);
  tracking(ctx, "0em");
}

function pe(ctx: CanvasRenderingContext2D, c: Carrossel, cor: string, direita = "") {
  tracking(ctx, "0em");
  ctx.font = fonte(500, 22, "GeistMono");
  ctx.fillStyle = cor;
  ctx.textAlign = "left";
  ctx.fillText(c.handle || "@seuperfil", M, 1278);
  if (direita) ctx.fillText(direita, 676, 1278);
}

function selo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  texto: string,
  d: Def,
) {
  ctx.fillStyle = d.p.destaque;
  ctx.beginPath();
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr2 = r * (1 + 0.05 * Math.sin(i * 2.7) + 0.03 * Math.cos(i * 5.1));
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(243,234,219,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = d.p.sobreDestaque;
  ctx.textAlign = "center";
  const px = ajustar(ctx, texto, 400, r * 1.25, 64, "DMSerif");
  ctx.font = fonte(400, px, "DMSerif");
  ctx.fillText(texto, x, y + px * 0.35);
  ctx.textAlign = "left";
}

function placeholderFoto(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  cor: string,
) {
  ctx.save();
  ctx.setLineDash([14, 12]);
  ctx.strokeStyle = cor;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  rr(ctx, cx - w / 2, cy - h / 2, w, h, 24);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = fonte(500, 24, "GeistMono");
  ctx.fillStyle = cor;
  ctx.textAlign = "center";
  ctx.fillText("SUA FOTO AQUI", cx, cy + 8);
  ctx.textAlign = "left";
  ctx.restore();
}

// ---------- capas ----------
type Mov = (id: string, ax: number, ay: number) => void;

function capaClassico(ctx: CanvasRenderingContext2D, c: Carrossel, d: Def, t: number, mov: Mov) {
  const p = d.p;
  cab(ctx, [c.nome, c.recibo].filter(Boolean).join(" · "), p.mudoClaro, 120);
  const foto = imagem(c.foto);
  let y = 330;
  if (foto) {
    cobrir(ctx, foto, M, 160, W - 2 * M, 320);
    y = 520;
  }
  tracking(ctx, "-0.02em");
  const pt = foto ? 80 : 104;
  ctx.font = fonte(400, pt, "DMSerif");
  mov("topo", M, y + 100);
  const fim = paragrafo(
    ctx,
    c.capaTopo || "Linha de cima",
    M,
    y + 90,
    W - 2 * M - 40,
    pt,
    1.0,
    p.tintaClaro,
    400,
    "DMSerif",
  );
  ctx.restore();
  const palavra = c.capaPalavra || "palavra.";
  const px = ajustar(
    ctx,
    palavra,
    400,
    c.selo ? 600 : foto ? 700 : 900,
    foto ? 230 : 300,
    "DMSerif",
  );
  const yp = fim + px * 0.75;
  mov("palavra", M + 200, yp);
  ctx.font = fonte(400, px, "DMSerif");
  ctx.fillStyle = p.destaque;
  ctx.fillText(palavra, M, yp);
  ctx.restore();
  tracking(ctx, "0em");
  if (c.selo) {
    mov("selo", W - M - 118, yp - px * 0.4);
    selo(ctx, W - M - 118, yp - px * 0.4, 112, c.selo, d);
    ctx.restore();
  }
  if (c.capaSub) {
    mov("sub", M, yp + 120);
    ctx.font = fonte(500, 36, "GeistMono");
    ctx.fillStyle = p.tintaClaro;
    ctx.fillText(c.capaSub, M, yp + 120);
    // cursor que pisca (1 vez por segundo: fecha o loop)
    if (Math.floor(t * 2) % 2 === 0) {
      const w = ctx.measureText(c.capaSub + " ").width;
      ctx.fillRect(M + w, yp + 120 - 32, 20, 38);
    }
    ctx.restore();
  }
  pe(ctx, c, p.mudoClaro, "arrasta pro lado →");
}

function capaFogo(ctx: CanvasRenderingContext2D, c: Carrossel, d: Def, t: number, mov: Mov) {
  const p = d.p;
  cab(ctx, [c.nome, c.recibo].filter(Boolean).join(" · "), p.mudoEscuro);
  const foto = imagem(c.foto);
  const linhas = [
    { id: "topo", txt: c.capaTopo || "Chegou", cor: p.tintaEscuro },
    { id: "palavra", txt: c.capaPalavra || "o lanche", cor: p.tintaEscuro },
    { id: "sub", txt: c.capaSub || "novo", cor: p.destaque },
  ].filter((l) => l.txt);
  let y = 200;
  const maxPx = foto ? 190 : 250;
  for (const [k, l] of linhas.entries()) {
    const txt = l.txt.toUpperCase();
    const largura = k === 1 ? W - 2 * M - 130 : W - 2 * M;
    const px = ajustar(ctx, txt, 400, largura, maxPx, "Anton");
    y += px * 0.98;
    mov(l.id, M + 150, y);
    ctx.font = fonte(400, px, "Anton");
    ctx.fillStyle = l.cor;
    ctx.fillText(txt, M, y);
    if (k === 1) {
      // seta
      const w = ctx.measureText(txt).width;
      const ax = M + w + 26;
      const ay = y - px * 0.4;
      ctx.fillStyle = p.destaque;
      ctx.fillRect(ax, ay - 14, 70, 28);
      ctx.beginPath();
      ctx.moveTo(ax + 64, ay - 40);
      ctx.lineTo(ax + 112, ay);
      ctx.lineTo(ax + 64, ay + 40);
      ctx.fill();
    }
    ctx.restore();
    y += 6;
  }
  if (foto) {
    mov("foto", W / 2, 1180);
    conter(ctx, foto, W / 2, Math.min(y + 260, 1000), 760, 440);
    ctx.restore();
    chamas(ctx, d, "capa", t);
  }
}

function capaInterface(ctx: CanvasRenderingContext2D, c: Carrossel, d: Def, t: number, mov: Mov) {
  const p = d.p;
  // pílula de alerta
  const pil = `●  ${(c.recibo || "alerta").toUpperCase()}`;
  ctx.font = fonte(600, 22, "GeistMono");
  const wp = ctx.measureText(pil).width + 44;
  rr(ctx, M, 92, wp, 46, 23);
  ctx.strokeStyle = p.destaque;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = p.destaque;
  ctx.fillText(pil, M + 22, 123);
  tracking(ctx, "-0.045em");
  const topo = c.capaTopo || "Seu WhatsApp";
  const pt = ajustar(ctx, topo, 900, W - 2 * M, 128);
  mov("topo", M, 300);
  ctx.font = fonte(900, pt);
  ctx.fillStyle = p.tintaClaro;
  ctx.fillText(topo, M, 300);
  ctx.restore();
  tracking(ctx, "-0.02em");
  const pal = c.capaPalavra || "não para.";
  const pp = ajustar(ctx, pal, 400, W - 2 * M, 150, "DMSerif", "italic");
  mov("palavra", M + 150, 300 + pp * 1.0);
  ctx.font = fonte(400, pp, "DMSerif", "italic");
  ctx.fillStyle = p.destaque;
  ctx.fillText(pal, M, 300 + pp * 1.0);
  ctx.restore();
  tracking(ctx, "0em");
  const ys = 300 + pp * 1.0 + 70;
  if (c.capaSub) {
    mov("sub", M, ys);
    ctx.font = fonte(500, 36);
    ctx.fillStyle = p.mudoClaro;
    ctx.fillText(c.capaSub, M, ys);
    ctx.restore();
  }
  // cartões de conversa
  const foto = imagem(c.foto);
  const msgs = ["Qual o preço?", "Tem horário amanhã?", "Onde fica?"];
  msgs.forEach((m, k) => {
    const x = M + k * 34;
    const y = ys + 60 + k * 120;
    mov(`card${k}`, x + 250, y + 90);
    ctx.save();
    ctx.shadowColor = "rgba(27,21,48,0.10)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#FFFFFF";
    rr(ctx, x, y, 560, 100, 22);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = k === 0 && foto ? "#fff" : p.destaque2;
    ctx.beginPath();
    ctx.arc(x + 50, y + 50, 26, 0, TAU);
    ctx.fill();
    if (k === 0 && foto) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + 50, y + 50, 26, 0, TAU);
      ctx.clip();
      cobrir(ctx, foto, x + 24, y + 24, 52, 52);
      ctx.restore();
    }
    ctx.font = fonte(500, 20, "GeistMono");
    ctx.fillStyle = p.mudoClaro;
    ctx.fillText(`cliente ${k + 1} · agora`, x + 96, y + 40);
    ctx.font = fonte(700, 30);
    ctx.fillStyle = p.tintaClaro;
    ctx.fillText(m, x + 96, y + 76);
    ctx.restore();
  });
  // selo redondo com o número do recibo
  const num = (c.recibo.match(/[\d.,]+/) ?? ["24/7"])[0];
  const bx = W - M - 120;
  const by = ys + 220;
  mov("badge", bx, by);
  ctx.strokeStyle = p.destaque;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(bx, by, 110, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = p.destaque;
  ctx.beginPath();
  ctx.arc(bx, by, 90, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  const pn = ajustar(ctx, num, 900, 150, 60);
  ctx.font = fonte(900, pn);
  ctx.fillText(num, bx, by + pn * 0.3);
  ctx.font = fonte(500, 18, "GeistMono");
  ctx.fillText("ABERTOS", bx, by + pn * 0.3 + 32);
  ctx.textAlign = "left";
  ctx.restore();
  // onda no rodapé (loop: período divide a duração)
  const dur = duracao("capa");
  ctx.strokeStyle = p.destaque;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = M; x <= W - M - 160; x += 6) {
    const yy = 1215 + 8 * Math.sin(x / 18 + ((TAU * t) / dur) * 2);
    if (x === M) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  pe(ctx, c, p.mudoClaro);
}

function capaPremium(ctx: CanvasRenderingContext2D, c: Carrossel, d: Def, t: number, mov: Mov) {
  const p = d.p;
  tracking(ctx, "0.02em");
  ctx.font = fonte(400, 64, "Anton");
  ctx.fillStyle = p.tintaEscuro;
  ctx.fillText((c.nome || "MARCA").toUpperCase(), M, 120);
  tracking(ctx, "0.12em");
  ctx.font = fonte(500, 22, "GeistMono");
  ctx.fillStyle = p.destaque;
  ctx.fillText((c.capaTopo || "coleção 01").toUpperCase(), M, 190);
  tracking(ctx, "0em");
  // produto flutuando (seno com período = duração → loop perfeito)
  const dur = duracao("capa");
  const flut = 14 * Math.sin((TAU * t) / dur);
  const foto = imagem(c.foto);
  mov("foto", W / 2, 560);
  if (foto) conter(ctx, foto, W / 2, 560 + flut, 820, 560);
  else placeholderFoto(ctx, W / 2, 560 + flut, 700, 460, p.destaque);
  ctx.restore();
  // palavra gigante
  const pal = (c.capaPalavra || "nome").toUpperCase();
  const px = ajustar(ctx, pal, 400, W - 2 * M, 330, "Anton");
  mov("palavra", W / 2, 1120);
  tracking(ctx, "0.02em");
  ctx.font = fonte(400, px, "Anton");
  ctx.fillStyle = p.tintaEscuro;
  ctx.fillText(pal, M, 1120);
  ctx.restore();
  tracking(ctx, "0.1em");
  if (c.capaSub) {
    mov("sub", M, 1185);
    ctx.font = fonte(500, 22, "GeistMono");
    ctx.fillStyle = p.destaque;
    ctx.fillText(`${c.capaSub.toUpperCase()}  ———→`, M, 1185);
    ctx.restore();
  }
  tracking(ctx, "0em");
  pe(ctx, c, p.mudoEscuro, c.recibo);
}

// ---------- slides internos (estrutura comum, acabamento de cada estilo) ----------
function numero(ctx: CanvasRenderingContext2D, est: Estilo, d: Def, i: number, escuro: boolean) {
  const p = d.p;
  const n = i + 1;
  if (est === "classico") {
    const rom = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][i] ?? String(n);
    ctx.font = fonte(400, 150, "DMSerif");
    ctx.fillStyle = p.destaque;
    ctx.fillText(`${rom}.`, M, 280);
    return 280;
  }
  if (est === "fogo") {
    ctx.font = fonte(400, 230, "Anton");
    ctx.fillStyle = p.destaque;
    ctx.fillText(String(n).padStart(2, "0"), M, 330);
    return 330;
  }
  if (est === "interface") {
    const txt = `#${n}`;
    ctx.font = fonte(800, 40);
    const w = ctx.measureText(txt).width + 50;
    rr(ctx, M, 150, w, 64, 32);
    ctx.fillStyle = p.destaque;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(txt, M + 25, 196);
    return 214;
  }
  // premium
  ctx.strokeStyle = p.destaque;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(M + 60, 250, 60, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = p.destaque;
  ctx.textAlign = "center";
  ctx.font = fonte(400, 64, "Anton");
  ctx.fillText(String(n).padStart(2, "0"), M + 60, 274);
  ctx.textAlign = "left";
  void escuro;
  return 310;
}

function barraFecho(
  ctx: CanvasRenderingContext2D,
  est: Estilo,
  d: Def,
  texto: string,
  y0: number,
  escuro: boolean,
) {
  const p = d.p;
  const tinta = escuro ? p.tintaEscuro : p.tintaClaro;
  if (est === "classico") {
    ctx.fillStyle = p.destaque;
    ctx.fillRect(M, y0, 120, 4);
    paragrafo(ctx, texto, M, y0 + 70, W - 2 * M, 54, 1.15, tinta, 400, "DMSerif", "italic");
    return;
  }
  if (est === "interface") {
    ctx.font = fonte(700, 38);
    const lin = quebrar(ctx, texto, W - 2 * M - 80);
    const h = lin.length * 50 + 50;
    ctx.save();
    ctx.shadowColor = "rgba(27,21,48,0.12)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = escuro ? "#241D40" : "#FFFFFF";
    rr(ctx, M, y0, W - 2 * M, h, 24);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = p.destaque;
    rr(ctx, M, y0, 10, h, 5);
    ctx.fill();
    ctx.fillStyle = tinta;
    ctx.font = fonte(700, 38);
    lin.forEach((l, k) => ctx.fillText(l, M + 44, y0 + 62 + k * 50));
    return;
  }
  if (est === "premium") {
    ctx.strokeStyle = p.destaque;
    ctx.lineWidth = 2;
    ctx.font = fonte(500, 30, "GeistMono");
    tracking(ctx, "0.08em");
    const lin = quebrar(ctx, texto.toUpperCase(), W - 2 * M - 60);
    const h = lin.length * 42 + 44;
    ctx.strokeRect(M, y0, W - 2 * M, h);
    ctx.fillStyle = p.destaque;
    lin.forEach((l, k) => ctx.fillText(l, M + 30, y0 + 56 + k * 42));
    tracking(ctx, "0em");
    return;
  }
  // fogo: faixa de destaque com letra condensada
  ctx.font = fonte(400, 56, "Anton");
  const lin = quebrar(ctx, texto.toUpperCase(), W - 2 * M - 50);
  const h = lin.length * 62 + 36;
  ctx.fillStyle = p.destaque;
  ctx.fillRect(M, y0, W - 2 * M, h);
  ctx.fillStyle = p.sobreDestaque;
  lin.forEach((l, k) => ctx.fillText(l, M + 25, y0 + 74 + k * 62));
}

export function desenharEstilo(
  ctx: CanvasRenderingContext2D,
  c: Carrossel,
  chave: string,
  t: number,
) {
  const est = c.estilo as Exclude<Estilo, "editorial">;
  const d = DEF[est] ?? DEF.classico;
  const p = d.p;
  const evs = eventos(chave, c.itens.length, c.estilo);
  const mov: Mov = (id, ax, ay) => aplicar(ctx, evs, id, t, ax, ay);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  tracking(ctx, "0em");
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  if (chave === "capa") {
    const escuro = est !== "classico" && est !== "interface";
    fundo(ctx, est, d, escuro, chave, t);
    if (est === "classico") return capaClassico(ctx, c, d, t, mov);
    if (est === "fogo") return capaFogo(ctx, c, d, t, mov);
    if (est === "interface") return capaInterface(ctx, c, d, t, mov);
    return capaPremium(ctx, c, d, t, mov);
  }

  if (chave === "mapa") {
    const escuro = est === "premium";
    fundo(ctx, est, d, escuro, chave, t);
    const tinta = escuro ? p.tintaEscuro : p.tintaClaro;
    const mudo = escuro ? p.mudoEscuro : p.mudoClaro;
    cab(ctx, `${mes} · ${c.nome || c.handle}`, mudo);
    tracking(ctx, d.tit.track);
    const px = d.tit.fam === "Anton" ? 92 : 76;
    mov("tese", M, 330);
    const fim = paragrafo(
      ctx,
      caixa(c.tese || "Escreva a tese.", d),
      M,
      260,
      W - 2 * M,
      px,
      d.tit.entrelinha + 0.06,
      tinta,
      d.tit.peso,
      d.tit.fam,
    );
    ctx.restore();
    tracking(ctx, "0em");
    let y = Math.max(fim + 60, 660);
    ctx.fillStyle = est === "classico" || est === "premium" ? p.destaque : tinta;
    ctx.fillRect(M, y - 30, W - 2 * M, est === "premium" ? 1 : 3);
    c.itens.slice(0, 8).forEach((it, i) => {
      mov(`i${i}`, M, y + 44);
      ctx.font = fonte(500, 30, "GeistMono");
      ctx.fillStyle = p.destaque;
      ctx.fillText(String(i + 1).padStart(2, "0"), M, y + 40);
      tracking(ctx, d.tit.track);
      ctx.font = fonte(
        d.tit.fam === "Geist" ? 800 : d.tit.peso,
        d.tit.fam === "Anton" ? 64 : 58,
        d.tit.fam,
      );
      ctx.fillStyle = tinta;
      ctx.fillText(caixa(it.nome || "—", d), M + 110, y + 44);
      tracking(ctx, "0em");
      ctx.restore();
      y += 96;
    });
    pe(ctx, c, mudo);
    return;
  }

  if (chave.startsWith("item-")) {
    const i = Number(chave.slice(5));
    const it = c.itens[i]!;
    const escuro =
      est === "premium" || est === "fogo"
        ? true
        : i % 2 === 0
          ? est !== "interface"
          : est === "interface";
    fundo(ctx, est, d, escuro, chave, t);
    const tinta = escuro ? p.tintaEscuro : p.tintaClaro;
    const mudo = escuro ? p.mudoEscuro : p.mudoClaro;
    mov("num", M + 80, 300);
    const yNum = numero(ctx, est, d, i, escuro);
    ctx.restore();
    const nome = caixa(it.nome || "nome", d);
    tracking(ctx, d.tit.track);
    const px = ajustar(
      ctx,
      nome,
      d.tit.peso,
      W - 2 * M,
      d.tit.fam === "Anton" ? 190 : 150,
      d.tit.fam,
    );
    const yNome = yNum + 40 + px * 0.9;
    mov("nome", M, yNome);
    ctx.font = fonte(d.tit.peso, px, d.tit.fam);
    ctx.fillStyle = tinta;
    ctx.fillText(nome, M, yNome);
    ctx.restore();
    tracking(ctx, "0em");
    const yDef = yNome + 80;
    if (it.definicao) {
      mov("def", M, yDef);
      if (d.enf.fam === "Anton") {
        tracking(ctx, "0.08em");
        ctx.font = fonte(500, 30, "GeistMono");
        ctx.fillStyle = p.destaque2;
        ctx.fillText(it.definicao.toUpperCase(), M, yDef);
        tracking(ctx, "0em");
      } else {
        ctx.font = fonte(400, 50, d.enf.fam, d.enf.estilo);
        ctx.fillStyle = p.destaque;
        ctx.fillText(it.definicao, M, yDef);
      }
      ctx.restore();
    }
    tracking(ctx, "-0.02em");
    const fim = paragrafo(
      ctx,
      it.texto || "Escreva duas frases.",
      M,
      yDef + 100,
      W - 2 * M,
      48,
      1.3,
      tinta,
      est === "classico" ? 500 : 600,
    );
    tracking(ctx, "0em");
    if (it.fecho) {
      const y0 = Math.max(fim + 60, 1010);
      mov("fecho", M, y0 + 80);
      barraFecho(ctx, est, d, it.fecho, y0, escuro);
      ctx.restore();
    }
    pe(ctx, c, mudo, `${i + 1} de ${c.itens.length}`);
    return;
  }

  if (chave === "virada") {
    fundo(ctx, est, d, true, chave, t);
    cab(ctx, "a virada", p.mudoEscuro);
    tracking(ctx, d.tit.track);
    const pa = d.tit.fam === "Anton" ? 110 : 92;
    mov("A", M, 480);
    const y1 = paragrafo(
      ctx,
      caixa(c.viradaA || "Você não precisa de X.", d),
      M,
      480,
      W - 2 * M,
      pa,
      d.tit.entrelinha + 0.04,
      p.mudoEscuro,
      d.tit.peso,
      d.tit.fam,
    );
    ctx.restore();
    const b = caixa(c.viradaB || "Precisa de Y.", d);
    const pb = d.tit.fam === "Anton" ? 140 : 112;
    mov("B", M, y1 + 140);
    const y2 = paragrafo(
      ctx,
      b,
      M,
      y1 + 140,
      W - 2 * M,
      pb,
      d.tit.entrelinha + 0.04,
      p.tintaEscuro,
      d.tit.peso,
      d.tit.fam,
    );
    ctx.restore();
    mov("U", M + 60, y2 + 20);
    ctx.fillStyle = p.destaque;
    ctx.fillRect(M, y2 - pb * 0.55, 140, est === "premium" ? 2 : 10);
    ctx.restore();
    tracking(ctx, "0em");
    pe(ctx, c, p.mudoEscuro);
    return;
  }

  // CTA
  const escuro = est === "fogo" || est === "premium";
  fundo(ctx, est, d, escuro, chave, t);
  const tinta = escuro ? p.tintaEscuro : p.tintaClaro;
  const mudo = escuro ? p.mudoEscuro : p.mudoClaro;
  cab(ctx, `Meu nome é ${c.nome || "—"}`, mudo);
  mov("comenta", M, 430);
  ctx.font =
    est === "classico"
      ? fonte(400, 80, "DMSerif", "italic")
      : fonte(700, 64, d.tit.fam === "Anton" ? "Geist" : d.tit.fam);
  ctx.fillStyle = tinta;
  ctx.fillText("comenta", M, 430);
  ctx.restore();
  const pal = (c.ctaPalavra || "PALAVRA").toUpperCase();
  const famPal = est === "classico" ? "DMSerif" : d.tit.fam === "Geist" ? "Geist" : "Anton";
  const pesoPal = famPal === "Geist" ? 900 : 400;
  tracking(ctx, famPal === "Geist" ? "-0.05em" : "0em");
  const px = ajustar(
    ctx,
    pal,
    pesoPal,
    W - 2 * M,
    est === "fogo" || est === "premium" ? 340 : 280,
    famPal,
  );
  const yp = 430 + px * 0.98;
  mov("palavra", M + 160, yp);
  ctx.font = fonte(pesoPal, px, famPal);
  ctx.fillStyle = p.destaque;
  ctx.fillText(pal, M, yp);
  ctx.restore();
  tracking(ctx, "0em");
  mov("entrega", M, yp + 150);
  paragrafo(
    ctx,
    c.ctaEntrega || "e eu te mando o material",
    M,
    yp + 100,
    W - 2 * M,
    48,
    1.25,
    tinta,
    600,
  );
  ctx.restore();
  ctx.font = fonte(500, 22, "GeistMono");
  ctx.fillStyle = est === "fogo" ? p.tintaEscuro : mudo;
  ctx.fillText("PRECISA ESTAR SEGUINDO PRA RECEBER", M, est === "fogo" ? 120 + 40 : 1278);
}
