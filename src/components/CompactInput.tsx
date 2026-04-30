export default function CompactInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="min-w-0">
      <span className="mb-0.5 block truncate text-[8px] uppercase tracking-[0.18em] text-white/40">{label}</span>
      <input
        className="h-9 w-full border border-primary/20 bg-black px-2 text-xs text-primary outline-none transition-colors placeholder:text-primary/20 focus:border-primary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
