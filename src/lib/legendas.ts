export type Tom = "vendedor" | "leve" | "profissional" | "emocional";

export type Nicho = {
  id: string;
  nome: string;
  produto: string;
  dores: string[];
  beneficios: string[];
  tags: string[];
};

export const NICHOS: Nicho[] = [
  {
    id: "barbearia",
    nome: "Barbearia",
    produto: "corte e barba",
    dores: ["cabelo sem forma", "barba desalinhada", "fila e espera longa"],
    beneficios: ["visual afiado", "autoestima lá em cima", "atendimento com hora marcada"],
    tags: ["barbearia", "barba", "cortemasculino", "degrade", "barbeiro", "visualmasculino"],
  },
  {
    id: "hamburgueria",
    nome: "Hamburgueria / Lanchonete",
    produto: "hambúrguer artesanal",
    dores: ["lanche sem graça", "fome na hora errada", "entrega que chega fria"],
    beneficios: ["sabor de verdade", "ingredientes frescos", "entrega rápida e quentinha"],
    tags: ["hamburguer", "hamburgueriaartesanal", "lanche", "delivery", "burger", "comidaboa"],
  },
  {
    id: "acai",
    nome: "Açaí / Sorveteria",
    produto: "açaí cremoso",
    dores: ["calor sem fim", "vontade de algo gelado", "açaí aguado"],
    beneficios: ["cremosidade de verdade", "monte do seu jeito", "refrescância na hora"],
    tags: ["acai", "acaiteria", "sorvete", "sorveteria", "sobremesa", "refrescante"],
  },
  {
    id: "marmita",
    nome: "Marmita / Restaurante",
    produto: "comida caseira",
    dores: ["falta de tempo para cozinhar", "almoço sempre igual", "fast food todo dia"],
    beneficios: ["tempero de casa", "cardápio variado", "praticidade no dia a dia"],
    tags: ["marmita", "comidacaseira", "almoco", "marmitex", "delivery", "restaurante"],
  },
  {
    id: "salao",
    nome: "Salão / Estética",
    produto: "cuidados com beleza",
    dores: ["autoestima baixa", "cabelo sem vida", "falta de tempo para si"],
    beneficios: ["transformação visível", "momento só seu", "profissionais de confiança"],
    tags: ["salaodebeleza", "cabelo", "beleza", "estetica", "autoestima", "cuidadospessoais"],
  },
  {
    id: "loja",
    nome: "Loja de roupas",
    produto: "peças da nova coleção",
    dores: ["guarda-roupa repetitivo", "peças que não valorizam", "preço fora da realidade"],
    beneficios: ["estilo com preço justo", "peças exclusivas", "troca facilitada"],
    tags: ["modafeminina", "lookdodia", "lojaderoupas", "moda", "novacolecao", "outfit"],
  },
  {
    id: "academia",
    nome: "Academia / Personal",
    produto: "treino com acompanhamento",
    dores: ["falta de constância", "treino sem resultado", "dor por execução errada"],
    beneficios: ["resultado real", "treino sob medida", "evolução acompanhada"],
    tags: ["treino", "academia", "personaltrainer", "fitness", "saude", "foconotreino"],
  },
  {
    id: "servicos",
    nome: "Serviços / Negócio local",
    produto: "serviço de qualidade",
    dores: ["não achar profissional de confiança", "perder tempo com orçamento", "dor de cabeça"],
    beneficios: ["resultado garantido", "atendimento rápido", "preço transparente"],
    tags: [
      "servicos",
      "negociolocal",
      "empreendedorismo",
      "atendimento",
      "qualidade",
      "pequenonegocio",
    ],
  },
  {
    id: "editor",
    nome: "Edição de vídeo / Social media",
    produto: "edição de vídeo profissional",
    dores: ["vídeo que não prende", "perder horas editando", "perfil parado"],
    beneficios: ["retenção maior", "entrega rápida", "perfil com cara profissional"],
    tags: ["edicaodevideo", "reels", "socialmedia", "videomaker", "conteudo", "marketingdigital"],
  },
];

const aleatorio = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;

function embaralhar<T>(a: readonly T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

export function limparTag(t: string): string {
  const s = t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
  return s ? `#${s}` : "";
}

export type EntradaLegenda = {
  nicho: Nicho;
  tom: Tom;
  negocio: string;
  oferta: string;
  cta: string;
  cidade: string;
  extras: string[];
  qtdTags: number;
  emojis: boolean;
};

const GANCHOS: Record<Tom, string[]> = {
  vendedor: [
    "Chega de {dor}.",
    "{negocio} tem a solução para {dor}.",
    "Atenção: {oferta}",
    "Última chance de garantir {beneficio}.",
  ],
  leve: [
    "Quem aí também sofre com {dor}? 😅",
    "Passando pra lembrar: {beneficio} existe, sim.",
    "Seu dia pede {produto}. Concorda?",
    "Sextou com {produto}?",
  ],
  profissional: [
    "{negocio}: {beneficio}.",
    "Como resolver {dor} de forma definitiva.",
    "Qualidade que você percebe: {beneficio}.",
    "Seu padrão merece {produto}.",
  ],
  emocional: [
    "Todo mundo merece {beneficio}.",
    "Às vezes tudo o que a gente precisa é de {produto}.",
    "Cuidar de você também é {beneficio}.",
    "{negocio} nasceu para te dar {beneficio}.",
  ],
};

const CORPOS: Record<Tom, string[]> = {
  vendedor: [
    "Aqui você encontra {produto} com {beneficio} e {beneficio2}.",
    "Quem prova, volta. {produto} com {beneficio}.",
  ],
  leve: [
    "Aqui o papo é simples: {produto} feito com carinho, {beneficio} e {beneficio2}.",
    "A gente cuida de {produto} pra você só curtir.",
  ],
  profissional: [
    "Trabalhamos com {produto}, focando em {beneficio} e {beneficio2}.",
    "Nosso compromisso: {beneficio}, {beneficio2} e atendimento de verdade.",
  ],
  emocional: [
    "Cada detalhe de {produto} é pensado para você sentir {beneficio}.",
    "Mais do que {produto}: é {beneficio} e {beneficio2} no seu dia.",
  ],
};

const EMOJIS: Record<string, string[]> = {
  barbearia: ["💈", "✂️", "🔥"],
  hamburgueria: ["🍔", "🔥", "😋"],
  acai: ["🍇", "🥣", "😋"],
  marmita: ["🍱", "😋", "🔥"],
  salao: ["💇", "✨", "💅"],
  loja: ["🛍️", "✨", "👗"],
  academia: ["💪", "🔥", "🏋️"],
  servicos: ["✅", "🔧", "⭐"],
  editor: ["🎬", "🔥", "📲"],
};

function preencher(t: string, v: Record<string, string>) {
  const r = t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
  // Maiúscula no começo e depois de ponto, exclamação ou interrogação.
  return r.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

const GERAIS = [
  "negociolocal",
  "empreendedorismo",
  "comprelocal",
  "pequenosnegocios",
  "qualidade",
  "novidade",
  "promocao",
  "instabrasil",
  "brasil",
  "reels",
];

export function gerarHashtags(e: EntradaLegenda): string[] {
  const base = [...e.nicho.tags, ...e.extras, ...GERAIS];
  if (e.cidade) base.unshift(`${e.nicho.tags[0]}${e.cidade}`, e.cidade);
  if (e.negocio) base.unshift(e.negocio);
  const unicas = Array.from(new Set(base.map(limparTag).filter((t) => t.length > 2)));
  // Nome, cidade e nicho primeiro; depois as do nicho embaralhadas; as gerais só completam.
  const fixas = unicas.filter((t) => !GERAIS.includes(t.slice(1)));
  const gerais = unicas.filter((t) => GERAIS.includes(t.slice(1)));
  const priorizadas = [...fixas.slice(0, 3), ...embaralhar(fixas.slice(3)), ...embaralhar(gerais)];
  return priorizadas.slice(0, e.qtdTags);
}

export function gerarLegendas(e: EntradaLegenda, qtd = 3): string[] {
  const out: string[] = [];
  const ganchos = embaralhar(GANCHOS[e.tom]);
  const corpos = embaralhar(CORPOS[e.tom]);
  for (let i = 0; i < qtd; i++) {
    const [b1, b2] = embaralhar(e.nicho.beneficios);
    const v = {
      dor: aleatorio(e.nicho.dores),
      beneficio: b1 ?? "",
      beneficio2: b2 ?? b1 ?? "",
      produto: e.nicho.produto,
      negocio: e.negocio || e.nicho.nome,
      oferta: e.oferta || `${e.nicho.produto} com condição especial`,
    };
    const em = e.emojis ? aleatorio(EMOJIS[e.nicho.id] ?? ["✨"]) : "";
    const gancho = preencher(ganchos[i % ganchos.length]!, v);
    const corpo = preencher(corpos[i % corpos.length]!, v);
    const oferta = e.oferta ? `\n\n${e.emojis ? "🎯 " : ""}${e.oferta}` : "";
    const cidade = e.cidade ? `\n${e.emojis ? "📍 " : ""}${e.cidade}` : "";
    const cta = e.cta ? `\n\n${e.emojis ? "👉 " : ""}${e.cta}` : "";
    out.push(
      `${em ? em + " " : ""}${gancho}\n\n${corpo}${oferta}${cidade}${cta}\n\n${gerarHashtags(e).join(" ")}`,
    );
  }
  return out;
}
