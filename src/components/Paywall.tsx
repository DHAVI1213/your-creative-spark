import { Link } from "react-router-dom";
import { Check, Crown, Lock } from "lucide-react";
import { Button, Card } from "./ui";
import { useSiteSettings } from "../lib/site-settings";
import { brl } from "../lib/utils";
import { FERRAMENTAS } from "../lib/tools";
import { NOME_PLANO, temAcesso, type PlanoMinimo } from "../lib/planos";

const PRECO_PADRAO: Record<PlanoMinimo, number> = { basico: 2500, pro: 5000, elite: 10000, gold: 50000 };

/** Tela de bloqueio: mostra o plano mínimo que libera a ferramenta e o que mais vem nele. */
export default function Paywall({ ferramenta, plano }: { ferramenta: string; plano: PlanoMinimo }) {
  const salvo = useSiteSettings().plans.find((p) => p.id === plano);
  const preco = brl((salvo?.price_cents ?? PRECO_PADRAO[plano]) / 100);
  const unico = salvo ? !salvo.recurring : plano === "gold";
  const nome = salvo?.name ?? NOME_PLANO[plano];
  const inclui = FERRAMENTAS.filter((f) => temAcesso(plano, f.plano));

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <Card className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-lime/15">
          <Lock className="size-8 text-lime" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-lime">Disponível a partir do plano {nome}</p>
        <h2 className="mt-2 text-2xl font-bold">{ferramenta}</h2>
        <p className="mt-2 text-tsecondary">
          Para usar, assine o plano <strong className="text-tprimary">{nome}</strong> ou um plano acima.
        </p>
        <div className="mt-6 rounded-xl border border-border bg-surface2 p-4 text-left">
          <p className="text-sm font-semibold">O plano {nome} libera:</p>
          <ul className="mt-3 space-y-1.5">
            {inclui.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-sm text-tsecondary">
                <Check className="size-4 shrink-0 text-lime" /> {f.nome}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Link to={`/checkout?plano=${plano}`}>
            <Button className="w-full">
              <Crown className="size-4" /> Assinar o {nome} — {preco}
              {unico ? "" : "/mês"}
            </Button>
          </Link>
          <Link to="/#precos">
            <Button variant="outline" className="w-full">
              Comparar todos os planos
            </Button>
          </Link>
          <Link to="/app">
            <Button variant="ghost" className="w-full">
              Voltar ao painel
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
