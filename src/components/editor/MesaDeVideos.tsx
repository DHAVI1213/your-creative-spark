import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/lib/editor/store";
import type { VideoItem } from "@/lib/editor/tipos";

function CartaoVideo({ video }: { video: VideoItem }) {
  const elemento = useRef<HTMLVideoElement>(null);
  const { modeloId, escolherModelo, remover } = useEditor();
  useEffect(() => {
    const player = elemento.current;
    if (!player || typeof IntersectionObserver === "undefined") return;
    let visivel = false;
    const atualizar = () => {
      if (visivel && !document.hidden) void player.play().catch(() => undefined);
      else player.pause();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visivel = entry?.isIntersecting ?? false;
        atualizar();
      },
      { threshold: 0.1 },
    );
    observer.observe(player);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", atualizar);
      player.pause();
    };
  }, [video.url]);
  const modelo = modeloId === video.id;
  const segundos = Math.floor(video.duracao);
  const duracao = `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;
  return (
    <article
      className={`relative min-w-0 overflow-hidden rounded-md border ${modelo ? "border-primary bg-primary/10" : "border-border bg-card"}`}
    >
      <button
        type="button"
        className="block w-full text-left focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`Usar ${video.nome} como modelo`}
        aria-pressed={modelo}
        onClick={() => escolherModelo(video.id)}
      >
        <video
          ref={elemento}
          src={video.url}
          muted
          loop
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black object-contain"
        />
        <div className="space-y-1 p-3">
          <p className="truncate text-sm font-medium" title={video.nome}>
            {video.nome}
          </p>
          <p className="text-xs text-muted-foreground">
            {duracao} · {video.tamanhoMB.toFixed(1)} MB
          </p>
          {modelo && <span className="sys-label text-primary">MODELO</span>}
        </div>
      </button>
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-1 top-1 size-9"
        aria-label={`Remover ${video.nome}`}
        onClick={() => remover(video.id)}
      >
        <X className="size-4" />
      </Button>
    </article>
  );
}

export function MesaDeVideos() {
  const { videos } = useEditor();
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {videos.map((video) => (
        <CartaoVideo key={video.id} video={video} />
      ))}
    </div>
  );
}
