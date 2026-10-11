import { Undo2, Redo2, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useDevice } from "@/lib/device";
import { useEditor } from "@/lib/editor/store";
import { EDICAO_PADRAO, type Edicao, type Filtro } from "@/lib/editor/tipos";
import { FILTROS } from "@/lib/editor/filtros";
import { VideoComEdicao } from "./VideoComEdicao";
import { ControleCorte, ControleDeslizante } from "./ControlesEdicao";
import { PainelCamadas } from "./PainelCamadas";

const FORMATOS: { valor: Edicao["formato"]; titulo: string; proporcao: string }[] = [
  { valor: "original", titulo: "Original", proporcao: "4/3" },
  { valor: "9:16", titulo: "Reels / TikTok / Shorts", proporcao: "9/16" },
  { valor: "1:1", titulo: "Quadrado", proporcao: "1" },
  { valor: "4:5", titulo: "Feed", proporcao: "4/5" },
  { valor: "16:9", titulo: "Horizontal", proporcao: "16/9" },
];
const AJUSTES: {
  chave: Exclude<keyof Filtro, "nome">;
  titulo: string;
  min: number;
  max: number;
}[] = [
  { chave: "brilho", titulo: "Brilho", min: 0, max: 2 },
  { chave: "contraste", titulo: "Contraste", min: 0, max: 2 },
  { chave: "saturacao", titulo: "Saturação", min: 0, max: 3 },
  { chave: "temperatura", titulo: "Temperatura", min: -1, max: 1 },
  { chave: "vinheta", titulo: "Vinheta", min: 0, max: 1 },
  { chave: "nitidez", titulo: "Nitidez", min: 0, max: 1 },
  { chave: "granulado", titulo: "Granulado", min: 0, max: 1 },
];

function ConteudoPainel() {
  const {
    videos,
    modeloId,
    edicao,
    mudarEdicao,
    confirmarEdicao,
    desfazer,
    refazer,
    passado,
    futuro,
    inicioGesto,
    tempoModelo,
  } = useEditor();
  const modelo = videos.find((video) => video.id === modeloId);
  if (!modelo) return null;
  const slider = (
    chave: "zoom" | "posicaoX" | "posicaoY",
    titulo: string,
    min: number,
    max: number,
  ) => (
    <ControleDeslizante
      titulo={titulo}
      valor={edicao[chave]}
      min={min}
      max={max}
      mudar={(valor) => mudarEdicao({ [chave]: valor }, true)}
      confirmar={confirmarEdicao}
    />
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!passado.length && !inicioGesto} onClick={desfazer}>
          <Undo2 className="size-4" />
          Desfazer
        </Button>
        <Button variant="outline" disabled={!futuro.length} onClick={refazer}>
          <Redo2 className="size-4" />
          Refazer
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Ctrl+Z para desfazer · Ctrl+Shift+Z para refazer
      </p>
      <Tabs defaultValue="corte">
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger className="px-1 text-xs sm:text-sm" value="corte">
            Corte
          </TabsTrigger>
          <TabsTrigger className="px-1 text-xs sm:text-sm" value="formato">
            Formato
          </TabsTrigger>
          <TabsTrigger className="px-1 text-xs sm:text-sm" value="velocidade">
            Velocidade
          </TabsTrigger>
          <TabsTrigger className="px-1 text-xs sm:text-sm" value="filtros">
            Filtros
          </TabsTrigger>
          <TabsTrigger className="px-2 text-xs sm:text-sm" value="camadas">
            Textos e logo
          </TabsTrigger>
        </TabsList>
        <TabsContent value="camadas" className="pt-4">
          <PainelCamadas />
        </TabsContent>
        <TabsContent value="corte" className="pt-4">
          <ControleCorte
            corte={edicao.corte}
            duracao={modelo.duracao}
            mudar={(corte, transitoria) => mudarEdicao({ corte }, transitoria)}
            confirmar={confirmarEdicao}
            tempoAtual={() => tempoModelo.current?.currentTime ?? 0}
          />
          {modelo.ajuste?.corte && (
            <p className="mt-3 text-xs text-muted-foreground">
              O modelo tem um corte individual. Remova o ajuste no cartão para usar este corte nele.
            </p>
          )}
        </TabsContent>
        <TabsContent value="formato" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FORMATOS.map((formato) => (
              <button
                key={formato.valor}
                type="button"
                aria-pressed={edicao.formato === formato.valor}
                onClick={() => mudarEdicao({ formato: formato.valor })}
                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded border p-3 text-sm ${edicao.formato === formato.valor ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <span
                  className="block h-8 border-2 border-current"
                  style={{ aspectRatio: formato.proporcao }}
                />
                <span className="font-semibold">
                  {formato.valor === "original" ? "Original" : formato.valor}
                </span>
                <span
                  className={`text-xs ${formato.valor === "9:16" ? "text-primary" : "text-muted-foreground"}`}
                >
                  {formato.titulo}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { valor: "preencher", titulo: "Preencher" },
                { valor: "caber", titulo: "Caber (barras)" },
                { valor: "fundo-desfocado", titulo: "Fundo desfocado" },
              ] as const
            ).map(({ valor, titulo }) => (
              <Button
                key={valor}
                variant={edicao.enquadrar === valor ? "default" : "outline"}
                aria-pressed={edicao.enquadrar === valor}
                onClick={() => mudarEdicao({ enquadrar: valor })}
              >
                {titulo}
              </Button>
            ))}
          </div>
          {slider("zoom", "Zoom", 1, 2)}
          {slider("posicaoX", "Posição horizontal", -1, 1)}
          {slider("posicaoY", "Posição vertical", -1, 1)}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={edicao.espelhar ? "default" : "outline"}
              aria-pressed={edicao.espelhar}
              onClick={() => mudarEdicao({ espelhar: !edicao.espelhar })}
            >
              Espelhar
            </Button>
            <Button
              variant="outline"
              onClick={() => mudarEdicao({ girar: ((edicao.girar + 90) % 360) as Edicao["girar"] })}
            >
              Girar · {edicao.girar}°
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="velocidade" className="pt-4">
          <div className="grid grid-cols-3 gap-2">
            {([0.5, 0.75, 1, 1.25, 1.5, 2] as const).map((velocidade) => (
              <Button
                key={velocidade}
                variant={edicao.velocidade === velocidade ? "default" : "outline"}
                aria-pressed={edicao.velocidade === velocidade}
                onClick={() => mudarEdicao({ velocidade })}
              >
                {velocidade}x
              </Button>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="filtros" className="space-y-4 pt-4">
          {(["Clássicos", "Anime"] as const).map((grupo) => (
            <div key={grupo} className="space-y-2">
              <p className="sys-label">{grupo}</p>
              <div className="grid grid-cols-3 gap-2">
                {FILTROS.filter((filtro) => filtro.grupo === grupo).map((filtro) => (
                  <button
                    key={filtro.nome}
                    aria-label={filtro.nome}
                    type="button"
                    aria-pressed={edicao.filtro.nome === filtro.nome}
                    onClick={() => mudarEdicao({ filtro: { ...filtro } })}
                    className={`overflow-hidden rounded border p-1 text-xs ${edicao.filtro.nome === filtro.nome ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    <VideoComEdicao
                      video={{ ...modelo, ajuste: undefined }}
                      edicao={{ ...edicao, formato: "16:9", filtro }}
                      numero={videos.findIndex((video) => video.id === modeloId) + 1}
                    />
                    <span className="block py-2">{filtro.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {AJUSTES.map(({ chave, titulo, min, max }) => (
            <ControleDeslizante
              key={chave}
              titulo={titulo}
              valor={edicao.filtro[chave]}
              min={min}
              max={max}
              mudar={(valor) => mudarEdicao({ filtro: { ...edicao.filtro, [chave]: valor } }, true)}
              confirmar={confirmarEdicao}
            />
          ))}
          <Button
            variant="outline"
            onClick={() =>
              mudarEdicao({
                filtro: {
                  ...(FILTROS.find((filtro) => filtro.nome === edicao.filtro.nome) ??
                    EDICAO_PADRAO.filtro),
                },
              })
            }
          >
            Voltar ao padrão
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function PainelEdicao() {
  const { isMobile } = useDevice();
  const {
    videos,
    modeloId,
    edicao,
    confirmarEdicao,
    camadaSelecionadaId,
    selecionarCamada,
    atualizarCamada,
  } = useEditor();
  const modelo = videos.find((video) => video.id === modeloId);
  const [aberto, setAberto] = useState(false);
  if (!videos.length) return null;
  if (isMobile)
    return (
      <Sheet
        open={aberto}
        onOpenChange={(valor) => {
          confirmarEdicao();
          setAberto(valor);
        }}
      >
        <SheetTrigger asChild>
          <Button className="w-full">
            <SlidersHorizontal className="size-4" />
            Editar todos os vídeos
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[80dvh] overflow-y-auto rounded-t-xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetTitle>Editar todos os vídeos</SheetTitle>
          <SheetDescription className="mb-4">
            A prévia muda na hora em toda a mesa.
          </SheetDescription>
          {modelo && (
            <div className="mx-auto mb-4 w-40">
              <VideoComEdicao
                video={modelo}
                edicao={edicao}
                numero={videos.findIndex((video) => video.id === modeloId) + 1}
                editorCamadas={{
                  selecionadaId: camadaSelecionadaId,
                  selecionar: selecionarCamada,
                  atualizar: atualizarCamada,
                  confirmar: confirmarEdicao,
                }}
                automatico
              />
            </div>
          )}
          <ConteudoPainel />
        </SheetContent>
      </Sheet>
    );
  return (
    <SystemWindow title="Edição para todos">
      <div className="p-4">
        <ConteudoPainel />
      </div>
    </SystemWindow>
  );
}
