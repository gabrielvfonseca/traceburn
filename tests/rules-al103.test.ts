import { makeCall, makeResult, makeRun } from '@@/helpers.js';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTEXT } from '@/rules/engine.js';
import { ruleAl103 } from '../src/rules/al103.js';

describe('AL103 tool error', () => {
  it('flags a call whose result is an error', () => {
    const run = makeRun([
      makeCall('c1', 'Bash', { command: 'ls' }),
      makeResult('c1', 'boom', true),
    ]);
    const result = ruleAl103.evaluate(run, DEFAULT_CONTEXT);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('AL103');
    expect(result.findings[0]?.tier).toBe('hard_event');
  });

  it('does not flag a successful result', () => {
    const run = makeRun([
      makeCall('c1', 'Bash', { command: 'ls' }),
      makeResult('c1', 'ok'),
    ]);
    expect(ruleAl103.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });

  it('does not flag a call with no result yet', () => {
    const run = makeRun([makeCall('c1', 'Bash', { command: 'ls' })]);
    expect(ruleAl103.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });

  it('flags multiple errored calls independently', () => {
    const run = makeRun([
      makeCall('c1', 'Bash', { command: 'ls' }),
      makeResult('c1', 'boom', true),
      makeCall('c2', 'Read', { path: 'x' }),
      makeResult('c2', 'nope', true),
    ]);
    const result = ruleAl103.evaluate(run, DEFAULT_CONTEXT);
    expect(result.findings).toHaveLength(2);
  });
});
