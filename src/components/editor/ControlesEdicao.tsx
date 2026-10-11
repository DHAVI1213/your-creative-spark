import { useId } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { limitarCorte } from "@/lib/editor/filtros";
import type { Corte } from "@/lib/editor/tipos";

export function ControleDeslizante({
  titulo,
  valor,
  min,
  max,
  step = 0.01,
  mudar,
  confirmar,
}: {
  titulo: string;
  valor: number;
  min: number;
  max: number;
  step?: number;
  mudar: (valor: number) => void;
  confirmar?: (() => void) | undefined;
}) {
  const id = useId();
  return (
    <div className="space-y-3 py-2">
      <div className="flex justify-between text-sm">
        <span id={id}>{titulo}</span>
        <span className="tabular-nums text-muted-foreground">{valor.toFixed(2)}</span>
      </div>
      <Slider
        aria-labelledby={id}
        value={[valor]}
        min={min}
        max={max}
        step={step}
        onValueChange={([n]) => {
          if (n !== undefined) mudar(n);
        }}
        onValueCommit={() => confirmar?.()}
      />
    </div>
  );
}

export function ControleCorte({
  corte,
  duracao,
  mudar,
  confirmar,
  tempoAtual,
}: {
  corte: Corte;
  duracao: number;
  mudar: (corte: Corte, transitoria?: boolean) => void;
  confirmar?: (() => void) | undefined;
  tempoAtual?: (() => number) | undefined;
}) {
  const id = useId();
  const limitado = limitarCorte(corte, duracao);
  const atualizar = (inicio: number, fim: number | null, transitoria = false) => {
    const ajustado = limitarCorte({ inicio, fim }, duracao);
    mudar({ inicio: ajustado.inicio, fim: fim === null ? null : ajustado.fim }, transitoria);
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        O mesmo trecho vale para todos, limitado à duração de cada vídeo.
      </p>
      <SliderPrimitive.Root
        aria-label="Trecho do vídeo"
        className="relative flex w-full touch-none select-none items-center py-3"
        min={0}
        max={duracao}
        step={0.05}
        minStepsBetweenThumbs={1}
        value={[limitado.inicio, limitado.fim]}
        onValueChange={([inicio, fim]) => {
          if (inicio !== undefined && fim !== undefined)
            atualizar(inicio, fim >= duracao ? null : fim, true);
        }}
        onValueCommit={() => confirmar?.()}
      >
        <SliderPrimitive.Track className="relative h-1.5 grow rounded-full bg-primary/20">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        {["Início do corte", "Fim do corte"].map((nome) => (
          <SliderPrimitive.Thumb
            key={nome}
            aria-label={nome}
            className="block size-5 rounded-full border border-primary bg-background shadow focus-visible:ring-2 focus-visible:ring-ring"
          />
        ))}
      </SliderPrimitive.Root>
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${id}-inicio`} className="space-y-1 text-sm">
          Início (s)
          <Input
            id={`${id}-inicio`}
            type="number"
            min={0}
            max={duracao}
            step={0.05}
            value={Number(limitado.inicio.toFixed(2))}
            onChange={(event) => atualizar(Number(event.target.value), corte.fim)}
          />
        </label>
        <label htmlFor={`${id}-fim`} className="space-y-1 text-sm">
          Fim (s)
          <Input
            id={`${id}-fim`}
            type="number"
            min={limitado.inicio}
            max={duracao}
            step={0.05}
            value={corte.fim === null ? "" : Number(limitado.fim.toFixed(2))}
            placeholder={duracao.toFixed(2)}
            onChange={(event) =>
              atualizar(
                limitado.inicio,
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {tempoAtual && (
          <Button variant="outline" onClick={() => atualizar(tempoAtual(), corte.fim)}>
            Usar o tempo atual
          </Button>
        )}
        <Button variant="ghost" onClick={() => mudar({ inicio: 0, fim: null })}>
          Vídeo inteiro
        </Button>
      </div>
    </div>
  );
}
