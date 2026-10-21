import { readFileSync } from 'node:fs';
import type { TokenUsage } from '@/schema.js';

export interface ModelPrice {
  cacheCreateMultiple: number;
  cacheReadFraction: number;
  input: number;
  output: number;
}

export interface PricingTable {
  asOf: string;
  currency: string;
  models: Record<string, ModelPrice>;
  note: string;
}

/** Longest-prefix match of a model id against the pricing table. */
export function resolvePrice(
  model: string | undefined,
  table: PricingTable,
): ModelPrice | undefined {
  if (!model) {
    return undefined;
  }
  const m = model.toLowerCase();
  let best: { key: string; price: ModelPrice } | undefined;
  for (const [key, price] of Object.entries(table.models)) {
    if (
      (m === key.toLowerCase() || m.includes(key.toLowerCase())) &&
      (!best || key.length > best.key.length)
    ) {
      best = { key, price };
    }
  }
  return best?.price;
}

export function estimateCost(usage: TokenUsage, price: ModelPrice): number {
  const input = usage.input * price.input;
  const output = usage.output * price.output;
  const cacheRead =
    (usage.cacheRead ?? 0) * price.input * price.cacheReadFraction;
  const cacheCreate =
    (usage.cacheCreate ?? 0) * price.input * price.cacheCreateMultiple;
  return (input + output + cacheRead + cacheCreate) / 1_000_000;
}

/** Total prompt (context) tokens carried into a turn. */
export function contextTokens(usage: TokenUsage): number {
  return usage.input + (usage.cacheRead ?? 0) + (usage.cacheCreate ?? 0);
}

export function billedTokens(usage: TokenUsage): number {
  return (
    usage.input +
    usage.output +
    (usage.cacheRead ?? 0) +
    (usage.cacheCreate ?? 0)
  );
}

const DEFAULT_PRICING: PricingTable = {
  asOf: '2026-10',
  currency: 'USD',
  models: {
    'claude-3-5-haiku': {
      cacheCreateMultiple: 1.25,
      cacheReadFraction: 0.1,
      input: 0.8,
      output: 4,
    },
    'claude-3-7-sonnet': {
      cacheCreateMultiple: 1.25,
      cacheReadFraction: 0.1,
      input: 3,
      output: 15,
    },
    'claude-haiku-4-5': {
      cacheCreateMultiple: 1.25,
      cacheReadFraction: 0.1,
      input: 1,
      output: 5,
    },
    'claude-opus-4-1': {
      cacheCreateMultiple: 1.25,
      cacheReadFraction: 0.1,
      input: 15,
      output: 75,
    },
    'claude-opus-4-5': {
      cacheCreateMultiple: 1.25,
      cacheReadFraction: 0.1,
      input: 5,
      output: 25,
    },
    'claude-sonnet-4-5': {
      cacheCreateMultiple: 1.25,
      cacheReadFraction: 0.1,
      input: 3,
      output: 15,
    },
    'claude-sonnet-4-20250514': {
      cacheCreateMultiple: 1.25,
      cacheReadFraction: 0.1,
      input: 3,
      output: 15,
    },
    'gemini-2.5-flash': {
      cacheCreateMultiple: 1,
      cacheReadFraction: 0.25,
      input: 0.3,
      output: 2.5,
    },
    'gemini-2.5-pro': {
      cacheCreateMultiple: 1,
      cacheReadFraction: 0.25,
      input: 1.25,
      output: 10,
    },
    'gpt-4.1': {
      cacheCreateMultiple: 1,
      cacheReadFraction: 0.25,
      input: 2,
      output: 8,
    },
    'gpt-4.1-mini': {
      cacheCreateMultiple: 1,
      cacheReadFraction: 0.25,
      input: 0.4,
      output: 1.6,
    },
    'gpt-4.1-nano': {
      cacheCreateMultiple: 1,
      cacheReadFraction: 0.25,
      input: 0.1,
      output: 0.4,
    },
    'gpt-4o': {
      cacheCreateMultiple: 1,
      cacheReadFraction: 0.5,
      input: 2.5,
      output: 10,
    },
    'gpt-4o-mini': {
      cacheCreateMultiple: 1,
      cacheReadFraction: 0.5,
      input: 0.15,
      output: 0.6,
    },
    o3: {
      cacheCreateMultiple: 1,
      cacheReadFraction: 0.5,
      input: 10,
      output: 40,
    },
    'o3-mini': {
      cacheCreateMultiple: 1,
      cacheReadFraction: 0.5,
      input: 1.1,
      output: 4.4,
    },
    'o4-mini': {
      cacheCreateMultiple: 1,
      cacheReadFraction: 0.5,
      input: 1.1,
      output: 4.4,
    },
  },
  note: 'Prices in USD per 1M tokens. cacheRead is billed as a fraction of input; cacheCreate as a multiple of input. Estimates only.',
};

let cachedTable: PricingTable | undefined;

export function loadPricing(path?: string): PricingTable {
  if (path) {
    return JSON.parse(readFileSync(path, 'utf8')) as PricingTable;
  }
  if (!cachedTable) {
    cachedTable = DEFAULT_PRICING;
  }
  return cachedTable;
}

export function formatUsd(n: number): string {
  if (n === 0) {
    return '$0';
  }
  if (n < 0.01) {
    return `$${n.toFixed(4)}`;
  }
  return `$${n.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(n);
}
