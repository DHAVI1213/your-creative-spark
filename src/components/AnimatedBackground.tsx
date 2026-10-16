export function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* blobs de aurora */}
      <div className="aurora-blob absolute -top-32 left-[8%] size-[560px] rounded-full bg-lime/[0.07] blur-[120px] animate-aurora-a" />
      <div className="aurora-blob absolute top-[10%] right-[4%] size-[480px] rounded-full bg-lime/[0.05] blur-[110px] animate-aurora-b" />
      <div className="aurora-blob absolute bottom-[-20%] left-[30%] size-[620px] rounded-full bg-emerald-500/[0.05] blur-[130px] animate-aurora-c" />
      {/* brilho central suave no topo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(600px 300px at 50% 0%, rgba(200,245,60,0.08), transparent 70%)",
        }}
      />
      {/* grade sutil */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%)",
        }}
      />
    </div>
  );
}
