import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { entrarComGoogle } from "../integrations/lovable";
import { useAuth } from "../lib/auth";
import { Button, Card, Input, Label } from "../components/ui";
import { SiteHeader } from "../components/Layout";

const ERROS: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos. Se criou a conta com o Google, use o botão do Google.",
  "Email not confirmed": "Confirme seu e-mail: enviamos um link para a sua caixa de entrada.",
  "User already registered": "Este e-mail já tem conta. Clique em “Já tem conta? Entrar”.",
};

/** Login de verdade (conta no banco): o plano e o acesso de admin vêm da conta. */
export default function Login() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"entrar" | "cadastrar">("cadastrar");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busy, setBusy] = useState(false);
  const { usuario } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (usuario) nav("/app", { replace: true });
  }, [usuario, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErro("");
    setAviso("");
    try {
      if (modo === "cadastrar") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: {
            data: { nome: nome.trim() || email.split("@")[0], full_name: nome.trim() || undefined },
            emailRedirectTo: window.location.origin + "/app",
          },
        });
        if (error) throw error;
        if (!data.session) setAviso("Conta criada! Abra o link que enviamos para o seu e-mail para confirmar e depois entre.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErro(ERROS[msg] ?? msg);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErro("");
    const e = await entrarComGoogle(window.location.origin + "/app");
    if (e) setErro(e);
  };

  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader />
      <div className="mx-auto flex max-w-md flex-col px-6 py-20">
        <div className="mb-8 text-center">
          <img src="/logo.webp" alt="NK Software" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            {modo === "cadastrar" ? "Crie sua conta grátis" : "Bem-vindo de volta"}
          </h1>
          <p className="mt-2 text-tsecondary">Leva menos de 1 minuto. Sem cartão.</p>
        </div>
        <Card>
          <Button type="button" variant="outline" className="w-full" onClick={() => void google()}>
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            Continuar com Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-tmuted">
            <span className="h-px flex-1 bg-border" /> ou com e-mail <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            {modo === "cadastrar" && (
              <div>
                <Label>Seu nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como podemos te chamar?" />
              </div>
            )}
            <div>
              <Label>E-mail</Label>
              <Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                required
                minLength={6}
                autoComplete={modo === "cadastrar" ? "new-password" : "current-password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={modo === "cadastrar" ? "Mínimo 6 caracteres" : "Sua senha"}
              />
            </div>
            {erro && <p role="alert" className="text-sm text-red-400">{erro}</p>}
            {aviso && <p className="text-sm text-lime">{aviso}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {modo === "cadastrar" ? "Criar conta" : "Entrar"}
            </Button>
          </form>
          <button
            onClick={() => {
              setModo(modo === "cadastrar" ? "entrar" : "cadastrar");
              setErro("");
              setAviso("");
            }}
            className="mt-4 w-full cursor-pointer text-center text-sm text-tsecondary hover:text-lime"
          >
            {modo === "cadastrar" ? "Já tem conta? Entrar" : "Ainda não tem conta? Cadastrar"}
          </button>
        </Card>
        <p className="mt-6 text-center text-xs text-tmuted">
          <Link to="/" className="hover:text-tsecondary">← Voltar para o início</Link>
        </p>
      </div>
    </div>
  );
}
