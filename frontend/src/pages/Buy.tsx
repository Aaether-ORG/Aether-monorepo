import { useEffect, useMemo, useState } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { shorten } from '@/lib/format';
import { TxLink } from '@/components/TxLink';

const BACKEND = (import.meta.env.VITE_THORNBURY_URL as string | undefined) ?? 'http://localhost:3000';
const AETHER_TOKEN_ID = (import.meta.env.VITE_AGENT_TOKEN_ID as string | undefined) ?? '1';

type Phase =
  | 'idle'
  | 'fetching'
  | 'challenged'
  | 'paying'
  | 'settling'
  | 'unlocked'
  | 'failed';

interface ChallengeAccept {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  asset: `0x${string}`;
  payTo: `0x${string}`;
  description: string;
  extra?: { name?: string; version?: string; decimals?: number };
}

const ERC20_BALANCE_ABI = [{
  type: 'function',
  name: 'balanceOf',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

function parseChainIdFromNetwork(network: string): number {
  if (/^\d+$/.test(network)) return Number(network);
  if (network.startsWith('eip155:')) return Number(network.slice(7));
  const named: Record<string, number> = {
    'base-sepolia': 84532, 'sepolia': 11155111, '0g-galileo': 16602, 'galileo': 16602,
  };
  return named[network] ?? Number.NaN;
}

function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

export function BuyPage() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const [tokenId, setTokenId] = useState(AETHER_TOKEN_ID);
  const [phase, setPhase] = useState<Phase>('idle');
  const [challenge, setChallenge] = useState<{ accepts: ChallengeAccept[] } | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authzTxHash, setAuthzTxHash] = useState<string | null>(null);
  const [settleTxHash, setSettleTxHash] = useState<string | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);

  const accept = challenge?.accepts[0];
  const targetChainId = accept ? parseChainIdFromNetwork(accept.network) : NaN;
  const decimals = accept?.extra?.decimals ?? 6;

  // Live ZGUSD balance — read once we know the asset address from the challenge.
  const tcidLiteral = (Number.isFinite(targetChainId) ? targetChainId : undefined) as
    | 16602 | 11155111 | 84532 | undefined;
  const { data: buyerBal, refetch: refetchBuyer } = useReadContract({
    address: accept?.asset, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: tcidLiteral,
    query: { enabled: Boolean(accept?.asset && address) },
  });
  const { data: sellerBal, refetch: refetchSeller } = useReadContract({
    address: accept?.asset, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf',
    args: accept?.payTo ? [accept.payTo] : undefined,
    chainId: tcidLiteral,
    query: { enabled: Boolean(accept?.asset && accept?.payTo) },
  });

  // Pre-fetch the challenge on mount so the ticker comes alive immediately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/report/${tokenId}`);
        if (r.status !== 402) return;
        const headerVal = r.headers.get('PAYMENT-REQUIRED');
        if (!headerVal) return;
        const ch = JSON.parse(atob(headerVal));
        if (!cancelled) setChallenge(ch);
      } catch { /* server offline — leave ticker quiet */ }
    })();
    return () => { cancelled = true; };
  }, [tokenId]);

  const priceLabel = useMemo(() => {
    if (!accept) return '—';
    return Number(formatUnits(BigInt(accept.maxAmountRequired), decimals)).toFixed(2);
  }, [accept, decimals]);

  const ticker = useMemo(() => {
    return {
      buyer: buyerBal !== undefined ? formatUnits(buyerBal as bigint, decimals) : null,
      seller: sellerBal !== undefined ? formatUnits(sellerBal as bigint, decimals) : null,
    };
  }, [buyerBal, sellerBal, decimals]);

  async function buy() {
    setReport(null); setError(null); setAuthzTxHash(null); setSettleTxHash(null); setAuditId(null);
    try {
      if (!walletClient || !address) throw new Error('wallet not connected');

      // 1. Refresh the challenge (in case price/payTo changed).
      setPhase('fetching');
      const r1 = await fetch(`${BACKEND}/report/${tokenId}`);
      if (r1.status !== 402) throw new Error(`expected 402, got ${r1.status}`);
      const challengeHeader = r1.headers.get('PAYMENT-REQUIRED');
      if (!challengeHeader) throw new Error('no PAYMENT-REQUIRED header');
      const ch = JSON.parse(atob(challengeHeader));
      setChallenge(ch);
      setPhase('challenged');

      // 2. Read everything from the challenge — zero hardcoded knowledge.
      const a = ch.accepts[0] as ChallengeAccept;
      const tcid = parseChainIdFromNetwork(a.network);
      if (Number.isNaN(tcid)) throw new Error(`unknown network: ${a.network}`);
      const domainName = a.extra?.name;
      const domainVersion = a.extra?.version;
      if (!domainName || !domainVersion) {
        throw new Error('challenge missing extra.name/extra.version');
      }
      if (chainId !== tcid) {
        await switchChainAsync({ chainId: tcid });
      }

      // 3. Sign EIP-3009 TransferWithAuthorization.
      setPhase('paying');
      const now = Math.floor(Date.now() / 1000);
      const validAfter = BigInt(now - 60);
      const validBefore = BigInt(now + 600);
      const nonce = randomNonce();
      const value = BigInt(a.maxAmountRequired);

      const signature = await walletClient.signTypedData({
        account: address,
        domain: {
          name: domainName,
          version: domainVersion,
          chainId: tcid,
          verifyingContract: a.asset,
        },
        types: {
          TransferWithAuthorization: [
            { name: 'from',         type: 'address' },
            { name: 'to',           type: 'address' },
            { name: 'value',        type: 'uint256' },
            { name: 'validAfter',   type: 'uint256' },
            { name: 'validBefore',  type: 'uint256' },
            { name: 'nonce',        type: 'bytes32' },
          ],
        },
        primaryType: 'TransferWithAuthorization',
        message: {
          from: address,
          to: a.payTo,
          value,
          validAfter,
          validBefore,
          nonce,
        },
      });

      // 4. Build PAYMENT-SIGNATURE envelope.
      const paymentPayload = {
        x402Version: 2,
        accepted: a,
        payload: {
          signature,
          authorization: {
            from: address,
            to: a.payTo,
            value: value.toString(),
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
          },
        },
      };
      const paymentSig = btoa(JSON.stringify(paymentPayload));

      // 5. Re-fetch — server settles real ZGUSD on chain.
      setPhase('settling');
      const r2 = await fetch(`${BACKEND}/report/${tokenId}`, {
        headers: { 'PAYMENT-SIGNATURE': paymentSig, 'X-Buyer-Address': address },
      });
      if (!r2.ok) throw new Error(`server unlock failed: ${r2.status} ${await r2.text()}`);
      const body = await r2.json();
      setReport(body.report);
      setAuthzTxHash(body.authzTxHash ?? null);
      setSettleTxHash(body.settleTxHash ?? null);
      setAuditId(body.auditId ?? null);
      setPhase('unlocked');

      // Refresh balances after settlement.
      void refetchBuyer();
      void refetchSeller();
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? String(e));
      setPhase('failed');
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="grid grid-cols-12 gap-6 pb-6 border-b border-rule">
        <div className="col-span-12 lg:col-span-7">
          <div className="key mb-3">FILE 0003 · ORDER&nbsp;ENTRY&nbsp;TERMINAL</div>
          <h1 className="font-mono text-[clamp(2rem,4.4vw,3.4rem)] leading-[0.95] text-bone">
            settle access via{' '}
            <span className="font-display italic text-phosphor glow-phosphor">x402.</span>
          </h1>
          <p className="mt-3 text-bone-dim text-sm max-w-xl">
            <code className="font-mono text-phosphor">/report/:tokenId</code> returns HTTP&nbsp;402.
            Your wallet signs an EIP-712{' '}
            <code className="font-mono text-bone">TransferWithAuthorization</code> per the x402&nbsp;spec.
            The server settles by calling{' '}
            <code className="font-mono text-bone">ZGUSD.transferWithAuthorization()</code>{' '}
            on 0G Galileo, then authorises you on the iNFT. Real stablecoin moves on chain.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-5 lg:pl-6 lg:border-l lg:border-rule">
          {/* Live ticker block */}
          <div className="bracket-frame-tight">
            <div className="flex items-center justify-between mb-3">
              <span className="key">ZGUSD&nbsp;·&nbsp;LIVE</span>
              <span className="chip chip-on">
                <span className="pip pip-on animate-pulse-soft" />
                MARKET&nbsp;OPEN
              </span>
            </div>
            <div className="space-y-2 text-sm font-mono nums-tabular">
              <div className="flex items-baseline justify-between border-b border-rule pb-2">
                <span className="text-bone-dim text-[0.66rem] uppercase tracking-widest">PRICE</span>
                <span className="text-phosphor text-2xl font-display italic glow-phosphor">
                  {priceLabel}
                </span>
                <span className="text-bone-dim/70 text-[0.66rem] uppercase tracking-widest">ZGUSD</span>
              </div>
              <Row k="YOU HOLD" v={ticker.buyer ?? '—'} unit="ZGUSD" tone="bone" />
              <Row k="SELLER" v={ticker.seller ?? '—'} unit="ZGUSD" tone="dim" />
              <Row
                k="ASSET"
                v={accept ? shorten(accept.asset, 8, 6) : '—'}
                tone="dim"
                tip={accept?.asset}
              />
              <Row
                k="PAY TO"
                v={accept ? shorten(accept.payTo, 8, 6) : '—'}
                tone="dim"
                tip={accept?.payTo}
              />
            </div>
          </div>
        </div>
      </header>

      {/* 3-column working area */}
      <section className="grid grid-cols-12 gap-4">
        {/* Order entry */}
        <div className="col-span-12 lg:col-span-5 bracket-frame">
          <div className="panel-heading mb-4">ORDER&nbsp;ENTRY</div>

          <div className="space-y-4">
            <label className="block">
              <div className="key mb-2">TOKEN&nbsp;ID</div>
              <input
                className="field"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                placeholder="agent token id"
              />
            </label>

            <label className="block">
              <div className="key mb-2">PAY&nbsp;WITH</div>
              <select className="field-select" defaultValue="ZGUSD">
                <option value="ZGUSD">ZGUSD · 0G GALILEO</option>
              </select>
              <div className="mt-1.5 text-[0.62rem] uppercase tracking-widest text-bone-dim/60">
                cross-token swap (Uniswap pay-with-any) — v0.2
              </div>
            </label>

            <div className="rule" />

            <div className="ledger">
              <dt>SCHEME</dt>      <dd>{accept?.scheme ?? 'exact'}</dd>
              <dt>NETWORK</dt>     <dd>{accept?.network ?? '—'}</dd>
              <dt>DOMAIN</dt>      <dd>{accept?.extra?.name ?? '—'} v{accept?.extra?.version ?? '—'}</dd>
              <dt>DECIMALS</dt>    <dd>{decimals}</dd>
            </div>

            <button
              className="key-cap w-full justify-center"
              disabled={!isConnected || phase === 'paying' || phase === 'settling' || phase === 'fetching'}
              onClick={buy}
            >
              {phase === 'fetching'   && (<><span className="pip pip-on animate-pulse-soft" />FETCHING…</>)}
              {phase === 'challenged' && (<><span className="pip pip-on animate-pulse-soft" />SIGNING…</>)}
              {phase === 'paying'     && (<><span className="pip pip-on animate-pulse-soft" />SIGN&nbsp;IN&nbsp;WALLET</>)}
              {phase === 'settling'   && (<><span className="pip pip-go animate-pulse-soft" />SETTLING…</>)}
              {phase === 'unlocked'   && (<><span className="pip pip-go" />UNLOCKED · PAY&nbsp;AGAIN</>)}
              {phase === 'failed'     && (<><span className="pip pip-bad" />RETRY</>)}
              {phase === 'idle'       && (<>EXECUTE&nbsp;ORDER&nbsp;▶</>)}
            </button>

            {!isConnected && (
              <div className="font-mono text-[0.7rem] uppercase tracking-widest text-ferric flex items-center gap-2">
                <span className="pip pip-bad" /> AUTH&nbsp;NODE&nbsp;OFFLINE
              </div>
            )}
            {error && (
              <div className="bracket-frame-tight border-ferric/40 text-sm">
                <div className="key mb-1 text-ferric">▌ ABORT</div>
                <div className="text-bone font-mono text-xs break-all">{error}</div>
              </div>
            )}
          </div>
        </div>

        {/* Phase trace */}
        <div className="col-span-12 lg:col-span-7">
          <PhaseTrace
            phase={phase}
            tokenId={tokenId}
            authzTxHash={authzTxHash}
          />
        </div>
      </section>

      {/* On-chain proof block — the hero of the success state */}
      {(authzTxHash || settleTxHash || auditId) && (
        <section className="bracket-frame relative overflow-hidden">
          <div
            className="absolute inset-x-0 top-0 h-px bg-phosphor"
            aria-hidden
          />
          <div className="flex items-baseline justify-between mb-4">
            <span className="panel-heading">ON-CHAIN&nbsp;PROOF</span>
            <span className="chip chip-go">
              <span className="pip pip-go" />
              3&nbsp;ARTIFACTS&nbsp;CONFIRMED
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProofCell
              index={1}
              label="x402 SETTLE · ZGUSD"
              detail="ZGUSD.transferWithAuthorization()"
              hash={settleTxHash}
              chainId={16602}
            />
            <ProofCell
              index={2}
              label="authorizeUsage · iNFT"
              detail={`AgentNFT.authorizeUsage(${tokenId}, buyer)`}
              hash={authzTxHash}
              chainId={16602}
            />
            <ProofCellPlain
              index={3}
              label="KEEPERHUB AUDIT"
              detail="evidence id · cryptographic provenance"
              value={auditId ?? '—'}
            />
          </div>
        </section>
      )}

      {/* Report */}
      {report && (
        <section className="bracket-frame">
          <div className="flex items-baseline justify-between mb-3">
            <span className="panel-heading">REPORT&nbsp;·&nbsp;DECLASSIFIED</span>
            <span className="chip chip-go">
              <span className="pip pip-go" />
              authorizeUsage(#{tokenId}, {shorten(address ?? '0x', 4, 4)})
            </span>
          </div>
          <article className="prose prose-invert prose-sm max-w-none whitespace-pre-line font-mono text-bone leading-relaxed">
            {report}
          </article>
        </section>
      )}
    </div>
  );
}

function Row({
  k, v, unit, tone = 'bone', tip,
}: {
  k: string; v: string; unit?: string;
  tone?: 'bone' | 'dim' | 'phosphor';
  tip?: string;
}) {
  const color =
    tone === 'phosphor' ? 'text-phosphor' :
    tone === 'dim'      ? 'text-bone-dim' :
                          'text-bone';
  return (
    <div className="flex items-baseline justify-between gap-3" title={tip}>
      <span className="text-bone-dim/70 text-[0.66rem] uppercase tracking-widest">{k}</span>
      <span className={`${color} flex items-baseline gap-1.5`}>
        <span>{v}</span>
        {unit && <span className="text-bone-dim/70 text-[0.62rem] uppercase tracking-widest">{unit}</span>}
      </span>
    </div>
  );
}

function ProofCell({
  index, label, detail, hash, chainId,
}: {
  index: number;
  label: string;
  detail: string;
  hash: string | null;
  chainId: number;
}) {
  return (
    <div className="border-l border-phosphor/40 pl-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-display italic text-phosphor text-2xl leading-none">
          0{index}
        </span>
        <span className="key">{label}</span>
      </div>
      <div className="text-[0.66rem] uppercase tracking-widest text-bone-dim/60 mb-2 font-mono">
        {detail}
      </div>
      <TxLink hash={hash} chainId={chainId} showExplorer head={12} tail={10} />
    </div>
  );
}

function ProofCellPlain({
  index, label, detail, value,
}: {
  index: number;
  label: string;
  detail: string;
  value: string;
}) {
  return (
    <div className="border-l border-phosphor/40 pl-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-display italic text-phosphor text-2xl leading-none">
          0{index}
        </span>
        <span className="key">{label}</span>
      </div>
      <div className="text-[0.66rem] uppercase tracking-widest text-bone-dim/60 mb-2 font-mono">
        {detail}
      </div>
      <span className="font-mono text-[0.85rem] text-bone break-all">{value}</span>
    </div>
  );
}

function PhaseTrace({
  phase, tokenId, authzTxHash,
}: {
  phase: Phase;
  tokenId: string;
  authzTxHash: string | null;
}) {
  const steps: { id: Phase; code: string; label: string; sub: string }[] = [
    { id: 'fetching',   code: 'A', label: 'GET /report/:id',                   sub: 'no payment header' },
    { id: 'challenged', code: 'B', label: '402 PAYMENT-REQUIRED',              sub: 'parse accepts[0]' },
    { id: 'paying',     code: 'C', label: 'sign EIP-712 TransferWithAuth.',    sub: 'wallet typed-data prompt' },
    { id: 'settling',   code: 'D', label: 'ZGUSD.transferWithAuthorization()', sub: 'server submits on chain' },
    { id: 'unlocked',   code: 'E', label: `agentNFT.authorizeUsage(${tokenId})`, sub: 'iNFT permission grant' },
  ];
  const order: Phase[] = ['idle', 'fetching', 'challenged', 'paying', 'settling', 'unlocked'];
  const idx = order.indexOf(phase);

  return (
    <div className="bracket-frame h-full">
      <div className="flex items-baseline justify-between mb-4">
        <span className="panel-heading">PAYMENT&nbsp;TRACE</span>
        <span className="font-mono text-[0.66rem] uppercase tracking-widest text-bone-dim/70">
          x402 · EIP-3009 · 0G&nbsp;GALILEO
        </span>
      </div>
      <ol className="relative">
        <span className="absolute left-[11px] top-1 bottom-1 w-px bg-rule" aria-hidden />
        {steps.map((s) => {
          const stepIdx = order.indexOf(s.id);
          const stage = idx > stepIdx ? 'done' : idx === stepIdx ? 'active' : 'pending';
          const tone =
            stage === 'done'   ? 'text-phosphor' :
            stage === 'active' ? 'text-scope animate-phosphor-pulse' :
                                 'text-bone-dim/40';
          const pip =
            stage === 'done'   ? 'pip-on'   :
            stage === 'active' ? 'pip-go animate-pulse-soft'   :
                                 'pip-idle';

          return (
            <li key={s.id} className="relative pl-9 py-3 first:pt-0 last:pb-0">
              <span className={`absolute left-[7px] top-[18px] pip ${pip}`} />
              <div className="flex items-baseline gap-3">
                <span className={`font-mono text-[0.7rem] tracking-widest ${tone}`}>
                  STEP·{s.code}
                </span>
                <span className={`font-mono text-sm ${stage === 'pending' ? 'text-bone-dim/50' : 'text-bone'}`}>
                  {s.label}
                </span>
                {stage === 'done' && s.id === 'settling' && authzTxHash && (
                  <span className="ml-auto">
                    <TxLink hash={authzTxHash} chainId={16602} head={6} tail={4} />
                  </span>
                )}
              </div>
              <div className={`text-[0.66rem] uppercase tracking-widest font-mono mt-1 ${
                stage === 'pending' ? 'text-bone-dim/30' : 'text-bone-dim/70'
              }`}>
                {s.sub}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
