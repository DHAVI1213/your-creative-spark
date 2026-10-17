import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from '../integrations/supabase/client';

export type PlanoPago = "basico" | "pro" | "elite" | "gold";
export type Usuario = { nome: string; email: string; plano: "gratis" | "basico" | "pro" | "elite" | "gold" };

const CHAVE = "nk_usuario";

function ler(): Usuario | null {
  try {
    const raw = localStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as Usuario) : null;
  } catch {
    return null;
  }
}

const AuthCtx = createContext<{
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (nome: string, email: string) => void;
  sair: () => void;
  assinar: (plano: PlanoPago) => void;
}>({ usuario: null, carregando: true, entrar: () => {}, sair: () => {}, assinar: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setUsuario(ler());
    let alive = true;
    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (alive) setCarregando(false); return; }
      const { data, error } = await supabase.rpc('client_account_state');
      if (!alive) return;
      const state = data as { active: boolean; plan: string | null } | null;
      if (error || state?.active === false) { setUsuario(null); setCarregando(false); return; }
      const { data: subscriptions } = await supabase.from('assinaturas').select('plano').eq('user_id', session.user.id).eq('status', 'ativo').order('criado_em', { ascending: false }).limit(1);
      const candidate = state?.plan ?? subscriptions?.[0]?.plano ?? 'gratis';
      const plano: Usuario['plano'] = candidate === 'basico' || candidate === 'pro' || candidate === 'elite' || candidate === 'gold' ? candidate : 'gratis';
      setUsuario({ nome: String(session.user.user_metadata?.nome ?? session.user.email?.split('@')[0] ?? 'Usuário'), email: session.user.email ?? '', plano });
      setCarregando(false);
    };
    void hydrate();
    const id = setInterval(() => void hydrate(), 30000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { setTimeout(() => void hydrate(), 0); });
    return () => { alive = false; clearInterval(id); subscription.unsubscribe(); };
  }, []);

  const entrar = useCallback((nome: string, email: string) => {
    const u: Usuario = { nome, email, plano: "gratis" };
    try {
      localStorage.setItem(CHAVE, JSON.stringify(u));
    } catch {}
    setUsuario(u);
  }, []);

  const sair = useCallback(() => {
    void supabase.auth.signOut();
    try {
      localStorage.removeItem(CHAVE);
    } catch {}
    setUsuario(null);
  }, []);

  const assinar = useCallback((plano: PlanoPago) => {
    setUsuario((u) => {
      if (!u) return u;
      const novo = { ...u, plano };
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novo));
      } catch {}
      return novo;
    });
  }, []);

  return (
    <AuthCtx.Provider value={{ usuario, carregando, entrar, sair, assinar }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
