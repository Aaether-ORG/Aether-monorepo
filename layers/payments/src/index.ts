/**
 * @aether/payments — token-agnostic x402 settlement.
 *
 * The Uniswap pay-with-any-token plugin is client-side only. This module ships
 * the **server-side counterpart**: an x402 challenge envelope that lists multiple
 * acceptable tokens, plus a buyer-side helper that uses pay-with-any-token to
 * route a payment via Uniswap's Universal Router.
 */

export { x402Challenge, parseChallenge, type X402Challenge, type X402Accepts } from './x402.js';
export { payWithAnyToken, fetchWithPayment, type PayWithAnyTokenArgs, type PayResult } from './buyer.js';
