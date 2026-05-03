import { useEffect, useState } from 'react';
import { useBlockNumber, useChainId } from 'wagmi';

/**
 * SystemStatus — the thin bar that sits below the Layout header.
 * Live UTC clock, mission tag, chain pip, current block number.
 */
export function SystemStatus() {
  const [now, setNow] = useState(() => new Date());
  const chainId = useChainId();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const utc = now.toISOString().slice(11, 19);
  const dayCode = now.toISOString().slice(0, 10);
  const mission = 'AETHER · OPERATIONS · LIVE';

  return (
    <div className="border-y border-rule bg-ink-900/60">
      <div className="max-w-[1280px] mx-auto px-6 h-9 flex items-center gap-6 text-[0.7rem] uppercase tracking-widest text-bone-dim">
        <span className="flex items-center gap-2">
          <span className="pip pip-on animate-pulse-soft" />
          <span className="text-phosphor">SIGNAL</span>
        </span>
        <span className="hidden sm:inline">{mission}</span>
        <span className="ml-auto flex items-center gap-5">
          <span title="Coordinated Universal Time">
            <span className="text-bone-dim/70">UTC</span>{' '}
            <span className="text-bone nums-tabular">{utc}</span>
          </span>
          <span className="hidden md:inline">
            <span className="text-bone-dim/70">DAY</span>{' '}
            <span className="text-bone nums-tabular">{dayCode}</span>
          </span>
          <span title={`chain ${chainId}`}>
            <span className="text-bone-dim/70">CHAIN</span>{' '}
            <span className="text-phosphor nums-tabular">{chainId || '—'}</span>
          </span>
          <span title="latest block height">
            <span className="text-bone-dim/70">BLOCK</span>{' '}
            <span className="text-scope nums-tabular">
              {blockNumber ? `#${blockNumber.toString()}` : '———'}
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}
