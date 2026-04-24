type AvatarBadgeProps = {
  name?: string | null;
  email?: string | null;
  guestId?: string | null;
  className?: string;
  textClassName?: string;
};

export default function AvatarBadge({ name, email, guestId, className = '', textClassName = '' }: AvatarBadgeProps) {
  const seed = name?.trim() || email?.trim() || guestId?.trim() || 'guest';
  const initials = buildInitials(seed);
  const hue = hashHue(seed);

  return (
    <div
      className={`flex items-center justify-center border border-secondary/40 text-white font-black uppercase ${className}`.trim()}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 80% 54%), hsl(${(hue + 36) % 360} 72% 28%))`,
      }}
    >
      <span className={textClassName}>{initials}</span>
    </div>
  );
}

function buildInitials(seed: string) {
  const parts = seed
    .replace(/[@._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'G';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function hashHue(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
}
