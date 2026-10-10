import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Copy,
  Crown,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { SystemHeader, SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { STATUS_LABEL, nomeDoPlano, useAuth } from "@/lib/auth";
import { carregarConfig, type AppConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Painel do dono · Fábrica de Conteúdo" }] }),
  component: Admin,
});

type Assinatura = Tables<"assinaturas">;
type Perfil = Tables<"profiles">;
type Evento = Tables<"eventos_kiwify">;

const DIA = 24 * 60 * 60 * 1000;
const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string | null | undefined, hora = false) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        ...(hora ? { hour: "2-digit", minute: "2-digit" } : {}),
      })
    : "—";

/** Mesma regra do banco (tem_acesso) para mostrar quem está liberado. */
function liberado(a: Assinatura, agora = Date.now()) {
  const valido = !a.valido_ate || new Date(a.valido_ate).getTime() > agora;
  if (a.status === "ativo" || a.status === "atrasado") return a.plano === "vitalicio" || valido;
  return a.status === "cancelado" && a.plano === "mensal" && !!a.valido_ate && valido;
}

function Admin() {
  const { isAdmin } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [temToken, setTemToken] = useState(false);
  const [cfg, setCfg] = useState<AppConfig | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [a, p, e, t, c] = await Promise.all([
      supabase.from("assinaturas").select("*").order("atualizado_em", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase
        .from("eventos_kiwify")
        .select("*")
        .order("recebido_em", { ascending: false })
        .limit(50),
      supabase.rpc("admin_has_secret", { _chave: "kiwify_token" }),
      carregarConfig(true),
    ]);
    setAssinaturas(a.data ?? []);
    setPerfis(p.data ?? []);
    setEventos(e.data ?? []);
    setTemToken(t.data === true);
    setCfg(c);
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void carregar();
  }, [isAdmin, carregar]);

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <SystemHeader label="Acesso negado" icon={ShieldAlert} title="Área do dono" />
        <SystemWindow muted>
          <p className="p-5 text-sm text-muted-foreground">Esta área é só para o dono do app.</p>
        </SystemWindow>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SystemHeader label="Comando central" icon={Crown} title="Painel do dono" />
        <Button variant="secondary" onClick={carregar} disabled={carregando}>
          {carregando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Atualizar
        </Button>
      </div>

      {!temToken && !carregando && (
        <div className="flex gap-3 rounded-sm border border-gold/40 bg-gold/10 p-4 text-sm">
          <ShieldAlert className="size-5 shrink-0 text-gold" />
          <p>
            A Kiwify ainda não está conectada. Abra a aba <b>Kiwify</b> e siga os 3 passos para as
            vendas liberarem o acesso sozinhas.
          </p>
        </div>
      )}

      <Tabs defaultValue="geral">
        <TabsList className="grid h-auto w-full grid-cols-4 bg-secondary/60">
          <TabsTrigger value="geral" className="text-xs">
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="assinantes" className="text-xs">
            Assinantes
          </TabsTrigger>
          <TabsTrigger value="contas" className="text-xs">
            Contas
          </TabsTrigger>
          <TabsTrigger value="kiwify" className="text-xs">
            Kiwify
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <VisaoGeral assinaturas={assinaturas} perfis={perfis} eventos={eventos} />
        </TabsContent>
        <TabsContent value="assinantes" className="mt-4">
          <Assinantes assinaturas={assinaturas} perfis={perfis} onMudou={carregar} />
        </TabsContent>
        <TabsContent value="contas" className="mt-4">
          <Contas perfis={perfis} assinaturas={assinaturas} />
        </TabsContent>
        <TabsContent value="kiwify" className="mt-4">
          {cfg && <Kiwify temToken={temToken} eventos={eventos} cfg={cfg} onMudou={carregar} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===================== Visão geral =====================

function VisaoGeral({
  assinaturas,
  perfis,
  eventos,
}: {
  assinaturas: Assinatura[];
  perfis: Perfil[];
  eventos: Evento[];
}) {
  const ativos = assinaturas.filter((a) => liberado(a));
  const mensais = ativos.filter((a) => a.plano === "mensal").length;
  const vitalicios = ativos.filter((a) => a.plano === "vitalicio").length;
  const vendas = eventos.filter(
    (e) =>
      e.assinatura_valida &&
      (e.tipo === "order_approved" ||
        e.tipo === "subscription_renewed" ||
        e.status_pedido === "paid"),
  );
  const faturado = vendas.reduce((s, e) => s + (e.valor_centavos ?? 0), 0);
  const ultimos30 = vendas.filter((e) => Date.now() - new Date(e.recebido_em).getTime() < 30 * DIA);
  const faturado30 = ultimos30.reduce((s, e) => s + (e.valor_centavos ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Users} label="Contas criadas" valor={String(perfis.length)} />
        <Stat icon={ShieldCheck} label="Com acesso" valor={String(ativos.length)} destaque />
        <Stat icon={Crown} label="Mensal · Vitalício" valor={`${mensais} · ${vitalicios}`} />
        <Stat
          icon={Wallet}
          label="Vendas em 30 dias"
          valor={brl(faturado30)}
          sub={`${ultimos30.length} vendas`}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Faturamento registrado pela Kiwify (últimos 50 avisos):{" "}
        <b className="text-foreground">{brl(faturado)}</b>
      </p>

      <SystemWindow title="Últimas vendas" muted>
        <div className="divide-y divide-primary/10">
          {vendas.slice(0, 8).map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <CheckCircle2 className="size-4 shrink-0 text-success" />
              <span className="min-w-0 flex-1 truncate">{e.email}</span>
              <span className="hidden text-muted-foreground sm:block">{e.produto}</span>
              <span className="font-mono">{e.valor_centavos ? brl(e.valor_centavos) : "—"}</span>
              <span className="w-24 text-right font-mono text-xs text-muted-foreground">
                {dataBR(e.recebido_em)}
              </span>
            </div>
          ))}
          {vendas.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
          )}
        </div>
      </SystemWindow>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  valor,
  sub,
  destaque,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valor: string;
  sub?: string;
  destaque?: boolean;
}) {
  return (
    <div className={cn("sys-panel rounded-sm p-4", !destaque && "sys-panel-muted")}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="size-3.5 text-primary" /> {label}
      </div>
      <div className={cn("mt-1 font-display text-2xl font-bold", destaque && "sys-glow-text")}>
        {valor}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ===================== Assinantes =====================

function Assinantes({
  assinaturas,
  perfis,
  onMudou,
}: {
  assinaturas: Assinatura[];
  perfis: Perfil[];
  onMudou: () => Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "liberados" | "bloqueados">("todos");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const nomes = useMemo(() => new Map(perfis.map((p) => [p.id, p.nome])), [perfis]);

  const lista = assinaturas.filter((a) => {
    if (busca && !a.email.includes(busca.toLowerCase().trim())) return false;
    if (filtro === "liberados") return liberado(a);
    if (filtro === "bloqueados") return !liberado(a);
    return true;
  });

  const mudar = async (a: Assinatura, campos: Partial<Assinatura>, msg: string) => {
    setOcupado(a.id);
    const { error } = await supabase.from("assinaturas").update(campos).eq("id", a.id);
    setOcupado(null);
    if (error) toast.error("Não deu para salvar: " + error.message);
    else {
      toast.success(msg);
      await onMudou();
    }
  };

  const mais30 = (a: Assinatura) => {
    const base = Math.max(Date.now(), a.valido_ate ? new Date(a.valido_ate).getTime() : 0);
    return new Date(base + 30 * DIA).toISOString();
  };

  return (
    <div className="space-y-4">
      <LiberarManual onFeito={onMudou} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por e-mail"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <div className="flex rounded-sm border border-primary/30 p-0.5 text-xs">
          {(["todos", "liberados", "bloqueados"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-[3px] px-3 py-1.5 capitalize",
                filtro === f ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {lista.map((a) => {
          const ok = liberado(a);
          return (
            <div key={a.id} className="sys-panel sys-panel-muted rounded-sm p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {ok ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {a.email}
                  {a.user_id && nomes.get(a.user_id) ? (
                    <span className="text-muted-foreground"> · {nomes.get(a.user_id)}</span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px] uppercase",
                    a.plano === "vitalicio" ? "text-gold" : "text-primary",
                  )}
                >
                  {nomeDoPlano(a.plano)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 pl-7 text-[11px] text-muted-foreground">
                <span>{STATUS_LABEL[a.status] ?? a.status}</span>
                <span>
                  {a.plano === "vitalicio" ? "sem vencimento" : `vence ${dataBR(a.valido_ate)}`}
                </span>
                <span>{a.origem === "kiwify" ? "Kiwify" : "manual"}</span>
                <span>{a.user_id ? "tem conta" : "ainda não criou conta"}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                {ocupado === a.id ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <>
                    {ok ? (
                      <MiniBtn
                        danger
                        onClick={() =>
                          mudar(
                            a,
                            { status: "cancelado", valido_ate: new Date().toISOString() },
                            "Acesso bloqueado.",
                          )
                        }
                      >
                        Bloquear
                      </MiniBtn>
                    ) : (
                      <MiniBtn
                        onClick={() =>
                          mudar(
                            a,
                            {
                              status: "ativo",
                              valido_ate: a.plano === "vitalicio" ? null : mais30(a),
                            },
                            "Acesso liberado.",
                          )
                        }
                      >
                        Liberar
                      </MiniBtn>
                    )}
                    {a.plano === "mensal" && (
                      <MiniBtn
                        onClick={() => mudar(a, { valido_ate: mais30(a) }, "+30 dias adicionados.")}
                      >
                        +30 dias
                      </MiniBtn>
                    )}
                    {a.plano === "mensal" ? (
                      <MiniBtn
                        onClick={() =>
                          mudar(
                            a,
                            { plano: "vitalicio", status: "ativo", valido_ate: null },
                            "Agora é vitalício.",
                          )
                        }
                      >
                        Tornar vitalício
                      </MiniBtn>
                    ) : (
                      <MiniBtn
                        onClick={() =>
                          mudar(
                            a,
                            { plano: "mensal", valido_ate: mais30(a) },
                            "Agora é mensal (+30 dias).",
                          )
                        }
                      >
                        Tornar mensal
                      </MiniBtn>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {lista.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum assinante encontrado.
          </p>
        )}
      </div>
    </div>
  );
}

function MiniBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-sm border border-border bg-secondary/60 px-2.5 py-1 text-[11px] transition-colors hover:border-primary/60",
        danger && "hover:border-destructive hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

function LiberarManual({ onFeito }: { onFeito: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [plano, setPlano] = useState<"mensal" | "vitalicio">("mensal");
  const [dias, setDias] = useState("30");
  const [salvando, setSalvando] = useState(false);

  const liberar = async () => {
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast.error("Digite um e-mail válido.");
      return;
    }
    const n = Math.max(1, Math.min(3650, parseInt(dias, 10) || 30));
    setSalvando(true);
    const { error } = await supabase.from("assinaturas").upsert(
      {
        email: mail,
        plano,
        status: "ativo",
        origem: "manual",
        valido_ate: plano === "vitalicio" ? null : new Date(Date.now() + n * DIA).toISOString(),
        observacao: "liberado pelo dono",
      },
      { onConflict: "email" },
    );
    setSalvando(false);
    if (error) toast.error("Não deu para liberar: " + error.message);
    else {
      toast.success(`Acesso liberado para ${mail}.`);
      setEmail("");
      await onFeito();
    }
  };

  return (
    <SystemWindow title="Liberar acesso manualmente" muted>
      <div className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
        <Input
          placeholder="E-mail do cliente"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 md:flex-1"
        />
        <div className="flex gap-2">
          <select
            value={plano}
            onChange={(e) => setPlano(e.target.value as "mensal" | "vitalicio")}
            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="mensal">Mensal</option>
            <option value="vitalicio">Vitalício</option>
          </select>
          {plano === "mensal" && (
            <Input
              value={dias}
              onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))}
              className="h-10 w-20"
              aria-label="Dias"
            />
          )}
          <Button onClick={liberar} disabled={salvando} className="h-10">
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Liberar
          </Button>
        </div>
      </div>
      <p className="px-4 pb-4 text-[11px] text-muted-foreground">
        Bom para dar acesso de presente, parceiros ou testar. Se a pessoa ainda não tem conta, o
        acesso fica esperando ela se cadastrar com esse e-mail.
      </p>
    </SystemWindow>
  );
}

// ===================== Contas =====================

function Contas({ perfis, assinaturas }: { perfis: Perfil[]; assinaturas: Assinatura[] }) {
  const [busca, setBusca] = useState("");
  const porUsuario = useMemo(
    () => new Map(assinaturas.filter((a) => a.user_id).map((a) => [a.user_id!, a])),
    [assinaturas],
  );
  const lista = perfis.filter(
    (p) =>
      !busca ||
      p.email.includes(busca.toLowerCase()) ||
      (p.nome ?? "").toLowerCase().includes(busca.toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-10 pl-9"
        />
      </div>
      <SystemWindow muted>
        <div className="divide-y divide-primary/10">
          {lista.map((p) => {
            const a = porUsuario.get(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-primary/30 font-display font-bold text-primary">
                  {(p.nome || p.email).charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.nome || "Sem nome"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px] uppercase",
                    a && liberado(a) ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {a ? (liberado(a) ? nomeDoPlano(a.plano) : "bloqueado") : "sem plano"}
                </span>
                <span className="hidden w-20 text-right font-mono text-xs text-muted-foreground sm:block">
                  {dataBR(p.created_at)}
                </span>
              </div>
            );
          })}
          {lista.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conta ainda.</p>
          )}
        </div>
      </SystemWindow>
    </div>
  );
}

// ===================== Kiwify =====================

function Kiwify({
  temToken,
  eventos,
  cfg,
  onMudou,
}: {
  temToken: boolean;
  eventos: Evento[];
  cfg: AppConfig;
  onMudou: () => Promise<void>;
}) {
  const [token, setToken] = useState("");
  const [salvandoToken, setSalvandoToken] = useState(false);
  const [links, setLinks] = useState(cfg);
  const [salvandoLinks, setSalvandoLinks] = useState(false);
  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/kiwify` : "/api/kiwify";
  const emPreview =
    typeof window !== "undefined" && /id-preview--|lovableproject\.com/.test(window.location.host);

  const salvarToken = async () => {
    if (token.trim().length < 6) {
      toast.error("Cole o token do webhook da Kiwify.");
      return;
    }
    setSalvandoToken(true);
    const { error } = await supabase.rpc("admin_set_secret", {
      _chave: "kiwify_token",
      _valor: token.trim(),
    });
    setSalvandoToken(false);
    if (error) toast.error(error.message);
    else {
      setToken("");
      toast.success("Token salvo. A Kiwify está conectada.");
      await onMudou();
    }
  };

  const salvarLinks = async () => {
    const linhas = (Object.keys(links) as (keyof AppConfig)[]).map((chave) => ({
      chave,
      valor: links[chave].trim(),
    }));
    for (const l of linhas) {
      if (l.chave.startsWith("checkout") && l.valor && !/^https:\/\//.test(l.valor)) {
        toast.error("Os links de checkout precisam começar com https://");
        return;
      }
    }
    setSalvandoLinks(true);
    const { error } = await supabase.from("app_config").upsert(linhas, { onConflict: "chave" });
    setSalvandoLinks(false);
    if (error) toast.error("Não deu para salvar: " + error.message);
    else {
      toast.success("Links e preços atualizados no site.");
      await carregarConfig(true);
    }
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    toast.success("Endereço copiado.");
  };

  return (
    <div className="space-y-4">
      <SystemWindow title="Conectar a Kiwify em 3 passos" scan={!temToken}>
        <ol className="space-y-5 p-5">
          <Passo n={1} titulo="Copie o endereço do webhook">
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="h-10 font-mono text-xs" />
              <Button variant="secondary" onClick={copiar}>
                <Copy className="size-4" /> Copiar
              </Button>
            </div>
            {emPreview && (
              <p className="text-[11px] text-gold">
                Você está na prévia da Lovable. Publique o app e use o endereço do site publicado
                (ou seu domínio) no lugar deste.
              </p>
            )}
          </Passo>
          <Passo n={2} titulo="Crie o webhook na Kiwify">
            <p className="text-sm text-muted-foreground">
              Na Kiwify: <b>Apps → Webhooks → Criar webhook</b>. Cole o endereço, escolha o seu
              produto, marque <b>todos os eventos</b> e salve. A Kiwify mostra um <b>token</b>:
              copie.
            </p>
          </Passo>
          <Passo n={3} titulo="Cole o token aqui">
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={
                  temToken ? "Token já configurado — cole outro para trocar" : "Token do webhook"
                }
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="h-10"
                autoComplete="off"
              />
              <Button onClick={salvarToken} disabled={salvandoToken}>
                {salvandoToken ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Salvar
              </Button>
            </div>
            <p className={cn("text-[11px]", temToken ? "text-success" : "text-muted-foreground")}>
              {temToken
                ? "● Conectado. Toda venda aprovada libera o acesso sozinha."
                : "○ Ainda não conectado."}
            </p>
          </Passo>
        </ol>
      </SystemWindow>

      <SystemWindow title="Links de compra e preços do site" muted>
        <div className="grid gap-3 p-5 md:grid-cols-2">
          <Campo label="Link do checkout — Mensal">
            <Input
              placeholder="https://pay.kiwify.com.br/..."
              value={links.checkout_mensal}
              onChange={(e) => setLinks({ ...links, checkout_mensal: e.target.value })}
              className="h-10 font-mono text-xs"
            />
          </Campo>
          <Campo label="Preço — Mensal">
            <Input
              value={links.preco_mensal}
              onChange={(e) => setLinks({ ...links, preco_mensal: e.target.value })}
              className="h-10"
            />
          </Campo>
          <Campo label="Link do checkout — Vitalício">
            <Input
              placeholder="https://pay.kiwify.com.br/..."
              value={links.checkout_vitalicio}
              onChange={(e) => setLinks({ ...links, checkout_vitalicio: e.target.value })}
              className="h-10 font-mono text-xs"
            />
          </Campo>
          <Campo label="Preço — Vitalício">
            <Input
              value={links.preco_vitalicio}
              onChange={(e) => setLinks({ ...links, preco_vitalicio: e.target.value })}
              className="h-10"
            />
          </Campo>
          <div className="md:col-span-2">
            <Button onClick={salvarLinks} disabled={salvandoLinks}>
              {salvandoLinks ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar links e preços
            </Button>
          </div>
        </div>
      </SystemWindow>

      <SystemWindow title="Últimos avisos recebidos" muted>
        <div className="divide-y divide-primary/10">
          {eventos.slice(0, 20).map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-xs">
              {e.assinatura_valida && e.processado && !e.erro ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : e.assinatura_valida ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-mono text-primary">
                    {e.tipo || e.status_pedido || "aviso"}
                  </span>
                  {e.email && <span className="text-muted-foreground"> · {e.email}</span>}
                </p>
                {e.erro && <p className="text-muted-foreground">{e.erro}</p>}
              </div>
              <span className="shrink-0 font-mono text-muted-foreground">
                {dataBR(e.recebido_em, true)}
              </span>
            </div>
          ))}
          {eventos.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Nenhum aviso ainda. Depois de configurar, use o botão de teste da Kiwify para
              conferir.
            </p>
          )}
        </div>
      </SystemWindow>
    </div>
  );
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="sys-glow-text font-display text-2xl font-bold leading-none">
        {String(n).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold">{titulo}</p>
        {children}
      </div>
    </li>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
