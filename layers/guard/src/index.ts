/**
 * @aether/guard — KeeperHub-backed reliability for x402 / agent transactions.
 *
 * Transport: HTTP MCP at `https://app.keeperhub.com/mcp`. We discover tools at
 * boot (`tools/list`), then call them by name. This way we don't hard-code
 * tool names that may shift between KeeperHub releases.
 *
 *   const guard = await createGuard();
 *   const r = await guard.submitTx({ to, data, value }, { tag: 'authz', routing: 'private' });
 */
import { ethers } from 'ethers';

export interface GuardConfig {
  mcpUrl: string;     // e.g. https://app.keeperhub.com/mcp
  apiBase: string;    // e.g. https://api.keeperhub.com (for REST fallback)
  token: string;      // Bearer
  projectId?: string;
  defaultRouting?: 'public' | 'private';
}

export interface GuardSubmitArgs {
  to: string;
  data: string;
  value?: bigint;
  sla?: string;
  routing?: 'public' | 'private';
  maxRetries?: number;
  fallback?: 'mpp' | 'refund' | 'none';
  tag?: string;
  chainId?: number;
}

export interface GuardResult {
  txHash: string;
  workflowId: string;
  auditId: string;
  attempts: number;
  fallbackUsed?: 'mpp' | 'refund';
  raw?: unknown;
}

export interface GuardSubmitOptions {
  awaitCompletion?: boolean;
  pollMs?: number;
  timeoutMs?: number;
}

interface MCPToolDef {
  name: string;
  description?: string;
  inputSchema?: any;
}

export class Guard {
  private toolCache: MCPToolDef[] | null = null;
  private mcpSessionId: string | null = null;

  constructor(private config: GuardConfig) {}

  /** Discover available MCP tools at runtime. */
  async listTools(): Promise<MCPToolDef[]> {
    if (this.toolCache) return this.toolCache;
    try {
      const tools = await this.mcpRpc<{ tools: MCPToolDef[] }>('tools/list', {});
      this.toolCache = tools.tools ?? [];
      return this.toolCache;
    } catch (e) {
      // MCP discovery failed — return empty, fall back to REST.
      this.toolCache = [];
      return [];
    }
  }

  async submit(args: GuardSubmitArgs, opts: GuardSubmitOptions = {}): Promise<GuardResult> {
    // Try MCP first; fall back to REST if MCP discovery turns up empty.
    const tools = await this.listTools();

    // Heuristic match for the workflow-creation tool. Names observed across
    // KeeperHub builds: "create_workflow", "workflow_create", "workflows.create".
    const createTool = tools.find((t) =>
      /create.*workflow|workflow.*create/i.test(t.name),
    );

    if (createTool) {
      return await this.submitViaMCP(createTool.name, args, opts);
    }
    return await this.submitViaREST(args, opts);
  }

  private async submitViaMCP(toolName: string, args: GuardSubmitArgs, opts: GuardSubmitOptions): Promise<GuardResult> {
    // Send-best-effort body; KeeperHub schema may use different field names.
    const body = {
      name: `aether-${args.tag ?? 'tx'}-${Date.now()}`,
      project_id: this.config.projectId,
      chain_id: args.chainId ?? 16601,
      nodes: [{
        id: 'submit',
        type: 'submit_transaction',
        config: {
          to: args.to,
          data: args.data,
          value: (args.value ?? 0n).toString(),
          routing: args.routing ?? this.config.defaultRouting ?? 'private',
          retry: { max: args.maxRetries ?? 3, strategy: 'exponential' },
          sla: args.sla,
        },
      }],
      edges: [],
    };

    const res = await this.mcpRpc<any>('tools/call', {
      name: toolName,
      arguments: body,
    });

    const out = res.content?.[0]?.text
      ? safeJsonParse(res.content[0].text)
      : res;

    const workflowId = out.workflowId ?? out.workflow_id ?? out.id;
    if (!workflowId) {
      throw new Error(`Guard: no workflowId in MCP response: ${JSON.stringify(out)}`);
    }

    if (opts.awaitCompletion === false) {
      return {
        txHash: '',
        workflowId,
        auditId: out.executionId ?? out.execution_id ?? workflowId,
        attempts: 0,
        raw: out,
      };
    }
    return await this.awaitWorkflow(workflowId, opts);
  }

  private async submitViaREST(args: GuardSubmitArgs, opts: GuardSubmitOptions): Promise<GuardResult> {
    const url = `${this.config.apiBase.replace(/\/$/, '')}/workflows`;
    const body = {
      name: `aether-${args.tag ?? 'tx'}-${Date.now()}`,
      projectId: this.config.projectId,
      chainId: args.chainId ?? 16601,
      nodes: [{
        id: 'submit',
        type: 'submit_transaction',
        config: {
          to: args.to,
          data: args.data,
          value: (args.value ?? 0n).toString(),
          routing: args.routing ?? this.config.defaultRouting ?? 'private',
          retry: { max: args.maxRetries ?? 3, strategy: 'exponential' },
          sla: args.sla,
        },
      }],
      edges: [],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Guard.submitViaREST failed: ${res.status} ${await res.text()}`);
    const out = await res.json() as any;
    const workflowId: string = out.workflowId ?? out.workflow_id ?? out.id;
    const auditId: string = out.auditId ?? out.audit_id ?? out.executionId ?? out.execution_id ?? workflowId;

    if (opts.awaitCompletion === false) {
      return { txHash: '', workflowId, auditId, attempts: 0, raw: out };
    }
    return await this.awaitWorkflow(workflowId, opts);
  }

  async awaitWorkflow(workflowId: string, opts: GuardSubmitOptions = {}): Promise<GuardResult> {
    const pollMs = opts.pollMs ?? 1500;
    const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
    while (Date.now() < deadline) {
      await sleep(pollMs);
      const status = await this.getWorkflow(workflowId);
      const phase = status.status ?? status.phase;
      if (phase === 'completed' || phase === 'success') {
        return {
          txHash: status.txHash ?? status.tx_hash ?? '',
          workflowId,
          auditId: status.auditId ?? status.audit_id ?? workflowId,
          attempts: status.attempts ?? 1,
          fallbackUsed: status.fallbackUsed ?? status.fallback_used,
          raw: status,
        };
      }
      if (phase === 'failed' || phase === 'error') {
        throw new Error(`Guard workflow ${workflowId} failed: ${status.error ?? JSON.stringify(status)}`);
      }
    }
    throw new Error(`Guard workflow ${workflowId} timed out after ${opts.timeoutMs ?? 90_000}ms`);
  }

  async getWorkflow(workflowId: string): Promise<any> {
    const url = `${this.config.apiBase.replace(/\/$/, '')}/workflows/${workflowId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    });
    if (!res.ok) throw new Error(`getWorkflow ${workflowId}: ${res.status}`);
    return await res.json();
  }

  async submitTx(
    tx: { to: string; data?: string; value?: bigint },
    opts: Omit<GuardSubmitArgs, 'to' | 'data' | 'value'> = {},
    runOpts: GuardSubmitOptions = {},
  ): Promise<GuardResult> {
    return this.submit({
      to: tx.to,
      data: tx.data ?? '0x',
      value: tx.value,
      ...opts,
    }, runOpts);
  }

  /**
   * Direct contract call via KeeperHub's `execute_contract_call` MCP tool.
   * Simpler than workflow construction — just submits the tx and returns the
   * execution ID, no node graph needed.
   *
   * KeeperHub schema (verified via tools/list):
   *   contract_address: string
   *   network: string (chainId as string, e.g. "16602")
   *   function_name: string (e.g. "authorizeUsage")
   *   function_args: JSON array string, e.g. '["0", "0x..."]'
   *   abi (optional): contract ABI as JSON string. Auto-fetched if verified.
   *   value: wei as string
   */
  async executeContractCall(args: {
    chainId: number;
    contractAddress: string;
    /** function name only, e.g. 'authorizeUsage' */
    functionName: string;
    args: unknown[];
    /** Optional contract ABI as parsed JS object (will be JSON.stringify'd). */
    abi?: unknown[];
    value?: string;
    gasLimitMultiplier?: string;
    priorityFeeGwei?: string;
  }): Promise<{ executionId: string; txHash?: string; raw: any }> {
    await this.ensureMCPSession();
    const result = await this.mcpRpc<any>('tools/call', {
      name: 'execute_contract_call',
      arguments: {
        contract_address: args.contractAddress,
        network: String(args.chainId),
        function_name: args.functionName,
        function_args: JSON.stringify(args.args),
        ...(args.abi ? { abi: JSON.stringify(args.abi) } : {}),
        ...(args.value ? { value: args.value } : {}),
        ...(args.gasLimitMultiplier ? { gas_limit_multiplier: args.gasLimitMultiplier } : {}),
        ...(args.priorityFeeGwei ? { priority_fee_gwei: args.priorityFeeGwei } : {}),
      },
    });
    const out = result?.content?.[0]?.text
      ? safeJsonParse(result.content[0].text)
      : result;
    if (process.env.GUARD_DEBUG) {
      console.log('[guard] execute_contract_call result:', JSON.stringify(out, null, 2));
    }
    return {
      executionId:
        out.executionId ?? out.execution_id ?? out.executionID ??
        out.id ?? out.directExecutionId ?? out.direct_execution_id ??
        out.txId ?? 'unknown',
      txHash:
        out.txHash ?? out.tx_hash ?? out.transactionHash ?? out.transaction_hash,
      raw: out,
    };
  }

  /** Initialize MCP session (handshake + notifications/initialized). */
  private async ensureMCPSession(): Promise<void> {
    if (this.mcpSessionId) return;
    const res = await fetch(this.config.mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${this.config.token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'aether-guard', version: '0.1.0' },
        },
      }),
    });
    if (!res.ok) throw new Error(`MCP initialize failed: ${res.status}`);
    const sid = res.headers.get('mcp-session-id');
    if (!sid) throw new Error('MCP no session id');
    this.mcpSessionId = sid;
    // notifications/initialized
    await fetch(this.config.mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${this.config.token}`,
        'mcp-session-id': sid,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
  }

  /** Low-level MCP JSON-RPC (uses session). Handles SSE-style responses. */
  private async mcpRpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
    await this.ensureMCPSession();
    const res = await fetch(this.config.mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${this.config.token}`,
        'mcp-session-id': this.mcpSessionId!,
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: Date.now(), method, params,
      }),
    });
    if (!res.ok) throw new Error(`MCP ${method}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    let parsed: any;
    if (text.startsWith('event:') || text.includes('\ndata:')) {
      const dataLine = text.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) throw new Error(`MCP ${method}: SSE has no data line`);
      parsed = JSON.parse(dataLine.slice(5).trim());
    } else {
      parsed = JSON.parse(text);
    }
    if (parsed.error) throw new Error(`MCP error: ${parsed.error.message ?? JSON.stringify(parsed.error)}`);
    return parsed.result;
  }
}

export function createGuard(config?: Partial<GuardConfig>): Guard {
  const cfg: GuardConfig = {
    mcpUrl: config?.mcpUrl ?? process.env.KEEPERHUB_MCP_URL ?? 'https://app.keeperhub.com/mcp',
    apiBase: config?.apiBase ?? process.env.KEEPERHUB_API_BASE ?? 'https://api.keeperhub.com',
    token: config?.token ?? process.env.KEEPERHUB_TOKEN ?? '',
    projectId: config?.projectId ?? process.env.KEEPERHUB_PROJECT_ID,
    defaultRouting: config?.defaultRouting ?? 'private',
  };
  if (!cfg.token) {
    throw new Error('Guard requires KEEPERHUB_TOKEN. Get one at https://app.keeperhub.com');
  }
  return new Guard(cfg);
}

export async function guardCall(
  contract: ethers.Contract,
  method: string,
  args: unknown[],
  opts: { sla?: string; routing?: 'public' | 'private'; tag?: string } = {},
): Promise<GuardResult> {
  const guard = createGuard();
  const data = contract.interface.encodeFunctionData(method, args);
  const to = await contract.getAddress();
  return guard.submitTx({ to, data }, opts, { awaitCompletion: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJsonParse(s: string): any {
  try { return JSON.parse(s); } catch { return s; }
}
