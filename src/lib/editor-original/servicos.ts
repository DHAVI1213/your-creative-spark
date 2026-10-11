import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const entrada = z.object({
  token: z.string().min(1),
  acao: z.enum([
    "configurar",
    "cloud-config",
    "cloud",
    "upload",
    "transcrever",
    "testar-ia",
    "cortes",
    "frases",
  ]),
  payload: z.record(z.unknown()),
});
export const servicoEditor = createServerFn({ method: "POST" })
  .validator((input: unknown) => entrada.parse(input))
  .handler(async ({ data }) => {
    const { executarServico } = await import("./servicos.server");
    return executarServico(data);
  });
