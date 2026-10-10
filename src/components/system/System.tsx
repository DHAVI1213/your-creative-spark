import type { ReactNode } from "react";

import { RANK_COLOR, type Tool } from "@/lib/app";
import { cn } from "@/lib/utils";

/** Janela do "Sistema": painel com borda luminosa e cantos marcados. */
export function SystemWindow({
  title,
  children,
  className,
  muted = false,
  scan = false,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  muted?: boolean;
  scan?: boolean;
}) {
  return (
    <div
      className={cn(
        "sys-panel rounded-md",
        muted && "sys-panel-muted",
        scan && "sys-scan",
        className,
      )}
    >
      {title && (
        <div className="flex items-center justify-center gap-2 border-b border-primary/20 px-4 py-2">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-primary/50" />
          <span className="sys-label">{title}</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-primary/50" />
        </div>
      )}
      {children}
    </div>
  );
}

export function RankBadge({ rank, className }: { rank: Tool["rank"]; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-sm border font-display text-sm font-bold",
        RANK_COLOR[rank],
        className,
      )}
      title={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

/** Cabeçalho das telas do app. */
export function SystemHeader({
  label,
  title,
  description,
  icon: Icon,
}: {
  label: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <header className="space-y-2">
      <p className="sys-label flex items-center gap-2">
        {Icon && <Icon className="size-3.5" />}[ {label} ]
      </p>
      <h1 className="text-3xl font-bold uppercase tracking-wide md:text-4xl">{title}</h1>
      {description && (
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>
      )}
    </header>
  );
}
