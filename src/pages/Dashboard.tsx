import { Link } from "react-router-dom";
import { ArrowUpRight, Crown } from "lucide-react";
import { useAuth } from "../lib/auth";
import { FERRAMENTAS } from "../lib/tools";
import { Badge } from "../components/ui";

export default function Dashboard() {
  const { usuario } = useAuth();
  const isPro = usuario?.plano !== "gratis";

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Olá, {usuario?.nome?.split(" ")[0] ?? "criador"} 👋
          </h1>
          <p className="mt-1 text-tsecondary">Escolha uma ferramenta para começar a produzir.</p>
        </div>
        {!isPro && (
          <Link
            to="/checkout"
            className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-semibold text-black hover:brightness-110"
          >
            <Crown className="size-4" /> Assinar o Pro
          </Link>
        )}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FERRAMENTAS.map((f) => {
          const bloqueada = f.plano === "pro" && !isPro;
          return (
            <Link
              key={f.id}
              to={bloqueada ? "/checkout" : `/app/${f.id}`}
              className="group overflow-hidden rounded-2xl border border-border bg-surface1 transition-all hover:border-lime/50 hover:shadow-[0_0_24px_rgba(200,245,60,0.08)]"
            >
              <div className="relative aspect-video overflow-hidden bg-surface2">
                <img
                  src={f.imagem}
                  alt={f.nome}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute left-3 top-3 flex gap-2">
                  {f.plano === "pro" ? (
                    <Badge tone={isPro ? "lime" : "warn"}>{isPro ? "PRO" : "PRO 🔒"}</Badge>
                  ) : (
                    <Badge tone="lime">GRÁTIS</Badge>
                  )}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <f.icone className="size-5 text-lime" />
                    <h3 className="font-semibold">{f.nome}</h3>
                  </div>
                  <ArrowUpRight className="size-4 text-tmuted transition-all group-hover:translate-x-0.5 group-hover:text-lime" />
                </div>
                <p className="mt-2 text-sm text-tsecondary">{f.descricao}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
