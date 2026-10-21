import type { SourceFormat } from '@/loaders.js';
import type { PricingTable } from '@/pricing/index.js';
import { loadPricing } from '@/pricing/index.js';
import {
  DEFAULT_CONTEXT,
  type Finding,
  mergeResults,
  type Rule,
  type RuleContext,
  type Suppression,
  TIER_RANK,
  type Tier,
} from '@/rules/engine.js';
import { defaultRules } from '@/rules/index.js';
import type { AgentRun } from '@/schema.js';

export interface LintOptions {
  bloatGrowthFactor?: number;
  failOn?: Tier;
  hotspotShare?: number;
  pricingPath?: string;
  rules?: readonly Rule[];
}

export interface LintReport {
  exitCode: 0 | 1 | 2;
  findings: Finding[];
  format: SourceFormat | 'library';
  pricing: PricingTable;
  run: AgentRun;
  suppressions: Suppression[];
}

function exitCodeFor(
  findings: readonly Finding[],
  failOn: Tier | undefined,
): 0 | 1 | 2 {
  const hasHardDefect = findings.some(
    (finding) => finding.tier === 'hard_defect',
  );
  if (hasHardDefect) {
    return 2;
  }
  if (failOn === undefined) {
    return 0;
  }
  const threshold = TIER_RANK[failOn];
  const hasFailTier = findings.some(
    (finding) => TIER_RANK[finding.tier] >= threshold,
  );
  return hasFailTier ? 1 : 0;
}

export function lintRun(
  run: AgentRun,
  options: LintOptions = {},
  format: SourceFormat | 'library' = 'library',
): LintReport {
  const pricing = loadPricing(options.pricingPath);
  const ctx: RuleContext = {
    bloatGrowthFactor:
      options.bloatGrowthFactor ?? DEFAULT_CONTEXT.bloatGrowthFactor,
    hotspotShare: options.hotspotShare ?? DEFAULT_CONTEXT.hotspotShare,
    pricing,
  };
  const rules = options.rules ?? defaultRules;
  const merged = mergeResults(rules.map((rule) => rule.evaluate(run, ctx)));
  const findings = merged.findings.sort((a, b) => {
    const byCost = (b.cost ?? 0) - (a.cost ?? 0);
    if (byCost !== 0) {
      return byCost;
    }
    return TIER_RANK[b.tier] - TIER_RANK[a.tier];
  });
  return {
    exitCode: exitCodeFor(findings, options.failOn),
    findings,
    format,
    pricing,
    run,
    suppressions: merged.suppressions,
  };
}
