import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { ogGalileo } from '@/lib/wagmi';
import { shorten } from '@/lib/format';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    const injectedConnector = connectors.find((c) => c.id === 'injected');
    return (
      <button
        className="key-cap"
        onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      >
        <span className="pip pip-on" />
        AUTH&nbsp;NODE
      </button>
    );
  }

  const wrongChain = chainId !== ogGalileo.id;
  return (
    <div className="flex items-center gap-2">
      {wrongChain && (
        <button
          className="key-cap-ghost"
          style={{ borderColor: '#FFB454', color: '#FFB454' }}
          onClick={() => switchChain({ chainId: ogGalileo.id })}
          title="Switch to 0G Galileo (chain 16602)"
        >
          ⇆ 0G&nbsp;GALILEO
        </button>
      )}
      <span className="chip chip-go">
        <span className="pip pip-go animate-pulse-soft" />
        <span className="font-mono nums-tabular tracking-normal normal-case text-bone">
          {shorten(address ?? '')}
        </span>
      </span>
      <button
        className="key-cap-ghost hover:!border-ferric hover:!text-ferric"
        onClick={() => disconnect()}
        title="Disconnect wallet"
      >
        ⏻
      </button>
    </div>
  );
}
