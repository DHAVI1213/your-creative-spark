import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/ComingSoon";
import { TOOLS } from "@/lib/app";

export const Route = createFileRoute("/_app/minerador")({
  head: () => ({ meta: [{ title: "Minerador de Clientes · Fábrica de Conteúdo" }] }),
  component: MineradorPage,
});

function MineradorPage() {
  return (
    <ComingSoon
      tool={TOOLS.find((t) => t.id === "minerador")!}
      bullets={[
        "Busque lojas, lanchonetes e serviços da sua cidade",
        "Veja quem não tem site ou tem site fraco",
        "Organize seus leads e chame no WhatsApp com um toque",
        "Busca pela base oficial do Google, sem precisar de extensão",
      ]}
      deviceNote="A busca roda no servidor, então funciona igual no PC e no celular."
    />
  );
}
