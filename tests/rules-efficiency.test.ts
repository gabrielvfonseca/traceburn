import { makeAssistantTurn, makeRun } from '@@/helpers.js';
import { describe, expect, it } from 'vitest';
import { loadPricing } from '@/pricing/index.js';
import { ruleAl200 } from '@/rules/al200.js';
import { ruleAl201 } from '@/rules/al201.js';
import { ruleAl202 } from '@/rules/al202.js';
import { DEFAULT_CONTEXT } from '@/rules/engine.js';

const SPEND_REGEX = /% of run spend/;

const pricing = loadPricing();
const ctx = { ...DEFAULT_CONTEXT, pricing };

describe('AL200 token hotspot', () => {
  it('flags a turn over the share threshold', () => {
    const run = makeRun([
      makeAssistantTurn({ cacheRead: 1000, input: 2, output: 50 }),
      makeAssistantTurn({ cacheRead: 1000, input: 2, output: 5000 }),
      makeAssistantTurn({ cacheRead: 1000, input: 2, output: 40 }),
    ]);
    const result = ruleAl200.evaluate(run, ctx);
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const finding = result.findings.find((f) => f.eventIndexes.includes(1));
    expect(finding?.summary).toMatch(SPEND_REGEX);
    expect(finding?.cost).toBeGreaterThan(0);
  });

  it('suppresses with a reason when usage is missing', () => {
    const run = makeRun([]);
    const result = ruleAl200.evaluate(run, ctx);
    expect(result.findings).toHaveLength(0);
    expect(result.suppressions[0]?.reason).toContain('no assistant turns');
  });

  it('suppresses with a reason when models are unpriced', () => {
    const run = makeRun([
      makeAssistantTurn(
        { input: 100, output: 100 },
        { model: 'mystery-model-9000' },
      ),
    ]);
    const result = ruleAl200.evaluate(run, ctx);
    expect(result.findings).toHaveLength(0);
    expect(result.suppressions[0]?.reason).toContain('--pricing');
  });
});

describe('AL201 context bloat', () => {
  it('flags 3x context growth', () => {
    const run = makeRun([
      makeAssistantTurn({ cacheCreate: 10_000, input: 2, output: 50 }),
      makeAssistantTurn({
        cacheCreate: 5000,
        cacheRead: 15_000,
        input: 2,
        output: 50,
      }),
      makeAssistantTurn({
        cacheCreate: 5000,
        cacheRead: 25_000,
        input: 2,
        output: 50,
      }),
      makeAssistantTurn({
        cacheCreate: 5000,
        cacheRead: 35_000,
        input: 2,
        output: 50,
      }),
    ]);
    const result = ruleAl201.evaluate(run, ctx);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.summary).toContain('4.0×');
  });

  it('does not flag a stable context', () => {
    const run = makeRun([
      makeAssistantTurn({ cacheRead: 10_000, input: 2, output: 50 }),
      makeAssistantTurn({ cacheRead: 10_100, input: 2, output: 50 }),
      makeAssistantTurn({ cacheRead: 10_200, input: 2, output: 50 }),
      makeAssistantTurn({ cacheRead: 10_300, input: 2, output: 50 }),
    ]);
    expect(ruleAl201.evaluate(run, ctx).findings).toHaveLength(0);
  });

  it('suppresses with a reason on short runs', () => {
    const run = makeRun([makeAssistantTurn({ input: 2, output: 50 })]);
    const result = ruleAl201.evaluate(run, ctx);
    expect(result.findings).toHaveLength(0);
    expect(result.suppressions[0]?.reason).toContain('need >= 4');
  });
});

describe('AL202 run cost', () => {
  it('reports an informational total against the date-stamped table', () => {
    const run = makeRun([
      makeAssistantTurn({ input: 1000, output: 500 }),
      makeAssistantTurn({ input: 1000, output: 500 }),
    ]);
    const result = ruleAl202.evaluate(run, ctx);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.tier).toBe('info');
    expect(result.findings[0]?.cost).toBeGreaterThan(0);
    expect(result.findings[0]?.evidence.join(' ')).toContain(pricing.asOf);
  });

  it('discloses unpriced models as a suppression, not a clean pass', () => {
    const run = makeRun([
      makeAssistantTurn({ input: 1000, output: 500 }),
      makeAssistantTurn(
        { input: 1000, output: 500 },
        { model: 'mystery-model-9000' },
      ),
    ]);
    const result = ruleAl202.evaluate(run, ctx);
    expect(
      result.suppressions.some((s) => s.reason.includes('mystery-model-9000')),
    ).toBe(true);
  });
});
