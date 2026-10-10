import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planos")({
  head: () => ({ meta: [{ title: "Planos · Fábrica de Conteúdo" }] }),
  component: Planos,
});

// Preços: troque aqui quando definir os valores finais.
const PLANS = [
  {
    id: "mensal",
    name: "Mensal",
    price: "R$ 47",
    period: "/mês",
    icon: Zap,
    highlight: false,
    features: [
      "Todas as ferramentas",
      "Atualizações e ferramentas novas",
      "Agendador com publicação na nuvem",
      "Cancele quando quiser",
    ],
  },
  {
    id: "vitalicio",
    name: "Vitalício",
    price: "R$ 497",
    period: "pagamento único",
    icon: Crown,
    highlight: true,
    features: [
      "Tudo do plano mensal, para sempre",
      "Sem mensalidade",
      "Acesso antecipado às novidades",
      "Suporte prioritário",
    ],
  },
];

function Planos() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center md:text-left">
        <p className="text-sm text-primary">Planos</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Escolha como quer usar
        </h1>
        <p className="text-muted-foreground">
          O mesmo acesso no PC e no celular, com uma conta só.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((p) => (
          <div
            key={p.id}
            className={cn(
              "relative flex flex-col gap-5 rounded-2xl border border-border bg-card/60 p-6",
              p.highlight &&
                "border-primary/60 bg-gradient-to-b from-primary/15 to-card/60 shadow-xl shadow-primary/10",
            )}
          >
            {p.highlight && (
              <span className="absolute -top-3 right-5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Mais vantajoso
              </span>
            )}
            <div className="flex items-center gap-2">
              <p.icon className={cn("size-5", p.highlight ? "text-chart-3" : "text-primary")} />
              <h2 className="font-semibold">{p.name}</h2>
            </div>
            <div>
              <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
              <span className="ml-1 text-sm text-muted-foreground">{p.period}</span>
            </div>
            <ul className="space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-auto"
              variant={p.highlight ? "default" : "secondary"}
              onClick={() =>
                toast.info("O pagamento com Pix e cartão entra numa próxima atualização.")
              }
            >
              Assinar {p.name.toLowerCase()}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
