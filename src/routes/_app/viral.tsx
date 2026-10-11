import { createFileRoute } from "@tanstack/react-router";
import { MineradorViral } from "@/components/viral/MineradorViral";
export const Route = createFileRoute("/_app/viral")({
  head: () => ({ meta: [{ title: "Minerador Viral · Fábrica de Conteúdo" }] }),
  component: MineradorViral,
});
