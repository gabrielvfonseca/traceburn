import { formatTokens, formatUsd } from '@/pricing/index.js';
import { collectUsage, totalCost, unpricedModels } from '@/rules/usage.js';
import type { AgentRun } from '@/schema.js';
import type { Rule, RuleContext, RuleResult } from './engine.js';

/**
 * AL202: run cost — the aggregate money finding (informational).
 * Every number is an estimate against a date-stamped pricing table.
 */
export const ruleAl202: Rule = {
  evaluate(run: AgentRun, ctx: RuleContext): RuleResult {
    const turns = collectUsage(run, ctx.pricing);
    const unpriced = unpricedModels(turns);
    if (turns.length === 0) {
      return {
        findings: [],
        suppressions: [
          {
            reason: 'no assistant turns with token usage in this run',
            ruleId: 'AL202',
          },
        ],
      };
    }
    const cost = totalCost(turns);
    const totalBilled = turns.reduce((sum, turn) => sum + turn.billed, 0);
    const suppressions =
      unpriced.length === 0
        ? []
        : [
            {
              reason: `cost excludes turns from unpriced model(s): ${unpriced.join(', ')}`,
              ruleId: 'AL202',
            },
          ];
    return {
      findings: [
        {
          cost,
          eventIndexes: turns.map((turn) => turn.eventIndex),
          evidence: [
            `pricing as of ${ctx.pricing.asOf} (override with --pricing)`,
            ...unpriced.map((model) => `unpriced model: ${model}`),
          ],
          ruleId: 'AL202',
          summary:
            cost === undefined
              ? `est. cost unavailable (unpriced models); ${formatTokens(totalBilled)} tokens billed`
              : `est. ${formatUsd(cost)} across ${turns.length} priced turn(s), ${formatTokens(totalBilled)} tokens`,
          tier: 'info',
          title: 'run cost — estimated spend',
          tokens: totalBilled,
        },
      ],
      suppressions,
    };
  },
  id: 'AL202',
  tier: 'info',
  title: 'run cost — estimated spend',
};
