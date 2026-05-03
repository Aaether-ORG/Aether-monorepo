import { expect } from 'chai';
import { ethers } from 'hardhat';
import { keccak256, solidityPackedKeccak256, toUtf8Bytes } from 'ethers';

describe('AmmoniteResolver', () => {
  it('returns static text records', async () => {
    const F = await ethers.getContractFactory('AmmoniteResolver');
    const r = await F.deploy(['https://gw.example/{sender}/{data}']);
    await r.waitForDeployment();

    const node = ethers.namehash('thornbury.aether.eth');
    await r.setText(node, 'agent.services.x402', 'https://example.com/.well-known/x402');
    expect(await r.text(node, 'agent.services.x402'))
      .to.equal('https://example.com/.well-known/x402');
  });

  it('reverts with OffchainLookup for dynamic keys', async () => {
    const F = await ethers.getContractFactory('AmmoniteResolver');
    const r = await F.deploy(['https://gw.example/{sender}/{data}']);
    await r.waitForDeployment();

    const node = ethers.namehash('thornbury.aether.eth');
    // agent.aether.head is dynamic by default
    await expect(r.text.staticCall(node, 'agent.aether.head'))
      .to.be.revertedWithCustomError(r, 'OffchainLookup');
  });

  it('decodes textCallback from gateway response', async () => {
    const F = await ethers.getContractFactory('AmmoniteResolver');
    const r = await F.deploy(['https://gw.example/{sender}/{data}']);
    await r.waitForDeployment();

    const expected = '0x' + 'ab'.repeat(32);
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(['string'], [expected]);
    const out = await r.textCallback.staticCall(encoded, '0x');
    expect(out).to.equal(expected);
  });
});
