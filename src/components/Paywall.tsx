import { Link } from "react-router-dom";
import { Crown, Lock } from "lucide-react";
import { Button, Card } from "./ui";

export default function Paywall({ ferramenta }: { ferramenta: string }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20">
      <Card className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-lime/15">
          <Lock className="size-8 text-lime" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">Ferramenta Pro</h2>
        <p className="mt-2 text-tsecondary">
          <strong className="text-tprimary">{ferramenta}</strong> faz parte do plano Pro. Assine
          para desbloquear as 8 ferramentas.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link to="/checkout">
            <Button className="w-full">
              <Crown className="size-4" /> Assinar o Pro — R$ 47/mês
            </Button>
          </Link>
          <Link to="/app">
            <Button variant="ghost" className="w-full">
              Voltar ao painel
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
