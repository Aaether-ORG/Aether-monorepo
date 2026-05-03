import { expect } from 'chai';
import { ethers } from 'hardhat';
import { AetherVerifier } from '../typechain-types';

describe('AetherVerifier', () => {
  let verifier: AetherVerifier;
  let authority: any;
  let other: any;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    authority = signers[0];
    other = signers[1];
    const F = await ethers.getContractFactory('AetherVerifier');
    verifier = (await F.deploy(authority.address)) as unknown as AetherVerifier;
    await verifier.waitForDeployment();
  });

  it('exposes the authority address', async () => {
    expect(await verifier.authority()).to.equal(authority.address);
  });

  it('verifies a valid preimage proof', async () => {
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes('hello-world'));
    const claim = ethers.solidityPackedKeccak256(
      ['string', 'bytes32', 'address'],
      ['PREIMAGE', dataHash, authority.address]
    );
    const sig = await authority.signMessage(ethers.getBytes(claim));
    const proof = ethers.concat([dataHash, sig]);

    const out = await verifier.verifyPreimage.staticCall([proof]);
    expect(out.length).to.equal(1);
    expect(out[0].dataHash).to.equal(dataHash);
    expect(out[0].isValid).to.equal(true);
  });

  it('rejects a proof signed by the wrong key', async () => {
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes('hello'));
    const claim = ethers.solidityPackedKeccak256(
      ['string', 'bytes32', 'address'],
      ['PREIMAGE', dataHash, authority.address]
    );
    const sig = await other.signMessage(ethers.getBytes(claim));
    const proof = ethers.concat([dataHash, sig]);

    const out = await verifier.verifyPreimage.staticCall([proof]);
    expect(out[0].isValid).to.equal(false);
  });

  it('verifies a valid transfer-validity proof', async () => {
    const oldH = ethers.keccak256(ethers.toUtf8Bytes('old'));
    const newH = ethers.keccak256(ethers.toUtf8Bytes('new'));
    const receiver = other.address;
    const sealedKey = '0x' + 'aa'.repeat(16); // 16 bytes

    const claim = ethers.solidityPackedKeccak256(
      ['string', 'bytes32', 'bytes32', 'address', 'bytes16', 'address'],
      ['TRANSFER_VALIDITY', oldH, newH, receiver, sealedKey, authority.address]
    );
    const sig = await authority.signMessage(ethers.getBytes(claim));

    const proof = ethers.concat([
      oldH,
      newH,
      ethers.zeroPadValue(receiver, 20),
      sealedKey,
      sig,
    ]);

    const out = await verifier.verifyTransferValidity.staticCall([proof]);
    expect(out[0].oldDataHash).to.equal(oldH);
    expect(out[0].newDataHash).to.equal(newH);
    expect(out[0].receiver.toLowerCase()).to.equal(receiver.toLowerCase());
    expect(out[0].sealedKey).to.equal(sealedKey);
    expect(out[0].isValid).to.equal(true);
  });

  it('reverts on too-short proofs', async () => {
    await expect(verifier.verifyPreimage.staticCall(['0x1234']))
      .to.be.revertedWithCustomError(verifier, 'ProofTooShort');
  });
});
