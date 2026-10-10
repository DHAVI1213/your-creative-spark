import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Perfil = Tables<"profiles">;
export type Assinatura = Tables<"assinaturas">;

type AuthState = {
  /** true enquanto ainda não sabemos se há alguém logado. */
  carregando: boolean;
  session: Session | null;
  user: User | null;
  perfil: Perfil | null;
  assinatura: Assinatura | null;
  isAdmin: boolean;
  temAcesso: boolean;
  /** Relê perfil, plano e permissões (ex.: depois de uma compra). */
  atualizar: () => Promise<void>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  /** Para qual usuário os dados (perfil, plano) já foram carregados. */
  const [dadosDe, setDadosDe] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [temAcesso, setTemAcesso] = useState(false);

  // Sessão: primeiro escuta mudanças, depois lê a sessão salva.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setCarregandoSessao(false);
    });
    supabase.auth
      .getSession()
      .then(({ data: d }) => setSession(d.session))
      .finally(() => setCarregandoSessao(false));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const carregarDados = useCallback(async (uid: string | null) => {
    if (!uid) {
      setPerfil(null);
      setAssinatura(null);
      setIsAdmin(false);
      setTemAcesso(false);
      setDadosDe(null);
      return;
    }
    try {
      const [p, a, admin, acesso] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase
          .from("assinaturas")
          .select("*")
          .eq("user_id", uid)
          .order("atualizado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
        supabase.rpc("tem_acesso"),
      ]);
      setPerfil(p.data ?? null);
      setAssinatura(a.data ?? null);
      setIsAdmin(admin.data === true);
      setTemAcesso(acesso.data === true);
    } finally {
      setDadosDe(uid);
    }
  }, []);

  useEffect(() => {
    // Adiado para fora do callback de auth, como recomenda o Supabase.
    const t = setTimeout(() => void carregarDados(userId), 0);
    return () => clearTimeout(t);
  }, [userId, carregarDados]);

  const value = useMemo<AuthState>(
    () => ({
      carregando: carregandoSessao || (!!userId && dadosDe !== userId),
      session,
      user: session?.user ?? null,
      perfil,
      assinatura,
      isAdmin,
      temAcesso,
      atualizar: () => carregarDados(userId),
      sair: async () => {
        await supabase.auth.signOut();
      },
    }),
    [
      carregandoSessao,
      dadosDe,
      session,
      perfil,
      assinatura,
      isAdmin,
      temAcesso,
      carregarDados,
      userId,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}

/** Traduz as mensagens de erro mais comuns do login. */
export function erroAuth(message: string | undefined): string {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Já existe uma conta com esse e-mail. Use “Entrar”.";
  if (m.includes("password should be at least") || m.includes("weak password"))
    return "A senha precisa ter pelo menos 8 caracteres, com letras e números.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Espere alguns minutos e tente de novo.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider"))
    return "O login com Google ainda não foi ativado. Use e-mail e senha por enquanto.";
  if (m.includes("same password")) return "A nova senha precisa ser diferente da atual.";
  if (m.includes("known to be weak") || m.includes("pwned") || m.includes("easy to guess"))
    return "Essa senha é muito comum e já apareceu em vazamentos. Escolha outra mais forte.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Sem conexão com o servidor. Confira sua internet e tente de novo.";
  if (m.includes("invalid") && m.includes("email")) return "Esse e-mail não é válido.";
  if (m.includes("not allowed") && m.includes("email"))
    return "Esse e-mail não pode receber mensagens. Use um e-mail real.";
  return message || "Algo deu errado. Tente de novo.";
}

export function nomeDoPlano(plano: string | null | undefined) {
  return plano === "vitalicio"
    ? "Monarca Vitalício"
    : plano === "mensal"
      ? "Caçador Mensal"
      : "Sem plano";
}

export const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  atrasado: "Pagamento atrasado",
  cancelado: "Cancelado",
  reembolsado: "Reembolsado",
  expirado: "Expirado",
};
