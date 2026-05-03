import type { AetherEvent } from '@/lib/types';
import { shorten, formatTs } from '@/lib/format';
import { TxLink } from './TxLink';

const ZG_CHAIN = 16602;

const GLYPH: Record<AetherEvent['type'], string> = {
  inference:      '◈',
  tool_call:      '⊞',
  observation:    '◉',
  state_mutation: '⇌',
  mint:           '✕',
};

const TYPE_LABEL: Record<AetherEvent['type'], string> = {
  inference:      'INFER',
  tool_call:      'TOOL ',
  observation:    'OBSRV',
  state_mutation: 'MUTAT',
  mint:           'MINT ',
};

const COLOR: Record<AetherEvent['type'], string> = {
  inference:      'text-phosphor',
  tool_call:      'text-bone',
  observation:    'text-scope',
  state_mutation: 'text-phosphor/80',
  mint:           'text-phosphor glow-phosphor',
};

export function EventCard({ event, index }: { event: AetherEvent; index: number }) {
  return (
    <article
      className="relative pl-10 pr-4 py-3 animate-tape-feed"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      {/* Marker on the tape spine */}
      <span
        className={`absolute left-[6px] top-[18px] w-3.5 h-3.5 flex items-center justify-center bg-ink-900 ring-1 ring-rule-bright ${COLOR[event.type]}`}
        aria-hidden
      >
        <span className="text-[0.6rem] leading-none">{GLYPH[event.type]}</span>
      </span>

      {/* Header line */}
      <header className="flex items-baseline gap-3 flex-wrap">
        <span className="font-mono text-[0.66rem] uppercase tracking-widest text-bone-dim/60 nums-tabular">
          T+{String(index).padStart(3, '0')}
        </span>
        <span className={`font-mono text-[0.7rem] tracking-widest ${COLOR[event.type]}`}>
          {TYPE_LABEL[event.type]}
        </span>
        <span className="font-mono text-[0.66rem] text-bone-dim/60 nums-tabular ml-auto">
          {formatTs(event.ts)}
        </span>
        <PrevHashTrail prev={event.prevHash} />
      </header>

      {/* Body */}
      <div className="mt-2">
        <EventBody event={event} />
      </div>
    </article>
  );
}

function PrevHashTrail({ prev }: { prev: string }) {
  return (
    <span
      className="font-mono text-[0.62rem] text-bone-dim/40 hidden sm:inline"
      title={`prevHash: ${prev}`}
    >
      ↳ {shorten(prev, 4, 4)}
    </span>
  );
}

function EventBody({ event }: { event: AetherEvent }) {
  switch (event.type) {
    case 'inference':
      return (
        <dl className="ledger">
          <dt>model</dt>
          <dd className="text-phosphor">{event.model}</dd>
          <dt>prompt·h</dt>
          <dd>{shorten(event.promptHash, 10, 8)}</dd>
          <dt>output·h</dt>
          <dd>{shorten(event.outputHash, 10, 8)}</dd>
          <dt>tee·sig</dt>
          <dd className="flex items-center gap-2">
            <span className="chip chip-go">
              <span className="pip pip-go" />
              ATTESTED
            </span>
            <span className="text-bone-dim text-xs">
              by {shorten(event.attestation.providerAddress)}
            </span>
          </dd>
        </dl>
      );
    case 'tool_call':
      return (
        <dl className="ledger">
          <dt>tool</dt>
          <dd className="text-bone">{event.tool}<span className="text-bone-dim/60">()</span></dd>
          <dt>args·h</dt>
          <dd>{shorten(event.argsHash, 10, 8)}</dd>
          <dt>result·h</dt>
          <dd>{shorten(event.resultHash, 10, 8)}</dd>
        </dl>
      );
    case 'observation':
      return (
        <dl className="ledger">
          <dt>source</dt>
          <dd>
            <a
              href={event.source}
              target="_blank"
              rel="noreferrer"
              className="terminal-link truncate-mid block max-w-md"
            >
              {event.source}
            </a>
          </dd>
          <dt>content·h</dt>
          <dd>{shorten(event.contentHash, 10, 8)}</dd>
        </dl>
      );
    case 'state_mutation':
      return (
        <dl className="ledger">
          <dt>key</dt>
          <dd className="text-phosphor">{event.key}</dd>
          <dt>from</dt>
          <dd>{shorten(event.prevValueHash, 10, 8)}</dd>
          <dt>to</dt>
          <dd>{shorten(event.newValueHash, 10, 8)}</dd>
        </dl>
      );
    case 'mint':
      return (
        <dl className="ledger">
          <dt>token</dt>
          <dd className="text-phosphor text-base glow-phosphor">#{event.tokenId}</dd>
          <dt>contract</dt>
          <dd><TxLink hash={event.contract} chainId={ZG_CHAIN} kind="address" /></dd>
          <dt>root·h</dt>
          <dd>{shorten(event.metadataHash, 10, 8)}</dd>
        </dl>
      );
  }
}
