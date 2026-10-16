import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Usuario = { nome: string; email: string; plano: "gratis" | "pro" | "elite" };

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
  entrar: (nome: string, email: string) => void;
  sair: () => void;
  assinar: (plano: "pro" | "elite") => void;
}>({ usuario: null, entrar: () => {}, sair: () => {}, assinar: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => setUsuario(ler()), []);

  const entrar = useCallback((nome: string, email: string) => {
    const u: Usuario = { nome, email, plano: "gratis" };
    try {
      localStorage.setItem(CHAVE, JSON.stringify(u));
    } catch {}
    setUsuario(u);
  }, []);

  const sair = useCallback(() => {
    try {
      localStorage.removeItem(CHAVE);
    } catch {}
    setUsuario(null);
  }, []);

  const assinar = useCallback((plano: "pro" | "elite") => {
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
    <AuthCtx.Provider value={{ usuario, entrar, sair, assinar }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
