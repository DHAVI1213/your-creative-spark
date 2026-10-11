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
import { EDICAO_PADRAO, type AjusteVideo, type Edicao, type VideoItem } from "./tipos";

export const LIMITE_VIDEOS = 50;
export type EstadoEditor = {
  videos: VideoItem[];
  modeloId: string | null;
  edicao: Edicao;
  passado: Edicao[];
  futuro: Edicao[];
  inicioGesto: Edicao | null;
};
export const ESTADO_INICIAL: EstadoEditor = {
  videos: [],
  modeloId: null,
  edicao: EDICAO_PADRAO,
  passado: [],
  futuro: [],
  inicioGesto: null,
};
export type AcaoEditor =
  | { tipo: "adicionar"; videos: VideoItem[] }
  | { tipo: "remover"; id: string }
  | { tipo: "limpar" }
  | { tipo: "modelo"; id: string }
  | { tipo: "edicao"; parcial: Partial<Edicao>; transitoria?: boolean }
  | { tipo: "confirmar" }
  | { tipo: "desfazer" }
  | { tipo: "refazer" }
  | { tipo: "ajuste"; id: string; ajuste: AjusteVideo | undefined };

function confirmarGesto(estado: EstadoEditor): EstadoEditor {
  if (!estado.inicioGesto) return estado;
  const mudou = JSON.stringify(estado.inicioGesto) !== JSON.stringify(estado.edicao);
  return {
    ...estado,
    inicioGesto: null,
    passado: mudou ? [...estado.passado, estado.inicioGesto].slice(-100) : estado.passado,
    futuro: mudou ? [] : estado.futuro,
  };
}

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
      return { ...ESTADO_INICIAL, videos: [] };
    case "modelo":
      return estado.videos.some((video) => video.id === acao.id)
        ? { ...estado, modeloId: acao.id }
        : estado;
    case "edicao": {
      const base = acao.transitoria ? estado : confirmarGesto(estado);
      const edicao = { ...base.edicao, ...acao.parcial };
      if (JSON.stringify(edicao) === JSON.stringify(base.edicao)) return base;
      return {
        ...base,
        edicao,
        inicioGesto: acao.transitoria ? (base.inicioGesto ?? base.edicao) : null,
        passado: acao.transitoria ? base.passado : [...base.passado, base.edicao].slice(-100),
        futuro: [],
      };
    }
    case "confirmar":
      return confirmarGesto(estado);
    case "desfazer": {
      const base = confirmarGesto(estado);
      const anterior = base.passado.at(-1);
      return anterior
        ? {
            ...base,
            edicao: anterior,
            passado: base.passado.slice(0, -1),
            futuro: [base.edicao, ...base.futuro],
          }
        : base;
    }
    case "refazer": {
      const base = confirmarGesto(estado);
      const proxima = base.futuro[0];
      return proxima
        ? {
            ...base,
            edicao: proxima,
            passado: [...base.passado, base.edicao],
            futuro: base.futuro.slice(1),
          }
        : base;
    }
    case "ajuste":
      return {
        ...estado,
        videos: estado.videos.map((video) =>
          video.id === acao.id ? { ...video, ajuste: acao.ajuste } : video,
        ),
      };
  }
}

type EditorStore = EstadoEditor & {
  adicionar: (files: File[]) => Promise<void>;
  remover: (id: string) => void;
  limparTudo: () => void;
  escolherModelo: (id: string) => void;
  mudarEdicao: (parcial: Partial<Edicao>, transitoria?: boolean) => void;
  confirmarEdicao: () => void;
  desfazer: () => void;
  refazer: () => void;
  ajustarVideo: (id: string, ajuste: AjusteVideo | undefined) => void;
  tempoModelo: React.MutableRefObject<HTMLVideoElement | null>;
  carregando: boolean;
};
const EditorContext = createContext<EditorStore | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [estado, dispatch] = useReducer(editorReducer, ESTADO_INICIAL);
  const [pendentes, alterarPendentes] = useReducer((n: number, delta: number) => n + delta, 0);
  const recursos = useRef(new Map<string, string>());
  const geracao = useRef(0);
  const vagas = useRef(0);
  const tempoModelo = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const teclado = (event: KeyboardEvent) => {
      const alvo = event.target;
      if (
        alvo instanceof HTMLElement &&
        (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ tipo: event.shiftKey ? "refazer" : "desfazer" });
      }
    };
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, []);

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
        mudarEdicao: (parcial, transitoria = false) =>
          dispatch({ tipo: "edicao", parcial, transitoria }),
        confirmarEdicao: () => dispatch({ tipo: "confirmar" }),
        desfazer: () => dispatch({ tipo: "desfazer" }),
        refazer: () => dispatch({ tipo: "refazer" }),
        ajustarVideo: (id, ajuste) => dispatch({ tipo: "ajuste", id, ajuste }),
        tempoModelo,
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
