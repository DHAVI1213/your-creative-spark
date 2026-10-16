import { useRef, type ReactNode } from "react";
import { cn } from "../lib/utils";

/**
 * Card com tilt 3D que segue o mouse + brilho que acompanha o cursor.
 * Desativa em touch e em prefers-reduced-motion.
 */
export function TiltCard({
  children,
  className,
  max = 10,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateZ(0)`;
    if (glow.current) {
      glow.current.style.opacity = "1";
      glow.current.style.background = `radial-gradient(420px circle at ${px * 100}% ${py * 100}%, rgba(200,245,60,0.12), transparent 60%)`;
    }
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    if (glow.current) glow.current.style.opacity = "0";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("relative transition-transform duration-200 ease-out", className)}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div
        ref={glow}
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300"
      />
      {children}
    </div>
  );
}
