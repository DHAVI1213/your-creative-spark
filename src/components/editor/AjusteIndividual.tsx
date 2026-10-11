import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useEditor } from "@/lib/editor/store";
import type { AjusteVideo, VideoItem } from "@/lib/editor/tipos";
import { ControleCorte, ControleDeslizante } from "./ControlesEdicao";
import { VideoComEdicao } from "./VideoComEdicao";

export function AjusteIndividual({ video }: { video: VideoItem }) {
  const { edicao, ajustarVideo } = useEditor();
  const mudar = (parcial: AjusteVideo) => ajustarVideo(video.id, { ...video.ajuste, ...parcial });
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto min-h-9 w-full whitespace-normal text-xs"
        >
          Ajuste só deste vídeo
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl">
        <div className="mx-auto max-w-2xl space-y-4">
          <SheetTitle>Ajuste só deste vídeo</SheetTitle>
          <SheetDescription>
            {video.nome} · os outros vídeos continuam com a edição geral.
          </SheetDescription>
          <div className="mx-auto w-40">
            <VideoComEdicao video={video} edicao={edicao} automatico />
          </div>
          <ControleCorte
            corte={video.ajuste?.corte ?? edicao.corte}
            duracao={video.duracao}
            mudar={(corte) => mudar({ corte })}
          />
          <ControleDeslizante
            titulo="Posição horizontal"
            valor={video.ajuste?.posicaoX ?? edicao.posicaoX}
            min={-1}
            max={1}
            mudar={(posicaoX) => mudar({ posicaoX })}
          />
          <ControleDeslizante
            titulo="Posição vertical"
            valor={video.ajuste?.posicaoY ?? edicao.posicaoY}
            min={-1}
            max={1}
            mudar={(posicaoY) => mudar({ posicaoY })}
          />
          <Button
            variant="outline"
            disabled={!video.ajuste}
            onClick={() => ajustarVideo(video.id, undefined)}
          >
            Usar edição geral
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
