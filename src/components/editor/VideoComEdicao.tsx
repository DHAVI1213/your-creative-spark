import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { edicaoDoVideo, normalizarFiltro, paraCss, tonsDoFiltro } from "@/lib/editor/filtros";
import type { Edicao, VideoItem } from "@/lib/editor/tipos";

const GRAO = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' opacity='.5' filter='url(%23n)'/%3E%3C/svg%3E")`;

export function VideoComEdicao({
  video,
  edicao,
  controles = false,
  automatico = false,
  referencia,
}: {
  video: VideoItem;
  edicao: Edicao;
  controles?: boolean;
  automatico?: boolean;
  referencia?: MutableRefObject<HTMLVideoElement | null>;
}) {
  const principal = useRef<HTMLVideoElement>(null);
  const fundo = useRef<HTMLVideoElement>(null);
  const moldura = useRef<HTMLDivElement>(null);
  const atual = edicaoDoVideo(video, edicao);
  const config = useRef(atual);
  const [tempo, setTempo] = useState(0);
  const [tocando, setTocando] = useState(false);
  const nitidezId = useId().replaceAll(":", "");
  const f = normalizarFiltro(atual.filtro);
  const tons = tonsDoFiltro(f.nome);
  const quarto = atual.girar === 90 || atual.girar === 270;
  const proporcao =
    atual.formato === "original"
      ? quarto
        ? video.altura / video.largura
        : video.largura / video.altura
      : Number(atual.formato.split(":")[0]) / Number(atual.formato.split(":")[1]);
  const css = paraCss(f);
  const estilo: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: quarto ? `${100 / proporcao}%` : "100%",
    height: quarto ? `${100 * proporcao}%` : "100%",
    maxWidth: "none",
    objectFit: atual.enquadrar === "preencher" ? "cover" : "contain",
    transform: `translate(-50%, -50%) translate(${atual.posicaoX * 25}%, ${atual.posicaoY * 25}%) rotate(${atual.girar}deg) scale(${atual.espelhar ? -atual.zoom : atual.zoom}, ${atual.zoom})`,
    filter: `${css}${f.nitidez ? ` url(#${nitidezId})` : ""}`,
  };

  useEffect(() => {
    config.current = atual;
    const player = principal.current;
    if (!player) return;
    player.playbackRate = atual.velocidade;
    const { inicio, fim } = atual.corte;
    if (
      player.readyState >= 1 &&
      (player.currentTime < inicio - 0.001 || player.currentTime >= (fim ?? video.duracao))
    )
      player.currentTime = inicio;
    if (fundo.current) fundo.current.playbackRate = atual.velocidade;
  }, [atual, video.duracao]);

  useEffect(() => {
    const player = principal.current;
    const background = fundo.current;
    if (!player) return;
    if (referencia) referencia.current = player;
    let frame = 0;
    const sincronizar = () => {
      const corte = config.current.corte;
      const fim = corte.fim ?? video.duracao;
      if (
        player.readyState >= 1 &&
        (player.currentTime < corte.inicio - 0.001 || player.currentTime >= fim)
      )
        player.currentTime = corte.inicio;
      if (background) {
        background.playbackRate = player.playbackRate;
        if (
          background.readyState >= 1 &&
          Math.abs(background.currentTime - player.currentTime) > 0.06
        )
          background.currentTime = player.currentTime;
      }
      if (controles)
        setTempo((anterior) =>
          Math.abs(anterior - player.currentTime) > 0.05 ? player.currentTime : anterior,
        );
    };
    const repetir = () => {
      sincronizar();
      frame = requestAnimationFrame(repetir);
    };
    const tocar = () => {
      if (controles) setTocando(true);
      if (background) void background.play().catch(() => undefined);
      cancelAnimationFrame(frame);
      repetir();
    };
    const pausar = () => {
      if (controles) setTocando(false);
      background?.pause();
      cancelAnimationFrame(frame);
    };
    const terminou = () => {
      player.currentTime = config.current.corte.inicio;
      void player.play().catch(() => undefined);
    };
    player.addEventListener("loadedmetadata", sincronizar);
    player.addEventListener("timeupdate", sincronizar);
    player.addEventListener("seeking", sincronizar);
    player.addEventListener("play", tocar);
    player.addEventListener("pause", pausar);
    player.addEventListener("ended", terminou);
    background?.addEventListener("loadedmetadata", sincronizar);
    if (!player.paused) tocar();
    return () => {
      cancelAnimationFrame(frame);
      player.removeEventListener("loadedmetadata", sincronizar);
      player.removeEventListener("timeupdate", sincronizar);
      player.removeEventListener("seeking", sincronizar);
      player.removeEventListener("play", tocar);
      player.removeEventListener("pause", pausar);
      player.removeEventListener("ended", terminou);
      background?.removeEventListener("loadedmetadata", sincronizar);
      background?.pause();
      if (referencia?.current === player) referencia.current = null;
    };
  }, [video.url, video.duracao, controles, referencia, atual.enquadrar]);

  useEffect(() => {
    const player = principal.current;
    const box = moldura.current;
    if (!player || !box) return;
    let visivel = false;
    let retomar = automatico;
    let suspenso = false;
    const atualizar = () => {
      if (visivel && !document.hidden) {
        if (retomar) void player.play().catch(() => undefined);
        suspenso = false;
      } else {
        if (!suspenso) retomar = automatico || !player.paused;
        suspenso = true;
        player.pause();
        fundo.current?.pause();
      }
    };
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              visivel = entry?.isIntersecting ?? false;
              atualizar();
            },
            { threshold: 0.1 },
          )
        : null;
    observer?.observe(box);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", atualizar);
      player.pause();
    };
  }, [video.url, automatico]);

  const fim = atual.corte.fim ?? video.duracao;
  return (
    <div
      className="mx-auto w-full min-w-0"
      style={controles ? { maxWidth: `${proporcao * 60}vh` } : undefined}
    >
      <div
        ref={moldura}
        className="relative isolate w-full overflow-hidden rounded bg-black"
        style={{ aspectRatio: proporcao }}
      >
        {atual.enquadrar === "fundo-desfocado" && (
          <video
            key="fundo"
            ref={fundo}
            src={video.url}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            style={{
              ...estilo,
              objectFit: "cover",
              transform: `translate(-50%, -50%) rotate(${atual.girar}deg) scale(1.2)`,
              filter: `${css} blur(24px)`,
            }}
          />
        )}
        <video
          key="principal"
          ref={principal}
          src={video.url}
          muted={!controles}
          playsInline
          preload="metadata"
          style={estilo}
          aria-label={`Prévia de ${video.nome}`}
        />
        <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true">
          <defs>
            <filter id={nitidezId} colorInterpolationFilters="sRGB">
              <feConvolveMatrix
                order="3"
                kernelMatrix={`0 ${-f.nitidez} 0 ${-f.nitidez} ${1 + 4 * f.nitidez} ${-f.nitidez} 0 ${-f.nitidez} 0`}
                preserveAlpha="true"
              />
            </filter>
          </defs>
        </svg>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: f.temperatura >= 0 ? "rgb(255,155,55)" : "rgb(55,140,255)",
            opacity: Math.abs(f.temperatura) * 0.18,
            mixBlendMode: "soft-light",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(to top, rgba(${tons.cor},${Math.max(...tons.sombras) * 1.2}), transparent 70%)`,
            mixBlendMode: "soft-light",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `rgba(${tons.cor},${Math.max(...tons.luzes) * 0.35})`,
            mixBlendMode: "screen",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse, transparent 35%, rgba(0,0,0,${f.vinheta * 0.75}) 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: GRAO, opacity: f.granulado * 0.3, mixBlendMode: "overlay" }}
        />
      </div>
      {controles && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            size="icon"
            variant="outline"
            aria-label={tocando ? "Pausar modelo" : "Reproduzir modelo"}
            onClick={() => {
              const player = principal.current;
              if (!player) return;
              if (player.paused) void player.play().catch(() => undefined);
              else player.pause();
            }}
          >
            {tocando ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <input
            type="range"
            min={atual.corte.inicio}
            max={fim}
            step={0.01}
            value={Math.max(atual.corte.inicio, Math.min(tempo, fim))}
            aria-label="Tempo do vídeo modelo"
            className="min-w-0 flex-1 accent-primary"
            onChange={(event) => {
              if (principal.current) principal.current.currentTime = Number(event.target.value);
              setTempo(Number(event.target.value));
            }}
          />
          <span className="text-xs tabular-nums">{tempo.toFixed(1)} s</span>
        </div>
      )}
    </div>
  );
}
