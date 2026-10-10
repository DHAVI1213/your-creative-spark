import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Tool } from "@/lib/app";
import { RankBadge, SystemHeader, SystemWindow } from "./system/System";

export function ComingSoon({
  tool,
  bullets,
  deviceNote,
}: {
  tool: Tool;
  bullets: string[];
  deviceNote?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <SystemHeader
        label={`${tool.code} · ${tool.name}`}
        icon={tool.icon}
        title={tool.name}
        description={tool.description}
      />

      <SystemWindow title="Habilidade bloqueada" scan className="sys-pop">
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Lock className="sys-pulse size-5 text-primary" />
            <p className="text-sm">
              Esta habilidade será liberada numa próxima atualização do sistema.
            </p>
            <RankBadge rank={tool.rank} className="ml-auto" />
          </div>
          <div>
            <p className="sys-label mb-2">Efeitos da habilidade</p>
            <ul className="space-y-2">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-primary shadow-[0_0_6px_var(--color-primary)]" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SystemWindow>

      {deviceNote && (
        <SystemWindow muted>
          <p className="p-4 text-sm text-muted-foreground">{deviceNote}</p>
        </SystemWindow>
      )}

      <Button asChild variant="secondary">
        <Link to="/painel">
          <ArrowLeft className="size-4" /> Voltar ao painel
        </Link>
      </Button>
    </div>
  );
}
