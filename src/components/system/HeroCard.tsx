import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Embers } from "./Embers";

type Theme = "azul" | "dourado";

const THEMES: Record<
  Theme,
  { card: string; glow: string; embers: "blue" | "gold"; accent: string; gate: [string, string] }
> = {
  azul: {
    card: "bg-[radial-gradient(120%_120%_at_70%_20%,#3a3fb0_0%,#24267a_35%,#121640_70%,#0a0d24_100%)]",
    glow: "from-[#38aaff]/30",
    embers: "blue",
    accent: "text-[#7fd3ff]",
    gate: ["#7fd3ff", "#3a52ff"],
  },
  dourado: {
    card: "bg-[radial-gradient(120%_120%_at_70%_20%,#8a7420_0%,#6b4e22_35%,#3b2524_70%,#1f1418_100%)]",
    glow: "from-[#ffb35c]/30",
    embers: "gold",
    accent: "text-[#ffd89a]",
    gate: ["#ffd89a", "#ff7a3d"],
  },
};

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='.9'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.12'/></svg>\")";

export type HeroNavItem = { label: string; href?: string; onClick?: () => void; active?: boolean };

/**
 * Card grande no estilo "ficha de personagem": rank, apelido, nome, descrição à esquerda,
 * menu à direita e a arte saindo por cima da moldura.
 */
export function HeroCard({
  theme = "azul",
  rank = "S",
  kicker,
  title,
  subtitle,
  children,
  navTitle = "Sobre",
  nav = [],
  art,
  topBar,
  compact = false,
  className,
}: {
  theme?: Theme;
  rank?: string;
  kicker: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  navTitle?: string;
  nav?: HeroNavItem[];
  art?: string;
  topBar?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const t = THEMES[theme];
  const [artOk, setArtOk] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  // A imagem pode falhar antes da página "ligar" (o aviso de erro se perde); confere de novo aqui.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setArtOk(false);
  }, [art]);

  return (
    <div className={cn("relative", compact ? "pt-10 md:pt-14" : "pt-16 md:pt-24", className)}>
      {/* Fundo do card */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] ring-1 ring-white/10",
          t.card,
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent",
            t.glow,
          )}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay"
          style={{ backgroundImage: NOISE }}
        />
        <Embers color={t.embers} density={compact ? 0.7 : 1} />

        {topBar && <div className="relative z-20 px-5 pt-4 md:px-8 md:pt-5">{topBar}</div>}

        <div
          className={cn(
            "relative z-20 grid gap-6 px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] md:px-8",
            compact ? "py-6 md:py-8" : "pt-6 pb-8 md:pt-10 md:pb-12",
          )}
        >
          {/* Texto à esquerda */}
          <div className="hero-rise max-w-xl space-y-3">
            <p className="flex items-end gap-1.5">
              <span className="bg-gradient-to-b from-[#ffe7a3] to-[#f0a52a] bg-clip-text font-display text-4xl font-bold leading-none text-transparent drop-shadow-[0_0_10px_rgba(255,190,80,.5)]">
                {rank}
              </span>
              <span className="pb-0.5 font-display text-lg italic tracking-wide text-white/90">
                Rank
              </span>
            </p>
            <p className={cn("text-sm", t.accent)}>{kicker} A.K.A</p>
            <h2
              className={cn(
                "font-bold uppercase leading-[0.95] tracking-wide text-white drop-shadow-[0_2px_18px_rgba(0,0,0,.5)]",
                compact ? "text-3xl md:text-4xl" : "text-4xl md:text-6xl",
              )}
            >
              {title}
            </h2>
            {subtitle && <p className="font-mono text-sm text-white/70">({subtitle})</p>}
            {children && (
              <div className="space-y-4 pt-2 text-sm leading-6 text-white/80">{children}</div>
            )}
          </div>

          {/* Espaço reservado para a arte no meio (desktop) */}
          <div className="hidden md:block" />

          {/* Menu à direita */}
          {nav.length > 0 && (
            <nav className="hero-rise flex flex-row flex-wrap items-center gap-x-4 gap-y-2 [animation-delay:150ms] md:flex-col md:items-end md:gap-3 md:pt-6">
              <p className="flex w-full items-center gap-2 font-display text-2xl font-bold uppercase text-white md:w-auto md:text-3xl">
                <span className="size-2 rounded-full bg-white shadow-[0_0_10px_white]" /> {navTitle}
              </p>
              {nav.map((n) =>
                n.href ? (
                  <a
                    key={n.label}
                    href={n.href}
                    onClick={n.onClick}
                    className={cn(
                      "hero-nav-link font-mono text-[11px] uppercase tracking-widest text-white/60",
                      n.active && "text-white",
                    )}
                  >
                    {n.label}
                  </a>
                ) : (
                  <button
                    key={n.label}
                    type="button"
                    onClick={n.onClick}
                    className={cn(
                      "hero-nav-link font-mono text-[11px] uppercase tracking-widest text-white/60",
                      n.active && "text-white",
                    )}
                  >
                    {n.label}
                  </button>
                ),
              )}
            </nav>
          )}
        </div>
      </div>

      {/* Arte saindo por cima do card (cortada embaixo, livre em cima) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 overflow-hidden rounded-b-xl",
          compact ? "top-0" : "top-0",
        )}
      >
        <div
          className={cn(
            "hero-rise absolute bottom-0 [animation-delay:250ms]",
            "right-[-8%] h-[78%] opacity-35 md:right-[24%] md:h-[112%] md:opacity-100",
          )}
        >
          <div className="hero-float h-full">
            {art && artOk ? (
              <img
                ref={imgRef}
                src={art}
                alt=""
                onError={() => setArtOk(false)}
                className="h-full w-auto max-w-none object-contain object-bottom drop-shadow-[0_0_40px_rgba(0,0,0,.6)]"
              />
            ) : (
              <Gate colors={t.gate} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Portal brilhante: arte provisória original enquanto não houver personagem. */
function Gate({ colors: [a, b] }: { colors: [string, string] }) {
  const id = a.replace("#", "");
  return (
    <svg viewBox="0 0 300 420" className="h-full w-auto" aria-hidden>
      <defs>
        <radialGradient id={`core-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="35%" stopColor={a} stopOpacity="0.8" />
          <stop offset="75%" stopColor={b} stopOpacity="0.35" />
          <stop offset="100%" stopColor={b} stopOpacity="0" />
        </radialGradient>
        <filter id={`blur-${id}`}>
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <ellipse
        cx="150"
        cy="200"
        rx="120"
        ry="180"
        fill={`url(#core-${id})`}
        opacity="0.55"
        filter={`url(#blur-${id})`}
      />
      <g fill="none" stroke={a} strokeWidth="2.5">
        <ellipse cx="150" cy="200" rx="92" ry="150" opacity="0.95">
          <animate attributeName="ry" values="150;156;150" dur="4s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="150" cy="200" rx="104" ry="164" opacity="0.5" strokeDasharray="6 10">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 150 200"
            to="360 150 200"
            dur="40s"
            repeatCount="indefinite"
          />
        </ellipse>
        <ellipse cx="150" cy="200" rx="70" ry="118" opacity="0.35" strokeDasharray="2 6" />
      </g>
      <ellipse cx="150" cy="200" rx="58" ry="100" fill={`url(#core-${id})`} opacity="0.9">
        <animate attributeName="opacity" values="0.75;1;0.75" dur="3s" repeatCount="indefinite" />
      </ellipse>
      <ellipse
        cx="150"
        cy="392"
        rx="110"
        ry="14"
        fill={a}
        opacity="0.25"
        filter={`url(#blur-${id})`}
      />
    </svg>
  );
}
