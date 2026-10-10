import { useState } from "react";
import { Loader2, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { STATUS_LABEL, nomeDoPlano, useAuth } from "@/lib/auth";
import { PlanCards } from "./PlanCards";
import { SystemHeader, SystemWindow } from "./System";

/** Tela mostrada no lugar de uma ferramenta quando a conta não tem plano ativo. */
export function Paywall() {
  const { user, assinatura, atualizar } = useAuth();
  const [verificando, setVerificando] = useState(false);

  const verificar = async () => {
    setVerificando(true);
    await atualizar();
    setVerificando(false);
    toast.info("Verificamos de novo. Se a compra foi agora, pode levar 1 ou 2 minutos.");
  };

  const motivo = !assinatura
    ? "Esta habilidade é liberada para quem tem um plano ativo."
    : assinatura.status === "ativo" || assinatura.status === "atrasado"
      ? `Seu plano ${nomeDoPlano(assinatura.plano)} venceu. Renove para continuar.`
      : `Seu plano ${nomeDoPlano(assinatura.plano)} está como “${STATUS_LABEL[assinatura.status] ?? assinatura.status}”.`;

  return (
    <div className="space-y-8">
      <SystemHeader label="Acesso" icon={Lock} title="Habilidade selada" description={motivo} />

      <SystemWindow title="Já comprou?" muted>
        <div className="flex flex-col gap-3 p-4 text-sm md:flex-row md:items-center">
          <p className="flex-1 text-muted-foreground">
            O acesso é liberado sozinho quando a compra é feita com o mesmo e-mail desta conta
            {user?.email ? (
              <>
                : <b className="text-foreground">{user.email}</b>
              </>
            ) : null}
            . Se comprou com outro e-mail, fale com o suporte.
          </p>
          <Button variant="secondary" onClick={verificar} disabled={verificando}>
            {verificando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Verificar de novo
          </Button>
        </div>
      </SystemWindow>

      <PlanCards />
    </div>
  );
}
