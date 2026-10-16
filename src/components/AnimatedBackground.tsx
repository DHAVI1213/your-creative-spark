export function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* blobs de aurora */}
      <div className="absolute -top-40 left-[5%] size-[600px] rounded-full bg-lime/[0.13] blur-[100px] animate-aurora-a" />
      <div className="absolute top-[5%] right-[2%] size-[520px] rounded-full bg-lime/[0.10] blur-[100px] animate-aurora-b" />
      <div className="absolute bottom-[-25%] left-[28%] size-[660px] rounded-full bg-emerald-400/[0.09] blur-[110px] animate-aurora-c" />
      <div className="absolute top-[30%] left-[55%] size-[380px] rounded-full bg-lime/[0.08] blur-[90px] animate-aurora-b" />
      {/* brilho central no topo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 340px at 50% 0%, rgba(200,245,60,0.12), transparent 70%)",
        }}
      />
      {/* grade sutil */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%)",
        }}
      />
    </div>
  );
}
