import { createHash } from 'node:crypto';
import type { CompletedCall } from '@/schema.js';

const WRITE_TOOL_PATTERN =
  /edit|write|patch|apply|insert|update|delete|create|mkdir|touch|truncate|upsert|remove/i;

const SHELL_NAMES = new Set([
  'bash',
  'shell',
  'run_command',
  'execute',
  'exec',
  'terminal',
]);

const SHELL_WRITE_PATTERN =
  /(\bmv\b|\brm\b|\btee\b|\btouch\b|\bmkdir\b|\bsed\b\s+-i|>>?|\bcat\b.*>|git\s+(commit|add|switch|checkout|merge|rebase|push)|npm\s+(install|run)|pip\s+install|\bcm\b\s+.*\s+\/)/;

/**
 * Best-effort mutation detector: a call that can change external state.
 * Used to separate "no progress happened" (loop/redundant) from real work.
 */
export function isMutatingCall(call: CompletedCall['call']): boolean {
  if (WRITE_TOOL_PATTERN.test(call.name)) {
    return true;
  }
  if (SHELL_NAMES.has(call.name.toLowerCase())) {
    const { args } = call;
    const command =
      typeof args === 'object' && args !== null && 'command' in args
        ? String((args as { command: unknown }).command)
        : (call.argsRaw ?? '');
    return SHELL_WRITE_PATTERN.test(command);
  }
  return false;
}

export function resultHashOf(entry: CompletedCall): string | undefined {
  return entry.result?.contentHash;
}

export function isSuccessful(entry: CompletedCall): boolean {
  return entry.result !== undefined && entry.result.isError !== true;
}

export function hashOf(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Median gap in ms between timestamps; undefined when fewer than 2 parse. */
export function medianGapMs(timestamps: readonly string[]): number | undefined {
  const parsed = timestamps
    .map((ts) => Date.parse(ts))
    .filter((ms): ms is number => Number.isFinite(ms));
  if (parsed.length < 2) {
    return undefined;
  }
  const sorted = [...parsed].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((ms, i) => ms - (sorted[i] ?? 0));
  const mid = Math.floor(gaps.length / 2);
  const values = gaps.slice(Math.max(0, mid - 2), mid + 3);
  if (values.length === 0) {
    return undefined;
  }
  const sum = values.reduce((acc, gap) => acc + gap, 0);
  return Math.round(sum / values.length);
}

export function formatGap(gapMs: number | undefined): string {
  if (gapMs === undefined) {
    return 'unknown spacing';
  }
  if (gapMs < 1000) {
    return `~${gapMs}ms apart`;
  }
  return `~${Math.round(gapMs / 1000)}s apart`;
}
