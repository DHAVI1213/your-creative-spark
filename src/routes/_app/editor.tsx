import { createFileRoute } from "@tanstack/react-router";
import { EditorOriginal } from "@/components/editor/EditorOriginal";
export const Route = createFileRoute("/_app/editor")({
  head: () => ({ meta: [{ title: "Editor em Massa · Fábrica de Conteúdo" }] }),
  component: EditorOriginal,
});
