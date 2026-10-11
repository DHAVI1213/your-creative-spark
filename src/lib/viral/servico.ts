import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const entrada = z.object({
  token: z.string().min(1),
  acao: z.enum(["config", "iniciar", "consultar", "preparar", "arquivo"]),
  perfil: z.string().max(500).optional(),
  busca: z.string().uuid().optional(),
  ids: z.array(z.string().max(100)).max(50).optional(),
  id: z.string().max(100).optional(),
  limite: z.number().int().min(1).max(200).optional(),
});
export const minerar = createServerFn({ method: "POST" })
  .validator((v: unknown) => entrada.parse(v))
  .handler(async ({ data }) => {
    const { executarMinerador } = await import("./servico.server");
    return executarMinerador(data);
  });
