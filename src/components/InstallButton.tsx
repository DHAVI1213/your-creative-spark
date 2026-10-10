import { useState } from "react";
import { Download, MonitorSmartphone, Share, SquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDevice } from "@/lib/device";
import { useInstallPrompt } from "@/lib/pwa";
import { APP_NAME } from "@/lib/app";

export function InstallButton({ compact = false }: { compact?: boolean }) {
  const device = useDevice();
  const { canInstall, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);

  if (!device.ready || device.installed) return null;

  const onClick = async () => {
    if (canInstall) {
      await install();
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <Button
        onClick={onClick}
        size={compact ? "sm" : "default"}
        variant={compact ? "secondary" : "default"}
        className={compact ? "gap-1.5" : "w-full gap-2"}
      >
        <Download className="size-4" />
        {compact ? "Instalar" : "Instalar o app"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instalar o {APP_NAME}</DialogTitle>
            <DialogDescription>
              Ele vira um app com ícone próprio e abre em tela cheia, sem precisar de loja.
            </DialogDescription>
          </DialogHeader>
          <InstallSteps os={device.os} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {n}
      </span>
      <span className="text-sm leading-6">{children}</span>
    </li>
  );
}

function InstallSteps({ os }: { os: ReturnType<typeof useDevice>["os"] }) {
  if (os === "ios") {
    return (
      <ol className="space-y-3">
        <Step n={1}>
          Abra este site no <b>Safari</b>.
        </Step>
        <Step n={2}>
          Toque em <Share className="inline size-4 align-text-bottom" /> <b>Compartilhar</b>.
        </Step>
        <Step n={3}>
          Escolha <SquarePlus className="inline size-4 align-text-bottom" />{" "}
          <b>Adicionar à Tela de Início</b>.
        </Step>
      </ol>
    );
  }
  if (os === "android") {
    return (
      <ol className="space-y-3">
        <Step n={1}>
          Abra este site no <b>Chrome</b>.
        </Step>
        <Step n={2}>
          Toque no menu <b>⋮</b> no canto de cima.
        </Step>
        <Step n={3}>
          Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
        </Step>
      </ol>
    );
  }
  return (
    <ol className="space-y-3">
      <Step n={1}>
        Abra este site no <b>Chrome</b> ou no <b>Edge</b>.
      </Step>
      <Step n={2}>
        Clique no ícone <MonitorSmartphone className="inline size-4 align-text-bottom" /> na barra
        de endereço, ou no menu <b>⋮</b> → <b>Instalar {APP_NAME}</b>.
      </Step>
      <Step n={3}>O app aparece na área de trabalho e no menu Iniciar.</Step>
    </ol>
  );
}
