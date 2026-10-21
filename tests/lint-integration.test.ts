import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lintRun } from '@/lint.js';
import { loadRun } from '@/loaders.js';

const FIXTURE = fileURLToPath(
  new URL('../fixtures/claude-code/fixture-session-001.jsonl', import.meta.url),
);

describe('lintRun end-to-end on the pinned Claude Code fixture', () => {
  const { run, format } = loadRun(FIXTURE);
  const report = lintRun(run, {}, format);

  it('detects the format and run identity', () => {
    expect(report.format).toBe('claude-code');
    expect(report.run.id).toBe('fixture-session-001');
  });

  it('catches the planted loop (AL104)', () => {
    const loop = report.findings.find((f) => f.ruleId === 'AL104');
    expect(loop).toBeDefined();
    expect(loop?.summary).toContain('3×');
  });

  it('catches the planted redundant read (AL105)', () => {
    const redundant = report.findings.filter((f) => f.ruleId === 'AL105');
    expect(redundant.length).toBeGreaterThanOrEqual(1);
  });

  it('reports cost against the date-stamped pricing table (AL202)', () => {
    const cost = report.findings.find((f) => f.ruleId === 'AL202');
    expect(cost?.tier).toBe('info');
    expect(cost?.cost).toBeGreaterThan(0);
    expect(report.pricing.asOf).toBe('2026-10');
  });

  it('flags a token hotspot (AL200)', () => {
    const hotspots = report.findings.filter((f) => f.ruleId === 'AL200');
    expect(hotspots.length).toBeGreaterThanOrEqual(1);
  });

  it('flags context bloat (AL201)', () => {
    const bloat = report.findings.find((f) => f.ruleId === 'AL201');
    expect(bloat).toBeDefined();
  });

  it('does not fail CI on candidates or warnings by default', () => {
    expect(report.exitCode).toBe(0);
  });

  it('fails at candidate tier only when opted in', () => {
    const strict = lintRun(run, { failOn: 'candidate' }, format);
    expect(strict.exitCode).toBe(1);
  });
});
