import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cpu, MonitorSmartphone } from "lucide-react";

import { InstallButton } from "@/components/InstallButton";
import { APP_NAME, APP_TAGLINE, TOOLS } from "@/lib/app";
import { TIER_LABEL, useDevice } from "@/lib/device";
import { cn } from "@/lib/utils";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const device = useDevice();

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-primary">Painel</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{APP_NAME}</h1>
        <p className="max-w-xl text-muted-foreground">{APP_TAGLINE}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => {
          const active = t.status === "ativo";
          return (
            <Link
              key={t.id}
              to={t.to}
              className={cn(
                "group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card/60 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50",
                active && "border-primary/40 bg-gradient-to-br from-primary/15 to-card/60",
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl",
                    active
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <t.icon className="size-5" />
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                    active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                  )}
                >
                  {active ? "Disponível" : "Em breve"}
                </span>
              </div>
              <div>
                <h2 className="font-semibold">{t.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              </div>
              <span className="mt-auto flex items-center gap-1 text-sm text-primary">
                {active ? "Abrir" : "Ver detalhes"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </section>

      {device.ready && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Cpu className="size-4 text-primary" /> {TIER_LABEL[device.tier]}
            </div>
            <p className="text-sm text-muted-foreground">
              O app se ajusta a este {device.isMobile ? "celular" : "computador"}: {device.cores}{" "}
              núcleos
              {device.memoryGB ? `, ${device.memoryGB} GB de memória ou mais` : ""}. As ferramentas
              vão processar {device.concurrency} arquivo{device.concurrency > 1 ? "s" : ""} por vez
              e vídeos de até cerca de{" "}
              {device.maxVideoMB >= 1000
                ? `${(device.maxVideoMB / 1000).toFixed(1)} GB`
                : `${device.maxVideoMB} MB`}{" "}
              com folga.
            </p>
          </div>
          {!device.installed && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MonitorSmartphone className="size-4 text-primary" /> Use como app
              </div>
              <p className="text-sm text-muted-foreground">
                Instale no {device.isMobile ? "celular" : "PC"} para abrir com um toque, em tela
                cheia, sem precisar de loja.
              </p>
              <div className="mt-auto md:max-w-56">
                <InstallButton />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
