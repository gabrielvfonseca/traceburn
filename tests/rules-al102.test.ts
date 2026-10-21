import { makeResult, makeRun } from '@@/helpers.js';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTEXT } from '@/rules/engine.js';
import { type AgentRun, type RunEvent, SCHEMA_VERSION } from '@/schema.js';
import { ruleAl102 } from '../src/rules/al102.js';

function runWithTools(tools: { name: string }[], events: RunEvent[]): AgentRun {
  return {
    events,
    id: 'test-run',
    schemaVersion: SCHEMA_VERSION,
    source: 'native',
    tools,
  } as AgentRun;
}

function call(id: string, name: string) {
  return {
    call: { id, name },
    type: 'tool_call' as const,
  };
}

describe('AL102 unknown tool', () => {
  it('suppresses when no toolset is declared', () => {
    const run = makeRun([call('c1', 'Bash'), makeResult('c1', 'ok')]);
    const result = ruleAl102.evaluate(run, DEFAULT_CONTEXT);
    expect(result.findings).toHaveLength(0);
    expect(result.suppressions[0]?.reason).toContain('no toolset declared');
  });

  it('flags a call to an undeclared tool', () => {
    const run = runWithTools(
      [{ name: 'Read' }],
      [call('c1', 'Bash'), makeResult('c1', 'ok')],
    );
    const result = ruleAl102.evaluate(run, DEFAULT_CONTEXT);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('AL102');
    expect(result.findings[0]?.tier).toBe('candidate');
    expect(result.findings[0]?.summary).toContain('Bash');
  });

  it('does not flag a call to a declared tool', () => {
    const run = runWithTools(
      [{ name: 'Bash' }],
      [call('c1', 'Bash'), makeResult('c1', 'ok')],
    );
    expect(ruleAl102.evaluate(run, DEFAULT_CONTEXT).findings).toHaveLength(0);
  });

  it('groups multiple calls to the same unknown tool into one finding', () => {
    const run = runWithTools(
      [{ name: 'Read' }],
      [
        call('c1', 'Bash'),
        makeResult('c1', 'ok'),
        call('c2', 'Bash'),
        makeResult('c2', 'ok'),
      ],
    );
    const result = ruleAl102.evaluate(run, DEFAULT_CONTEXT);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.meta?.count).toBe(2);
    expect(result.findings[0]?.eventIndexes).toEqual([0, 2]);
  });
});
