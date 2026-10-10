import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Tool } from "@/lib/app";

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
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-primary">
          <tool.icon className="size-4" /> {tool.name}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{tool.description}</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> Chegando nas próximas atualizações
        </span>
      </header>

      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <p className="mb-3 text-sm font-medium">O que vem nessa ferramenta</p>
        <ul className="space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      {deviceNote && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm text-muted-foreground">
          {deviceNote}
        </div>
      )}

      <Button asChild variant="secondary">
        <Link to="/">
          <ArrowLeft className="size-4" /> Voltar ao painel
        </Link>
      </Button>
    </div>
  );
}
