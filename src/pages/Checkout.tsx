import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BadgeCheck, CreditCard, Lock } from "lucide-react";
import { useAuth, type PlanoPago } from "../lib/auth";
import { useSiteSettings } from "../lib/site-settings";
import { Button, Card, Input, Label } from "../components/ui";
import { SiteHeader } from "../components/Layout";
import { brl } from "../lib/utils";

/** Valores padrão — os preços reais vêm do painel admin (Configurações > Preços dos planos). */
const PLANOS: { id: PlanoPago; nome: string; preco: number; unico: boolean; desc: string }[] = [
  { id: "basico", nome: "Básico", preco: 25, unico: false, desc: "Limpador, Clonador, Legendas e Propostas." },
  { id: "pro", nome: "Pro", preco: 50, unico: false, desc: "Todas as ferramentas, exceto o Agendador." },
  { id: "elite", nome: "Elite", preco: 100, unico: false, desc: "Tudo do Pro + Agendador, suporte e onboarding 1:1." },
  { id: "gold", nome: "Gold", preco: 500, unico: true, desc: "Tudo do Elite + Figma, Gemini e Framer." },
];

export default function Checkout() {
  const { usuario, assinar } = useAuth();
  const nav = useNavigate();
  const settings = useSiteSettings();
  const [params] = useSearchParams();
  const planos = PLANOS.map((x) => {
    const salvo = settings.plans.find((p) => p.id === x.id);
    return salvo ? { ...x, nome: salvo.name, preco: salvo.price_cents / 100, unico: !salvo.recurring } : x;
  });
  const inicial = planos.find((x) => x.id === params.get("plano"))?.id ?? "pro";
  const [plano, setPlano] = useState<PlanoPago>(inicial);
  const [nome, setNome] = useState("");
  const [cartao, setCartao] = useState("");
  const [ok, setOk] = useState(false);

  if (!usuario) {
    return (
      <div className="min-h-screen bg-bg">
        <SiteHeader />
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          <p className="text-tsecondary">Você precisa de uma conta para assinar.</p>
          <Link to="/entrar" className="mt-4 inline-block rounded-xl bg-lime px-6 py-3 font-semibold text-black">
            Criar conta grátis
          </Link>
        </div>
      </div>
    );
  }

  const p = planos.find((x) => x.id === plano)!;

  const pagar = (e: React.FormEvent) => {
    e.preventDefault();
    setOk(true);
    setTimeout(() => {
      assinar(plano);
      nav("/app");
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Checkout simulado</h1>
        <p className="mt-2 text-tsecondary">
          Ambiente de demonstração — nenhum valor é cobrado de verdade.
        </p>

        {ok ? (
          <Card className="mt-8 text-center">
            <BadgeCheck className="mx-auto size-14 text-lime" />
            <h2 className="mt-4 text-xl font-bold">Pagamento aprovado!</h2>
            <p className="mt-2 text-tsecondary">Ativando seu plano {p.nome}...</p>
          </Card>
        ) : (
          <div className="mt-8 grid gap-6">
            <div className="grid grid-cols-2 gap-4">
              {planos.map((x) => (
                <button
                  key={x.id}
                  onClick={() => setPlano(x.id)}
                  className={`rounded-2xl border p-5 text-left cursor-pointer transition-all ${
                    plano === x.id ? "border-lime bg-lime/5" : "border-border bg-surface1"
                  }`}
                >
                  <p className="font-bold">{x.nome}</p>
                  <p className="mt-1 text-2xl font-bold text-lime">{brl(x.preco)}<span className="text-sm text-tmuted">{x.unico ? " único" : "/mês"}</span></p>
                  <p className="mt-2 text-xs text-tsecondary">{x.desc}</p>
                </button>
              ))}
            </div>
            <Card>
              <form onSubmit={pagar} className="space-y-4">
                <div>
                  <Label>Nome no cartão</Label>
                  <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como está no cartão" />
                </div>
                <div>
                  <Label>Número do cartão</Label>
                  <Input
                    required
                    inputMode="numeric"
                    value={cartao}
                    onChange={(e) => setCartao(e.target.value.replace(/\D/g, "").slice(0, 16))}
                    placeholder="0000 0000 0000 0000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Validade</Label>
                    <Input required placeholder="MM/AA" />
                  </div>
                  <div>
                    <Label>CVV</Label>
                    <Input required inputMode="numeric" placeholder="123" />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  <Lock className="size-4" /> Pagar {brl(p.preco)} (simulação)
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-tmuted">
                  <CreditCard className="size-3.5" /> Demonstração — use qualquer número fictício.
                </p>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
