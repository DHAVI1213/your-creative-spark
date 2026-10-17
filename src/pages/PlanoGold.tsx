import { Link } from "react-router-dom";
import { Check, Crown, MessageCircle, Receipt, Send } from "lucide-react";
import { Button, Card } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useSiteSettings } from "../lib/site-settings";
import { temAcesso } from "../lib/planos";
import { ARSENAL, linkWhatsappGold } from "../lib/arsenal";
import { brl } from "../lib/utils";

/** Aba "Plano Gold": mostra as IAs do Arsenal Gold e, para quem é Gold, o botão do WhatsApp. */
export default function PlanoGold() {
  const { usuario } = useAuth();
  const settings = useSiteSettings();
  const gold = temAcesso(usuario, "gold");
  const plano = settings.plans.find((p) => p.id === "gold");
  const preco = brl((plano?.price_cents ?? 50000) / 100);
  const numero = settings.content.whatsapp_gold?.trim() ?? "";
  const whatsapp = numero ? linkWhatsappGold(numero, usuario?.nome ?? "", usuario?.email ?? "") : "";

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-lime">
            <Crown className="size-4" /> Plano Gold
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Arsenal Gold</h1>
          <p className="mt-1 text-tsecondary">As IAs e ferramentas pro que todo criador precisa, incluídas no plano Gold.</p>
        </div>
        {gold && <span className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-black">{usuario?.admin ? "Admin: acesso total" : "Você é Gold ✨"}</span>}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {ARSENAL.map((a) => (
          <div key={a.nome} className="overflow-hidden rounded-2xl border border-border bg-surface1">
            <div className="aspect-[4/3] overflow-hidden bg-surface2">
              <img src={a.imagem} alt={a.nome} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-semibold">{a.nome}</h3>
                <span className="shrink-0 rounded-full bg-lime/10 px-3 py-1 text-xs font-semibold text-lime">{a.duracao}</span>
              </div>
              <p className="mt-2 text-sm text-tsecondary">{a.descricao}</p>
            </div>
          </div>
        ))}
      </div>

      {gold ? (
        <Card className="mt-8 border-lime/40">
          <h2 className="text-xl font-bold">Libere seu Arsenal Gold</h2>
          <p className="mt-1 text-sm text-tsecondary">Os acessos são entregues pelo WhatsApp, direto com a gente.</p>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { icone: MessageCircle, titulo: "1. Abra o WhatsApp", texto: "Clique no botão abaixo. A mensagem já vai pronta com seu nome e e-mail." },
              { icone: Receipt, titulo: "2. Envie o comprovante", texto: "Mande junto o print ou PDF do comprovante de pagamento do plano Gold." },
              { icone: Check, titulo: "3. Receba os acessos", texto: "Conferimos o pagamento e enviamos o Figma, o Gemini e o Framer." },
            ].map((p) => (
              <li key={p.titulo} className="rounded-xl border border-border bg-surface2 p-4">
                <p.icone className="size-5 text-lime" />
                <p className="mt-2 text-sm font-semibold">{p.titulo}</p>
                <p className="mt-1 text-xs text-tsecondary">{p.texto}</p>
              </li>
            ))}
          </ol>
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noreferrer" className="mt-6 block">
              <Button className="w-full sm:w-auto">
                <Send className="size-4" /> Solicitar meu Arsenal Gold no WhatsApp
              </Button>
            </a>
          ) : (
            <p className="mt-6 rounded-xl bg-surface2 p-4 text-sm text-tsecondary">
              O WhatsApp de atendimento ainda não foi configurado. Tente novamente em alguns minutos.
            </p>
          )}
        </Card>
      ) : (
        <Card className="mt-8 text-center">
          <Crown className="mx-auto size-10 text-lime" />
          <h2 className="mt-3 text-xl font-bold">Disponível no plano Gold</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-tsecondary">
            O Gold traz tudo do Elite (todas as ferramentas, incluindo o Agendador) e mais o Arsenal Gold acima. Pagamento
            único de {preco}. Depois de assinar, volte aqui e clique no botão para liberar seus acessos pelo WhatsApp.
          </p>
          <Link to="/checkout?plano=gold" className="mt-5 inline-block">
            <Button>
              <Crown className="size-4" /> Assinar o Gold — {preco}
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
