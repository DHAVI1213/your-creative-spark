import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Crown, Cpu, Grid2x2, LayoutGrid, LogOut, ShieldCheck, UserRound, Zap } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APP_NAME, TOOLS } from "@/lib/app";
import { nomeDoPlano, useAuth } from "@/lib/auth";
import { TIER_LABEL, useDevice } from "@/lib/device";
import { cn } from "@/lib/utils";
import { InstallButton } from "./InstallButton";
import { RankBadge } from "./system/System";

export function Logo({ to = "/painel" }: { to?: "/" | "/painel" }) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <span className="sys-btn-glow flex size-9 items-center justify-center rounded-sm border border-primary/60 bg-primary/10 text-primary">
        <Zap className="size-5" />
      </span>
      <span className="font-display text-lg font-bold uppercase leading-none tracking-wider">
        {APP_NAME}
      </span>
    </Link>
  );
}

const navBase =
  "group flex items-center gap-3 rounded-sm border border-transparent px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:border-primary/25 hover:bg-sidebar-accent hover:text-sidebar-foreground";
const navActive =
  "border-primary/40 bg-sidebar-accent text-sidebar-foreground shadow-[0_0_14px_-4px_var(--color-primary)]";

function DeviceStatus() {
  const d = useDevice();
  if (!d.ready) return null;
  return (
    <div className="sys-panel sys-panel-muted rounded-sm p-3 font-mono text-[11px] leading-5 text-muted-foreground">
      <div className="mb-1 flex items-center gap-1.5 text-primary">
        <Cpu className="size-3.5" /> STATUS DO APARELHO
      </div>
      <div className="flex justify-between">
        <span>MODO</span>
        <span className="text-sidebar-foreground">{TIER_LABEL[d.tier]}</span>
      </div>
      <div className="flex justify-between">
        <span>NÚCLEOS</span>
        <span className="text-sidebar-foreground">{d.cores}</span>
      </div>
      <div className="flex justify-between">
        <span>LOTE</span>
        <span className="text-sidebar-foreground">{d.concurrency}x</span>
      </div>
    </div>
  );
}

function UserCard() {
  const { user, perfil, assinatura, temAcesso, isAdmin, sair } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const nome = perfil?.nome || user.email || "";
  return (
    <div className="sys-panel sys-panel-muted flex items-center gap-2 rounded-sm p-2">
      <Link to="/conta" className="flex min-w-0 flex-1 items-center gap-2">
        {perfil?.avatar_url ? (
          <img src={perfil.avatar_url} alt="" className="size-8 rounded-sm object-cover" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-primary/40 bg-primary/10 font-display font-bold text-primary">
            {nome.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-sidebar-foreground">{nome}</span>
          <span
            className={
              temAcesso
                ? "block truncate text-[10px] text-success"
                : "block truncate text-[10px] text-muted-foreground"
            }
          >
            {isAdmin ? "Dono do app" : temAcesso ? nomeDoPlano(assinatura?.plano) : "Sem plano"}
          </span>
        </span>
      </Link>
      <button
        onClick={async () => {
          await sair();
          navigate({ to: "/" });
        }}
        className="rounded-sm p-1.5 text-muted-foreground hover:text-foreground"
        aria-label="Sair"
        title="Sair"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, sair } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-dvh md:flex">
      {/* PC: menu lateral */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-sidebar-border bg-sidebar/85 p-4 backdrop-blur md:flex">
        <div className="px-1 pt-1">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1">
          <Link
            to="/painel"
            className={navBase}
            activeProps={{ className: navActive }}
            activeOptions={{ exact: true }}
          >
            <LayoutGrid className="size-4" /> Painel
          </Link>
          <p className="sys-label mt-3 mb-1 px-3 text-[10px] opacity-70">Habilidades</p>
          {TOOLS.map((t) => (
            <Link key={t.id} to={t.to} className={navBase} activeProps={{ className: navActive }}>
              <t.icon className="size-4" />
              <span className="flex-1 truncate">{t.name}</span>
              {t.status === "em-breve" ? (
                <span className="font-mono text-[9px] text-muted-foreground">BLOQ.</span>
              ) : (
                <span className="size-1.5 rounded-full bg-success shadow-[0_0_6px_var(--color-success)]" />
              )}
            </Link>
          ))}
          <Link to="/planos" className={cn(navBase, "mt-3")} activeProps={{ className: navActive }}>
            <Crown className="size-4 text-gold" /> Planos
          </Link>
          <Link to="/conta" className={navBase} activeProps={{ className: navActive }}>
            <UserRound className="size-4" /> Minha conta
          </Link>
          {isAdmin && (
            <Link to="/admin" className={navBase} activeProps={{ className: navActive }}>
              <ShieldCheck className="size-4 text-success" /> Painel do dono
            </Link>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <UserCard />
          <DeviceStatus />
          <InstallButton />
        </div>
      </aside>

      {/* Celular: barra de cima */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/conta"
            className="rounded-sm p-2 text-muted-foreground"
            aria-label="Minha conta"
          >
            <UserRound className="size-5" />
          </Link>
          <InstallButton compact />
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      {/* Celular: barra de baixo */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-primary/25 bg-background/92 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          <MobileTab to="/painel" label="Painel" icon={LayoutGrid} exact />
          {TOOLS.slice(0, 3).map((t) => (
            <MobileTab key={t.id} to={t.to} label={t.short} icon={t.icon} />
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground"
          >
            <Grid2x2 className="size-5" />
            Mais
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-lg border-primary/30">
          <SheetHeader>
            <SheetTitle className="sys-label text-center">[ Todas as habilidades ]</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4 pb-6">
            {TOOLS.map((t) => (
              <Link
                key={t.id}
                to={t.to}
                onClick={() => setMoreOpen(false)}
                className="sys-panel sys-panel-muted flex items-center gap-2 rounded-sm p-3 text-sm"
              >
                <t.icon className="size-4 text-primary" />
                <span className="flex-1 truncate">{t.short}</span>
                <RankBadge rank={t.rank} className="size-5 text-[11px]" />
              </Link>
            ))}
            <Link
              to="/planos"
              onClick={() => setMoreOpen(false)}
              className="sys-panel sys-panel-muted col-span-2 flex items-center justify-center gap-2 rounded-sm p-3 text-sm text-gold"
            >
              <Crown className="size-4" /> Planos
            </Link>
            <Link
              to="/conta"
              onClick={() => setMoreOpen(false)}
              className="sys-panel sys-panel-muted flex items-center justify-center gap-2 rounded-sm p-3 text-sm"
            >
              <UserRound className="size-4 text-primary" /> Minha conta
            </Link>
            {isAdmin ? (
              <Link
                to="/admin"
                onClick={() => setMoreOpen(false)}
                className="sys-panel sys-panel-muted flex items-center justify-center gap-2 rounded-sm p-3 text-sm"
              >
                <ShieldCheck className="size-4 text-success" /> Painel do dono
              </Link>
            ) : (
              <button
                onClick={async () => {
                  setMoreOpen(false);
                  await sair();
                  navigate({ to: "/" });
                }}
                className="sys-panel sys-panel-muted flex items-center justify-center gap-2 rounded-sm p-3 text-sm"
              >
                <LogOut className="size-4" /> Sair
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MobileTab({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: "/painel" | (typeof TOOLS)[number]["to"];
  label: string;
  icon: (typeof TOOLS)[number]["icon"];
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact ?? false }}
      className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground"
      activeProps={{ className: "text-primary [&_svg]:drop-shadow-[0_0_6px_var(--color-primary)]" }}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
