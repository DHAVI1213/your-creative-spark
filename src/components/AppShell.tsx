import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Cpu, LayoutGrid, Sparkles } from "lucide-react";

import { APP_NAME, TOOLS } from "@/lib/app";
import { TIER_LABEL, useDevice } from "@/lib/device";
import { cn } from "@/lib/utils";
import { InstallButton } from "./InstallButton";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <Sparkles className="size-5" />
      </span>
      <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}

const navBase =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground";
const navActive = "bg-sidebar-accent text-sidebar-foreground font-medium";

function DeviceBadge() {
  const d = useDevice();
  if (!d.ready) return null;
  return (
    <div className="rounded-lg border border-sidebar-border bg-background/40 p-3 text-xs text-muted-foreground">
      <div className="mb-1 flex items-center gap-1.5 font-medium text-sidebar-foreground">
        <Cpu className="size-3.5 text-primary" />
        {TIER_LABEL[d.tier]}
      </div>
      {d.cores} núcleos{d.memoryGB ? ` · ${d.memoryGB} GB+` : ""} · {d.concurrency} arquivo
      {d.concurrency > 1 ? "s" : ""} por vez
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:flex">
      {/* PC: menu lateral */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar/80 p-4 backdrop-blur md:flex">
        <div className="px-1 pt-1">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1">
          <Link
            to="/"
            className={navBase}
            activeProps={{ className: navActive }}
            activeOptions={{ exact: true }}
          >
            <LayoutGrid className="size-4" /> Painel
          </Link>
          {TOOLS.map((t) => (
            <Link key={t.id} to={t.to} className={navBase} activeProps={{ className: navActive }}>
              <t.icon className="size-4" />
              <span className="flex-1">{t.name}</span>
              {t.status === "em-breve" && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  em breve
                </span>
              )}
            </Link>
          ))}
          <Link to="/planos" className={cn(navBase, "mt-2")} activeProps={{ className: navActive }}>
            <Crown className="size-4 text-chart-3" /> Planos
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <DeviceBadge />
          <InstallButton />
        </div>
      </aside>

      {/* Celular: barra de cima */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <Link to="/planos" className="rounded-md p-2 text-chart-3" aria-label="Planos">
            <Crown className="size-5" />
          </Link>
          <InstallButton compact />
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      {/* Celular: barra de baixo */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          <MobileTab to="/" label="Painel" icon={LayoutGrid} exact />
          {TOOLS.map((t) => (
            <MobileTab key={t.id} to={t.to} label={t.short} icon={t.icon} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function MobileTab({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: "/" | (typeof TOOLS)[number]["to"];
  label: string;
  icon: (typeof TOOLS)[number]["icon"];
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact ?? false }}
      className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground"
      activeProps={{ className: "text-primary" }}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
