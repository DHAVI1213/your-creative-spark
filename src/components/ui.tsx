import { useState, type ReactNode } from "react";
import { cn } from "../lib/utils";

export function Button({
  children,
  variant = "primary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "dark";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" &&
          "bg-lime text-black hover:brightness-110 hover:shadow-[0_0_24px_rgba(200,245,60,0.35)]",
        variant === "ghost" && "text-tsecondary hover:text-tprimary hover:bg-surface2",
        variant === "outline" &&
          "border border-border text-tprimary hover:border-lime hover:text-lime",
        variant === "dark" && "bg-surface2 text-tprimary border border-border hover:border-tmuted",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl bg-surface1 border border-border px-4 py-3 text-sm text-tprimary placeholder:text-tmuted outline-none focus:border-lime transition-colors",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl bg-surface1 border border-border px-4 py-3 text-sm text-tprimary placeholder:text-tmuted outline-none focus:border-lime transition-colors min-h-[100px]",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-xl bg-surface1 border border-border px-4 py-3 text-sm text-tprimary outline-none focus:border-lime transition-colors cursor-pointer",
        props.className,
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-tmuted mb-2">
      {children}
    </label>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-surface1 border border-border p-6", className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "lime" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        tone === "default" && "bg-surface2 text-tsecondary border border-border",
        tone === "lime" && "bg-lime/15 text-lime border border-lime/30",
        tone === "warn" && "bg-amber-500/15 text-amber-400 border border-amber-500/30",
      )}
    >
      {children}
    </span>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-surface2 overflow-hidden">
      <div
        className="h-full rounded-full bg-lime transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {}
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-tsecondary hover:text-lime hover:border-lime transition-colors cursor-pointer"
    >
      {ok ? "Copiado!" : label}
    </button>
  );
}

export function Empty({ icon, titulo, descricao }: { icon: ReactNode; titulo: string; descricao: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface2 text-tmuted">
        {icon}
      </div>
      <p className="font-semibold text-tprimary">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-tmuted">{descricao}</p>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface2 border border-border px-4 py-3">
      <p className="text-xs text-tmuted uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-lg font-bold text-tprimary">{value}</p>
    </div>
  );
}
