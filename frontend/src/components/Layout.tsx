import { Link, NavLink, Outlet } from 'react-router-dom';
import { WalletButton } from './WalletButton';

export function Layout() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-ink-200/10 backdrop-blur sticky top-0 z-10 bg-ink-900/70">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <Logo />
            <span className="font-mono text-lg tracking-tight">aether</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavItem to="/">Run</NavItem>
            <NavItem to="/agent/last">Replay</NavItem>
            <NavItem to="/buy">Buy report</NavItem>
            <NavItem to="/architecture">Architecture</NavItem>
          </nav>
          <WalletButton />
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-ink-200/10 py-6">
        <div className="max-w-6xl mx-auto px-6 flex justify-between text-sm text-ink-400">
          <span>aether — replayable agents on 0G</span>
          <span className="font-mono">v0.1.0 · ETHGlobal OpenAgents</span>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          isActive ? 'bg-ink-200/10 text-ink-50' : 'text-ink-400 hover:text-ink-100'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" className="text-accent">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="currentColor" stopOpacity="1"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.4"/>
        </linearGradient>
      </defs>
      <path
        d="M16 4 L28 26 L4 26 Z"
        fill="url(#g1)"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="20" r="2" fill="currentColor" />
    </svg>
  );
}
