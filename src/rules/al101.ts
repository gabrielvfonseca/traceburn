import { type AgentRun, pairCallsWithResults } from '@/schema.js';
import type { Finding, Rule, RuleContext, RuleResult } from './engine.js';

/**
 * AL101: malformed arguments — the emitted tool-call arguments are not valid JSON.
 * Structurally decidable from argsRaw alone; no LLM judge needed. hard_defect.
 */
export const ruleAl101: Rule = {
  evaluate(run: AgentRun, _ctx: RuleContext): RuleResult {
    const findings: Finding[] = [];
    for (const entry of pairCallsWithResults(run)) {
      const raw = entry.call.argsRaw;
      if (raw === undefined || raw.length === 0) {
        continue;
      }
      try {
        JSON.parse(raw);
      } catch {
        findings.push({
          eventIndexes: [entry.eventIndex],
          evidence: [
            `call: ${entry.call.name}`,
            `argsRaw: ${raw.length > 160 ? `${raw.slice(0, 157)}...` : raw}`,
            `at event: ${entry.eventIndex}`,
          ],
          meta: { tool: entry.call.name },
          ruleId: 'AL101',
          summary: `tool call \`${entry.call.name}\` (${entry.call.id}) emitted unparseable arguments`,
          tier: 'hard_defect',
          title: 'malformed arguments — tool-call args are not valid JSON',
        });
      }
    }
    return { findings, suppressions: [] };
  },
  id: 'AL101',
  tier: 'hard_defect',
  title: 'malformed arguments — tool-call args are not valid JSON',
};
