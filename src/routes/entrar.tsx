import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  MailCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/AppShell";
import { Embers } from "@/components/system/Embers";
import { SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { erroAuth, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Modo = "entrar" | "criar" | "esqueci";

/** Só aceita voltar para páginas do próprio app. */
function destinoSeguro(para: unknown) {
  return typeof para === "string" && para.startsWith("/") && !para.startsWith("//")
    ? para
    : "/painel";
}

export const Route = createFileRoute("/entrar")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { para?: string | undefined; modo?: "criar" | undefined } => ({
    para: typeof s["para"] === "string" ? s["para"] : undefined,
    modo: s["modo"] === "criar" ? ("criar" as const) : undefined,
  }),
  head: () => ({ meta: [{ title: "Entrar · Fábrica de Conteúdo" }] }),
  component: Entrar,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Entrar() {
  const { para, modo: modoInicial } = Route.useSearch();
  const destino = destinoSeguro(para);
  const navigate = useNavigate();
  const { session, carregando } = useAuth();

  const [modo, setModo] = useState<Modo>(modoInicial ?? "entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Já logado: vai direto para o app.
  useEffect(() => {
    if (!carregando && session) navigate({ to: destino as "/painel" });
  }, [carregando, session, destino, navigate]);

  const validar = () => {
    if (!EMAIL_RE.test(email.trim())) return "Digite um e-mail válido.";
    if (modo !== "esqueci" && senha.length < 8)
      return "A senha precisa ter pelo menos 8 caracteres.";
    if (modo === "criar" && !/[a-zA-Z]/.test(senha)) return "Use letras e números na senha.";
    if (modo === "criar" && !/\d/.test(senha)) return "Use letras e números na senha.";
    if (modo === "criar" && nome.trim().length < 2) return "Digite seu nome.";
    return null;
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const erro = validar();
    if (erro) {
      toast.error(erro);
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      const mail = email.trim().toLowerCase();
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password: senha });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      } else if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email: mail,
          password: senha,
          options: {
            emailRedirectTo: `${window.location.origin}${destino}`,
            data: { full_name: nome.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setAviso(
            `Enviamos um link de confirmação para ${mail}. Abra o e-mail e toque no link para ativar sua conta.`,
          );
        } else {
          toast.success("Conta criada!");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) throw error;
        setAviso(
          `Se existir uma conta com ${mail}, você vai receber um link para criar uma nova senha.`,
        );
      }
    } catch (err) {
      toast.error(erroAuth(err instanceof Error ? err.message : undefined));
    } finally {
      setEnviando(false);
    }
  };

  // Login com Google gerenciado pelo Lovable Cloud.
  const google = async () => {
    setEnviando(true);
    try {
      const { lovable } = await import("@/integrations/lovable");
      const r = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}${destino}`,
      });
      if ("error" in r && r.error) throw r.error;
    } catch (err) {
      toast.error(erroAuth(err instanceof Error ? err.message : undefined));
      setEnviando(false);
    }
  };

  const titulo =
    modo === "entrar" ? "Entrar" : modo === "criar" ? "Criar conta" : "Recuperar senha";

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Embers color="blue" density={0.5} className="pointer-events-none fixed inset-0 size-full" />
      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8">
        <Logo to="/" />
        <Link
          to="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar ao site
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <SystemWindow title={`Sistema · ${titulo}`} scan className="sys-pop w-full max-w-md">
          <div className="space-y-5 p-6 md:p-8">
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-wide">
                {modo === "entrar" && "Bem-vindo de volta"}
                {modo === "criar" && "Desperte sua conta"}
                {modo === "esqueci" && "Nova senha"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {modo === "entrar" && "Entre para usar suas habilidades."}
                {modo === "criar" &&
                  "Use o mesmo e-mail da sua compra na Kiwify para liberar o acesso na hora."}
                {modo === "esqueci" && "Enviaremos um link para você criar uma nova senha."}
              </p>
            </div>

            {modo !== "esqueci" && (
              <div className="grid grid-cols-2 rounded-sm border border-primary/30 p-0.5 text-xs uppercase tracking-wider">
                {(["entrar", "criar"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setModo(m);
                      setAviso(null);
                    }}
                    className={cn(
                      "rounded-[3px] py-2 transition-colors",
                      modo === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === "entrar" ? "Entrar" : "Criar conta"}
                  </button>
                ))}
              </div>
            )}

            {aviso ? (
              <div className="space-y-4 rounded-sm border border-success/40 bg-success/10 p-4 text-sm">
                <p className="flex gap-2">
                  <MailCheck className="size-5 shrink-0 text-success" />
                  {aviso}
                </p>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setAviso(null);
                    setModo("entrar");
                  }}
                >
                  Voltar para entrar
                </Button>
              </div>
            ) : (
              <>
                {modo !== "esqueci" && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 w-full"
                      onClick={google}
                      disabled={enviando}
                    >
                      <GoogleIcon /> Continuar com Google
                    </Button>
                    <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                      <span className="h-px flex-1 bg-border" /> ou com e-mail{" "}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}

                <form onSubmit={enviar} className="space-y-3" noValidate>
                  {modo === "criar" && (
                    <Campo label="Seu nome">
                      <Input
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        autoComplete="name"
                        className="h-11"
                        maxLength={80}
                      />
                    </Campo>
                  )}
                  <Campo label="E-mail">
                    <Input
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="h-11"
                      maxLength={200}
                    />
                  </Campo>
                  {modo !== "esqueci" && (
                    <Campo
                      label="Senha"
                      extra={
                        modo === "entrar" && (
                          <button
                            type="button"
                            onClick={() => setModo("esqueci")}
                            className="text-xs text-primary hover:underline"
                          >
                            Esqueci a senha
                          </button>
                        )
                      }
                    >
                      <div className="relative">
                        <Input
                          type={verSenha ? "text" : "password"}
                          value={senha}
                          onChange={(e) => setSenha(e.target.value)}
                          autoComplete={modo === "criar" ? "new-password" : "current-password"}
                          className="h-11 pr-10"
                          maxLength={72}
                        />
                        <button
                          type="button"
                          onClick={() => setVerSenha((v) => !v)}
                          className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-muted-foreground"
                          aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
                        >
                          {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {modo === "criar" && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Mínimo de 8 caracteres, com letras e números.
                        </p>
                      )}
                    </Campo>
                  )}

                  <Button
                    type="submit"
                    className="h-11 w-full uppercase tracking-wider"
                    disabled={enviando}
                  >
                    {enviando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : modo === "entrar" ? (
                      <LogIn className="size-4" />
                    ) : modo === "criar" ? (
                      <UserPlus className="size-4" />
                    ) : (
                      <KeyRound className="size-4" />
                    )}
                    {modo === "entrar"
                      ? "Entrar"
                      : modo === "criar"
                        ? "Criar minha conta"
                        : "Enviar link"}
                  </Button>
                </form>

                {modo === "esqueci" && (
                  <button
                    type="button"
                    onClick={() => setModo("entrar")}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  >
                    Lembrei a senha
                  </button>
                )}
              </>
            )}
          </div>
        </SystemWindow>
      </main>
    </div>
  );
}

function Campo({
  label,
  extra,
  children,
}: {
  label: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
        {extra}
      </div>
      {children}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
