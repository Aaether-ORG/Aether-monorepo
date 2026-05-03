import type { AetherEvent } from '@/lib/types';
import { shorten, formatTs } from '@/lib/format';
import { TxLink } from './TxLink';

// 0G Galileo testnet — chain id where iNFTs live
const ZG_CHAIN = 16602;

const ICONS: Record<AetherEvent['type'], string> = {
  inference: '✦',
  tool_call: '⟐',
  observation: '◎',
  state_mutation: '⇌',
  mint: '✕',
};

const COLORS: Record<AetherEvent['type'], string> = {
  inference: 'text-accent',
  tool_call: 'text-ink-100',
  observation: 'text-ink-200',
  state_mutation: 'text-warn',
  mint: 'text-accent',
};

export function EventCard({ event, index }: { event: AetherEvent; index: number }) {
  return (
    <div className="card animate-slide-in" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-start gap-3">
        <span className={`text-2xl leading-none ${COLORS[event.type]}`}>{ICONS[event.type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-ink-100">#{index}</span>
            <span className="pill-neutral">{event.type}</span>
            <span className="text-xs text-ink-400 ml-auto">{formatTs(event.ts)}</span>
          </div>
          <EventBody event={event} />
        </div>
      </div>
    </div>
  );
}

function EventBody({ event }: { event: AetherEvent }) {
  switch (event.type) {
    case 'inference':
      return (
        <div className="space-y-1.5 text-sm">
          <Row k="model" v={<span className="text-accent font-mono">{event.model}</span>} />
          <Row k="prompt"    v={<Mono>{shorten(event.promptHash, 8, 6)}</Mono>} />
          <Row k="output"    v={<Mono>{shorten(event.outputHash, 8, 6)}</Mono>} />
          <Row k="attested"  v={<span className="pill-ok">TEE-signed by {shorten(event.attestation.providerAddress)}</span>} />
        </div>
      );
    case 'tool_call':
      return (
        <div className="space-y-1.5 text-sm">
          <Row k="tool"    v={<span className="font-mono">{event.tool}()</span>} />
          <Row k="args"    v={<Mono>{shorten(event.argsHash, 8, 6)}</Mono>} />
          <Row k="result"  v={<Mono>{shorten(event.resultHash, 8, 6)}</Mono>} />
        </div>
      );
    case 'observation':
      return (
        <div className="space-y-1.5 text-sm">
          <Row k="source" v={<a href={event.source} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate-mid block max-w-md">{event.source}</a>} />
          <Row k="hash"   v={<Mono>{shorten(event.contentHash, 8, 6)}</Mono>} />
        </div>
      );
    case 'state_mutation':
      return (
        <div className="space-y-1.5 text-sm">
          <Row k="key"  v={<span className="font-mono text-warn">{event.key}</span>} />
          <Row k="from" v={<Mono>{shorten(event.prevValueHash, 8, 6)}</Mono>} />
          <Row k="to"   v={<Mono>{shorten(event.newValueHash, 8, 6)}</Mono>} />
        </div>
      );
    case 'mint':
      return (
        <div className="space-y-1.5 text-sm">
          <Row k="token" v={<span className="font-mono text-accent">#{event.tokenId}</span>} />
          <Row k="contract" v={<TxLink hash={event.contract} chainId={ZG_CHAIN} kind="address" />} />
          <Row k="root" v={<Mono>{shorten(event.metadataHash, 8, 6)}</Mono>} />
        </div>
      );
  }
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-ink-400 text-xs w-16">{k}</span>
      <span className="flex-1 min-w-0">{v}</span>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-ink-200">{children}</span>;
}
