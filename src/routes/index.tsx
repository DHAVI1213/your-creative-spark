import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Clock,
  Download,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Swords,
  Wallet,
  Zap,
} from "lucide-react";

import { Logo } from "@/components/AppShell";
import { HeroCard } from "@/components/system/HeroCard";
import { PlanCards } from "@/components/system/PlanCards";
import { RankBadge, SystemWindow } from "@/components/system/System";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { APP_NAME, TOOLS } from "@/lib/app";
import { ARTE } from "@/lib/arte";
import { cn } from "@/lib/utils";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Vendas,
});

const PAINS = [
  {
    icon: Clock,
    title: "Horas editando um por um",
    text: "Cortar, legendar e exportar vídeo por vídeo come o seu dia inteiro.",
  },
  {
    icon: Wallet,
    title: "Uma assinatura para cada coisa",
    text: "Editor, agendador, limpador, buscador de clientes… cada um cobra o seu.",
  },
  {
    icon: Swords,
    title: "Cliente não cai do céu",
    text: "Achar lojas que precisam de site e montar a proposta toma tempo.",
  },
];

const FAQ = [
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não precisa de loja. Você abre o site e toca em “Instalar o app”: ele vira um aplicativo com ícone no PC (Windows e Mac) e no celular (Android e iPhone).",
  },
  {
    q: "Funciona no celular e no PC com a mesma conta?",
    a: "Sim. É uma conta só. O app se ajusta ao aparelho: no PC processa lotes maiores, no celular trabalha mais leve.",
  },
  {
    q: "Meus vídeos e fotos vão para algum servidor?",
    a: "No Limpador de Metadados e no Editor em Massa, não: tudo é processado no seu próprio aparelho. Só o Agendador envia os vídeos para a nuvem, para publicar na hora marcada.",
  },
  {
    q: "As ferramentas novas custam a mais?",
    a: "Não. Quem assina recebe todas as habilidades que forem sendo liberadas, sem pagar nada a mais.",
  },
  {
    q: "E se eu não gostar?",
    a: "Você tem 7 dias de garantia: pede o reembolso e recebe o valor de volta, sem burocracia.",
  },
  {
    q: "Posso cancelar o plano mensal?",
    a: "Quando quiser, sem multa. O acesso continua até o fim do mês já pago.",
  },
];

function Vendas() {
  const live = TOOLS.filter((t) => t.status === "ativo").length;

  return (
    <div className="overflow-x-hidden">
      {/* Navegação */}
      <header className="sticky top-0 z-40 border-b border-primary/15 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo to="/" />
          <nav className="hidden items-center gap-6 font-mono text-xs uppercase tracking-widest text-muted-foreground md:flex">
            <a href="#habilidades" className="hover:text-primary">
              Habilidades
            </a>
            <a href="#planos" className="hover:text-primary">
              Planos
            </a>
            <a href="#duvidas" className="hover:text-primary">
              Dúvidas
            </a>
          </nav>
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="shrink-0 uppercase tracking-wider"
          >
            <Link to="/painel">Entrar no app</Link>
          </Button>
        </div>
      </header>

      {/* Hero: ficha de personagem */}
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-16 md:pb-24">
        <p className="sys-label mb-2">[ Sistema ] Um novo jogador foi detectado</p>
        <HeroCard
          theme="azul"
          rank="S"
          kicker="O seu arsenal"
          title={
            <>
              Fábrica de
              <br />
              <span className="sys-glow-text">Conteúdo</span>
            </>
          }
          subtitle="6 habilidades · PC e celular"
          art={ARTE.heroi}
          navTitle="Sobre"
          nav={[
            { label: "Habilidades", href: "#habilidades" },
            { label: "Como funciona", href: "#como-funciona" },
            { label: "Planos", href: "#planos" },
            { label: "Garantia", href: "#planos" },
            { label: "Dúvidas", href: "#duvidas" },
          ]}
        >
          <h1 className="max-w-md text-base font-normal normal-case text-white/85 md:text-lg">
            Edite vídeos em massa, limpe metadados, clone sites, encontre clientes e agende seus
            posts. Seis ferramentas num app só, que se adapta ao seu aparelho.
          </h1>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="uppercase tracking-wider">
              <a href="#planos">
                Despertar agora <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary" className="uppercase tracking-wider">
              <a href="#habilidades">Ver habilidades</a>
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-white/60">
            <span className="flex items-center gap-1.5">
              <MonitorSmartphone className="size-3.5 text-primary" /> PC e celular
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" /> 7 dias de garantia
            </span>
            <span className="flex items-center gap-1.5">
              <Download className="size-3.5 text-primary" /> Sem loja de apps
            </span>
          </div>
        </HeroCard>
      </section>

      {/* Problema */}
      <section className="border-y border-primary/10 bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="sys-label mb-3">[ Alerta ] Ameaças detectadas</p>
          <h2 className="mb-8 max-w-2xl text-3xl font-bold uppercase md:text-4xl">
            Você está perdendo tempo e dinheiro em três frentes
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PAINS.map((p) => (
              <SystemWindow key={p.title} muted>
                <div className="space-y-2 p-5">
                  <p.icon className="size-6 text-destructive" />
                  <h3 className="text-lg font-bold uppercase">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.text}</p>
                </div>
              </SystemWindow>
            ))}
          </div>
        </div>
      </section>

      {/* Habilidades */}
      <section id="habilidades" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <p className="sys-label mb-3">[ Habilidades ] {live} liberadas · mais chegando</p>
        <h2 className="mb-3 text-3xl font-bold uppercase md:text-4xl">Seu arsenal completo</h2>
        <p className="mb-10 max-w-2xl text-muted-foreground">
          Cada ferramenta é uma habilidade. Quem assina recebe todas, inclusive as que ainda vão ser
          liberadas.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <SystemWindow key={t.id} muted={t.status !== "ativo"} className="h-full">
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="sys-btn-glow flex size-11 items-center justify-center rounded-sm border border-primary/60 bg-primary/10 text-primary">
                    <t.icon className="size-5" />
                  </span>
                  <RankBadge rank={t.rank} />
                </div>
                <h3 className="text-xl font-bold uppercase tracking-wide">{t.name}</h3>
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <span
                  className={cn(
                    "mt-auto font-mono text-[11px] uppercase tracking-widest",
                    t.status === "ativo" ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {t.status === "ativo" ? "● Liberada" : "○ Chegando em breve"}
                </span>
              </div>
            </SystemWindow>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section
        id="como-funciona"
        className="scroll-mt-20 border-y border-primary/10 bg-background/40"
      >
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="sys-label mb-3">[ Missão ] Como começar</p>
          <h2 className="mb-8 text-3xl font-bold uppercase md:text-4xl">
            Três passos e você já está jogando
          </h2>
          <div className="grid items-center gap-10 md:grid-cols-[1fr_minmax(0,24rem)]">
            <div className="grid gap-6">
              {[
                {
                  n: "01",
                  t: "Escolha seu rank",
                  d: "Mensal ou vitalício. O acesso chega na hora.",
                },
                {
                  n: "02",
                  t: "Instale no aparelho",
                  d: "Um toque em “Instalar o app”, no PC ou no celular. Sem loja.",
                },
                {
                  n: "03",
                  t: "Use as habilidades",
                  d: "Edite, limpe, clone, minere e agende de um lugar só.",
                },
              ].map((s) => (
                <div key={s.n} className="flex gap-4">
                  <span className="sys-glow-text font-display text-5xl font-bold leading-none">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold uppercase">{s.t}</h3>
                    <p className="text-sm text-muted-foreground">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <StatusWindow />
          </div>
        </div>
      </section>

      {/* Card do plano vitalício */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <HeroCard
          theme="dourado"
          rank="S"
          kicker="Plano vitalício"
          title="Monarca Vitalício"
          subtitle="pagamento único"
          art={ARTE.heroi2}
          navTitle="Inclui"
          nav={[
            { label: "Todas as habilidades", href: "#planos" },
            { label: "Novas ferramentas", href: "#planos" },
            { label: "Sem mensalidade", href: "#planos" },
            { label: "Suporte prioritário", href: "#planos" },
          ]}
        >
          <p className="max-w-md">
            Pague uma vez e use para sempre, no PC e no celular. Toda habilidade nova que for
            liberada chega para você sem custo extra.
          </p>
          <Button asChild size="lg" className="uppercase tracking-wider">
            <a href="#planos">
              Quero ser Monarca <ArrowRight className="size-4" />
            </a>
          </Button>
        </HeroCard>
      </section>

      {/* Planos */}
      <section id="planos" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-20">
        <p className="sys-label mb-3 text-center">[ Evolução ] Escolha o seu rank</p>
        <h2 className="mb-10 text-center text-3xl font-bold uppercase md:text-4xl">
          Quanto custa subir de nível
        </h2>
        <PlanCards />
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" /> 7 dias de garantia incondicional
        </p>
      </section>

      {/* Dúvidas */}
      <section id="duvidas" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-20">
        <p className="sys-label mb-3">[ Registro ] Dúvidas frequentes</p>
        <h2 className="mb-6 text-3xl font-bold uppercase">Perguntas</h2>
        <SystemWindow muted>
          <Accordion type="single" collapsible className="px-5">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`} className="border-primary/15">
                <AccordionTrigger className="text-left font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SystemWindow>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-4xl px-4 pb-20">
        <SystemWindow title="Missão de emergência" scan>
          <div className="space-y-5 p-6 text-center md:p-10">
            <p className="text-2xl font-bold uppercase md:text-4xl">
              Aceitar a missão e <span className="sys-glow-text">subir de nível</span>?
            </p>
            <p className="text-muted-foreground">
              Recompensa: mais conteúdo, menos horas de trabalho e mais clientes.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="uppercase tracking-wider">
                <a href="#planos">
                  <Zap className="size-4" /> Aceitar
                </a>
              </Button>
              <Button asChild size="lg" variant="secondary" className="uppercase tracking-wider">
                <Link to="/painel">Testar o app</Link>
              </Button>
            </div>
          </div>
        </SystemWindow>
      </section>

      <footer className="border-t border-primary/10 py-8 text-center font-mono text-xs text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME}. Todos os direitos reservados.
      </footer>
    </div>
  );
}

/** Janela de status estilo "Sistema" mostrada ao lado do título. */
function StatusWindow() {
  return (
    <SystemWindow title="Status" scan className="sys-pop [animation-delay:150ms]">
      <div className="space-y-5 p-5 font-mono text-sm">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <Row k="Nome" v="Você" />
          <Row k="Nível" v="1 → 99" glow />
          <Row k="Classe" v="Criador" />
          <Row k="Título" v="Fábrica" />
        </div>
        <div className="space-y-2">
          <p className="sys-label text-[10px]">Habilidades</p>
          {TOOLS.slice(0, 4).map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <t.icon className="size-3.5 text-primary" />
              <span className="flex-1 truncate">{t.name}</span>
              <RankBadge rank={t.rank} className="size-5 text-[11px]" />
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-sm border border-primary/25 bg-background/40 p-3">
          <p className="flex items-center gap-1.5 text-xs text-primary">
            <Sparkles className="sys-pulse size-3.5" /> Missão diária
          </p>
          <Quest label="Postar 3 Reels" value={2} max={3} />
          <Quest label="Limpar metadados" value={10} max={10} />
          <Quest label="Chamar 5 clientes" value={1} max={5} />
        </div>
      </div>
    </SystemWindow>
  );
}

function Row({ k, v, glow }: { k: string; v: string; glow?: boolean }) {
  return (
    <div className="flex justify-between gap-2 border-b border-primary/10 pb-1 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn(glow && "sys-glow-text font-semibold")}>{v}</span>
    </div>
  );
}

function Quest({ label, value, max }: { label: string; value: number; max: number }) {
  const done = value >= max;
  return (
    <div className="text-xs">
      <div className="mb-1 flex justify-between">
        <span className={cn(done && "text-success")}>{label}</span>
        <span className={done ? "text-success" : "text-muted-foreground"}>
          [{value}/{max}]
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-primary/10">
        <div
          className={cn("h-full rounded-full", done ? "bg-success" : "bg-primary")}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
    </div>
  );
}
