import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseClaudeCodeSession } from '@/adapters/claude-code.js';

const HASH_REGEX = /^[0-9a-f]{64}$/;

const FIXTURE = fileURLToPath(
  new URL('../fixtures/claude-code/fixture-session-001.jsonl', import.meta.url),
);

describe('claude-code adapter (pinned golden fixture)', () => {
  const content = readFileSync(FIXTURE, 'utf8');
  const run = parseClaudeCodeSession(content, FIXTURE);

  it('identifies the run', () => {
    expect(run.source).toBe('claude-code');
    expect(run.id).toBe('fixture-session-001');
    expect(run.cwd).toBe('/Users/dev/project');
    expect(run.startedAt).toBe('2026-10-18T10:00:00.000Z');
    expect(run.endedAt).toBe('2026-10-18T10:00:40.000Z');
  });

  it('filters sidechain records', () => {
    const texts = run.events.flatMap((event) =>
      event.type === 'message' && event.text !== undefined ? [event.text] : [],
    );
    expect(texts.some((text) => text.includes('sidechain noise'))).toBe(false);
  });

  it('extracts tool calls with args and results with hashes', () => {
    const calls = run.events.filter((event) => event.type === 'tool_call');
    const results = run.events.filter((event) => event.type === 'tool_result');
    expect(calls).toHaveLength(5);
    expect(results).toHaveLength(5);
    const [first] = calls;
    expect(first?.type).toBe('tool_call');
    if (first?.type !== 'tool_call') {
      throw new Error('unreachable');
    }
    expect(first.call.id).toBe('tuu_1');
    expect(first.call.name).toBe('Bash');
    expect(first.call.args).toEqual({ command: 'git status --short' });
    const [firstResult] = results;
    if (firstResult?.type !== 'tool_result') {
      throw new Error('unreachable');
    }
    expect(firstResult.result.callId).toBe('tuu_1');
    expect(firstResult.result.isError).toBe(false);
    expect(firstResult.result.contentHash).toMatch(HASH_REGEX);
  });

  it('captures per-turn usage including cache tokens', () => {
    const turns = run.events.filter(
      (event) =>
        event.type === 'message' &&
        event.role === 'assistant' &&
        event.usage !== undefined,
    );
    expect(turns).toHaveLength(6);
    const totals = turns.reduce(
      (acc, event) => {
        if (event.type !== 'message' || event.usage === undefined) {
          return acc;
        }
        return {
          cacheCreate: acc.cacheCreate + (event.usage.cacheCreate ?? 0),
          cacheRead: acc.cacheRead + (event.usage.cacheRead ?? 0),
          input: acc.input + event.usage.input,
          output: acc.output + event.usage.output,
        };
      },
      { cacheCreate: 0, cacheRead: 0, input: 0, output: 0 },
    );
    expect(totals).toEqual({
      cacheCreate: 76_400,
      cacheRead: 193_600,
      input: 12,
      output: 595,
    });
  });

  it('records the model id', () => {
    const models = run.events.flatMap((event) =>
      event.type === 'message' && event.model !== undefined
        ? [event.model]
        : [],
    );
    expect(new Set(models)).toEqual(new Set(['claude-sonnet-4-5']));
  });
});
