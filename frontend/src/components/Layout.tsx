/**
 * AETHER — visual identity
 *
 * AESTHETIC: mid-century mission-control terminal × instrumentation lab.
 * The agent's life is a CRT log feed; the buyer flow is an order-entry
 * console; the iNFT replay is a black-box recorder readout.
 *
 * Why: judges are crypto-natives who respond to information density and
 * on-chain receipts. This aesthetic foregrounds raw addresses, hashes, and
 * timestamps — the proof — instead of marketing-site polish.
 *
 * Type: JetBrains Mono everywhere; Fraunces italic strictly for editorial
 * accents (one or two per page). No sans-serif body anywhere.
 *
 * Colour: bone-on-near-black with three signal channels — phosphor amber
 * (primary), scope cyan (confirmations), ferric red (aborts).
 *
 * Motion: deliberate. One signature animation per surface — tape-feed for
 * the event stream, cursor-blink at the prompt, phosphor-pulse on the live
 * pip. No gratuitous hover micro-interactions.
 */
import { Link, NavLink, Outlet } from 'react-router-dom';
import { WalletButton } from './WalletButton';
import { SystemStatus } from './SystemStatus';

const NAV_ITEMS = [
  { to: '/',             code: '01', label: 'Run',          end: true  },
  { to: '/agent/last',   code: '02', label: 'Replay'  },
  { to: '/buy',          code: '03', label: 'Buy / x402' },
  { to: '/architecture', code: '04', label: 'Spec' },
];

export function Layout() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-rule sticky top-0 z-20 bg-ink-900/85 backdrop-blur">
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <Mark />
            <span className="hidden sm:flex flex-col leading-tight">
              <span className="font-mono text-[0.95rem] tracking-[0.32em] text-bone group-hover:text-phosphor transition-colors">
                AETHER
              </span>
              <span className="text-[0.6rem] tracking-widest text-bone-dim/70 -mt-px">
                REPLAYABLE&nbsp;AGENTS
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 ml-2 sm:ml-6 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden lg:inline-flex chip">
              <span className="text-phosphor">v0.1.0</span>
              <span className="text-bone-dim/70">·</span>
              <span>OpenAgents&nbsp;'26</span>
            </span>
            <WalletButton />
          </div>
        </div>
      </header>

      <SystemStatus />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-rule mt-12">
        <div className="max-w-[1280px] mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-4 gap-6 text-[0.72rem] uppercase tracking-widest text-bone-dim/70">
          <div>
            <div className="text-phosphor mb-2">FILE No.</div>
            <div className="text-bone">AETHER-26-04-OPENAGENTS</div>
          </div>
          <div>
            <div className="text-phosphor mb-2">CHAINS</div>
            <div className="text-bone">0G GALILEO · SEPOLIA · BASE-SEP.</div>
          </div>
          <div>
            <div className="text-phosphor mb-2">STANDARDS</div>
            <div className="text-bone">ERC-7857 · 8004 · x402 · EIP-3009</div>
          </div>
          <div>
            <div className="text-phosphor mb-2">CONTACT</div>
            <div className="text-bone">aaether.eth · agentId 4098</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavItem({
  to, code, label, end,
}: { to: string; code: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'group relative flex items-baseline gap-2 px-3 py-2 font-mono text-[0.78rem] uppercase tracking-[0.2em] transition-colors',
          isActive
            ? 'text-phosphor'
            : 'text-bone-dim hover:text-bone',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? 'text-phosphor/80' : 'text-bone-dim/40'}>{code}</span>
          <span>{label}</span>
          <span
            className={[
              'absolute left-3 right-3 -bottom-px h-px transition-colors',
              isActive ? 'bg-phosphor' : 'bg-transparent group-hover:bg-rule-bright',
            ].join(' ')}
          />
        </>
      )}
    </NavLink>
  );
}

function Mark() {
  // Stylised reticle — concentric brackets centred on a phosphor dot.
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" className="text-phosphor">
      <rect x="3"  y="3"  width="6" height="1" fill="currentColor" />
      <rect x="3"  y="3"  width="1" height="6" fill="currentColor" />
      <rect x="23" y="3"  width="6" height="1" fill="currentColor" />
      <rect x="28" y="3"  width="1" height="6" fill="currentColor" />
      <rect x="3"  y="28" width="6" height="1" fill="currentColor" />
      <rect x="3"  y="23" width="1" height="6" fill="currentColor" />
      <rect x="23" y="28" width="6" height="1" fill="currentColor" />
      <rect x="28" y="23" width="1" height="6" fill="currentColor" />
      <circle cx="16" cy="16" r="5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
      <line x1="16" y1="9"  x2="16" y2="13" stroke="currentColor" strokeWidth="1" />
      <line x1="16" y1="19" x2="16" y2="23" stroke="currentColor" strokeWidth="1" />
      <line x1="9"  y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1" />
      <line x1="19" y1="16" x2="23" y2="16" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
