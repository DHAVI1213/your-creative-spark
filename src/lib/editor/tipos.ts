export type VideoItem = {
  id: string;
  file: File;
  url: string;
  nome: string;
  duracao: number;
  largura: number;
  altura: number;
  tamanhoMB: number;
  status: "pronto" | "processando" | "feito" | "erro";
  progresso: number;
  erro?: string | undefined;
  saida?: Blob | undefined;
  ajuste?: AjusteVideo | undefined;
};

export type Corte = { inicio: number; fim: number | null };
export type AjusteVideo = { corte?: Corte; posicaoX?: number; posicaoY?: number };
export type Filtro = {
  nome: string;
  brilho: number;
  contraste: number;
  saturacao: number;
  temperatura: number;
  vinheta: number;
  nitidez: number;
  granulado: number;
};
export type Edicao = {
  corte: Corte;
  formato: "original" | "9:16" | "1:1" | "4:5" | "16:9";
  enquadrar: "preencher" | "caber" | "fundo-desfocado";
  zoom: number;
  posicaoX: number;
  posicaoY: number;
  espelhar: boolean;
  girar: 0 | 90 | 180 | 270;
  velocidade: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
  filtro: Filtro;
};
export const EDICAO_PADRAO: Edicao = {
  corte: { inicio: 0, fim: null },
  formato: "original",
  enquadrar: "preencher",
  zoom: 1,
  posicaoX: 0,
  posicaoY: 0,
  espelhar: false,
  girar: 0,
  velocidade: 1,
  filtro: {
    nome: "Nenhum",
    brilho: 1,
    contraste: 1,
    saturacao: 1,
    temperatura: 0,
    vinheta: 0,
    nitidez: 0,
    granulado: 0,
  },
};
