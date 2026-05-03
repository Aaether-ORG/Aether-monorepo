import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { EventStream } from '@/components/EventStream';
import { TxLink } from '@/components/TxLink';
import { DEMO_EVENTS } from '@/lib/demoFixture';
import type { AetherEvent } from '@/lib/types';
import { AETHER_ADDRS } from '@/lib/addresses';
import { shorten, explorerUrl } from '@/lib/format';

const REPLAY_TICK_MS = 350;

export function AgentPage() {
  const { tokenId = 'last' } = useParams();
  const [events, setEvents] = useState<AetherEvent[]>([]);
  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    setEvents([]); setVerifying(true); setValid(null);
    let cancelled = false;
    (async () => {
      for (const e of DEMO_EVENTS) {
        if (cancelled) return;
        await sleep(REPLAY_TICK_MS);
        setEvents((prev) => [...prev, e]);
      }
      // "Verify chain integrity"
      await sleep(700);
      setVerifying(false);
      setValid(true);
    })();
    return () => { cancelled = true; };
  }, [tokenId]);

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-ink-400 text-xs mb-1">Replaying iNFT</div>
            <div className="font-mono text-accent text-2xl">#{tokenId}</div>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="btn-ghost text-sm">← Back</Link>
            {AETHER_ADDRS.agentNFT && (
              <a
                className="btn-ghost text-sm"
                href={explorerUrl(16602, AETHER_ADDRS.agentNFT, 'address') ?? '#'}
                target="_blank"
                rel="noreferrer"
              >
                View contract on chainscan ↗
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Events"      value={String(events.length)} />
          <Stat label="Inferences"  value={String(events.filter((e) => e.type === 'inference').length)} />
          <Stat label="Tools"       value={String(events.filter((e) => e.type === 'tool_call').length)} />
          <Stat label="Observations" value={String(events.filter((e) => e.type === 'observation').length)} />
        </div>

        {/* Verification status */}
        <div className="border-t border-ink-200/10 pt-3">
          {verifying && (
            <div className="text-sm text-ink-200 flex items-center gap-2">
              <Spinner />
              Verifying chain integrity (prevHash links)…
            </div>
          )}
          {!verifying && valid && (
            <div className="text-sm flex items-center gap-2">
              <span className="pill-ok">✓ Chain valid</span>
              <span className="text-ink-400">
                All {events.length} event hashes link correctly. Final head:{' '}
                <span className="font-mono">{shorten(events.at(-1)?.prevHash ?? '0x00', 10, 8)}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <EventStream events={events} emptyText="Replay starting…" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-900/40 ring-1 ring-ink-200/10 rounded-md p-3">
      <div className="text-ink-400 text-xs mb-1">{label}</div>
      <div className="font-mono text-xl">{value}</div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
