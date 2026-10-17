import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from '../integrations/supabase/client';

export type PlanoPago = "basico" | "pro" | "elite" | "gold";
export type Usuario = {
  nome: string;
  email: string;
  plano: "gratis" | "basico" | "pro" | "elite" | "gold";
  /** Dono do site: usa todas as ferramentas de graça. */
  admin?: boolean;
};

const CHAVE = "nk_usuario";


const AuthCtx = createContext<{
  usuario: Usuario | null;
  carregando: boolean;
  sair: () => void;
  assinar: (plano: PlanoPago) => void;
}>({ usuario: null, carregando: true, sair: () => {}, assinar: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let alive = true;
    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // Sem login de verdade não há usuário (o plano vem da conta no banco).
      if (!session) { if (alive) { setUsuario(null); setCarregando(false); } return; }
      const nome = String(session.user.user_metadata?.nome ?? session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'Usuário');
      const email = session.user.email ?? '';
      // Admin primeiro: o dono usa tudo de graça e nunca é bloqueado.
      const { data: admin } = await supabase.rpc('has_role', { _user_id: session.user.id, _role: 'admin' });
      if (!alive) return;
      if (admin === true) { setUsuario({ nome, email, plano: 'gold', admin: true }); setCarregando(false); return; }
      const { data, error } = await supabase.rpc('client_account_state');
      if (!alive) return;
      const state = data as { active: boolean; plan: string | null } | null;
      if (error || state?.active === false) { setUsuario(null); setCarregando(false); return; }
      const { data: subscriptions } = await supabase.from('assinaturas').select('plano').eq('user_id', session.user.id).eq('status', 'ativo').order('criado_em', { ascending: false }).limit(1);
      const candidate = state?.plan ?? subscriptions?.[0]?.plano ?? 'gratis';
      const plano: Usuario['plano'] = candidate === 'basico' || candidate === 'pro' || candidate === 'elite' || candidate === 'gold' ? candidate : 'gratis';
      setUsuario({ nome, email, plano });
      setCarregando(false);
    };
    void hydrate();
    const id = setInterval(() => void hydrate(), 30000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { setTimeout(() => void hydrate(), 0); });
    return () => { alive = false; clearInterval(id); subscription.unsubscribe(); };
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
    <AuthCtx.Provider value={{ usuario, carregando, sair, assinar }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
