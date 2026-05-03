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
        className="btn-primary"
        onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      >
        Connect Wallet
      </button>
    );
  }

  const wrongChain = chainId !== ogGalileo.id;
  return (
    <div className="flex items-center gap-2">
      {wrongChain && (
        <button
          className="btn-ghost text-warn"
          onClick={() => switchChain({ chainId: ogGalileo.id })}
        >
          Switch to 0G Galileo
        </button>
      )}
      <span className="pill-neutral">{shorten(address ?? '')}</span>
      <button className="btn-ghost text-bad" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
}
