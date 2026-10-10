import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Lock, MonitorSmartphone } from "lucide-react";

import { InstallButton } from "@/components/InstallButton";
import { HeroCard } from "@/components/system/HeroCard";
import { RankBadge, SystemWindow } from "@/components/system/System";
import { TOOLS } from "@/lib/app";
import { ARTE } from "@/lib/arte";
import { useDevice } from "@/lib/device";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/painel")({
  head: () => ({ meta: [{ title: "Painel · Fábrica de Conteúdo" }] }),
  component: Painel,
});

function Painel() {
  const device = useDevice();
  const navigate = useNavigate();
  const unlocked = TOOLS.filter((t) => t.status === "ativo").length;

  return (
    <div className="space-y-8">
      <HeroCard
        compact
        theme="azul"
        rank="S"
        kicker="Notificação do sistema"
        title="Bem-vindo, Criador."
        subtitle="Fábrica de Conteúdo"
        art={ARTE.heroi}
        navTitle="Habilidades"
        nav={TOOLS.map((t) => ({
          label: t.short,
          onClick: () => navigate({ to: t.to }),
          active: t.status === "ativo",
        }))}
      >
        <p className="max-w-md">
          Escolha uma habilidade para começar a sua missão de hoje. As liberadas aparecem acesas.
        </p>
        <div className="grid max-w-md grid-cols-3 gap-2 font-mono text-xs">
          <Stat label="Habilidades" value={`${unlocked}/${TOOLS.length}`} />
          <Stat
            label="Modo"
            value={
              device.ready ? { forte: "Forte", medio: "Médio", leve: "Leve" }[device.tier] : "—"
            }
          />
          <Stat label="Lote" value={device.ready ? `${device.concurrency}x` : "—"} />
        </div>
      </HeroCard>

      <section className="space-y-3">
        <p className="sys-label">[ Habilidades ]</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t, i) => {
            const active = t.status === "ativo";
            return (
              <Link
                key={t.id}
                to={t.to}
                style={{ animationDelay: `${i * 60}ms` }}
                className={cn(
                  "sys-panel sys-pop group flex flex-col gap-3 rounded-md p-4 transition-transform hover:-translate-y-0.5",
                  !active && "sys-panel-muted",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-sm border",
                      active
                        ? "border-primary/60 bg-primary/10 text-primary sys-btn-glow"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <t.icon className="size-5" />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{t.code}</span>
                    <RankBadge rank={t.rank} />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wide">{t.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                </div>
                <span
                  className={cn(
                    "mt-auto flex items-center gap-1 font-mono text-xs uppercase tracking-wider",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {active ? (
                    <>
                      Ativar{" "}
                      <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </>
                  ) : (
                    <>
                      <Lock className="size-3.5" /> Bloqueada — em breve
                    </>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {device.ready && !device.installed && (
        <SystemWindow muted>
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
            <MonitorSmartphone className="size-8 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-display text-lg font-bold uppercase">Instale como aplicativo</p>
              <p className="text-sm text-muted-foreground">
                Abra com um toque no {device.isMobile ? "celular" : "PC"}, em tela cheia, sem
                precisar de loja.
              </p>
            </div>
            <div className="md:w-56">
              <InstallButton />
            </div>
          </div>
        </SystemWindow>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-white/15 bg-black/25 px-3 py-2 backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm text-foreground">{value}</div>
    </div>
  );
}
