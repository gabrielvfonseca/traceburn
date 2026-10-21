import type { PricingTable } from '@/pricing/index.js';
import type { AgentRun } from '@/schema.js';

export type Tier =
  | 'hard_defect'
  | 'hard_event'
  | 'candidate'
  | 'warning'
  | 'info';

export interface Finding {
  /** attributed waste in USD, when priced */
  cost?: number;
  /** indexes into run.events */
  eventIndexes: number[];
  /** human-readable evidence lines */
  evidence: string[];
  meta?: Record<string, string | number>;
  ruleId: string;
  summary: string;
  tier: Tier;
  title: string;
  /** attributed wasted tokens, when counted */
  tokens?: number;
}

export interface Suppression {
  reason: string;
  ruleId: string;
}

export interface RuleResult {
  findings: Finding[];
  suppressions: Suppression[];
}

export interface RuleContext {
  /** context must grow by at least this factor to count as bloat */
  bloatGrowthFactor: number;
  /** per-turn cost must be >= this share of run cost to count as a hotspot */
  hotspotShare: number;
  pricing: PricingTable;
}

export interface Rule {
  evaluate: (run: AgentRun, ctx: RuleContext) => RuleResult;
  id: string;
  /** default tier for findings emitted by this rule */
  tier: Tier;
  title: string;
}

export const DEFAULT_CONTEXT: RuleContext = {
  bloatGrowthFactor: 3,
  hotspotShare: 0.15,
  pricing: {
    asOf: 'unspecified',
    currency: 'USD',
    models: {},
    note: '',
  },
};

export const EMPTY_RESULT: RuleResult = { findings: [], suppressions: [] };

export function mergeResults(results: readonly RuleResult[]): RuleResult {
  const merged = results.reduce<RuleResult>(
    (acc, result) => ({
      findings: [...acc.findings, ...result.findings],
      suppressions: [...acc.suppressions, ...result.suppressions],
    }),
    { findings: [], suppressions: [] },
  );
  return merged;
}

/** Tier ordering used by fail_on comparisons. */
export const TIER_RANK: Record<Tier, number> = {
  candidate: 2,
  hard_defect: 4,
  hard_event: 3,
  info: 0,
  warning: 1,
};

export function highestTier(findings: readonly Finding[]): Tier | undefined {
  return findings.reduce<Tier | undefined>(
    (best, finding) =>
      best === undefined || TIER_RANK[finding.tier] > TIER_RANK[best]
        ? finding.tier
        : best,
    undefined,
  );
}
