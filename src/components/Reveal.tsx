import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "../lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** direção da entrada */
  variant?: "up" | "down" | "left" | "right" | "scale" | "fade";
  /** atraso em ms (para stagger) */
  delay?: number;
  /** duração em ms */
  duration?: number;
  as?: "div" | "section" | "span";
};

const HIDDEN: Record<NonNullable<RevealProps["variant"]>, string> = {
  up: "translate-y-10 opacity-0",
  down: "-translate-y-10 opacity-0",
  left: "translate-x-10 opacity-0",
  right: "-translate-x-10 opacity-0",
  scale: "scale-95 opacity-0",
  fade: "opacity-0",
};

export function Reveal({
  children,
  className,
  variant = "up",
  delay = 0,
  duration = 700,
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style: CSSProperties = {
    transitionProperty: "transform, opacity",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    transitionDelay: `${delay}ms`,
    willChange: "transform, opacity",
  };

  const Tag = as as "div";

  return (
    <Tag ref={ref} style={style} className={cn(visible ? "" : HIDDEN[variant], className)}>
      {children}
    </Tag>
  );
}
