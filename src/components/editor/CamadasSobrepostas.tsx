import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from "react";
import { RotateCw } from "lucide-react";
import {
  alinharCentro,
  camadaVisivel,
  limitarPosicao,
  substituirVariaveis,
} from "@/lib/editor/camadas";
import type { Camada, Edicao, VideoItem } from "@/lib/editor/tipos";

export type EdicaoCamadas = {
  selecionadaId: string | null;
  selecionar: (id: string | null) => void;
  atualizar: (camada: Camada, transitoria?: boolean) => void;
  confirmar: () => void;
};
type Gesto = {
  modo: "mover" | "tamanho" | "girar";
  id: number;
  inicioX: number;
  inicioY: number;
  camada: Camada;
  altura: number;
  largura: number;
  angulo: number;
  alturaCamada: number;
};

function CamadaVisual({
  camada,
  video,
  numero,
  tempo,
  proporcao,
  editor,
  reduzido,
}: {
  camada: Camada;
  video: VideoItem;
  numero: number;
  tempo: number;
  proporcao: number;
  editor?: EdicaoCamadas | undefined;
  reduzido: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const gesto = useRef<Gesto | null>(null);
  const [altura, setAltura] = useState(0.1);
  const [guias, setGuias] = useState({ x: false, y: false });
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const selecionada = editor?.selecionadaId === camada.id;
  const texto =
    camada.tipo === "texto" ? substituirVariaveis(camada.texto.conteudo, video.nome, numero) : "";

  useEffect(() => {
    const elemento = box.current;
    if (!elemento) return;
    const medir = () => {
      const frame = elemento.parentElement;
      if (frame?.clientHeight) setAltura(elemento.offsetHeight / frame.clientHeight);
    };
    medir();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    observer?.observe(elemento);
    if (elemento.parentElement) observer?.observe(elemento.parentElement);
    return () => observer?.disconnect();
  }, [texto, camada.tipo]);

  const posicao = limitarPosicao(
    camada.x,
    camada.y,
    camada.largura,
    altura,
    camada.rotacao,
    proporcao,
  );
  const iniciar = (
    event: PointerEvent<HTMLDivElement | HTMLButtonElement>,
    modo: Gesto["modo"],
  ) => {
    if (!editor || event.button !== 0 || editando) return;
    event.preventDefault();
    event.stopPropagation();
    editor.selecionar(camada.id);
    const frame = box.current?.parentElement?.getBoundingClientRect();
    if (!frame) return;
    const centroX = frame.left + posicao.x * frame.width;
    const centroY = frame.top + posicao.y * frame.height;
    gesto.current = {
      modo,
      id: event.pointerId,
      inicioX: event.clientX,
      inicioY: event.clientY,
      camada: { ...camada, x: posicao.x, y: posicao.y, largura: posicao.largura },
      altura: frame.height,
      largura: frame.width,
      angulo: Math.atan2(event.clientY - centroY, event.clientX - centroX),
      alturaCamada: posicao.altura,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const mover = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!editor || !g || event.pointerId !== g.id) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = (event.clientX - g.inicioX) / g.largura;
    const dy = (event.clientY - g.inicioY) / g.altura;
    let x = g.camada.x,
      y = g.camada.y,
      largura = g.camada.largura,
      rotacao = g.camada.rotacao;
    let tamanho = 1;
    if (g.modo === "mover") {
      x = alinharCentro(x + dx);
      y = alinharCentro(y + dy);
    }
    if (g.modo === "tamanho") {
      largura = Math.max(0.03, Math.min(1, largura + dx * 2));
      tamanho = largura / g.camada.largura;
    }
    if (g.modo === "girar") {
      const frame = box.current?.parentElement?.getBoundingClientRect();
      if (!frame) return;
      rotacao +=
        ((Math.atan2(
          event.clientY - (frame.top + y * frame.height),
          event.clientX - (frame.left + x * frame.width),
        ) -
          g.angulo) *
          180) /
        Math.PI;
    }
    const ajustada = limitarPosicao(x, y, largura, g.alturaCamada * tamanho, rotacao, proporcao);
    const nova = { ...g.camada, x: ajustada.x, y: ajustada.y, largura: ajustada.largura, rotacao };
    if (nova.tipo === "texto" && g.camada.tipo === "texto" && g.modo === "tamanho")
      nova.texto = {
        ...g.camada.texto,
        tamanho: Math.max(0.01, Math.min(0.25, g.camada.texto.tamanho * tamanho)),
      };
    editor.atualizar(nova, true);
    setGuias({
      x: g.modo === "mover" && ajustada.x === 0.5,
      y: g.modo === "mover" && ajustada.y === 0.5,
    });
  };
  const encerrar = () => {
    if (gesto.current) editor?.confirmar();
    gesto.current = null;
    setGuias({ x: false, y: false });
  };
  const salvarTexto = () => {
    if (editor && camada.tipo === "texto" && rascunho !== camada.texto.conteudo)
      editor.atualizar({ ...camada, texto: { ...camada.texto, conteudo: rascunho } });
    setEditando(false);
  };
  const decorrido = Math.max(0, tempo - camada.inicio);
  const entrada = Math.min(1, decorrido / 0.3);
  const ease = 1 - (1 - entrada) ** 3;
  const animacao = reduzido ? "nenhuma" : camada.animacao;
  const escala =
    animacao === "pulsar"
      ? 1 + Math.sin((decorrido * Math.PI * 2) / 1.2) * 0.025
      : animacao === "surgir"
        ? 0.94 + ease * 0.06
        : 1;
  const deslocamento = animacao === "subir" ? (1 - ease) * 20 : 0;
  const tremida = animacao === "tremer" ? Math.sin(decorrido * Math.PI * 12) * 0.8 : 0;
  const conteudo =
    animacao === "digitar"
      ? Array.from(texto)
          .slice(0, Math.floor(decorrido * 24))
          .join("")
      : texto;
  const t = camada.tipo === "texto" ? camada.texto : null;
  return (
    <>
      {guias.x && (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-50 border-l border-cyan-300" />
      )}
      {guias.y && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-50 border-t border-cyan-300" />
      )}
      <div
        ref={box}
        data-camada-id={camada.id}
        aria-label={camada.tipo === "texto" ? `Camada de texto: ${texto}` : "Camada de imagem"}
        className={`absolute select-none ${editor ? "pointer-events-auto touch-none" : "pointer-events-none"}`}
        style={{
          left: `${posicao.x * 100}%`,
          top: `${posicao.y * 100}%`,
          width: `${camada.largura * 100}%`,
          transform: `translate(-50%, -50%) rotate(${camada.rotacao}deg) scale(${posicao.largura / camada.largura})`,
          opacity: camada.opacidade,
          outline: selecionada ? "1px dashed #38bdf8" : undefined,
        }}
        onPointerDown={(event) => iniciar(event, "mover")}
        onPointerMove={mover}
        onPointerUp={encerrar}
        onPointerCancel={encerrar}
        onLostPointerCapture={encerrar}
        onDoubleClick={() => {
          if (editor && camada.tipo === "texto") {
            setRascunho(camada.texto.conteudo);
            setEditando(true);
          }
        }}
      >
        <div
          style={{
            transform: `translateY(${deslocamento}%) scale(${escala}) rotate(${tremida}deg)`,
            opacity: animacao === "surgir" || animacao === "subir" ? ease : 1,
          }}
        >
          {camada.tipo === "imagem" ? (
            <img
              src={camada.imagem.dataUrl}
              alt="Logo ou imagem"
              draggable={false}
              className="block h-auto w-full"
            />
          ) : (
            <div
              style={{
                position: "relative",
                fontFamily: `'${t?.fonte}', sans-serif`,
                fontSize: `${(t?.tamanho ?? 0.07) * 100}cqh`,
                fontWeight: t?.negrito ? 800 : 400,
                textAlign: t?.alinhamento,
                color: t?.cor,
                textTransform: t?.maiusculas ? "uppercase" : "none",
                lineHeight: 1.15,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                WebkitTextStroke: `${(t?.contorno.espessura ?? 0) * 100}cqh ${t?.contorno.cor}`,
                paintOrder: "stroke fill",
                textShadow: t?.sombra ? "0 0.3cqh 0.7cqh rgba(0,0,0,.8)" : "none",
                padding: t?.fundo ? "0.7cqh" : 0,
              }}
            >
              {t?.fundo && (
                <div
                  className="absolute inset-0 -z-10"
                  style={{
                    background: t.fundo.cor,
                    opacity: t.fundo.opacidade,
                    borderRadius: `${t.fundo.arredondado * 100}cqh`,
                  }}
                />
              )}
              <span style={animacao === "digitar" ? { visibility: "hidden" } : undefined}>
                {texto || " "}
              </span>
              {animacao === "digitar" && (
                <span className="absolute inset-0" style={{ padding: t?.fundo ? "0.7cqh" : 0 }}>
                  {conteudo}
                </span>
              )}
            </div>
          )}
        </div>
        {editando && (
          <textarea
            autoFocus
            aria-label="Editar texto da camada"
            className="absolute inset-0 z-50 min-h-12 w-full resize-none rounded border border-primary bg-background p-1 text-sm text-foreground"
            value={rascunho}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => setRascunho(event.target.value)}
            onBlur={salvarTexto}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditando(false);
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                salvarTexto();
              }
            }}
          />
        )}
        {selecionada && !editando && (
          <>
            <button
              type="button"
              aria-label="Aumentar ou diminuir camada"
              className="absolute -bottom-3 -right-3 size-7 rounded-full border-2 border-white bg-primary"
              style={{ touchAction: "none" }}
              onPointerDown={(event) => iniciar(event, "tamanho")}
            />
            <button
              type="button"
              aria-label="Girar camada"
              className="absolute -top-9 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-white bg-primary text-primary-foreground"
              style={{ touchAction: "none" }}
              onPointerDown={(event) => iniciar(event, "girar")}
            >
              <RotateCw className="size-4" />
            </button>
          </>
        )}
      </div>
    </>
  );
}

export function CamadasSobrepostas({
  video,
  edicao,
  numero,
  player,
  proporcao,
  editor,
}: {
  video: VideoItem;
  edicao: Edicao;
  numero: number;
  player: MutableRefObject<HTMLVideoElement | null>;
  proporcao: number;
  editor?: EdicaoCamadas | undefined;
}) {
  const [tempo, setTempo] = useState(0);
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const atualizar = () => setReduzido(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);
  useEffect(() => {
    const videoEl = player.current;
    if (!videoEl) return;
    let frame = 0;
    let ultima = -1;
    const atualizar = () => {
      if (Math.abs(videoEl.currentTime - ultima) >= 1 / 30) {
        ultima = videoEl.currentTime;
        setTempo(ultima);
      }
    };
    const ciclo = () => {
      atualizar();
      frame = requestAnimationFrame(ciclo);
    };
    const tocar = () => {
      cancelAnimationFrame(frame);
      ciclo();
    };
    const pausar = () => {
      cancelAnimationFrame(frame);
      atualizar();
    };
    atualizar();
    videoEl.addEventListener("play", tocar);
    videoEl.addEventListener("pause", pausar);
    videoEl.addEventListener("timeupdate", atualizar);
    videoEl.addEventListener("seeking", atualizar);
    if (!videoEl.paused) tocar();
    return () => {
      cancelAnimationFrame(frame);
      videoEl.removeEventListener("play", tocar);
      videoEl.removeEventListener("pause", pausar);
      videoEl.removeEventListener("timeupdate", atualizar);
      videoEl.removeEventListener("seeking", atualizar);
    };
  }, [player, video.url]);
  return (
    <div
      className="pointer-events-none absolute inset-0"
      onPointerDown={(event) => {
        if (editor && event.target === event.currentTarget) editor.selecionar(null);
      }}
    >
      {editor && edicao.formato === "9:16" && (
        <div
          className="pointer-events-none absolute inset-0"
          aria-label="Área segura aproximada para Reels e TikTok"
        >
          <div className="absolute inset-x-0 top-0 h-[8%] border-b border-dashed border-white/40 bg-black/20" />
          <div className="absolute inset-y-[8%] right-0 w-[14%] border-l border-dashed border-white/40 bg-black/20" />
          <div className="absolute inset-x-0 bottom-0 h-[20%] border-t border-dashed border-white/40 bg-black/20">
            <span className="absolute bottom-1 left-1 text-[10px] text-white">
              Reserve espaço para legenda e botões
            </span>
          </div>
        </div>
      )}
      {edicao.camadas
        .filter((camada) => camadaVisivel(camada, tempo))
        .map((camada) => (
          <CamadaVisual
            key={camada.id}
            camada={camada}
            video={video}
            numero={numero}
            tempo={tempo}
            proporcao={proporcao}
            editor={editor}
            reduzido={reduzido}
          />
        ))}
    </div>
  );
}
