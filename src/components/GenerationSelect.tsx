export default function GenerationSelect({
  label,
  value,
  options,
  onChange,
  isOptionDisabled,
  getOptionLabel,
  disabled = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  isOptionDisabled?: (value: string) => boolean;
  getOptionLabel?: (value: string) => string;
  disabled?: boolean;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-0.5 block truncate text-[8px] uppercase tracking-[0.18em] text-white/40">{label}</span>
      <select
        className="h-9 w-full border border-primary/20 bg-black px-2 text-xs uppercase text-primary outline-none transition-colors focus:border-primary"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option} disabled={isOptionDisabled?.(option) || false}>
            {getOptionLabel?.(option) || option}
          </option>
        ))}
      </select>
    </label>
  );
}
