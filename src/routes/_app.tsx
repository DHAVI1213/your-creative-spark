import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Paywall } from "@/components/system/Paywall";
import { useAuth } from "@/lib/auth";

// Layout do aplicativo: exige login; as ferramentas exigem plano ativo.
export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

/** Telas do app que qualquer conta logada pode abrir, mesmo sem plano. */
const LIVRES = ["/painel", "/planos", "/conta", "/admin"];

function AppLayout() {
  const { carregando, session, temAcesso } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    // Só redireciona a partir de telas do app (evita salvar "/entrar" como destino).
    if (!carregando && !session && !pathname.startsWith("/entrar")) {
      navigate({ to: "/entrar", search: { para: pathname }, replace: true });
    }
  }, [carregando, session, pathname, navigate]);

  if (carregando || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-primary">
          <Loader2 className="size-4 animate-spin" /> Conectando ao sistema…
        </div>
      </div>
    );
  }

  const livre = LIVRES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return <AppShell>{livre || temAcesso ? <Outlet /> : <Paywall />}</AppShell>;
}
