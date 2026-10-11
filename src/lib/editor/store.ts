import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { lerInfo } from "./ler-video";
import { EDICAO_PADRAO, type Edicao, type VideoItem } from "./tipos";

export const LIMITE_VIDEOS = 50;
export type EstadoEditor = { videos: VideoItem[]; modeloId: string | null; edicao: Edicao };
export const ESTADO_INICIAL: EstadoEditor = { videos: [], modeloId: null, edicao: EDICAO_PADRAO };
export type AcaoEditor =
  | { tipo: "adicionar"; videos: VideoItem[] }
  | { tipo: "remover"; id: string }
  | { tipo: "limpar" }
  | { tipo: "modelo"; id: string }
  | { tipo: "edicao"; parcial: Partial<Edicao> };

export function editorReducer(estado: EstadoEditor, acao: AcaoEditor): EstadoEditor {
  switch (acao.tipo) {
    case "adicionar": {
      const videos = [...estado.videos, ...acao.videos].slice(0, LIMITE_VIDEOS);
      return { ...estado, videos, modeloId: estado.modeloId ?? videos[0]?.id ?? null };
    }
    case "remover": {
      const videos = estado.videos.filter((video) => video.id !== acao.id);
      return {
        ...estado,
        videos,
        modeloId: estado.modeloId === acao.id ? (videos[0]?.id ?? null) : estado.modeloId,
      };
    }
    case "limpar":
      return { ...ESTADO_INICIAL, videos: [], edicao: {} };
    case "modelo":
      return estado.videos.some((video) => video.id === acao.id)
        ? { ...estado, modeloId: acao.id }
        : estado;
    case "edicao":
      return { ...estado, edicao: { ...estado.edicao, ...acao.parcial } as Edicao };
  }
}

type EditorStore = EstadoEditor & {
  adicionar: (files: File[]) => Promise<void>;
  remover: (id: string) => void;
  limparTudo: () => void;
  escolherModelo: (id: string) => void;
  mudarEdicao: (parcial: Partial<Edicao>) => void;
  carregando: boolean;
};
const EditorContext = createContext<EditorStore | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [estado, dispatch] = useReducer(editorReducer, ESTADO_INICIAL);
  const [pendentes, alterarPendentes] = useReducer((n: number, delta: number) => n + delta, 0);
  const recursos = useRef(new Map<string, string>());
  const geracao = useRef(0);
  const vagas = useRef(0);

  useEffect(() => {
    const urls = recursos.current;
    const ciclo = geracao;
    const capacidade = vagas;
    return () => {
      ciclo.current++;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      capacidade.current = 0;
    };
  }, []);

  const adicionar = async (files: File[]) => {
    const lote = files.slice(0, LIMITE_VIDEOS - vagas.current);
    if (lote.length < files.length)
      toast.error("A mesa aceita até 50 vídeos. Remova alguns para adicionar mais.");
    vagas.current += lote.length;
    const atual = geracao.current;
    alterarPendentes(1);
    // Ler um arquivo por vez evita abrir dezenas de decodificadores no celular.
    try {
      for (const file of lote) {
        if (geracao.current !== atual) break;
        try {
          const info = await lerInfo(file);
          if (geracao.current !== atual) break;
          const id = crypto.randomUUID();
          const url = URL.createObjectURL(file);
          recursos.current.set(id, url);
          dispatch({
            tipo: "adicionar",
            videos: [
              {
                id,
                file,
                url,
                nome: file.name,
                ...info,
                tamanhoMB: file.size / 1024 / 1024,
                status: "pronto",
                progresso: 0,
              },
            ],
          });
        } catch (erro) {
          if (geracao.current !== atual) break;
          vagas.current--;
          toast.error(
            `${file.name}: ${erro instanceof Error ? erro.message : "Não foi possível ler o vídeo."}`,
          );
        }
      }
    } finally {
      alterarPendentes(-1);
    }
  };
  const remover = (id: string) => {
    const url = recursos.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      recursos.current.delete(id);
      vagas.current--;
    }
    dispatch({ tipo: "remover", id });
  };
  const limparTudo = () => {
    geracao.current++;
    recursos.current.forEach((url) => URL.revokeObjectURL(url));
    recursos.current.clear();
    vagas.current = 0;
    dispatch({ tipo: "limpar" });
  };
  return createElement(
    EditorContext.Provider,
    {
      value: {
        ...estado,
        adicionar,
        remover,
        limparTudo,
        escolherModelo: (id) => dispatch({ tipo: "modelo", id }),
        mudarEdicao: (parcial) => dispatch({ tipo: "edicao", parcial }),
        carregando: pendentes > 0,
      },
    },
    children,
  );
}

export function useEditor() {
  const store = useContext(EditorContext);
  if (!store) throw new Error("O editor precisa estar dentro de EditorProvider.");
  return store;
}
