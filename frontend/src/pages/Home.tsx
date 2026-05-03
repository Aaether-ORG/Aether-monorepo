import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Link, useNavigate } from 'react-router-dom';
import { useAgent } from '@/hooks/useAgent';
import { EventStream } from '@/components/EventStream';
import { ChainBadge } from '@/components/ChainBadge';
import { TxLink } from '@/components/TxLink';

const PRESETS = [
  'What are the most cited cell-free protein synthesis papers from Q1 2026?',
  'Which open-source agents have shipped to production in the last 90 days?',
  'Summarize 5 recent papers on TEE-attested model inference.',
];

export function HomePage() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const { events, state, tokenId, txHash, isFixture, startResearch, reset } = useAgent();
  const [question, setQuestion] = useState<string>(PRESETS[0]!);

  const isRunning = state === 'researching' || state === 'minting';
  const buttonLabel = (() => {
    if (state === 'researching') return 'TRACING…';
    if (state === 'minting')     return 'MINTING…';
    if (events.length === 0)     return 'EXECUTE ▶';
    return 'RUN AGAIN ▶';
  })();

  return (
    <div className="space-y-10">
      <Hero />

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-2">
        <ChainBadge name="0G GALILEO · 16602" />
        <span className="chip">ERC-7857 REF.</span>
        <span className="chip">ERC-8004 · SEPOLIA</span>
        <span className="chip">MODEL · QWEN-2.5-7B / TEEML</span>
        {isFixture && (
          <span
            className="chip chip-bad"
            title="Live backend unreachable — running deterministic fixture timeline."
          >
            <span className="pip pip-bad animate-pulse-soft" />
            FIXTURE&nbsp;MODE
          </span>
        )}
      </div>

      {/* Interrogation console */}
      <section className="bracket-frame">
        <div className="flex items-center justify-between mb-4">
          <span className="panel-heading">SECTION 01 · INTERROGATION</span>
          <span className="font-mono text-[0.66rem] tracking-widest text-bone-dim/70">
            agentId 4098 · thornbury.aaether.eth
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          {PRESETS.map((q) => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              className={[
                'group text-left px-3 py-3 border transition-colors text-[0.78rem] leading-snug',
                question === q
                  ? 'border-phosphor text-bone bg-phosphor/5'
                  : 'border-rule text-bone-dim hover:border-rule-bright hover:text-bone',
              ].join(' ')}
            >
              <div className={`text-[0.6rem] uppercase tracking-widest mb-1.5 ${
                question === q ? 'text-phosphor' : 'text-bone-dim/60'
              }`}>
                ▍ PRESET
              </div>
              <div>{q}</div>
            </button>
          ))}
        </div>

        <div className="relative">
          <span className="absolute left-3 top-3 font-mono text-phosphor text-base select-none">
            ⟶
          </span>
          <textarea
            className="field pl-9 leading-relaxed"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="enter directive…"
          />
          <span className="absolute right-3 bottom-2 font-mono text-[0.62rem] uppercase tracking-widest text-bone-dim/50 nums-tabular">
            {question.length} CH
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="key-cap"
            disabled={!isConnected || isRunning || !question.trim()}
            onClick={() => startResearch(question)}
          >
            {isRunning && <span className="pip pip-on animate-pulse-soft" />}
            {buttonLabel}
          </button>
          {events.length > 0 && (
            <button className="key-cap-ghost" onClick={reset} disabled={isRunning}>
              CLEAR&nbsp;TAPE
            </button>
          )}
          {!isConnected ? (
            <span className="font-mono text-[0.7rem] uppercase tracking-widest text-ferric flex items-center gap-2">
              <span className="pip pip-bad" /> AUTH&nbsp;NODE&nbsp;OFFLINE
            </span>
          ) : (
            <span className="font-mono text-[0.66rem] uppercase tracking-widest text-bone-dim/70 ml-auto">
              ⏎ submit · enter directive then strike key
            </span>
          )}
        </div>
      </section>

      {/* Tape feed */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="panel-heading">SECTION 02 · LIFE&nbsp;LOG</h2>
          <span className="font-mono text-[0.66rem] uppercase tracking-widest text-bone-dim/60">
            content-addressed · 0G storage · TEE-signed inferences
          </span>
        </div>
        <EventStream events={events} />
      </section>

      {/* Mint receipt */}
      {tokenId && txHash && (
        <section className="bracket-frame relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
               style={{
                 backgroundImage:
                   'repeating-linear-gradient(45deg, #FFB454 0 1px, transparent 1px 18px)',
               }} />
          <div className="relative">
            <div className="flex items-baseline justify-between mb-3">
              <span className="panel-heading">SECTION 03 · MINT&nbsp;RECEIPT</span>
              <span className="chip chip-on">
                <span className="pip pip-on" />
                CONFIRMED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="key mb-2">TOKEN&nbsp;·&nbsp;ERC-7857</div>
                <div className="font-display italic text-5xl text-phosphor glow-phosphor leading-none nums-tabular">
                  #{tokenId}
                </div>
              </div>
              <div>
                <div className="key mb-2">MINT&nbsp;TX</div>
                <TxLink hash={txHash} chainId={16602} showExplorer head={10} tail={8} />
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <div className="key">NEXT</div>
                <div className="flex flex-wrap gap-2">
                  <button className="key-cap-ghost" onClick={() => navigate(`/agent/${tokenId}`)}>
                    REPLAY&nbsp;▶
                  </button>
                  <Link to="/buy" className="key-cap">
                    BUY&nbsp;REPORT&nbsp;·&nbsp;x402
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="grid grid-cols-12 gap-6 items-end pt-2 pb-6 border-b border-rule">
      <div className="col-span-12 md:col-span-7">
        <div className="key mb-4">FILE 0001 · OPS&nbsp;LOG</div>
        <h1 className="leading-[0.92] text-bone">
          <span className="block font-display italic text-[clamp(2.4rem,6vw,4.4rem)] text-phosphor glow-phosphor">
            replayable
          </span>
          <span className="block font-mono text-[clamp(2.2rem,5.5vw,4rem)] tracking-tight">
            agents,
          </span>
          <span className="block font-mono text-[clamp(2.2rem,5.5vw,4rem)] tracking-tight text-bone-dim">
            on the record.
          </span>
        </h1>
      </div>
      <aside className="col-span-12 md:col-span-5 md:pl-6 md:border-l md:border-rule">
        <p className="text-bone-dim text-sm leading-relaxed mb-4">
          Aether transcribes every action an agent takes — fetch, inference, mutation —
          into a content-addressed event in <span className="text-phosphor">0G&nbsp;Storage</span>,
          attests every inference inside <span className="text-phosphor">0G&nbsp;Compute</span> TEEs,
          and freezes the running state as a transferable <span className="text-phosphor">ERC-7857</span> iNFT.
        </p>
        <p className="text-bone-dim text-sm leading-relaxed">
          Buyers resolve the agent through <span className="text-phosphor">ENS&nbsp;(aaether.eth)</span>,
          settle access via <span className="text-phosphor">x402&nbsp;+&nbsp;EIP-3009</span> stablecoin,
          and replay the full reasoning offline. The record is the product.
        </p>
      </aside>
    </section>
  );
}
