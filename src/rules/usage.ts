import type { PricingTable } from '@/pricing/index.js';
import {
  billedTokens,
  contextTokens,
  estimateCost,
  resolvePrice,
} from '@/pricing/index.js';
import type { AgentRun, TokenUsage } from '@/schema.js';

export interface TurnUsage {
  billed: number;
  context: number;
  /** estimated USD; undefined when the model has no price */
  cost: number | undefined;
  eventIndex: number;
  model: string | undefined;
  ts: string | undefined;
  usage: TokenUsage;
}

export function collectUsage(
  run: AgentRun,
  pricing: PricingTable,
): TurnUsage[] {
  return run.events.flatMap((event, index) => {
    if (
      event.type !== 'message' ||
      event.role !== 'assistant' ||
      event.usage === undefined
    ) {
      return [];
    }
    const price = resolvePrice(event.model, pricing);
    return [
      {
        billed: billedTokens(event.usage),
        context: contextTokens(event.usage),
        cost:
          price === undefined ? undefined : estimateCost(event.usage, price),
        eventIndex: index,
        model: event.model,
        ts: event.ts,
        usage: event.usage,
      } satisfies TurnUsage,
    ];
  });
}

export function totalCost(turns: readonly TurnUsage[]): number | undefined {
  const costs = turns.flatMap((turn) =>
    turn.cost === undefined ? [] : [turn.cost],
  );
  if (costs.length === 0) {
    return undefined;
  }
  return costs.reduce((sum, cost) => sum + cost, 0);
}

export function unpricedModels(turns: readonly TurnUsage[]): string[] {
  const names = turns.flatMap((turn) =>
    turn.cost === undefined && turn.model !== undefined ? [turn.model] : [],
  );
  return [...new Set(names)];
}
