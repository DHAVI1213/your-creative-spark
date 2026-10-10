import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/ComingSoon";
import { TOOLS } from "@/lib/app";

export const Route = createFileRoute("/agendador")({
  head: () => ({ meta: [{ title: "Agendador · Spark Suite" }] }),
  component: AgendadorPage,
});

function AgendadorPage() {
  return (
    <ComingSoon
      tool={TOOLS.find((t) => t.id === "agendador")!}
      bullets={[
        "Conecte suas contas profissionais do Instagram",
        "Agende Reels, Stories e posts em massa, escolhendo a conta de cada um",
        "Publica pela nuvem, com o PC ou o celular desligado",
        "Depois: TikTok e YouTube Shorts",
      ]}
      deviceNote="O agendador funciona igual no PC e no celular — as publicações saem do servidor, não do seu aparelho."
    />
  );
}
