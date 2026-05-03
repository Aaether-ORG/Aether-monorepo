/**
 * Compact tx hash display with a one-click "open on explorer" affordance.
 */
import { shorten, explorerUrl, explorerName } from '@/lib/format';

interface Props {
  hash: string | null | undefined;
  chainId: number | string;
  kind?: 'tx' | 'address' | 'token';
  className?: string;
  /** Show the explorer name underneath the hash. */
  showExplorer?: boolean;
  /** Override the default head/tail truncation. */
  head?: number;
  tail?: number;
}

export function TxLink({ hash, chainId, kind = 'tx', className = '', showExplorer = false, head = 8, tail = 6 }: Props) {
  if (!hash) return <span className={`text-ink-400 ${className}`}>—</span>;
  const url = explorerUrl(chainId, hash, kind);
  const label = shorten(hash, head, tail);

  const inner = (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono">{label}</span>
      {url && (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
             className="opacity-70 group-hover:opacity-100 transition-opacity">
          <path d="M5 11l6-6M5 5h6v6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );

  if (!url) {
    return <span className={`font-mono text-ink-200 ${className}`}>{label}</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`group inline-flex flex-col items-start text-accent hover:underline ${className}`}
      title={`Open on ${explorerName(chainId)}: ${hash}`}
    >
      {inner}
      {showExplorer && (
        <span className="text-[10px] text-ink-400 group-hover:text-ink-200 transition-colors">
          open on {explorerName(chainId)} ↗
        </span>
      )}
    </a>
  );
}
