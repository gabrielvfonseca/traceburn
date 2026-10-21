import { type AgentRun, pairCallsWithResults } from '@/schema.js';
import type { Finding, Rule, RuleContext, RuleResult } from './engine.js';

/**
 * AL103: a tool returned an error. Structured signal from the trace; hard_event.
 * Reported for review — a single error may be benign, but it is a real event.
 */
export const ruleAl103: Rule = {
  evaluate(run: AgentRun, _ctx: RuleContext): RuleResult {
    const findings: Finding[] = [];
    for (const entry of pairCallsWithResults(run)) {
      if (entry.result === undefined || entry.result.isError !== true) {
        continue;
      }
      findings.push({
        eventIndexes: [entry.eventIndex],
        evidence: [
          `call: ${entry.call.name}`,
          `result: ${entry.result?.contentPreview ?? '(no result)'}`,
          `at event: ${entry.eventIndex}`,
        ],
        meta: { tool: entry.call.name },
        ruleId: 'AL103',
        summary: `tool call \`${entry.call.name}\` (${entry.call.id}) returned an error`,
        tier: 'hard_event',
        title: 'tool error — call returned an error result',
      });
    }
    return { findings, suppressions: [] };
  },
  id: 'AL103',
  tier: 'hard_event',
  title: 'tool error — call returned an error result',
};
