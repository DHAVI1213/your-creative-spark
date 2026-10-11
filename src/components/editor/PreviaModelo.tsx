import { SystemWindow } from "@/components/system/System";
import { useEditor } from "@/lib/editor/store";
import { VideoComEdicao } from "./VideoComEdicao";
export function PreviaModelo() {
  const {
    videos,
    modeloId,
    edicao,
    tempoModelo,
    camadaSelecionadaId,
    selecionarCamada,
    atualizarCamada,
    confirmarEdicao,
  } = useEditor();
  const modelo = videos.find((video) => video.id === modeloId);
  if (!modelo) return null;
  return (
    <SystemWindow title="Vídeo modelo" className="min-w-0">
      <div className="space-y-3 p-3">
        <VideoComEdicao
          key={modelo.id}
          video={modelo}
          edicao={edicao}
          controles
          referencia={tempoModelo}
          numero={videos.findIndex((video) => video.id === modeloId) + 1}
          editorCamadas={{
            selecionadaId: camadaSelecionadaId,
            selecionar: selecionarCamada,
            atualizar: atualizarCamada,
            confirmar: confirmarEdicao,
          }}
        />
        <p className="break-words text-sm font-medium">{modelo.nome}</p>
        <p className="text-xs text-muted-foreground">
          Clique em um vídeo da mesa para trocar o modelo.
        </p>
      </div>
    </SystemWindow>
  );
}
