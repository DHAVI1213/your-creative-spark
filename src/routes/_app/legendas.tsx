import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Hash, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { SystemHeader, SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TOOLS } from "@/lib/app";
import {
  NICHOS,
  gerarHashtags,
  gerarLegendas,
  limparTag,
  type EntradaLegenda,
  type Tom,
} from "@/lib/legendas";
import { registrarUso } from "@/lib/uso";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/legendas")({
  head: () => ({ meta: [{ title: "Legendas e Hashtags · Fábrica de Conteúdo" }] }),
  component: Legendas,
});

const TONS: { id: Tom; nome: string }[] = [
  { id: "vendedor", nome: "Vendedor" },
  { id: "leve", nome: "Leve / divertido" },
  { id: "profissional", nome: "Profissional" },
  { id: "emocional", nome: "Emocional" },
];

const sel =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

async function copiar(texto: string, msg = "Copiado!") {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(msg);
  } catch {
    toast.error("Não consegui copiar. Selecione o texto e copie manualmente.");
  }
}

function Legendas() {
  const tool = TOOLS.find((t) => t.id === "legendas")!;
  const [nichoId, setNichoId] = useState(NICHOS[0]!.id);
  const [tom, setTom] = useState<Tom>("vendedor");
  const [negocio, setNegocio] = useState("");
  const [oferta, setOferta] = useState("");
  const [cta, setCta] = useState("Chama no direct ou toque no link da bio!");
  const [cidade, setCidade] = useState("");
  const [extras, setExtras] = useState("");
  const [qtdTags, setQtdTags] = useState(15);
  const [emojis, setEmojis] = useState(true);
  const [resultado, setResultado] = useState<string[]>([]);
  const [copiado, setCopiado] = useState<number | null>(null);

  const entrada: EntradaLegenda = useMemo(
    () => ({
      nicho: NICHOS.find((n) => n.id === nichoId)!,
      tom,
      negocio,
      oferta,
      cta,
      cidade,
      extras: extras.split(/[\s,#]+/).filter(Boolean),
      qtdTags,
      emojis,
    }),
    [nichoId, tom, negocio, oferta, cta, cidade, extras, qtdTags, emojis],
  );

  const gerar = () => {
    const r = gerarLegendas(entrada, 3);
    setResultado(r);
    setCopiado(null);
    registrarUso("legenda", r.length, entrada.nicho.nome);
  };

  return (
    <div className="space-y-6">
      <SystemHeader
        label={`${tool.code} · ${tool.name}`}
        icon={tool.icon}
        title={tool.name}
        description="Escolha o nicho e o tom, preencha o que quiser e gere 3 legendas prontas para postar ou colar no Agendador."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <SystemWindow title="Configuração">
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="nicho">Nicho</Label>
              <select
                id="nicho"
                className={sel}
                value={nichoId}
                onChange={(e) => setNichoId(e.target.value)}
              >
                {NICHOS.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Tom</Label>
              <div className="grid grid-cols-2 gap-2">
                {TONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTom(t.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      tom === t.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {t.nome}
                  </button>
                ))}
              </div>
            </div>

            <Campo
              id="negocio"
              label="Nome do negócio"
              valor={negocio}
              set={setNegocio}
              ex="Ex.: UP Barbearia"
            />
            <Campo
              id="oferta"
              label="Oferta (opcional)"
              valor={oferta}
              set={setOferta}
              ex="Ex.: Corte + barba por R$ 45 até sexta"
            />
            <Campo
              id="cta"
              label="Chamada para ação"
              valor={cta}
              set={setCta}
              ex="Ex.: Agende pelo WhatsApp"
            />
            <Campo
              id="cidade"
              label="Cidade (opcional)"
              valor={cidade}
              set={setCidade}
              ex="Ex.: Goiânia"
            />
            <Campo
              id="extras"
              label="Hashtags extras (opcional)"
              valor={extras}
              set={setExtras}
              ex="Ex.: promocao, novidade"
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Quantidade de hashtags</Label>
                <span className="font-mono text-xs text-primary">{qtdTags}</span>
              </div>
              <Slider
                min={3}
                max={30}
                step={1}
                value={[qtdTags]}
                onValueChange={(v) => setQtdTags(v[0] ?? 15)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="emojis">Usar emojis</Label>
              <Switch id="emojis" checked={emojis} onCheckedChange={setEmojis} />
            </div>

            <Button className="w-full" onClick={gerar}>
              <Sparkles className="size-4" /> Gerar legendas
            </Button>
          </div>
        </SystemWindow>

        <div className="space-y-4">
          {resultado.length === 0 ? (
            <SystemWindow muted>
              <div className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
                <Hash className="size-8 text-primary/60" />
                Configure ao lado e toque em <b className="text-foreground">Gerar legendas</b>.
              </div>
            </SystemWindow>
          ) : (
            <>
              {resultado.map((r, i) => (
                <SystemWindow key={i} title={`Legenda ${i + 1}`}>
                  <div className="space-y-3 p-4">
                    <Textarea
                      value={r}
                      rows={12}
                      onChange={(e) =>
                        setResultado((old) => old.map((x, j) => (j === i ? e.target.value : x)))
                      }
                      className="text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          void copiar(r, "Legenda copiada!");
                          setCopiado(i);
                        }}
                      >
                        {copiado === i ? <Check className="size-4" /> : <Copy className="size-4" />}
                        Copiar legenda
                      </Button>
                    </div>
                  </div>
                </SystemWindow>
              ))}
              <Button variant="outline" onClick={gerar}>
                <RefreshCw className="size-4" /> Gerar outras
              </Button>
            </>
          )}

          <SystemWindow title="Só as hashtags">
            <HashtagsSoltas entrada={entrada} />
          </SystemWindow>
        </div>
      </div>
    </div>
  );
}

function HashtagsSoltas({ entrada }: { entrada: EntradaLegenda }) {
  const [tags, setTags] = useState<string[]>([]);
  // Gera no navegador (evita diferença com o servidor) e refaz quando a configuração muda.
  useEffect(() => {
    setTags(gerarHashtags(entrada));
  }, [entrada]);
  const [nova, setNova] = useState("");
  const texto = tags.join(" ");

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            title="Remover"
            onClick={() => setTags((old) => old.filter((x) => x !== t))}
            className="rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary hover:line-through"
          >
            {t}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = limparTag(nova);
          if (t && !tags.includes(t)) setTags((old) => [...old, t]);
          setNova("");
        }}
      >
        <Input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          placeholder="Adicionar hashtag"
        />
        <Button type="submit" variant="outline">
          Adicionar
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void copiar(texto, "Hashtags copiadas!")}>
          <Copy className="size-4" /> Copiar hashtags
        </Button>
        <Button size="sm" variant="outline" onClick={() => setTags(gerarHashtags(entrada))}>
          <RefreshCw className="size-4" /> Gerar de novo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        As hashtags saem sem acento, sem espaço e sem símbolos, separadas por espaço. É assim que o
        Instagram as transforma em links clicáveis. Toque numa hashtag para tirá-la da lista.
      </p>
    </div>
  );
}

function Campo({
  id,
  label,
  valor,
  set,
  ex,
}: {
  id: string;
  label: string;
  valor: string;
  set: (v: string) => void;
  ex: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={valor} onChange={(e) => set(e.target.value)} placeholder={ex} />
    </div>
  );
}
