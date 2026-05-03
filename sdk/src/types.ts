/** A 0x-prefixed hex string (any length). */
export type Hex = `0x${string}`;

/** Standard chat message shape (OpenAI-compatible). */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}
