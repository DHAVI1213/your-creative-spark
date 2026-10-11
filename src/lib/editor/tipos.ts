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
};

// As opções de edição serão definidas nas próximas etapas.
export type Edicao = Record<string, never>;
export const EDICAO_PADRAO: Edicao = {};
