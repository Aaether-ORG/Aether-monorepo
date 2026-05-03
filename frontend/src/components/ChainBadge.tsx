export function ChainBadge({ name, ok = true }: { name: string; ok?: boolean }) {
  return (
    <span className={ok ? 'chip chip-on' : 'chip chip-bad'}>
      <span className={ok ? 'pip pip-on animate-pulse-soft' : 'pip pip-bad animate-pulse-soft'} />
      {name}
    </span>
  );
}
