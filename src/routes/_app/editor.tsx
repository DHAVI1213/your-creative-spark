import { createFileRoute } from "@tanstack/react-router";
import { Film, Trash2 } from "lucide-react";
import { AreaDeEnvio } from "@/components/editor/AreaDeEnvio";
import { MesaDeVideos } from "@/components/editor/MesaDeVideos";
import { PreviaModelo } from "@/components/editor/PreviaModelo";
import { SystemHeader, SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { EditorProvider, useEditor } from "@/lib/editor/store";

export const Route = createFileRoute("/_app/editor")({
  head: () => ({ meta: [{ title: "Editor em Massa · Fábrica de Conteúdo" }] }),
  component: EditorPage,
});
function EditorPage() {
  return (
    <EditorProvider>
      <MesaEditor />
    </EditorProvider>
  );
}
function MesaEditor() {
  const { videos, limparTudo, carregando } = useEditor();
  return (
    <div className="space-y-6">
      <SystemHeader
        label="Mesa de vídeos"
        title="Editor em Massa"
        icon={Film}
        description="Organize seus vídeos e escolha um modelo. As opções de edição chegam em breve."
      />
      <AreaDeEnvio />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm" aria-live="polite">
          {videos.length} vídeos na mesa
        </p>
        <Button variant="outline" disabled={!videos.length && !carregando} onClick={limparTudo}>
          <Trash2 className="size-4" />
          Limpar mesa
        </Button>
      </div>
      {videos.length ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
          <div className="order-2 min-w-0 lg:order-1">
            <MesaDeVideos />
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <PreviaModelo />
          </div>
        </div>
      ) : (
        <SystemWindow title="Sua mesa está vazia">
          <div className="space-y-3 px-6 py-12 text-center">
            <Film className="mx-auto size-10 text-primary" />
            <p>Suba os vídeos, edite um e a edição vale para todos.</p>
            <p className="text-sm text-muted-foreground">
              Comece escolhendo seus vídeos. A edição estará disponível nas próximas etapas.
            </p>
          </div>
        </SystemWindow>
      )}
    </div>
  );
}
