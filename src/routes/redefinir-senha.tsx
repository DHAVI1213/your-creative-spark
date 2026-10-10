import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/AppShell";
import { SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { erroAuth, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ title: "Nova senha · Fábrica de Conteúdo" }] }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const { session, carregando } = useAuth();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [enviando, setEnviando] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) {
      toast.error("A senha precisa ter pelo menos 8 caracteres, com letras e números.");
      return;
    }
    if (senha !== confirma) {
      toast.error("As duas senhas não são iguais.");
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      toast.error(erroAuth(error.message));
      return;
    }
    toast.success("Senha atualizada!");
    navigate({ to: "/painel" });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-4 md:px-8">
        <Logo to="/" />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <SystemWindow title="Sistema · Nova senha" scan className="sys-pop w-full max-w-md">
          <div className="space-y-5 p-6 md:p-8">
            <h1 className="text-3xl font-bold uppercase">Criar nova senha</h1>
            {carregando ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : !session ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Esse link expirou ou já foi usado. Peça um novo na tela de entrar.</p>
                <Button asChild className="w-full">
                  <Link to="/entrar">Ir para entrar</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={salvar} className="space-y-3">
                <Input
                  type="password"
                  placeholder="Nova senha"
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="h-11"
                  maxLength={72}
                />
                <Input
                  type="password"
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  className="h-11"
                  maxLength={72}
                />
                <p className="text-[11px] text-muted-foreground">
                  Mínimo de 8 caracteres, com letras e números.
                </p>
                <Button
                  type="submit"
                  className="h-11 w-full uppercase tracking-wider"
                  disabled={enviando}
                >
                  {enviando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  Salvar nova senha
                </Button>
              </form>
            )}
          </div>
        </SystemWindow>
      </main>
    </div>
  );
}
