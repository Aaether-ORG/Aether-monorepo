/**
 * Compact tx hash display — terminal styling with dashed-underline link
 * and an "open on chainscan" pip.
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

export function TxLink({
  hash, chainId, kind = 'tx', className = '',
  showExplorer = false, head = 8, tail = 6,
}: Props) {
  if (!hash) return <span className={`text-bone-dim/50 font-mono ${className}`}>· no signal ·</span>;
  const url = explorerUrl(chainId, hash, kind);
  const label = shorten(hash, head, tail);

  if (!url) {
    return <span className={`font-mono text-bone ${className}`}>{label}</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`group inline-flex flex-col items-start ${className}`}
      title={`Open on ${explorerName(chainId)}: ${hash}`}
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-[0.92rem] terminal-link">
        {label}
        <svg
          width="11" height="11" viewBox="0 0 16 16"
          fill="none" stroke="currentColor" strokeWidth="1.6"
          className="opacity-60 group-hover:opacity-100 transition-opacity translate-y-px"
        >
          <path d="M5 11l6-6M5 5h6v6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {showExplorer && (
        <span className="text-[0.6rem] uppercase tracking-widest text-bone-dim/60 group-hover:text-phosphor transition-colors mt-1">
          {explorerName(chainId)} ↗
        </span>
      )}
    </a>
  );
}
