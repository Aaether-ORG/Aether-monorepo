export function ChainBadge({ name, ok = true }: { name: string; ok?: boolean }) {
  return (
    <span className={ok ? 'pill-ok' : 'pill-warn'}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-slow" />
      {name}
    </span>
  );
}
