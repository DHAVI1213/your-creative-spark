import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { criarTexto, FONTES_EDITOR, lerImagem, MODELOS_TEXTO } from "@/lib/editor/camadas";
import { useEditor } from "@/lib/editor/store";
import type { Camada, TextoCamada } from "@/lib/editor/tipos";
import { ControleCorte, ControleDeslizante } from "./ControlesEdicao";

export function PainelCamadas() {
  const {
    videos,
    modeloId,
    edicao,
    mudarEdicao,
    confirmarEdicao,
    camadaSelecionadaId,
    selecionarCamada,
    atualizarCamada,
    adicionarCamada,
    tempoModelo,
  } = useEditor();
  const modelo = videos.find((video) => video.id === modeloId);
  const camada = edicao.camadas.find((item) => item.id === camadaSelecionadaId);
  const inputImagem = useRef<HTMLInputElement>(null);
  const ativo = useRef(true);
  const [lendo, setLendo] = useState(false);
  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);
  if (!modelo) return null;
  const atualizar = (parcial: Partial<Camada>, transitoria = false) => {
    if (camada) atualizarCamada({ ...camada, ...parcial } as Camada, transitoria);
  };
  const texto = (parcial: Partial<TextoCamada>, transitoria = false) => {
    if (camada?.tipo === "texto")
      atualizarCamada({ ...camada, texto: { ...camada.texto, ...parcial } }, transitoria);
  };
  const subir = (id: string, delta: number) => {
    const camadas = [...edicao.camadas];
    const index = camadas.findIndex((item) => item.id === id);
    const origem = camadas[index],
      destino = camadas[index + delta];
    if (!origem || !destino) return;
    camadas[index] = destino;
    camadas[index + delta] = origem;
    mudarEdicao({ camadas });
  };
  const cor = (titulo: string, valor: string, mudar: (cor: string) => void) => (
    <label className="flex items-center justify-between gap-2 text-sm">
      {titulo}
      <Input
        type="color"
        aria-label={titulo}
        className="h-9 w-16 p-1"
        value={valor}
        onChange={(event) => mudar(event.target.value)}
      />
    </label>
  );
  const caixa = (titulo: string, marcada: boolean, mudar: (valor: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(event) => mudar(event.target.checked)}
        className="size-4 accent-primary"
      />
      {titulo}
    </label>
  );
  const slider = (
    titulo: string,
    valor: number,
    min: number,
    max: number,
    mudar: (n: number) => void,
    step = 0.01,
  ) => (
    <ControleDeslizante
      titulo={titulo}
      valor={valor}
      min={min}
      max={max}
      step={step}
      mudar={mudar}
      confirmar={confirmarEdicao}
    />
  );
  const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => adicionarCamada(criarTexto())}>+ Texto</Button>
        <Button variant="outline" disabled={lendo} onClick={() => inputImagem.current?.click()}>
          + Logo / imagem
        </Button>
      </div>
      <input
        ref={inputImagem}
        aria-label="Enviar logo ou imagem"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setLendo(true);
          try {
            const nova = await lerImagem(file);
            if (ativo.current) adicionarCamada(nova);
          } catch (erro) {
            if (ativo.current)
              toast.error(
                erro instanceof Error ? erro.message : "Não foi possível abrir a imagem.",
              );
          } finally {
            if (ativo.current) setLendo(false);
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        PNG transparente recomendado · até 10 MB. Arraste a camada na prévia; use as alças para
        tamanho e rotação.
      </p>
      {lendo && (
        <p role="status" className="text-sm text-primary">
          Lendo imagem…
        </p>
      )}
      <div className="space-y-2">
        <p className="sys-label">Modelos de texto</p>
        <div className="flex flex-wrap gap-2">
          {MODELOS_TEXTO.map((nome) => (
            <Button
              key={nome}
              variant="outline"
              size="sm"
              onClick={() => adicionarCamada(criarTexto(nome))}
            >
              {nome}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="sys-label">Camadas · de cima para baixo</p>
        {!edicao.camadas.length && (
          <p className="text-sm text-muted-foreground">
            Adicione um texto ou uma imagem para começar.
          </p>
        )}
        {[...edicao.camadas].reverse().map((item, ordem) => (
          <div
            key={item.id}
            className={`rounded border p-2 ${camadaSelecionadaId === item.id ? "border-primary bg-primary/10" : "border-border"}`}
          >
            <button
              type="button"
              className="w-full truncate text-left text-sm"
              aria-pressed={camadaSelecionadaId === item.id}
              onClick={() => {
                selecionarCamada(item.id);
                if (
                  tempoModelo.current &&
                  (tempoModelo.current.currentTime < item.inicio ||
                    (item.fim !== null && tempoModelo.current.currentTime >= item.fim))
                )
                  tempoModelo.current.currentTime = item.inicio;
              }}
            >
              {item.tipo === "texto" ? item.texto.conteudo || "Texto vazio" : "Logo / imagem"}
              {item.oculta ? " (escondida)" : ""}
            </button>
            <div className="mt-2 flex flex-wrap gap-1">
              {[
                {
                  nome: "Subir camada",
                  icon: ArrowUp,
                  disabled: ordem === 0,
                  acao: () => subir(item.id, 1),
                },
                {
                  nome: "Descer camada",
                  icon: ArrowDown,
                  disabled: ordem === edicao.camadas.length - 1,
                  acao: () => subir(item.id, -1),
                },
                {
                  nome: item.oculta ? "Mostrar camada" : "Esconder camada",
                  icon: item.oculta ? EyeOff : Eye,
                  disabled: false,
                  acao: () => atualizarCamada({ ...item, oculta: !item.oculta }),
                },
                {
                  nome: "Duplicar camada",
                  icon: Copy,
                  disabled: false,
                  acao: () =>
                    adicionarCamada({
                      ...item,
                      id: crypto.randomUUID(),
                      x: Math.min(1, item.x + 0.03),
                      y: Math.min(1, item.y + 0.03),
                    }),
                },
                {
                  nome: "Apagar camada",
                  icon: Trash2,
                  disabled: false,
                  acao: () => {
                    mudarEdicao({ camadas: edicao.camadas.filter((c) => c.id !== item.id) });
                    if (camadaSelecionadaId === item.id) selecionarCamada(null);
                  },
                },
              ].map(({ nome, icon: Icon, disabled, acao }) => (
                <Button
                  key={nome}
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  title={nome}
                  aria-label={nome}
                  disabled={disabled}
                  onClick={acao}
                >
                  <Icon className="size-4" />
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {camada && (
        <div className="space-y-4 border-t border-border pt-4">
          {camada.tipo === "texto" && (
            <>
              <label className="block space-y-1 text-sm">
                Texto
                <Textarea
                  aria-label="Conteúdo da camada"
                  value={camada.texto.conteudo}
                  onChange={(event) => texto({ conteudo: event.target.value }, true)}
                  onBlur={confirmarEdicao}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Use {"{nome}"} para o arquivo sem extensão e {"{numero}"} para a ordem na mesa.
                Duplo clique na prévia também edita.
              </p>
              <label className="block space-y-1 text-sm">
                Fonte
                <select
                  aria-label="Fonte da camada"
                  value={camada.texto.fonte}
                  className={selectClass}
                  onChange={(event) => texto({ fonte: event.target.value })}
                >
                  {FONTES_EDITOR.map((fonte) => (
                    <option key={fonte.nome} value={fonte.nome}>
                      {fonte.nome}
                    </option>
                  ))}
                </select>
              </label>
              {slider(
                "Tamanho do texto",
                camada.texto.tamanho,
                0.01,
                0.25,
                (tamanho) => texto({ tamanho }, true),
                0.005,
              )}
              {cor("Cor do texto", camada.texto.cor, (cor) => texto({ cor }))}
              {cor("Cor do contorno", camada.texto.contorno.cor, (cor) =>
                texto({ contorno: { ...camada.texto.contorno, cor } }),
              )}
              {slider(
                "Espessura do contorno",
                camada.texto.contorno.espessura,
                0,
                0.012,
                (espessura) => texto({ contorno: { ...camada.texto.contorno, espessura } }, true),
                0.0005,
              )}
              <div className="flex flex-wrap gap-3">
                {caixa("Sombra", camada.texto.sombra, (sombra) => texto({ sombra }))}
                {caixa("Negrito", camada.texto.negrito, (negrito) => texto({ negrito }))}
                {caixa("Maiúsculas", camada.texto.maiusculas, (maiusculas) =>
                  texto({ maiusculas }),
                )}
              </div>
              <label className="block space-y-1 text-sm">
                Alinhamento
                <select
                  aria-label="Alinhamento do texto"
                  value={camada.texto.alinhamento}
                  className={selectClass}
                  onChange={(event) =>
                    texto({ alinhamento: event.target.value as TextoCamada["alinhamento"] })
                  }
                >
                  <option value="left">Esquerda</option>
                  <option value="center">Centro</option>
                  <option value="right">Direita</option>
                </select>
              </label>
              {caixa("Fundo do texto", camada.texto.fundo !== null, (mostrar) =>
                texto({
                  fundo: mostrar ? { cor: "#000000", opacidade: 0.8, arredondado: 0.01 } : null,
                }),
              )}
              {camada.texto.fundo && (
                <>
                  {cor("Cor do fundo", camada.texto.fundo.cor, (cor) =>
                    texto({ fundo: { ...camada.texto.fundo!, cor } }),
                  )}
                  {slider("Opacidade do fundo", camada.texto.fundo.opacidade, 0, 1, (opacidade) =>
                    texto({ fundo: { ...camada.texto.fundo!, opacidade } }, true),
                  )}
                  {slider(
                    "Cantos arredondados",
                    camada.texto.fundo.arredondado,
                    0,
                    0.05,
                    (arredondado) =>
                      texto({ fundo: { ...camada.texto.fundo!, arredondado } }, true),
                    0.001,
                  )}
                </>
              )}
            </>
          )}
          {slider("Largura da camada", camada.largura, 0.03, 1, (largura) =>
            atualizar({ largura }, true),
          )}
          {slider("Posição horizontal da camada", camada.x, 0, 1, (x) => atualizar({ x }, true))}
          {slider("Posição vertical da camada", camada.y, 0, 1, (y) => atualizar({ y }, true))}
          {slider(
            "Rotação da camada",
            camada.rotacao,
            -180,
            180,
            (rotacao) => atualizar({ rotacao }, true),
            1,
          )}
          {slider("Opacidade da camada", camada.opacidade, 0, 1, (opacidade) =>
            atualizar({ opacidade }, true),
          )}
          <label className="block space-y-1 text-sm">
            Animação
            <select
              aria-label="Animação da camada"
              value={camada.animacao}
              className={selectClass}
              onChange={(event) =>
                atualizar({ animacao: event.target.value as Camada["animacao"] })
              }
            >
              {["nenhuma", "surgir", "subir", "pulsar", "digitar", "tremer"].map((nome) => (
                <option key={nome} value={nome}>
                  {nome === "nenhuma" ? "Nenhuma" : nome.charAt(0).toUpperCase() + nome.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <p className="sys-label">Quando aparece · tempo do vídeo original</p>
          <ControleCorte
            corte={{ inicio: camada.inicio, fim: camada.fim }}
            duracao={modelo.duracao}
            mudar={(corte, transitoria) =>
              atualizar({ inicio: corte.inicio, fim: corte.fim }, transitoria)
            }
            confirmar={confirmarEdicao}
            tempoAtual={() => tempoModelo.current?.currentTime ?? 0}
          />
        </div>
      )}
    </div>
  );
}
