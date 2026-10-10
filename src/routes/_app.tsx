import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";

// Layout do aplicativo: todas as telas dentro de _app/ usam o menu do sistema.
export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
