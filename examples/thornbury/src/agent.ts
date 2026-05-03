/**
 * The Thornbury research agent — fully wired against real 0G + arxiv.
 *
 * Usage:
 *   const agent = await createThornbury({ ownerWallet, computeProviderAddress, ... });
 *   for await (const evt of agent.run("your question")) {
 *     // events stream as the agent works
 *   }
 *   await agent.mint();
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(import.meta.dirname, '..', '..', '..', '.env') });

import { ethers } from 'ethers';
import { Aether, type AetherConfig, type AetherEvent } from '@aether/sdk';
import { arxivSearch, fetchArxivAbstract, type ArxivPaper } from './arxiv.js';

export interface ThornburyConfig extends Omit<AetherConfig, 'agentName'> {
  reportStorage?: Map<string, string>; // optional: caller can supply a store for completed reports
}

export interface ThornburyResult {
  question: string;
  papers: ArxivPaper[];
  summaries: { paper: ArxivPaper; summary: string; eventHash: string }[];
  finalReport: string;
  /** 0G Storage root hash of the encrypted final report blob. */
  reportRoot?: string;
  /** 0G Storage tx hash for the report upload. */
  reportTxHash?: string;
  /** Filled if mint succeeds. */
  tokenId?: bigint;
  txHash?: string;
  /** Master key (16 bytes, hex) — needed to decrypt the report blob. Sealed in iNFT for the owner. */
  masterKeyHex?: string;
}

export async function createThornbury(config: ThornburyConfig): Promise<{
  aether: Aether;
  research: (question: string) => Promise<ThornburyResult>;
}> {
  const aether = await Aether.create({ ...config, agentName: 'Thornbury' });

  async function research(question: string): Promise<ThornburyResult> {
    // 1. Search arxiv (logged as a tool call). 2 papers keeps demo fast.
    const papers = await aether.tool('arxiv_search', { q: question, max: 2 }, async () => {
      return await arxivSearch(question, 2);
    });

    // 2. For each paper: observe + fetch abstract
    for (const p of papers) {
      const abs = await aether.tool('fetch_abstract', { arxivId: p.id }, async () => {
        return await fetchArxivAbstract(p);
      });
      await aether.observe(p.url, { id: p.id, title: p.title, abstract: abs });
    }

    // 3. Summarize each (attested 0G Compute call per paper)
    const summaries: ThornburyResult['summaries'] = [];
    for (const paper of papers) {
      const result = await aether.chat([
        {
          role: 'system',
          content:
            'You are a research analyst. Summarize the following paper in 80–120 words for an expert reader. Prioritize claims, methodology, and limitations.',
        },
        {
          role: 'user',
          content: `Title: ${paper.title}\nArxiv ID: ${paper.id}\nAuthors: ${paper.authors.join(', ')}\n\nAbstract:\n${paper.abstract}`,
        },
      ]);
      summaries.push({ paper, summary: result.content, eventHash: result.eventHash });
    }

    // 4. Synthesize a final report (attested)
    const synth = await aether.chat([
      {
        role: 'system',
        content:
          'You are a research synthesizer. Produce a comprehensive answer using the supplied paper summaries. Cite arxiv IDs in brackets. End with an "Open questions" section.',
      },
      {
        role: 'user',
        content: `Question: ${question}\n\n${summaries
          .map((s) => `[${s.paper.id}] ${s.paper.title}\n${s.summary}`)
          .join('\n\n')}`,
      },
    ]);
    const finalReport = synth.content;

    // 5. Upload the final report as a full encrypted blob to 0G Storage.
    //    This is what the buyer decrypts after `authorizeUsage`.
    const reportBlob = await aether.uploadBlob(
      JSON.stringify({ question, finalReport, papers, summaries: summaries.map((s) => ({ id: s.paper.id, summary: s.summary })) }, null, 2),
    );

    // 6. Persist a state mutation pointing at the report root
    await aether.setState(`report:${question}`, {
      reportRoot: reportBlob.rootHash,
      finalReportLength: finalReport.length,
      paperCount: papers.length,
    });

    return {
      question,
      papers,
      summaries,
      finalReport,
      reportRoot: reportBlob.rootHash,
      reportTxHash: reportBlob.txHash,
      masterKeyHex: '0x' + Buffer.from(aether.currentMasterKey).toString('hex'),
    };
  }

  return { aether, research };
}

/**
 * One-shot runner used by `run-research.ts`. Returns the full result + mint.
 */
export async function runThornburyOnce(args: {
  question: string;
  attemptMint?: boolean;
}): Promise<ThornburyResult> {
  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!);
  const wallet = new ethers.Wallet(process.env.AGENT_OWNER_PRIVATE_KEY!, provider);

  const { aether, research } = await createThornbury({
    rpcUrl: process.env.ZG_RPC_URL!,
    indexerUrl: process.env.ZG_INDEXER_RPC_URL!,
    ownerWallet: wallet,
    computeProviderAddress: process.env.ZG_COMPUTE_PROVIDER_ADDRESS!,
    defaultModel: process.env.ZG_COMPUTE_DEFAULT_MODEL ?? 'glm-5-fp8',
    agentNFTAddress: process.env.AGENT_NFT_ADDRESS,
    verifierAddress: process.env.AETHER_VERIFIER_ADDRESS,
    storeContent: process.env.AETHER_STORE_CONTENT === 'full' ? 'full' : 'hashes',
    storageMode: 'batched', // single 0G Storage upload at flush() — much faster on testnet
  });

  // Pipe events to console for visibility
  aether.on((evt: AetherEvent, eventHash) => {
    console.log(`  [${evt.type}] ${eventHash.slice(0, 12)}…`);
  });

  const result = await research(args.question);

  if (args.attemptMint && process.env.AGENT_NFT_ADDRESS) {
    try {
      const minted = await aether.mint();
      result.tokenId = minted.tokenId;
      result.txHash = minted.txHash;
      console.log(`Minted iNFT #${minted.tokenId}, tx ${minted.txHash}`);
    } catch (e: any) {
      console.warn('Mint failed:', e?.message ?? e);
    }
  }

  return result;
}
