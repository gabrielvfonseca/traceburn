import {
  type AgentRun,
  declaredToolNames,
  pairCallsWithResults,
} from '@/schema.js';
import type { Finding, Rule, RuleContext, RuleResult } from './engine.js';

/**
 * AL102: unknown tool — a call to a tool absent from the declared toolset.
 * Suppressed when no toolset is declared (cannot verify absence). candidate.
 */
export const ruleAl102: Rule = {
  evaluate(run: AgentRun, _ctx: RuleContext): RuleResult {
    const declared = new Set(declaredToolNames(run));
    if (declared.size === 0) {
      return {
        findings: [],
        suppressions: [
          {
            reason:
              'no toolset declared in the run; unknown-tool check requires declared tools',
            ruleId: 'AL102',
          },
        ],
      };
    }
    const byTool = new Map<string, number[]>();
    for (const entry of pairCallsWithResults(run)) {
      if (!declared.has(entry.call.name)) {
        const indexes = byTool.get(entry.call.name) ?? [];
        byTool.set(entry.call.name, [...indexes, entry.eventIndex]);
      }
    }
    const findings: Finding[] = [];
    for (const [name, indexes] of byTool) {
      findings.push({
        eventIndexes: indexes,
        evidence: [
          `tool: ${name}`,
          `declared tools: ${[...declared].sort().join(', ') || '(none)'}`,
          `at events: ${indexes.join(', ')}`,
        ],
        meta: { count: indexes.length, tool: name },
        ruleId: 'AL102',
        summary: `tool call \`${name}\` is not in the declared toolset (${indexes.length} call(s))`,
        tier: 'candidate',
        title: 'unknown tool — call to a tool absent from the declared toolset',
      });
    }
    return { findings, suppressions: [] };
  },
  id: 'AL102',
  tier: 'candidate',
  title: 'unknown tool — call to a tool absent from the declared toolset',
};
