import { formatTokens } from '@/pricing/index.js';
import { collectUsage } from '@/rules/usage.js';
import type { AgentRun } from '@/schema.js';
import type { Finding, Rule, RuleContext, RuleResult } from './engine.js';

const MIN_TURNS = 4;

function cacheHitRate(
  context: readonly number[],
  cacheReads: readonly number[],
): number {
  const contextSum = context.reduce((sum, n) => sum + n, 0);
  const cacheSum = cacheReads.reduce((sum, n) => sum + n, 0);
  if (contextSum === 0) {
    return 1;
  }
  return cacheSum / contextSum;
}

/**
 * AL201: context bloat — prompt size growing across the run while the cache
 * does not absorb it. Signals a growing context window paying full price.
 */
export const ruleAl201: Rule = {
  evaluate(run: AgentRun, ctx: RuleContext): RuleResult {
    const turns = collectUsage(run, ctx.pricing);
    if (turns.length < MIN_TURNS) {
      return {
        findings: [],
        suppressions: [
          {
            reason: `only ${turns.length} assistant turn(s) with usage; need >= ${MIN_TURNS} to judge context growth`,
            ruleId: 'AL201',
          },
        ],
      };
    }
    const [first] = turns;
    const last = turns.at(-1);
    if (first === undefined || last === undefined || first.context === 0) {
      return {
        findings: [],
        suppressions: [
          {
            reason: 'first turn has no context tokens recorded',
            ruleId: 'AL201',
          },
        ],
      };
    }
    const growth = last.context / first.context;
    const laterHalf = turns.slice(Math.floor(turns.length / 2));
    const hitRate = cacheHitRate(
      laterHalf.map((turn) => turn.context),
      laterHalf.map((turn) => turn.usage.cacheRead ?? 0),
    );
    const bloats =
      growth >= ctx.bloatGrowthFactor || (growth >= 2 && hitRate < 0.2);
    if (!bloats) {
      return { findings: [], suppressions: [] };
    }
    const finding: Finding = {
      eventIndexes: [first.eventIndex, last.eventIndex],
      evidence: [
        `turns measured: ${turns.length}`,
        `cache-hit rate (back half): ${(hitRate * 100).toFixed(1)}%`,
        'check for accumulating tool results, repeated file reads, or prompt churn',
      ],
      ruleId: 'AL201',
      summary: `context grew ${growth.toFixed(1)}× (${formatTokens(first.context)} → ${formatTokens(last.context)} tokens) with ${(hitRate * 100).toFixed(0)}% cache-hit rate in the back half`,
      tier: 'warning',
      title: 'context bloat — growing prompt, weak cache absorption',
      tokens: Math.max(0, last.context - first.context),
    };
    return { findings: [finding], suppressions: [] };
  },
  id: 'AL201',
  tier: 'warning',
  title: 'context bloat — growing prompt, weak cache absorption',
};
