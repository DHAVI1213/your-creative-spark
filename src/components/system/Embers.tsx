import { useEffect, useRef } from "react";

/**
 * Faíscas subindo (como brasas). Desenhadas num canvas, pausam fora da tela
 * e ficam paradas para quem pediu "reduzir movimento" no aparelho.
 */
export function Embers({
  color = "blue",
  density = 1,
  className,
}: {
  color?: "blue" | "gold" | "purple";
  density?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const palette = {
      blue: ["#7fd3ff", "#38aaff", "#c9ecff"],
      gold: ["#ffb35c", "#ff7a3d", "#ffd89a"],
      purple: ["#b78bff", "#7d5cff", "#e0ccff"],
    }[color];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    type P = {
      x: number;
      y: number;
      r: number;
      vy: number;
      vx: number;
      life: number;
      max: number;
      c: string;
    };
    let parts: P[] = [];

    const spawn = (anywhere = false): P => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      r: Math.random() * 1.8 + 0.6,
      vy: -(Math.random() * 0.6 + 0.25),
      vx: (Math.random() - 0.5) * 0.3,
      life: 0,
      max: Math.random() * 260 + 160,
      c: palette[Math.floor(Math.random() * palette.length)] ?? "#fff",
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(((w * h) / 9000) * density);
      parts = Array.from({ length: Math.min(140, count) }, () => spawn(true));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        const t = p.life / p.max;
        const alpha = Math.sin(Math.PI * Math.min(1, t)) * (0.6 + Math.random() * 0.4);
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.c;
        ctx.shadowColor = p.c;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const tick = () => {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]!;
        p.life++;
        p.y += p.vy;
        p.x += p.vx + Math.sin((p.life + i * 13) / 30) * 0.15;
        if (p.life > p.max || p.y < -10) parts[i] = spawn();
      }
      draw();
      if (visible) raf = requestAnimationFrame(tick);
    };

    resize();
    if (reduce) {
      draw();
    } else {
      raf = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = !!entry?.isIntersecting;
      if (visible && !was && !reduce) raf = requestAnimationFrame(tick);
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [color, density]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className ?? "pointer-events-none absolute inset-0 size-full"}
    />
  );
}
