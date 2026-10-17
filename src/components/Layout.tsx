import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Sparkles, BookOpen, Crown } from "lucide-react";
import { useAuth } from "../lib/auth";
import { FERRAMENTAS } from "../lib/tools";
import { cn } from "../lib/utils";
import { AnimatedLogo } from "./AnimatedLogo";
import { Reveal } from "./Reveal";

export function SiteHeader() {
  const { usuario, sair } = useAuth();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <AnimatedLogo />
          <span className="font-display font-bold tracking-tight text-tprimary">
            NK <span className="text-lime">Software</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-tsecondary md:flex">
          <a href="/#como-funciona" className="hover:text-tprimary transition-colors">
            Como funciona
          </a>
          <a href="/#ferramentas" className="hover:text-tprimary transition-colors">
            Ferramentas
          </a>
          <a href="/#precos" className="hover:text-tprimary transition-colors">
            Preços
          </a>
          <a href="/#faq" className="hover:text-tprimary transition-colors">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-3">
          {usuario ? (
            <>
              <Link
                to="/app"
                className="rounded-xl bg-lime px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
              >
                Abrir painel
              </Link>
              <button
                onClick={() => {
                  sair();
                  nav("/");
                }}
                className="text-tmuted hover:text-tprimary"
                title="Sair"
              >
                <LogOut className="size-5" />
              </button>
            </>
          ) : (
            <>
              <Link to="/entrar" className="text-sm text-tsecondary hover:text-tprimary">
                Entrar
              </Link>
              <Link
                to="/entrar"
                className="rounded-xl bg-lime px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
              >
                Começar grátis
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border">
      {/* linha gradiente animada */}
      <div className="footer-line absolute inset-x-0 top-0 h-px" aria-hidden="true" />
      <Reveal variant="up" className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row">
          <div className="flex items-center gap-3">
            <AnimatedLogo size="sm" />
            <span className="font-display font-bold text-tprimary">
              NK <span className="text-lime">Software</span>
            </span>
          </div>
          <p className="text-sm text-tmuted">
            Ferramentas profissionais para criadores de conteúdo. Feito no Brasil.
          </p>
          <p className="text-xs text-tmuted">© 2026 NK Software. Todos os direitos reservados.</p>
        </div>
      </Reveal>
    </footer>
  );
}

export function AppShell() {
  const { usuario, sair } = useAuth();
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface1 p-4 md:flex">
        <Link to="/app" className="flex items-center gap-3 px-2 py-4">
          <AnimatedLogo />
          <span className="font-display font-bold text-tprimary">
            NK <span className="text-lime">Software</span>
          </span>
        </Link>
        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto">
          <NavLink
            to="/app"
            end
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-lime/15 text-lime" : "text-tsecondary hover:bg-surface2 hover:text-tprimary",
              )
            }
          >
            <LayoutDashboard className="size-5" /> Painel
          </NavLink>
          {FERRAMENTAS.map((f) => (
            <NavLink
              key={f.id}
              to={`/app/${f.id}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-lime/15 text-lime" : "text-tsecondary hover:bg-surface2 hover:text-tprimary",
                )
              }
            >
              <f.icone className="size-5 shrink-0" />
              <span className="truncate">{f.nome}</span>
            </NavLink>
          ))}
          <NavLink
            to="/app/gold"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-lime/15 text-lime" : "text-lime/80 hover:bg-surface2 hover:text-lime",
              )
            }
          >
            <Crown className="size-5 shrink-0" />
            <span className="truncate">Plano Gold</span>
          </NavLink>
          <NavLink
            to="/app/tutoriais"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-lime/15 text-lime" : "text-tsecondary hover:bg-surface2 hover:text-tprimary",
              )
            }
          >
            <BookOpen className="size-5 shrink-0" />
            <span className="truncate">Tutoriais</span>
          </NavLink>
        </nav>
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 px-2 text-sm">
            <Sparkles className="size-4 text-lime" />
            <span className="truncate text-tsecondary">{usuario?.nome ?? "Visitante"}</span>
          </div>
          <button
            onClick={() => {
              sair();
              nav("/");
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-tmuted hover:text-tprimary"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="border-b border-border bg-surface1 px-6 py-3 md:hidden">
          <Link to="/app" className="flex items-center gap-2">
            <img src="/logo.webp" alt="NK" className="h-7 w-7 rounded-lg object-cover" />
            <span className="font-bold text-tprimary text-sm">NK Software</span>
          </Link>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
