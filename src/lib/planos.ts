import type { Usuario } from "./auth";

/** Ordem dos planos: cada plano inclui tudo dos anteriores. */
export const ORDEM_PLANOS = ["gratis", "basico", "pro", "elite", "gold"] as const;
export type Nivel = (typeof ORDEM_PLANOS)[number];
export type PlanoMinimo = Exclude<Nivel, "gratis">;

export const NOME_PLANO: Record<Nivel, string> = {
  gratis: "Grátis",
  basico: "Básico",
  pro: "Pro",
  elite: "Elite",
  gold: "Gold",
};

/** O plano do usuário libera algo que exige `minimo`? */
export function temAcesso(quem: Usuario["plano"] | Usuario | null | undefined, minimo: PlanoMinimo) {
  if (quem && typeof quem === "object" && quem.admin) return true; // o dono usa tudo de graça
  const plano: Nivel = typeof quem === "string" ? quem : (quem?.plano ?? "gratis");
  return ORDEM_PLANOS.indexOf(plano) >= ORDEM_PLANOS.indexOf(minimo);
}
