import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/ComingSoon";
import { TOOLS } from "@/lib/app";
import { useDevice } from "@/lib/device";

export const Route = createFileRoute("/_app/editor")({
  head: () => ({ meta: [{ title: "Editor em Massa · Fábrica de Conteúdo" }] }),
  component: EditorPage,
});

function EditorPage() {
  const device = useDevice();
  return (
    <ComingSoon
      tool={TOOLS.find((t) => t.id === "editor")!}
      bullets={[
        "Suba vários vídeos e edite só um: cortes, texto, filtros e música valem para todos",
        "Todos os vídeos da mesa atualizam na hora para você conferir",
        "Legendas animadas e filtros prontos",
        "Exporta tudo de uma vez, direto para o Agendador",
      ]}
      deviceNote={
        device.isMobile
          ? "No celular o editor vai trabalhar em lotes menores. Para lotes grandes, use o app no PC."
          : `Neste PC o editor vai processar ${device.concurrency} vídeo${device.concurrency > 1 ? "s" : ""} por vez, de acordo com a sua máquina.`
      }
    />
  );
}
