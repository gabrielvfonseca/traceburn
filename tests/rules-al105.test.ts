import { makeCall, makeResult, makeRun } from '@@/helpers.js';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTEXT } from '@/rules/engine.js';
import { ruleAl105 } from '../src/rules/al105.js';

const args = { path: 'src/foo.ts' };
const content = 'export function foo() { return 1; }';

describe('AL105 redundant call', () => {
  it('flags a repeated identical call with no mutation between', () => {
    const run = makeRun([
      makeCall('c1', 'Read', args),
      makeResult('c1', content),
      makeCall('c2', 'Read', args),
      makeResult('c2', content),
    ]);
    const result = ruleAl105.evaluate(run, DEFAULT_CONTEXT);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('AL105');
    expect(result.findings[0]?.eventIndexes).toEqual([0, 2]);
  });

  it('does not flag when a mutation happened between reads', () => {
    const run = makeRun([
      makeCall('c1', 'Read', args),
      makeResult('c1', content),
      makeCall('m1', 'Edit', {
        file_path: 'src/foo.ts',
        new_string: '2',
        old_string: '1',
      }),
      makeResult('m1', 'ok'),
      makeCall('c2', 'Read', args),
      makeResult('c2', content),
    ]);
    expect(ruleAl105.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });

  it('does not flag identical calls with different results', () => {
    const run = makeRun([
      makeCall('c1', 'Read', args),
      makeResult('c1', content),
      makeCall('c2', 'Read', args),
      makeResult('c2', 'changed content'),
    ]);
    expect(ruleAl105.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });
});
