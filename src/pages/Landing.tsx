import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  Clock3,
  Frame,
  PenTool,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { SiteFooter, SiteHeader } from "../components/Layout";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { FERRAMENTAS } from "../lib/tools";
import { cn } from "../lib/utils";

const TICKER = [
  "Limpador de Metadados",
  "Clonador de Sites",
  "Editor em Massa",
  "Minerador Viral",
  "Minerador de Clientes",
  "Agendador",
  "Legendas e Hashtags",
  "Gerador de Propostas",
];

const PASSOS = [
  {
    n: "01",
    titulo: "Crie sua conta grátis",
    texto: "Leva menos de 1 minuto. Sem cartão, sem enrolação.",
  },
  {
    n: "02",
    titulo: "Escolha a ferramenta",
    texto: "8 ferramentas profissionais num painel só, tudo em português.",
  },
  {
    n: "03",
    titulo: "Produza e publique",
    texto: "Limpe, edite, clone, agende e venda — direto do navegador.",
  },
];

const PLANOS = [
  {
    nome: "Básico",
    preco: "R$ 25",
    periodo: "/mês",
    destaque: false,
    selo: null,
    cta: "Assinar o Básico",
    itens: [
      "Limpador de Metadados",
      "Clonador de Sites",
      "Legendas e Hashtags",
      "Gerador de Propostas",
      "Uso pessoal",
    ],
  },
  {
    nome: "Pro",
    preco: "R$ 50",
    periodo: "/mês",
    destaque: true,
    selo: "MAIS POPULAR",
    cta: "Assinar o Pro",
    itens: [
      "Todas as ferramentas, exceto o Agendador",
      "Editor em Massa ilimitado",
      "Minerador Viral e de Clientes",
    ],
  },
  {
    nome: "Elite",
    preco: "R$ 100",
    periodo: "/mês",
    destaque: false,
    selo: null,
    cta: "Assinar o Elite",
    itens: [
      "Tudo do Pro",
      "Agendador de posts",
      "Suporte prioritário",
      "Acesso antecipado a novidades",
      "Sessão de onboarding 1:1",
      "Grupo fechado de criadores",
    ],
  },
  {
    nome: "Gold",
    preco: "R$ 500",
    periodo: "pagamento único",
    destaque: false,
    selo: "OFERTA GOLD",
    cta: "Quero a oferta Gold",
    itens: [
      "Tudo do Elite",
      "Figma Pro Education",
      "Gemini IA — 18 meses",
      "Framer Pro — 12 meses",
    ],
  },
];

const DEPOIMENTOS = [
  {
    foto: "/depoimentos/camila.jpg",
    nome: "Camila R.",
    profissao: "Social media",
    texto:
      "Eu gastava horas criando legenda e pesquisando hashtag. Agora monto o calendário do mês inteiro numa tarde. O minerador viral virou meu ponto de partida para todo conteúdo.",
  },
  {
    foto: "/depoimentos/diego.jpg",
    nome: "Diego M.",
    profissao: "Videomaker",
    texto:
      "O editor em massa salvou minha semana: edito um corte e aplico em 30 vídeos de uma vez. E o limpador de metadados me livra de dor de cabeça com cliente exigente.",
  },
  {
    foto: "/depoimentos/fernanda.jpg",
    nome: "Fernanda L.",
    profissao: "Dona de loja",
    texto:
      "Nunca tinha feito uma proposta profissional na vida. Com o gerador, mandei 10 propostas em dois dias e fechei 3 clientes para fazer os sites deles.",
  },
  {
    foto: "/depoimentos/thiago.jpg",
    nome: "Thiago S.",
    profissao: "Criador de conteúdo",
    texto:
      "O agendador sozinho já vale a assinatura. Programo a semana toda no domingo e esqueço. Meu alcance subiu porque parei de falhar dia.",
  },
  {
    foto: "/depoimentos/rafael.jpg",
    nome: "Rafael T.",
    profissao: "Gestor de tráfego",
    texto:
      "O minerador de clientes me entrega uma lista pronta de lojas que precisam de site. Junto com o gerador de propostas, virei uma máquina de fechar contrato.",
  },
  {
    foto: "/depoimentos/juliana.jpg",
    nome: "Juliana P.",
    profissao: "Criadora de conteúdo",
    texto:
      "As legendas prontas por nicho economizam meu tempo todo dia, e as hashtags realmente funcionam. Meu engajamento dobrou em dois meses.",
  },
  {
    foto: "/depoimentos/marcos.jpg",
    nome: "Marcos V.",
    profissao: "Fotógrafo",
    texto:
      "Entrego as fotos para os clientes já sem metadados, direto pelo limpador. Profissional demais — e o clonador me ajuda a montar portfólio rapidinho.",
  },
  {
    foto: "/depoimentos/beatriz.jpg",
    nome: "Beatriz A.",
    profissao: "Empreendedora digital",
    texto:
      "Uso o minerador viral para garimpar ideias e o agendador para manter constância. Saí de 2 mil para 25 mil seguidores sem comprar nada.",
  },
];

const ARSENAL = [
  {
    nome: "Figma Pro Education",
    duracao: "Education",
    descricao: "Design e prototipagem profissional para criar interfaces e criativos de alto nível.",
    icone: PenTool,
  },
  {
    nome: "Gemini IA",
    duracao: "18 meses",
    descricao: "Inteligência artificial avançada para textos, ideias e automação do seu conteúdo.",
    icone: Sparkles,
  },
  {
    nome: "Framer Pro",
    duracao: "12 meses",
    descricao: "Sites e interações em código, com animações premium e publicação instantânea.",
    icone: Frame,
  },
];

const FAQS = [
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. Tudo roda no navegador: você envia os arquivos, processa e baixa o resultado. Nada sai do seu computador sem você mandar.",
  },
  {
    q: "Meus arquivos são enviados para algum servidor?",
    a: "Não. O processamento é 100% local, no seu navegador. Fotos, vídeos e sites clonados nunca passam pelos nossos servidores.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Não tem fidelidade nem multa. Você cancela em dois cliques e mantém o acesso até o fim do ciclo.",
  },
  {
    q: "O Clonador de Sites é legal?",
    a: "Ele foi feito para clonar com autorização do dono — por exemplo, refazer o site de um cliente que perdeu o acesso. Sempre tenha permissão antes de copiar qualquer site.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. O painel é responsivo e funciona bem no celular e no computador.",
  },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-surface1">
      <button
        onClick={() => setAberto(!aberto)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer"
      >
        <span className="font-semibold text-tprimary">{q}</span>
        <ChevronDown
          className={cn("size-5 shrink-0 text-lime transition-transform", aberto && "rotate-180")}
        />
      </button>
      {aberto && <p className="px-6 pb-6 text-sm leading-relaxed text-tsecondary">{a}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg text-tprimary">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <AnimatedBackground />
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-24 text-center md:pt-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 text-sm text-lime">
            <Sparkles className="size-4" /> 8 ferramentas profissionais para criadores
          </div>
          <h1
            className="mx-auto max-w-4xl font-semibold tracking-tight"
            style={{ fontSize: "clamp(40px, 7vw, 68px)", letterSpacing: "-0.04em", lineHeight: 1.05 }}
          >
            Produza conteúdo como um <span className="text-lime">estúdio</span>, sozinho.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-tsecondary">
            Limpe metadados, clone sites, edite vídeos em massa, ache clientes e agende posts —
            tudo num painel só, direto do navegador.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/entrar"
              className="inline-flex items-center gap-2 rounded-xl bg-lime px-8 py-4 font-semibold text-black hover:brightness-110 hover:shadow-[0_0_32px_rgba(200,245,60,0.4)] transition-all"
            >
              Começar agora <ArrowRight className="size-5" />
            </Link>
            <a
              href="#precos"
              className="rounded-xl border border-border px-8 py-4 font-semibold text-tprimary hover:border-lime transition-colors"
            >
              Ver planos
            </a>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-tmuted">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-lime" /> 100% no navegador
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-4 text-lime" /> Sem instalação
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-4 text-lime" /> Cancele quando quiser
            </span>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="overflow-hidden border-y border-border bg-surface1 py-4">
        <div className="flex w-max animate-[ticker_30s_linear_infinite] gap-10">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-2 whitespace-nowrap text-sm text-tsecondary">
              <BadgeCheck className="size-4 text-lime" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-center font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
          Do zero ao publicado em <span className="text-lime">3 passos</span>
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PASSOS.map((p) => (
            <div key={p.n} className="rounded-2xl border border-border bg-surface1 p-8">
              <p className="text-4xl font-bold text-lime/40">{p.n}</p>
              <h3 className="mt-4 text-xl font-semibold">{p.titulo}</h3>
              <p className="mt-2 text-tsecondary">{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FERRAMENTAS */}
      <section id="ferramentas" className="border-y border-border bg-surface1/50">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <h2 className="text-center font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
            Um arsenal <span className="text-lime">completo</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-tsecondary">
            Cada ferramenta resolve um gargalo real de quem cria conteúdo ou vende serviços digitais.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FERRAMENTAS.map((f) => (
              <div
                key={f.id}
                className="group overflow-hidden rounded-2xl border border-border bg-surface1 transition-all hover:border-lime/50"
              >
                <div className="aspect-video overflow-hidden bg-surface2">
                  <img
                    src={f.imagem}
                    alt={f.nome}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <f.icone className="size-5 text-lime" />
                    <h3 className="font-semibold">{f.nome}</h3>
                  </div>
                  <p className="mt-2 text-sm text-tsecondary">{f.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ARSENAL GOLD */}
      <section id="arsenal" className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <h2 className="text-center font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
            Arsenal <span className="text-lime">Gold</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-tsecondary">
            As IAs e ferramentas pro que todo criador precisa — incluídas no plano Gold.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {ARSENAL.map((a) => (
              <div
                key={a.nome}
                className="group overflow-hidden rounded-2xl border border-border bg-surface1 transition-all hover:border-lime/50"
              >
                <div className="flex h-44 items-center justify-center bg-gradient-to-br from-surface2 to-bg">
                  <a.icone className="size-20 text-lime transition-transform group-hover:scale-110" strokeWidth={1.5} />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">{a.nome}</h3>
                    <span className="rounded-full bg-lime/10 px-3 py-1 text-xs font-semibold text-lime">
                      {a.duracao}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-tsecondary">{a.descricao}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <a
              href="#precos"
              className="inline-flex items-center gap-2 rounded-xl bg-lime px-8 py-4 font-semibold text-black transition-all hover:brightness-110 hover:shadow-[0_0_32px_rgba(200,245,60,0.4)]"
            >
              Quero o Arsenal Gold <ArrowRight className="size-5" />
            </a>
          </div>
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-center font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
          Preço que <span className="text-lime">se paga</span> no primeiro cliente
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANOS.map((p) => (
            <div
              key={p.nome}
              className={cn(
                "relative rounded-2xl border p-8",
                p.destaque
                  ? "border-lime bg-surface1 shadow-[0_0_40px_rgba(200,245,60,0.12)]"
                  : "border-border bg-surface1",
              )}
            >
              {p.selo && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-lime px-4 py-1 text-xs font-bold text-black">
                  {p.selo}
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.nome}</h3>
              <p className="mt-4">
                <span className="text-4xl font-bold">{p.preco}</span>
                <span className="text-tmuted">{p.periodo}</span>
              </p>
              <ul className="mt-6 space-y-3">
                {p.itens.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-tsecondary">
                    <Check className="mt-0.5 size-4 shrink-0 text-lime" /> {it}
                  </li>
                ))}
              </ul>
              <Link
                to="/entrar"
                className={cn(
                  "mt-8 block rounded-xl py-3 text-center font-semibold transition-all",
                  p.destaque
                    ? "bg-lime text-black hover:brightness-110"
                    : "border border-border text-tprimary hover:border-lime",
                )}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <h2 className="text-center font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
            Quem usa, <span className="text-lime">recomenda</span>
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {DEPOIMENTOS.map((d) => (
              <div key={d.nome} className="rounded-2xl border border-border bg-surface1 p-6">
                <div className="flex items-center gap-4">
                  <img
                    src={d.foto}
                    alt={d.nome}
                    className="size-14 rounded-full border border-border object-cover"
                  />
                  <div>
                    <h3 className="font-semibold">{d.nome}</h3>
                    <p className="text-sm text-tmuted">{d.profissao}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-tsecondary">"{d.texto}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="text-center font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
          Perguntas <span className="text-lime">frequentes</span>
        </h2>
        <div className="mt-10 space-y-4">
          {FAQS.map((f) => (
            <Faq key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
            Pronto para produzir como <span className="text-lime">profissional</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-tsecondary">
            Junte-se a criadores que economizam horas toda semana com o painel da NK Software.
          </p>
          <Link
            to="/entrar"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-lime px-8 py-4 font-semibold text-black hover:brightness-110 hover:shadow-[0_0_32px_rgba(200,245,60,0.4)] transition-all"
          >
            Criar conta grátis <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>

      <SiteFooter />
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
