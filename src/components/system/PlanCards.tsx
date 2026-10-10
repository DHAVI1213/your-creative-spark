import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CHECKOUT_URL } from "@/lib/app";
import { cn } from "@/lib/utils";

// Preços: troque aqui quando definir os valores finais.
export const PLANS = [
  {
    id: "mensal" as const,
    rank: "A",
    name: "Caçador Mensal",
    price: "R$ 47",
    period: "/mês",
    highlight: false,
    features: [
      "Todas as habilidades liberadas",
      "Novas ferramentas sem custo extra",
      "Agendador com publicação na nuvem",
      "Cancele quando quiser",
    ],
  },
  {
    id: "vitalicio" as const,
    rank: "S",
    name: "Monarca Vitalício",
    price: "R$ 497",
    period: "pagamento único",
    highlight: true,
    features: [
      "Tudo do plano mensal, para sempre",
      "Sem mensalidade",
      "Acesso antecipado às novidades",
      "Suporte prioritário",
    ],
  },
];

export function PlanCards() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {PLANS.map((p) => (
        <div
          key={p.id}
          className={cn(
            "sys-panel relative flex flex-col gap-5 rounded-md p-6",
            p.highlight ? "sys-scan" : "sys-panel-muted",
          )}
        >
          {p.highlight && (
            <span className="absolute -top-3 right-5 rounded-sm border border-gold/60 bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-gold">
              Mais vantajoso
            </span>
          )}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-sm border font-display text-2xl font-bold",
                p.rank === "S"
                  ? "border-gold/60 text-gold shadow-[0_0_18px_-4px_var(--color-gold)]"
                  : "border-destructive/60 text-destructive",
              )}
            >
              {p.rank}
            </span>
            <div>
              <p className="sys-label text-[10px]">Rank {p.rank}</p>
              <h3 className="text-xl font-bold uppercase tracking-wide">{p.name}</h3>
            </div>
          </div>
          <div>
            <span className="font-display text-5xl font-bold">{p.price}</span>
            <span className="ml-2 text-sm text-muted-foreground">{p.period}</span>
          </div>
          <ul className="space-y-2.5">
            {p.features.map((f) => (
              <li key={f} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            asChild
            size="lg"
            variant={p.highlight ? "default" : "secondary"}
            className={cn("mt-auto uppercase tracking-wider", p.highlight && "sys-btn-glow")}
          >
            <a href={CHECKOUT_URL[p.id]}>Quero o {p.name}</a>
          </Button>
        </div>
      ))}
    </div>
  );
}
