import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/ComingSoon";
import { TOOLS } from "@/lib/app";
import { useDevice } from "@/lib/device";

export const Route = createFileRoute("/minerador")({
  head: () => ({ meta: [{ title: "Minerador de Clientes · Fábrica de Conteúdo" }] }),
  component: MineradorPage,
});

function MineradorPage() {
  const device = useDevice();
  return (
    <ComingSoon
      tool={TOOLS.find((t) => t.id === "minerador")!}
      bullets={[
        "Busque lojas, lanchonetes e serviços da sua cidade",
        "Veja quem não tem site ou tem site fraco",
        "Organize seus leads e chame no WhatsApp com um toque",
        "Extensão do Chrome envia as buscas direto para o app",
      ]}
      deviceNote={
        device.isMobile
          ? "A busca usa a extensão do Chrome no PC. No celular você vê e chama os leads que já minerou."
          : "No PC você vai instalar a extensão do Chrome uma vez, e as buscas caem direto aqui."
      }
    />
  );
}
