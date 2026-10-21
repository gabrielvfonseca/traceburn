import { makeResult, makeRun } from '@@/helpers.js';
import { describe, expect, it } from 'vitest';
import { ruleAl101 } from '@/rules/al101.js';
import { DEFAULT_CONTEXT } from '@/rules/engine.js';

function malformedCall(id: string, name: string, argsRaw: string) {
  return {
    call: { argsRaw, id, name },
    type: 'tool_call' as const,
  };
}

describe('AL101 malformed arguments', () => {
  it('flags a call with unparseable argsRaw', () => {
    const run = makeRun([
      malformedCall('c1', 'Bash', '{ not valid json'),
      makeResult('c1', 'boom', true),
    ]);
    const result = ruleAl101.evaluate(run, DEFAULT_CONTEXT);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('AL101');
    expect(result.findings[0]?.tier).toBe('hard_defect');
  });

  it('does not flag valid JSON argsRaw', () => {
    const run = makeRun([
      malformedCall('c1', 'Bash', '{"command":"ls"}'),
      makeResult('c1', 'ok'),
    ]);
    expect(ruleAl101.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });

  it('does not flag a call with no argsRaw', () => {
    const run = makeRun([
      { call: { id: 'c1', name: 'Bash' }, type: 'tool_call' as const },
      makeResult('c1', 'ok'),
    ]);
    expect(ruleAl101.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });

  it('flags multiple malformed calls independently', () => {
    const run = makeRun([
      malformedCall('c1', 'Bash', '{ bad'),
      makeResult('c1', 'x', true),
      malformedCall('c2', 'Read', '{ also bad'),
      makeResult('c2', 'y', true),
    ]);
    const result = ruleAl101.evaluate(run, DEFAULT_CONTEXT);
    expect(result.findings).toHaveLength(2);
  });
});
