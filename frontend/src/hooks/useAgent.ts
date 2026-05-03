/**
 * useAgent — drives the in-page demo.
 *
 * Tries the live Thornbury backend first (SSE stream). On any failure
 * (server down, network error, no agent provider configured), it falls back
 * to a fixture timeline so the UI still demos cleanly.
 */
import { useCallback, useRef, useState } from 'react';
import type { AetherEvent } from '@/lib/types';
import { DEMO_EVENTS } from '@/lib/demoFixture';

export type AgentState = 'idle' | 'researching' | 'minting' | 'minted' | 'error';

export interface UseAgentResult {
  events: AetherEvent[];
  state: AgentState;
  tokenId: string | null;
  txHash: string | null;
  error: string | null;
  /** True if the run is using fixture data (server unreachable). */
  isFixture: boolean;
  startResearch: (question: string) => Promise<void>;
  reset: () => void;
}

const BACKEND = (import.meta.env.VITE_THORNBURY_URL as string | undefined) ?? 'http://localhost:3000';
const FIXTURE_TICK_MS = 700;

export function useAgent(): UseAgentResult {
  const [events, setEvents] = useState<AetherEvent[]>([]);
  const [state, setState] = useState<AgentState>('idle');
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFixture, setIsFixture] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    sseRef.current?.close();
    sseRef.current = null;
    setEvents([]); setState('idle'); setTokenId(null); setTxHash(null); setError(null); setIsFixture(false);
  }, []);

  const startResearch = useCallback(async (question: string) => {
    reset();
    setState('researching');

    // Try live backend first
    try {
      const r = await fetch(`${BACKEND}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: AbortSignal.timeout(3000),
      });
      if (!r.ok) throw new Error(`backend HTTP ${r.status}`);
      const { sessionId } = await r.json();

      // Subscribe SSE
      const es = new EventSource(`${BACKEND}/sessions/${sessionId}/events`);
      sseRef.current = es;
      es.addEventListener('event', (ev: MessageEvent) => {
        const data = JSON.parse(ev.data);
        if (data.evt?.type === 'inference' || data.evt?.type === 'tool_call' ||
            data.evt?.type === 'observation' || data.evt?.type === 'state_mutation' ||
            data.evt?.type === 'mint') {
          setEvents((prev) => [...prev, data.evt]);
          if (data.evt.type === 'mint') {
            setTokenId(data.evt.tokenId);
            setState('minted');
          }
        } else if (data.status === 'minting') {
          setState('minting');
        } else if (data.status === 'completed') {
          if (data.tokenId) setTokenId(data.tokenId);
          if (data.txHash) setTxHash(data.txHash);
          setState('minted');
          es.close();
        } else if (data.evt?.type === '__error') {
          setError(data.evt.error);
          setState('error');
          es.close();
        }
      });
      es.onerror = () => {
        // If SSE breaks mid-flight and we haven't completed, fall back to fixture
        if (state === 'researching') {
          es.close();
          void fallbackToFixture();
        }
      };
      return;
    } catch {
      // backend unreachable → fixture
    }

    await fallbackToFixture();

    async function fallbackToFixture() {
      setIsFixture(true);
      try {
        for (const e of DEMO_EVENTS) {
          await sleep(FIXTURE_TICK_MS);
          setEvents((prev) => [...prev, { ...e, ts: Date.now() }]);
        }
        setState('minting');
        await sleep(1500);
        const t = String(Math.floor(Math.random() * 9000 + 1000));
        const tx = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        setEvents((prev) => [
          ...prev,
          {
            type: 'mint',
            ts: Date.now(),
            prevHash: prev.at(-1)?.prevHash ?? ('0x' + '00'.repeat(32) as `0x${string}`),
            tokenId: t,
            contract: '0xAGENT_NFT',
            metadataHash: ('0x' + 'aa'.repeat(32)) as `0x${string}`,
          },
        ]);
        setTokenId(t);
        setTxHash(tx);
        setState('minted');
      } catch (e: any) {
        setError(e?.message ?? String(e));
        setState('error');
      }
    }
  }, [reset, state]);

  return { events, state, tokenId, txHash, error, isFixture, startResearch, reset };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
