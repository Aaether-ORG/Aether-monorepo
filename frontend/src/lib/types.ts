/** Frontend mirror of the SDK's event types (kept in sync manually for the demo). */

export type Hex = `0x${string}`;

export type EventType =
  | 'inference'
  | 'tool_call'
  | 'observation'
  | 'state_mutation'
  | 'mint';

export interface BaseEvent {
  type: EventType;
  ts: number;
  prevHash: Hex;
}

export interface InferenceEvent extends BaseEvent {
  type: 'inference';
  model: string;
  promptHash: Hex;
  outputHash: Hex;
  attestation: {
    signature: Hex;
    modelId: string;
    providerAddress: string;
    certFingerprint?: Hex;
  };
}

export interface ToolCallEvent extends BaseEvent {
  type: 'tool_call';
  tool: string;
  argsHash: Hex;
  resultHash: Hex;
}

export interface ObservationEvent extends BaseEvent {
  type: 'observation';
  source: string;
  contentHash: Hex;
}

export interface StateMutationEvent extends BaseEvent {
  type: 'state_mutation';
  key: string;
  prevValueHash: Hex;
  newValueHash: Hex;
}

export interface MintEvent extends BaseEvent {
  type: 'mint';
  tokenId: string;
  contract: string;
  metadataHash: Hex;
}

export type AetherEvent =
  | InferenceEvent
  | ToolCallEvent
  | ObservationEvent
  | StateMutationEvent
  | MintEvent;
