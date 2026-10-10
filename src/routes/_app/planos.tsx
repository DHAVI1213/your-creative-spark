import { createFileRoute } from "@tanstack/react-router";
import { Crown } from "lucide-react";

import { PlanCards } from "@/components/system/PlanCards";
import { SystemHeader } from "@/components/system/System";

export const Route = createFileRoute("/_app/planos")({
  head: () => ({ meta: [{ title: "Planos · Fábrica de Conteúdo" }] }),
  component: Planos,
});

function Planos() {
  return (
    <div className="space-y-8">
      <SystemHeader
        label="Evolução"
        icon={Crown}
        title="Escolha o seu rank"
        description="O mesmo acesso no PC e no celular, com uma conta só."
      />
      <PlanCards />
    </div>
  );
}
