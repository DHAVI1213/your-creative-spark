import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/** Configuração pública editada no Painel do dono: links de checkout e preços. */
export type AppConfig = {
  checkout_mensal: string;
  checkout_vitalicio: string;
  preco_mensal: string;
  preco_vitalicio: string;
};

export const CONFIG_PADRAO: AppConfig = {
  checkout_mensal: "",
  checkout_vitalicio: "",
  preco_mensal: "R$ 47",
  preco_vitalicio: "R$ 497",
};

let cache: AppConfig | null = null;
const ouvintes = new Set<(c: AppConfig) => void>();

export async function carregarConfig(force = false): Promise<AppConfig> {
  if (cache && !force) return cache;
  const { data } = await supabase.from("app_config").select("chave, valor");
  const cfg = { ...CONFIG_PADRAO };
  for (const row of data ?? []) {
    if (row.chave in cfg) cfg[row.chave as keyof AppConfig] = row.valor;
  }
  cache = cfg;
  ouvintes.forEach((o) => o(cfg));
  return cfg;
}

export function useAppConfig() {
  const [cfg, setCfg] = useState<AppConfig>(cache ?? CONFIG_PADRAO);
  useEffect(() => {
    ouvintes.add(setCfg);
    void carregarConfig().catch(() => {});
    return () => {
      ouvintes.delete(setCfg);
    };
  }, []);
  return cfg;
}
