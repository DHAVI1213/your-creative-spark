import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Crown, KeyRound, Loader2, LogOut, Save, UserRound } from "lucide-react";
import { toast } from "sonner";

import { SystemHeader, SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, erroAuth, nomeDoPlano, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/conta")({
  head: () => ({ meta: [{ title: "Minha conta · Fábrica de Conteúdo" }] }),
  component: Conta,
});

function dataBR(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function Conta() {
  const { user, perfil, assinatura, temAcesso, isAdmin, atualizar, sair } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState(perfil?.nome ?? "");
  const [salvando, setSalvando] = useState(false);
  const [senha, setSenha] = useState("");
  const [trocando, setTrocando] = useState(false);

  useEffect(() => setNome(perfil?.nome ?? ""), [perfil?.nome]);

  const salvarNome = async () => {
    if (!user) return;
    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim().slice(0, 80) })
      .eq("id", user.id);
    setSalvando(false);
    if (error) toast.error("Não deu para salvar.");
    else {
      toast.success("Nome atualizado.");
      void atualizar();
    }
  };

  const trocarSenha = async () => {
    if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) {
      toast.error("A senha precisa ter pelo menos 8 caracteres, com letras e números.");
      return;
    }
    setTrocando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setTrocando(false);
    if (error) toast.error(erroAuth(error.message));
    else {
      setSenha("");
      toast.success("Senha alterada.");
    }
  };

  const loginGoogle = user?.app_metadata?.provider === "google";
  const inicial = (perfil?.nome || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <SystemHeader label="Status do jogador" icon={UserRound} title="Minha conta" />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Plano */}
        <SystemWindow title="Plano" scan={temAcesso}>
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-sm border font-display text-2xl font-bold",
                  assinatura?.plano === "vitalicio"
                    ? "border-gold/60 text-gold"
                    : temAcesso
                      ? "border-destructive/60 text-destructive"
                      : "border-border text-muted-foreground",
                )}
              >
                {isAdmin ? "★" : assinatura?.plano === "vitalicio" ? "S" : temAcesso ? "A" : "E"}
              </span>
              <div>
                <p className="text-lg font-bold uppercase">
                  {isAdmin && !assinatura ? "Dono do app" : nomeDoPlano(assinatura?.plano)}
                </p>
                <p
                  className={cn(
                    "font-mono text-xs uppercase tracking-widest",
                    temAcesso ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {temAcesso ? "● Acesso liberado" : "○ Sem acesso às habilidades"}
                </p>
              </div>
            </div>

            {assinatura && (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Item
                  label="Situação"
                  valor={STATUS_LABEL[assinatura.status] ?? assinatura.status}
                />
                <Item
                  label={assinatura.plano === "vitalicio" ? "Validade" : "Válido até"}
                  valor={
                    assinatura.plano === "vitalicio" ? "Para sempre" : dataBR(assinatura.valido_ate)
                  }
                />
                <Item label="Desde" valor={dataBR(assinatura.criado_em)} />
                <Item
                  label="Compra"
                  valor={assinatura.origem === "kiwify" ? "Kiwify" : "Liberado pelo dono"}
                />
              </dl>
            )}

            {!temAcesso && (
              <Button asChild className="w-full uppercase tracking-wider">
                <Link to="/planos">
                  <Crown className="size-4" /> Ver planos
                </Link>
              </Button>
            )}
            {assinatura?.plano === "mensal" && (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <CalendarClock className="size-4 shrink-0 text-primary" />A renovação e o
                cancelamento do plano mensal são feitos pela Kiwify, no e-mail da compra.
              </p>
            )}
          </div>
        </SystemWindow>

        {/* Perfil */}
        <SystemWindow title="Perfil" muted>
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              {perfil?.avatar_url ? (
                <img
                  src={perfil.avatar_url}
                  alt=""
                  className="size-12 rounded-sm border border-primary/40 object-cover"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-sm border border-primary/40 bg-primary/10 font-display text-xl font-bold text-primary">
                  {inicial}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{perfil?.nome || "Sem nome"}</p>
                <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Nome</label>
              <div className="flex gap-2">
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={80}
                  className="h-10"
                />
                <Button
                  variant="secondary"
                  onClick={salvarNome}
                  disabled={salvando || nome.trim() === (perfil?.nome ?? "")}
                >
                  {salvando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </SystemWindow>

        {/* Segurança */}
        <SystemWindow title="Segurança" muted>
          <div className="space-y-3 p-5">
            {loginGoogle && (
              <p className="text-sm text-muted-foreground">
                Você entra com o Google. Se quiser, crie também uma senha para entrar com e-mail.
              </p>
            )}
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Nova senha
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                maxLength={72}
                className="h-10"
              />
              <Button variant="secondary" onClick={trocarSenha} disabled={trocando || !senha}>
                {trocando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Trocar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Mínimo de 8 caracteres, com letras e números.
            </p>
          </div>
        </SystemWindow>

        <SystemWindow title="Sessão" muted>
          <div className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">Sair desta conta neste aparelho.</p>
            <Button
              variant="secondary"
              onClick={async () => {
                await sair();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </SystemWindow>
      </div>
    </div>
  );
}

function Item({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-sm border border-primary/15 bg-background/40 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{valor}</dd>
    </div>
  );
}
