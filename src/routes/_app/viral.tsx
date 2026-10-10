import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/ComingSoon";
import { TOOLS } from "@/lib/app";

export const Route = createFileRoute("/_app/viral")({
  head: () => ({ meta: [{ title: "Minerador Viral · Fábrica de Conteúdo" }] }),
  component: ViralPage,
});

function ViralPage() {
  return (
    <ComingSoon
      tool={TOOLS.find((t) => t.id === "viral")!}
      bullets={[
        "Cole um perfil ou nicho e veja os vídeos que mais estouraram",
        "Score viral: visualizações comparadas com o tamanho do perfil",
        "Ordene, filtre e salve as melhores referências",
        "Mande seus próprios vídeos longos direto para os cortes do Editor",
      ]}
      deviceNote="Funciona igual no PC e no celular — a busca roda no servidor."
    />
  );
}
