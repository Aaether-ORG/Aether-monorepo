import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { EventStream } from '@/components/EventStream';
import { DEMO_EVENTS } from '@/lib/demoFixture';
import type { AetherEvent } from '@/lib/types';
import { AETHER_ADDRS } from '@/lib/addresses';
import { shorten, explorerUrl } from '@/lib/format';

const REPLAY_TICK_MS = 320;

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
      await sleep(700);
      setVerifying(false);
      setValid(true);
    })();
    return () => { cancelled = true; };
  }, [tokenId]);

  const counts = {
    total: events.length,
    inferences: events.filter((e) => e.type === 'inference').length,
    tools: events.filter((e) => e.type === 'tool_call').length,
    obs: events.filter((e) => e.type === 'observation').length,
  };

  return (
    <div className="space-y-8">
      {/* Recorder header */}
      <header className="grid grid-cols-12 gap-6 pb-6 border-b border-rule">
        <div className="col-span-12 md:col-span-7">
          <div className="key mb-3">FILE 0002 · BLACK-BOX&nbsp;RECORDER</div>
          <div className="flex items-baseline gap-4 flex-wrap">
            <span className="font-mono text-[0.7rem] uppercase tracking-widest text-bone-dim">
              REPLAYING&nbsp;iNFT
            </span>
            <span className="font-display italic text-phosphor text-[clamp(2.6rem,5vw,4rem)] leading-none glow-phosphor nums-tabular">
              #{tokenId}
            </span>
          </div>
          <p className="mt-3 text-bone-dim text-sm max-w-xl">
            Reconstructing the agent's complete reasoning chain from the
            content-addressed event log on 0G&nbsp;Storage. Each frame's
            <span className="font-mono text-phosphor"> prevHash </span>
            links to the previous frame — tampering anywhere breaks the link.
          </p>
        </div>
        <div className="col-span-12 md:col-span-5 md:pl-6 md:border-l md:border-rule flex flex-col gap-3 justify-end">
          <Link to="/" className="key-cap-ghost self-start">← BACK&nbsp;TO&nbsp;OPS</Link>
          {AETHER_ADDRS.agentNFT && (
            <a
              className="key-cap-ghost self-start"
              href={explorerUrl(16602, AETHER_ADDRS.agentNFT, 'address') ?? '#'}
              target="_blank"
              rel="noreferrer"
            >
              VIEW&nbsp;CONTRACT&nbsp;↗
            </a>
          )}
        </div>
      </header>

      {/* Instrumentation gauges */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Gauge label="FRAMES"      value={counts.total}      max={DEMO_EVENTS.length} />
        <Gauge label="INFERENCES"  value={counts.inferences} max={Math.max(1, DEMO_EVENTS.filter(e => e.type === 'inference').length)} accent="phosphor" />
        <Gauge label="TOOL CALLS"  value={counts.tools}      max={Math.max(1, DEMO_EVENTS.filter(e => e.type === 'tool_call').length)} />
        <Gauge label="OBSERVATIONS" value={counts.obs}       max={Math.max(1, DEMO_EVENTS.filter(e => e.type === 'observation').length)} accent="scope" />
      </section>

      {/* Chain integrity readout */}
      <section className="bracket-frame">
        <div className="flex items-center justify-between mb-3">
          <span className="panel-heading">CHAIN&nbsp;INTEGRITY</span>
          {!verifying && valid && (
            <span className="chip chip-go">
              <span className="pip pip-go" />
              ALL&nbsp;LINKS&nbsp;VALID
            </span>
          )}
          {verifying && (
            <span className="chip chip-on">
              <span className="pip pip-on animate-pulse-soft" />
              VERIFYING…
            </span>
          )}
        </div>
        {verifying ? (
          <div className="flex items-center gap-3 text-sm text-bone-dim font-mono">
            <SweepBar />
            <span>walking prevHash links · {events.length}/{DEMO_EVENTS.length}</span>
          </div>
        ) : (
          <div className="text-sm text-bone-dim font-mono">
            keccak256-walked · {events.length} frames · final head:{' '}
            <span className="text-phosphor">
              {shorten(events.at(-1)?.prevHash ?? '0x00', 12, 10)}
            </span>
          </div>
        )}
      </section>

      {/* Event tape */}
      <EventStream events={events} emptyText="Replay starting — buffering tape." />
    </div>
  );
}

function Gauge({
  label, value, max, accent = 'bone',
}: {
  label: string;
  value: number;
  max: number;
  accent?: 'phosphor' | 'scope' | 'bone';
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const color =
    accent === 'phosphor' ? 'bg-phosphor' :
    accent === 'scope'    ? 'bg-scope'    :
                            'bg-bone';
  const text =
    accent === 'phosphor' ? 'text-phosphor' :
    accent === 'scope'    ? 'text-scope'    :
                            'text-bone';

  return (
    <div className="bracket-frame-tight">
      <div className="flex items-center justify-between text-[0.62rem] uppercase tracking-widest text-bone-dim/70 mb-2">
        <span>{label}</span>
        <span className={`${text} nums-tabular`}>{value} / {max}</span>
      </div>
      <div className={`font-display italic text-3xl ${text} leading-none nums-tabular`}>
        {String(value).padStart(2, '0')}
      </div>
      <div className="mt-2 h-[3px] bg-rule relative overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${color} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SweepBar() {
  return (
    <div className="relative h-[3px] flex-1 bg-rule overflow-hidden">
      <div className="absolute inset-y-0 w-1/3 bg-phosphor animate-scope-sweep" />
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
