import { formatTokens, formatUsd } from '@/pricing/index.js';
import { collectUsage, totalCost } from '@/rules/usage.js';
import type { AgentRun } from '@/schema.js';
import type { Finding, Rule, RuleContext, RuleResult } from './engine.js';

const MAX_HOTSPOTS = 5;

/**
 * AL200: token hotspot — turns accounting for an outsized share of run spend.
 * This is the headline money rule: "turn 12 cost $0.41 (38% of run)".
 */
export const ruleAl200: Rule = {
  evaluate(run: AgentRun, ctx: RuleContext): RuleResult {
    const turns = collectUsage(run, ctx.pricing);
    const pricedTurns = turns.filter((turn) => turn.cost !== undefined);
    const total = totalCost(pricedTurns);
    if (total === undefined || total <= 0) {
      return {
        findings: [],
        suppressions:
          turns.length === 0
            ? [
                {
                  reason: 'no assistant turns with token usage in this run',
                  ruleId: 'AL200',
                },
              ]
            : [
                {
                  reason:
                    'no priced model matched; re-run with --pricing to estimate spend',
                  ruleId: 'AL200',
                },
              ],
      };
    }
    const hotspots = pricedTurns
      .filter((turn) => (turn.cost ?? 0) / total >= ctx.hotspotShare)
      .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
      .slice(0, MAX_HOTSPOTS);
    const findings: Finding[] = hotspots.map((turn) => {
      const share = ((turn.cost ?? 0) / total) * 100;
      return {
        cost: turn.cost,
        eventIndexes: [turn.eventIndex],
        evidence: [
          `model: ${turn.model ?? 'unknown'}`,
          `tokens: ${formatTokens(turn.usage.input)} in / ${formatTokens(turn.usage.output)} out / ${formatTokens(turn.usage.cacheRead ?? 0)} cache-read / ${formatTokens(turn.usage.cacheCreate ?? 0)} cache-create`,
          `context carried: ${formatTokens(turn.context)} tokens`,
        ],
        meta: { sharePercent: Math.round(share) },
        ruleId: 'AL200',
        summary: `turn at event ${turn.eventIndex} cost ${formatUsd(turn.cost ?? 0)} — ${share.toFixed(0)}% of run spend (${formatTokens(turn.billed)} tokens)`,
        tier: 'warning',
        title: 'token hotspot — outsized per-turn spend',
        tokens: turn.billed,
      };
    });
    return { findings, suppressions: [] };
  },
  id: 'AL200',
  tier: 'warning',
  title: 'token hotspot — outsized per-turn spend',
};
