import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, type CSSProperties } from "react";

import { useAuth } from "@/lib/auth";
import { useAppConfig } from "@/lib/config";

import ariseCss from "./arise.css?url";

// Página de vendas no estilo do site do Solo Leveling: ARISE OVERDRIVE (prévia visual).
// Estilos em ./arise.css (tudo dentro de .arise); artes, vídeos e fontes em public/sl/.
// No head(): a home herda title/description/og de __root.tsx; aqui só entra o CSS.
export const Route = createFileRoute("/")({
  head: () => ({ links: [{ rel: "stylesheet", href: ariseCss }] }),
  component: Vendas,
});

const AMEACAS = [
  {
    t: "Horas editando um por um",
    d: "Cortar, legendar e exportar vídeo por vídeo come o seu dia inteiro.",
  },
  {
    t: "Uma assinatura para cada coisa",
    d: "Editor, agendador, limpador, buscador de clientes… cada um cobra o seu.",
  },
  {
    t: "Cliente não cai do céu",
    d: "Achar lojas que precisam de site e montar a proposta toma tempo.",
  },
];

type Hab = { nome: string; desc: string; status: string; breve?: boolean };
const GRUPOS: { n: string; titulo: string; arte: string; lado: "dir" | "esq"; habs: Hab[] }[] = [
  {
    n: "1",
    titulo: "Crie em escala",
    arte: "/sl/img/174bf20366ef.png",
    lado: "dir",
    habs: [
      {
        nome: "Editor em Massa",
        desc: "Edite um vídeo e aplique a mesma edição em todos de uma vez.",
        status: "○ Em breve",
        breve: true,
      },
      {
        nome: "Agendador",
        desc: "Agende Reels, Stories e posts. Publica mesmo com o aparelho desligado.",
        status: "○ Em breve",
        breve: true,
      },
    ],
  },
  {
    n: "2",
    titulo: "Venda sites e ache clientes",
    arte: "/sl/img/9d21bbe85e09.png",
    lado: "esq",
    habs: [
      {
        nome: "Clonador de Sites",
        desc: "Copie um site (com autorização do dono), edite os textos e baixe para o cliente.",
        status: "● Rank A",
      },
      {
        nome: "Minerador de Clientes",
        desc: "Encontre lojas da sua cidade que precisam de site e organize seus leads.",
        status: "○ Em breve",
        breve: true,
      },
    ],
  },
  {
    n: "3",
    titulo: "Proteja e descubra",
    arte: "/sl/img/453f3448ef57.png",
    lado: "dir",
    habs: [
      {
        nome: "Limpador de Metadados",
        desc: "Remove localização, aparelho e datas das suas fotos e vídeos, sem upload.",
        status: "● Rank C",
      },
      {
        nome: "Minerador Viral",
        desc: "Encontre os vídeos que mais estouram num perfil ou nicho e use como referência.",
        status: "○ Em breve",
        breve: true,
      },
    ],
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

/** Link do checkout com o e-mail da conta (a Kiwify preenche o campo). */
function linkCheckout(base: string, email: string | undefined) {
  if (!base) return "#planos";
  if (!email || !/^https?:\/\//.test(base)) return base;
  try {
    const u = new URL(base);
    u.searchParams.set("email", email);
    return u.toString();
  } catch {
    return base;
  }
}

function Vendas() {
  const cfg = useAppConfig();
  const { user } = useAuth();
  const raiz = useRef<HTMLDivElement>(null);
  const portal = useRef<HTMLDivElement>(null);
  const monarca = useRef<HTMLDivElement>(null);

  // revela os blocos ao rolar + parallax do portal e do Monarca
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("mostrar");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.18 },
    );
    el.querySelectorAll(".rv").forEach((n) => io.observe(n));
    let pend = false;
    const aoRolar = () => {
      if (pend) return;
      pend = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (portal.current)
          portal.current.style.transform = `translateY(${y * 0.35}px) scale(${1 + y / 5000})`;
        const m = monarca.current;
        if (m?.parentElement && innerWidth > 860) {
          const r = m.parentElement.getBoundingClientRect();
          const d = Math.max(-90, Math.min(90, (r.top + r.height / 2 - innerHeight / 2) * -0.12));
          m.style.transform = `translateY(${d}px) scale(1.15)`;
        }
        pend = false;
      });
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    aoRolar();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", aoRolar);
    };
  }, []);

  return (
    <div className="arise" ref={raiz}>
      <header>
        <a className="logo" href="#">
          Fábrica de
          <br />
          Conteúdo<small>Sistema</small>
        </a>
        <nav>
          <a href="#habilidades">Habilidades</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>
        <Link className="btn sec" to="/painel">
          Entrar no app
        </Link>
      </header>

      <section className="hero">
        <div className="bg" ref={portal} />
        <video src="/sl/vid/40c7f4fd9e0e.mp4" autoPlay muted loop playsInline />
        <div className="conteudo">
          <p className="label">[ Sistema ] Um novo jogador foi detectado</p>
          <h1 className="disp glow">
            Fábrica de<span>Conteúdo</span>
          </h1>
          <p>
            Edite vídeos em massa, limpe metadados, clone sites, encontre clientes e agende seus
            posts. Seis ferramentas num app só, que se adapta ao seu aparelho.
          </p>
          <div className="ctas">
            <a className="btn" href="#planos">
              Despertar agora →
            </a>
            <a className="btn sec" href="#habilidades">
              Ver habilidades
            </a>
          </div>
          <div className="selos">
            <span>
              <b>◆</b> PC e celular
            </span>
            <span>
              <b>◆</b> 7 dias de garantia
            </span>
            <span>
              <b>◆</b> Sem loja de apps
            </span>
          </div>
        </div>
        <div className="seta">ROLE ▼</div>
      </section>

      <div className="barra" />

      <section className="ameacas">
        <div className="wrap">
          <p className="label rv">[ Alerta ] Ameaças detectadas</p>
          <h2 className="disp rv">
            Você está perdendo tempo
            <br />e dinheiro em três frentes
          </h2>
          <div className="grade3">
            {AMEACAS.map((a, i) => (
              <div key={a.t} className="janela rv" style={{ transitionDelay: `${i * 0.12}s` }}>
                <div className="ico">⚠ AMEAÇA 0{i + 1}</div>
                <h3>{a.t}</h3>
                <p>{a.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overview" id="habilidades">
        <div className="wrap">
          <p className="label rv">[ Habilidades ] 2 liberadas · mais chegando</p>
          <h2 className="titulo disp rv">
            Seu<span>Arsenal</span>
          </h2>
          {GRUPOS.map((g) => (
            <div key={g.n} className={g.lado === "esq" ? "linha inv" : "linha"}>
              <div className="texto rv">
                <div className="emblema">
                  <b>{g.n}</b>
                </div>
                <h3>{g.titulo}</h3>
                <div className="hab">
                  {g.habs.map((h) => (
                    <div key={h.nome}>
                      <b>
                        {h.nome} <i className={h.breve ? "breve" : undefined}>{h.status}</i>
                      </b>
                      <span>{h.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`arte rv ${g.lado}`}>
                <img src={g.arte} alt="" loading="lazy" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="barra" />

      <section className="missao" id="como-funciona">
        <div className="wrap">
          <div>
            <p className="label rv">[ Missão ] Como começar</p>
            <h2 className="disp rv">
              Três passos e você
              <br />
              já está jogando
            </h2>
            {[
              ["01", "Escolha seu rank", "Mensal ou vitalício. O acesso chega na hora."],
              [
                "02",
                "Instale no aparelho",
                "Um toque em “Instalar o app”, no PC ou no celular. Sem loja.",
              ],
              ["03", "Use as habilidades", "Edite, limpe, clone, minere e agende de um lugar só."],
            ].map(([n, t, d]) => (
              <div key={n} className="passo rv">
                <span className="n disp glow">{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="status rv dir">
            <p className="t">STATUS</p>
            <div className="lin">
              <span>Nome</span>
              <span>Você</span>
            </div>
            <div className="lin">
              <span>Nível</span>
              <span className="glow">1 → 99</span>
            </div>
            <div className="lin">
              <span>Classe</span>
              <span>Criador</span>
            </div>
            <div className="lin" style={{ marginBottom: 18 }}>
              <span>Título</span>
              <span>Fábrica</span>
            </div>
            <p className="label" style={{ margin: "0 0 12px" }}>
              ✦ Missão diária
            </p>
            <Quest label="Postar 3 Reels" v="2/3" pct="66%" />
            <Quest label="Limpar metadados" v="10/10" pct="100%" ok />
            <Quest label="Chamar 5 clientes" v="1/5" pct="20%" />
          </div>
        </div>
      </section>

      <section className="monarca">
        <div className="fundo" ref={monarca} />
        <div className="wrap">
          <div className="caixa">
            <p className="label rv">[ Rank S ] Plano vitalício</p>
            <h2 className="disp rv">
              Monarca
              <br />
              <span>Vitalício</span>
            </h2>
            <p className="rv">
              Pague uma vez e use para sempre, no PC e no celular. Toda habilidade nova que for
              liberada chega para você sem custo extra.
            </p>
            <ul className="rv">
              <li>Todas as habilidades</li>
              <li>Novas ferramentas sem custo</li>
              <li>Sem mensalidade</li>
              <li>Suporte prioritário</li>
            </ul>
            <a className="btn ouro rv" href="#planos">
              Quero ser Monarca →
            </a>
          </div>
        </div>
      </section>

      <section className="planos" id="planos">
        <div className="wrap">
          <p className="label rv" style={{ textAlign: "center" }}>
            [ Evolução ] Escolha o seu rank
          </p>
          <h2 className="disp rv">Quanto custa subir de nível</h2>
          <div className="grade2">
            <div className="plano rv esq">
              <div className="rank">A</div>
              <p className="label" style={{ margin: "0 0 6px" }}>
                Rank A
              </p>
              <h3>Caçador Mensal</h3>
              <div className="preco">
                {cfg.preco_mensal} <small>/mês</small>
              </div>
              <ul>
                <li>Todas as habilidades liberadas</li>
                <li>Novas ferramentas sem custo extra</li>
                <li>Agendador com publicação na nuvem</li>
                <li>Cancele quando quiser</li>
              </ul>
              <a className="btn sec" href={linkCheckout(cfg.checkout_mensal, user?.email)}>
                Quero o Caçador Mensal
              </a>
            </div>
            <div className="plano top rv dir">
              <span className="selo">MAIS VANTAJOSO</span>
              <div className="rank">S</div>
              <p className="label" style={{ margin: "0 0 6px", color: "var(--ouro)" }}>
                Rank S
              </p>
              <h3>Monarca Vitalício</h3>
              <div className="preco">
                {cfg.preco_vitalicio} <small>pagamento único</small>
              </div>
              <ul>
                <li>Tudo do plano mensal, para sempre</li>
                <li>Sem mensalidade</li>
                <li>Acesso antecipado às novidades</li>
                <li>Suporte prioritário</li>
              </ul>
              <a className="btn ouro" href={linkCheckout(cfg.checkout_vitalicio, user?.email)}>
                Quero o Monarca Vitalício
              </a>
            </div>
          </div>
          <p className="garantia">◆ 7 dias de garantia incondicional</p>
        </div>
      </section>

      <section className="duvidas" id="duvidas">
        <div className="wrap">
          <p className="label rv" style={{ textAlign: "center" }}>
            [ Registro ] Dúvidas frequentes
          </p>
          <h2 className="disp rv" style={{ textAlign: "center" }}>
            Perguntas
          </h2>
          <div className="faq rv">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="final">
        <div className="fundo" />
        <div className="wrap">
          <p className="label rv">[ Missão de emergência ]</p>
          <h2 className="disp glow rv">
            Aceitar a missão
            <br />e subir de nível?
          </h2>
          <p className="rv" style={{ color: "#cfdaf2", margin: "-20px 0 30px" }}>
            Recompensa: mais conteúdo, menos horas de trabalho e mais clientes.
          </p>
          <div
            className="rv"
            style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}
          >
            <a className="btn" href="#planos">
              ⚡ Aceitar
            </a>
            <Link className="btn sec" to="/painel">
              Testar o app
            </Link>
          </div>
        </div>
      </section>

      <footer>
        © {new Date().getFullYear()} Fábrica de Conteúdo. Todos os direitos reservados.
      </footer>
    </div>
  );
}

function Quest({ label, v, pct, ok }: { label: string; v: string; pct: string; ok?: boolean }) {
  return (
    <>
      <div className={ok ? "lin ok" : "lin"} style={{ border: 0 }}>
        <span className={ok ? "ok" : undefined}>{label}</span>
        <span>[{v}]</span>
      </div>
      <div className="barrinha">
        <i style={{ "--v": pct, ...(ok ? { background: "#5ef0a5" } : {}) } as CSSProperties} />
      </div>
    </>
  );
}
