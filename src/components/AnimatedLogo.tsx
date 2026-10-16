import { cn } from "../lib/utils";

/**
 * Logo da NK Software com animação: brilho pulsante contínuo
 * e shine que atravessa no hover.
 */
export function AnimatedLogo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  return (
    <span
      className={cn(
        "logo-anim group relative inline-flex shrink-0 overflow-hidden rounded-lg",
        dims,
        className
      )}
    >
      <img
        src="/logo.webp"
        alt="NK Software"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
      />
      <span className="logo-shine pointer-events-none absolute inset-0" aria-hidden="true" />
    </span>
  );
}
