import {
  makeAssistantTurn,
  makeCall,
  makeResult,
  makeRun,
} from '@@/helpers.js';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTEXT } from '@/rules/engine.js';
import { ruleAl104 } from '../src/rules/al104.js';

const identicalArgs = { command: 'git status --short' };
const identicalOutput = ' M src/foo.ts';

function loopRun(): ReturnType<typeof makeRun> {
  return makeRun([
    makeCall('c1', 'Bash', identicalArgs),
    makeResult('c1', identicalOutput),
    makeAssistantTurn({ input: 1, output: 10 }),
    makeCall('c2', 'Bash', identicalArgs),
    makeResult('c2', identicalOutput),
    makeCall('c3', 'Bash', identicalArgs),
    makeResult('c3', identicalOutput),
  ]);
}

describe('AL104 loop', () => {
  it('flags 3 identical no-progress calls', () => {
    const result = ruleAl104.evaluate(loopRun(), DEFAULT_CONTEXT);
    expect(result.findings).toHaveLength(1);
    const [finding] = result.findings;
    expect(finding?.ruleId).toBe('AL104');
    expect(finding?.tier).toBe('candidate');
    expect(finding?.summary).toContain('3×');
    expect(finding?.evidence.join(' ')).toContain('git status --short');
  });

  it('does not flag 2 identical calls', () => {
    const run = makeRun([
      makeCall('c1', 'Bash', identicalArgs),
      makeResult('c1', identicalOutput),
      makeCall('c2', 'Bash', identicalArgs),
      makeResult('c2', identicalOutput),
    ]);
    expect(ruleAl104.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });

  it('does not flag when a mutation breaks the streak', () => {
    const run = makeRun([
      makeCall('c1', 'Bash', identicalArgs),
      makeResult('c1', identicalOutput),
      makeCall('c2', 'Bash', identicalArgs),
      makeResult('c2', identicalOutput),
      makeCall('c3', 'Edit', {
        file_path: 'src/foo.ts',
        new_string: 'b',
        old_string: 'a',
      }),
      makeResult('c3', 'ok'),
      makeCall('c4', 'Bash', identicalArgs),
      makeResult('c4', 'different now'),
    ]);
    expect(ruleAl104.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });

  it('does not flag identical calls with differing results', () => {
    const run = makeRun([
      makeCall('c1', 'Bash', identicalArgs),
      makeResult('c1', 'out A'),
      makeCall('c2', 'Bash', identicalArgs),
      makeResult('c2', 'out B'),
      makeCall('c3', 'Bash', identicalArgs),
      makeResult('c3', 'out C'),
    ]);
    expect(ruleAl104.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });

  it('does not flag errored retries as a loop', () => {
    const run = makeRun([
      makeCall('c1', 'Bash', { command: 'npm test' }),
      makeResult('c1', 'boom', true),
      makeCall('c2', 'Bash', { command: 'npm test' }),
      makeResult('c2', 'boom', true),
      makeCall('c3', 'Bash', { command: 'npm test' }),
      makeResult('c3', 'boom', true),
    ]);
    expect(ruleAl104.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });
});
