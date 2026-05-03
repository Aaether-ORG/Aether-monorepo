import { useEffect, useState } from 'react';

const SECTIONS = [
  { id: 'thesis',     label: '§ THESIS' },
  { id: 'deploy',     label: '§ DEPLOYMENT' },
  { id: 'events',     label: '§ EVENT TYPES' },
  { id: 'hashchain',  label: '§ HASH CHAIN' },
  { id: 'storage',    label: '§ STORAGE' },
  { id: 'transfer',   label: '§ TRANSFER FLOW' },
  { id: 'tracks',     label: '§ CROSS-TRACK' },
];

export function ArchitecturePage() {
  const active = useActiveSection();

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* Sticky section nav */}
      <aside className="col-span-12 lg:col-span-3 lg:sticky lg:top-24 lg:self-start">
        <div className="key mb-4">DOCUMENT&nbsp;NAV</div>
        <ol className="space-y-1.5 border-l border-rule pl-4">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={[
                  'block font-mono text-[0.78rem] py-1 transition-colors flex items-baseline gap-2',
                  active === s.id ? 'text-phosphor' : 'text-bone-dim hover:text-bone',
                ].join(' ')}
              >
                <span className="text-bone-dim/50 nums-tabular">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
        <div className="mt-8 text-[0.66rem] uppercase tracking-widest text-bone-dim/50 font-mono leading-relaxed">
          DOC&nbsp;ID&nbsp;·&nbsp;AET-26-0001<br />
          REV&nbsp;·&nbsp;A.4<br />
          CLASS&nbsp;·&nbsp;PUBLIC<br />
          MIRROR&nbsp;·&nbsp;0G&nbsp;STORAGE
        </div>
      </aside>

      {/* Editorial body */}
      <article className="col-span-12 lg:col-span-9 space-y-12">
        <Title />

        <Section id="thesis" num="01" head="thesis">
          <Mark>
            <span className="float-left font-display italic text-phosphor text-[5.4rem] leading-[0.8] mr-3 -mt-2 glow-phosphor">A
            </span>
            ether is a runtime layer over <Strong>0glabs/0g-agent-nft</Strong>{' '}
            (the official ERC-7857 reference) and <Strong>0G Compute</Strong>{' '}
            (sealed inference). It does not replace those — it adds the missing
            piece: a typed event log that captures every action and freezes
            the running state as a transferable iNFT.
          </Mark>
          <Aside>
            The agent <em>is</em> the log. Anything not recorded did not happen.
          </Aside>
        </Section>

        <Section id="deploy" num="02" head="what we deploy">
          <p>
            Two contracts, deployed to 0G Galileo (chain&nbsp;<Mono>16602</Mono>):
          </p>
          <Plate>
            <Item code="AetherVerifier.sol"
                  desc="signature-based IERC7857DataVerifier — checks an ECDSA witness over (oldHash, newHash, sealedKey, receiver, authority)" />
            <Item code="AgentNFT.sol"
                  desc="0G's reference contract — non-upgradeable variant — pointed at our verifier" />
          </Plate>
        </Section>

        <Section id="events" num="03" head="event types">
          <p>Five canonical event shapes. All other agent activity is reduced to one of these.</p>
          <table className="w-full font-mono text-sm border-collapse">
            <thead>
              <tr className="border-b border-rule-bright text-bone-dim text-[0.66rem] uppercase tracking-widest">
                <th className="text-left py-2 pr-4 font-normal">type</th>
                <th className="text-left py-2 font-normal">captured fields</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              <Trow t="inference"      f="model · promptHash · outputHash · TEE attestation" />
              <Trow t="tool_call"      f="tool · argsHash · resultHash" />
              <Trow t="observation"    f="source URL · contentHash" />
              <Trow t="state_mutation" f="key · prevValueHash · newValueHash" />
              <Trow t="mint"           f="tokenId · contract · metadataHash" />
            </tbody>
          </table>
        </Section>

        <Section id="hashchain" num="04" head="hash chain">
          <p>
            Each event's <Mono>prevHash</Mono> field links to the previous event's
            keccak256 fingerprint, building a tamper-evident sequence:
          </p>
          <pre className="bracket-frame-tight text-[0.85rem] leading-relaxed text-phosphor font-mono overflow-x-auto">
{`eventHash = keccak256(prevHash || canonicalJSON(event))
prevHash[0] = 0x00…00            // genesis
prevHash[i] = eventHash[i - 1]   // for i ≥ 1`}
          </pre>
          <p>
            Tampering with any event invalidates every downstream link, so the
            entire agent history is verifiable in <em>O(n)</em> walk.
          </p>
        </Section>

        <Section id="storage" num="05" head="storage">
          <p>
            Every event is encrypted with the agent's 16-byte AES-128 master key —
            matching ERC-7857's <Mono>bytes16 sealedKey</Mono> constraint — and
            uploaded as a single file via <Mono>Indexer.upload(MemData, …)</Mono>.
          </p>
          <p>
            The iNFT's <Mono>dataHashes[0]</Mono> is the chained Merkle root over
            all event root hashes — one root per agent, one chain per replay.
          </p>
          <Aside>
            On testnet, batched mode defers persistence to <Mono>flush()</Mono>{' '}
            at mint time, collapsing 7 events × 30-90s each into a single ~90s upload.
          </Aside>
        </Section>

        <Section id="transfer" num="06" head="transfer flow">
          <ol className="space-y-2 list-none counter-reset-section">
            <Step n={1} text="New owner publishes their pubKey via off-chain signal" />
            <Step n={2} text="TEE worker re-encrypts master key for new owner ⇒ new sealedKey (16 bytes)" />
            <Step n={3} text="TEE worker signs (oldHash, newHash, receiver, sealedKey, authority) claim" />
            <Step n={4} text="SDK calls AgentNFT.transfer(receiver, tokenId, [proof])" />
            <Step n={5} text="AetherVerifier verifies signature; AgentNFT emits PublishedSealedKey" />
            <Step n={6} text="New owner reads sealedKey from event, decrypts master key, replays full history" />
          </ol>
        </Section>

        <Section id="tracks" num="07" head="cross-track layers">
          <p>
            Aether ships three optional layers used by the demo, each addressing
            a sponsor track without changing the core protocol:
          </p>
          <Plate>
            <Item code="Ammonite"  desc="ENS dynamic agent cards — ENSIP-25 + Durin + CCIP-Read · aaether.eth" />
            <Item code="Guard"     desc="KeeperHub-backed reliability for x402 settlements (with documented fallback)" />
            <Item code="Payments"  desc="server-side x402 envelope · EIP-3009 ZGUSD on 0G Galileo · Uniswap pay-with-any-token (v0.2)" />
          </Plate>
        </Section>

        <footer className="border-t border-rule pt-6 mt-12 text-[0.66rem] uppercase tracking-widest text-bone-dim/60 font-mono leading-relaxed">
          END&nbsp;OF&nbsp;DOCUMENT — AET-26-0001 · A.4<br />
          A typed event log freezes the running state of an agent. The state is the product. The log is the proof.
        </footer>
      </article>
    </div>
  );
}

/* ----- subcomponents -------------------------------------------------- */

function Title() {
  return (
    <header className="pb-6 border-b border-rule">
      <div className="flex items-center justify-between mb-3">
        <span className="key">SPECIFICATION&nbsp;·&nbsp;TECHNICAL</span>
        <span className="font-mono text-[0.66rem] uppercase tracking-widest text-bone-dim/70">
          AET-26-0001 · REV A.4
        </span>
      </div>
      <h1 className="font-display italic text-phosphor text-[clamp(2.4rem,5.4vw,4rem)] leading-[0.95] glow-phosphor">
        the architecture of<br />a replayable agent.
      </h1>
      <p className="mt-4 text-bone-dim text-sm max-w-2xl">
        A specification for capturing the entire reasoning chain of an
        autonomous agent — its inferences, fetches, mutations, and identity —
        as a content-addressed log that can be sealed, transferred, and replayed.
      </p>
    </header>
  );
}

function Section({
  id, num, head, children,
}: {
  id: string;
  num: string;
  head: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32">
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-12 md:col-span-3">
          <div className="font-display italic text-phosphor text-6xl leading-none glow-phosphor">
            §{num}
          </div>
          <div className="key mt-2">{head}</div>
        </div>
        <div className="col-span-12 md:col-span-9 prose prose-invert prose-sm max-w-none font-mono text-bone leading-relaxed prose-p:text-bone prose-p:my-3 prose-strong:text-phosphor">
          {children}
        </div>
      </div>
      <div className="rule" />
    </section>
  );
}

function Mark({ children }: { children: React.ReactNode }) {
  return <p className="text-base leading-relaxed">{children}</p>;
}

function Aside({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-phosphor pl-4 my-4 italic font-display text-bone-dim/90 text-base">
      {children}
    </p>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-phosphor font-mono not-italic">{children}</strong>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-phosphor bg-phosphor/[0.06] px-1.5 py-0.5">{children}</code>;
}

function Plate({ children }: { children: React.ReactNode }) {
  return (
    <div className="bracket-frame-tight space-y-3 not-prose">
      {children}
    </div>
  );
}

function Item({ code, desc }: { code: string; desc: string }) {
  return (
    <div className="grid grid-cols-12 gap-3 items-baseline">
      <div className="col-span-12 sm:col-span-4 font-mono text-phosphor text-sm">{code}</div>
      <div className="col-span-12 sm:col-span-8 text-bone-dim text-sm leading-relaxed">{desc}</div>
    </div>
  );
}

function Trow({ t, f }: { t: string; f: string }) {
  return (
    <tr>
      <td className="py-2 pr-4 align-top text-phosphor">{t}</td>
      <td className="py-2 align-top text-bone-dim">{f}</td>
    </tr>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-baseline gap-3">
      <span className="font-display italic text-phosphor text-2xl w-8 text-right shrink-0 leading-none">
        {n}.
      </span>
      <span className="text-bone leading-relaxed">{text}</span>
    </li>
  );
}

function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0]?.id ?? '');
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const handle = (id: string) => (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(id);
      });
    };
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (!el) return;
      const o = new IntersectionObserver(handle(s.id), {
        rootMargin: '-30% 0px -55% 0px',
      });
      o.observe(el);
      observers.push(o);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);
  return active;
}
