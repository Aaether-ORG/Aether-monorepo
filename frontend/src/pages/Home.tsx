import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Link, useNavigate } from 'react-router-dom';
import { useAgent } from '@/hooks/useAgent';
import { EventStream } from '@/components/EventStream';
import { ChainBadge } from '@/components/ChainBadge';
import { TxLink } from '@/components/TxLink';

const PRESET_QUESTIONS = [
  'What are the most cited cell-free protein synthesis papers from Q1 2026?',
  'Which open-source agents have shipped to production in the last 90 days?',
  'Summarize 5 recent papers on TEE-attested model inference.',
];

export function HomePage() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const { events, state, tokenId, txHash, isFixture, startResearch, reset } = useAgent();
  const [question, setQuestion] = useState(PRESET_QUESTIONS[0]);

  return (
    <div className="space-y-8">
      <Hero />

      {/* Status row */}
      <div className="flex flex-wrap gap-2">
        <ChainBadge name="0G Galileo Testnet" />
        <ChainBadge name="ERC-7857 reference" />
        <ChainBadge name="ERC-8004 (Sepolia)" />
        <span className="pill-neutral">model: glm-5-fp8 (TeeML)</span>
        {isFixture && (
          <span className="pill-warn" title="Live backend unreachable — using a deterministic fixture so the demo still works.">
            fixture mode
          </span>
        )}
      </div>

      {/* Question selector */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">1. Ask Thornbury a question</h2>
        <div className="flex flex-wrap gap-2">
          {PRESET_QUESTIONS.map((q, i) => (
            <button
              key={i}
              className={`text-left text-sm px-3 py-2 rounded-md ring-1 transition-colors ${
                question === q
                  ? 'bg-accent/10 ring-accent text-accent'
                  : 'bg-ink-800/40 ring-ink-200/10 text-ink-200 hover:bg-ink-800/60'
              }`}
              onClick={() => setQuestion(q)}
            >
              {q}
            </button>
          ))}
        </div>
        <textarea
          className="w-full bg-ink-900/60 border border-ink-200/10 rounded-md p-3 text-ink-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type a research question..."
        />
        <div className="flex items-center gap-3">
          <button
            className="btn-primary"
            disabled={!isConnected || state === 'researching' || state === 'minting' || !question.trim()}
            onClick={() => startResearch(question)}
          >
            {state === 'researching' && 'Researching…'}
            {state === 'minting' && 'Minting iNFT…'}
            {(state === 'idle' || state === 'minted' || state === 'error') &&
              (events.length === 0 ? 'Run agent →' : 'Re-run')}
          </button>
          {!isConnected && (
            <span className="text-sm text-warn">Connect a wallet to run the agent.</span>
          )}
          {events.length > 0 && (
            <button className="btn-ghost text-sm" onClick={reset}>Clear</button>
          )}
        </div>
      </div>

      {/* Live event stream */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">2. Watch the agent's life log</h2>
          <span className="pill-neutral">{events.length} events</span>
        </div>
        <p className="text-sm text-ink-400">
          Every action — fetch, summary, synthesis — becomes a content-addressed event in 0G Storage.
          Inference events carry TEE attestation from 0G Compute.
        </p>
        <EventStream events={events} />
      </div>

      {/* Mint result */}
      {tokenId && txHash && (
        <div className="card space-y-3 border-accent/30 ring-1 ring-accent/30">
          <div className="flex items-center gap-2">
            <span className="text-accent text-xl">✓</span>
            <h2 className="text-lg font-semibold">3. iNFT minted</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-ink-400 text-xs mb-1">Token ID</div>
              <div className="font-mono text-accent text-xl">#{tokenId}</div>
            </div>
            <div>
              <div className="text-ink-400 text-xs mb-1">Mint tx</div>
              <TxLink hash={txHash} chainId={16602} showExplorer head={10} tail={8} />
            </div>
            <div>
              <div className="text-ink-400 text-xs mb-1">Action</div>
              <div className="flex gap-2 flex-wrap">
                <button className="btn-ghost text-sm" onClick={() => navigate(`/agent/${tokenId}`)}>
                  Replay agent →
                </button>
                <Link to="/buy" className="btn-ghost text-sm">
                  Buy report (x402)
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="text-center py-8 space-y-4">
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight bg-gradient-to-b from-ink-50 to-ink-400 bg-clip-text text-transparent">
        Agents you can replay.
      </h1>
      <p className="text-ink-400 max-w-2xl mx-auto">
        Aether turns every agent action into a content-addressed event in <Highlight>0G Storage</Highlight>,
        TEE-attests every inference via <Highlight>0G Compute</Highlight>, and freezes the running state as
        an <Highlight>ERC-7857</Highlight> iNFT — buyers can verify and replay the agent's complete life.
      </p>
    </section>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="text-accent font-medium">{children}</span>;
}
