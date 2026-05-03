export function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <div className="card prose prose-invert prose-sm max-w-none">
        <h1>Architecture</h1>
        <p>
          Aether is a runtime layer over <strong>0glabs/0g-agent-nft</strong> (the official ERC-7857 reference)
          and <strong>0G Compute</strong> (sealed inference). We don't replace those — we add the missing
          piece: a typed event log that captures every action and freezes it as a transferable iNFT.
        </p>

        <h2>What we deploy</h2>
        <ul>
          <li><span className="font-mono text-accent">AetherVerifier.sol</span> — signature-based <code>IERC7857DataVerifier</code></li>
          <li><span className="font-mono text-accent">AgentNFT.sol</span> — 0G's reference contract, unchanged, pointed at our verifier</li>
        </ul>

        <h2>Cross-track layers</h2>
        <ul>
          <li><strong>Ammonite</strong> — ENS dynamic agent cards (ENSIP-25 + Durin + CCIP-Read)</li>
          <li><strong>Guard</strong> — KeeperHub-backed reliability for x402 settlements</li>
          <li><strong>Payments</strong> — server-side x402 envelope for Uniswap pay-with-any-token</li>
        </ul>

        <h2>Event types</h2>
        <table>
          <thead>
            <tr><th>Type</th><th>Captured fields</th></tr>
          </thead>
          <tbody>
            <tr><td><code>inference</code></td><td>model, promptHash, outputHash, TEE attestation</td></tr>
            <tr><td><code>tool_call</code></td><td>tool, argsHash, resultHash</td></tr>
            <tr><td><code>observation</code></td><td>source URL, contentHash</td></tr>
            <tr><td><code>state_mutation</code></td><td>key, prev/new value hashes</td></tr>
            <tr><td><code>mint</code></td><td>tokenId, contract, metadataHash</td></tr>
          </tbody>
        </table>

        <h2>Hash chain</h2>
        <pre className="font-mono text-xs">eventHash = keccak256(prevHash || canonicalJSON(event))</pre>
        <p>
          Each event's <code>prevHash</code> field links to the previous event's hash. Tampering with any
          event invalidates every downstream link, so the whole agent history is verifiable in one walk.
        </p>

        <h2>Storage</h2>
        <p>
          Every event is encrypted with the agent's 16-byte AES-128 master key (matching ERC-7857's <code>bytes16 sealedKey</code>
          ) and uploaded as a single file via <code>Indexer.upload(MemData, …)</code>. The iNFT's <code>dataHashes[0]</code> is
          the chained Merkle root over all event root hashes.
        </p>

        <h2>Transfer flow</h2>
        <ol>
          <li>New owner publishes their pubKey via off-chain signal</li>
          <li>TEE worker re-encrypts master key for new owner ⇒ new <code>sealedKey</code> (16 bytes)</li>
          <li>TEE worker signs <code>(oldHash, newHash, receiver, sealedKey, authority)</code> claim</li>
          <li>SDK calls <code>AgentNFT.transfer(receiver, tokenId, [proof])</code></li>
          <li>AetherVerifier verifies signature; AgentNFT emits <code>PublishedSealedKey</code></li>
          <li>New owner reads sealedKey from event, decrypts master key, replays full history</li>
        </ol>
      </div>
    </div>
  );
}
