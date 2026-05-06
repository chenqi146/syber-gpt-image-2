export default function ModelBadge({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`inline-flex w-fit items-center border border-primary/35 bg-primary/10 font-bold uppercase text-primary shadow-[0_0_14px_rgba(0,243,255,0.14)] ${
        compact ? 'gap-1 px-2 py-0.5 text-[9px] tracking-[0.18em]' : 'gap-2 px-3 py-1 text-[10px] tracking-[0.22em]'
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(255,0,255,0.65)]" />
      <span>image2</span>
      <span className="text-white/45">gpt-image-2</span>
    </div>
  );
}

