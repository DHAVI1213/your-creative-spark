import { SystemWindow } from "@/components/system/System";
import { useEditor } from "@/lib/editor/store";

export function PreviaModelo() {
  const { videos, modeloId } = useEditor();
  const modelo = videos.find((video) => video.id === modeloId);
  if (!modelo) return null;
  return (
    <SystemWindow title="Vídeo modelo" className="min-w-0">
      <div className="space-y-3 p-3">
        <video
          key={modelo.id}
          src={modelo.url}
          controls
          playsInline
          preload="metadata"
          className="max-h-[60vh] w-full rounded bg-black"
          aria-label={`Prévia de ${modelo.nome}`}
        />
        <p className="break-words text-sm font-medium">{modelo.nome}</p>
        <p className="text-xs text-muted-foreground">
          Clique em um vídeo da mesa para trocar o modelo.
        </p>
      </div>
    </SystemWindow>
  );
}
