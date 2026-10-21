import {
  formatGap,
  isMutatingCall,
  isSuccessful,
  medianGapMs,
  resultHashOf,
} from '@/rules/detect.js';
import {
  type AgentRun,
  type CompletedCall,
  callKey,
  pairCallsWithResults,
} from '@/schema.js';
import type { Finding, Rule, RuleContext, RuleResult } from './engine.js';

const MIN_STREAK = 3;

interface Streak {
  entries: CompletedCall[];
  key: string;
  resultHash: string;
}

function sameStreak(streak: Streak, entry: CompletedCall): boolean {
  const hash = resultHashOf(entry);
  return (
    hash !== undefined &&
    isSuccessful(entry) &&
    callKey(entry.call.name, entry.call.args, entry.call.argsRaw) ===
      streak.key &&
    hash === streak.resultHash
  );
}

function startStreak(entry: CompletedCall): Streak | undefined {
  const hash = resultHashOf(entry);
  if (hash === undefined || !isSuccessful(entry)) {
    return undefined;
  }
  return {
    entries: [entry],
    key: callKey(entry.call.name, entry.call.args, entry.call.argsRaw),
    resultHash: hash,
  };
}

function closeStreak(acc: { streaks: Streak[]; open: Streak | undefined }): {
  streaks: Streak[];
  open: Streak | undefined;
} {
  if (acc.open === undefined) {
    return acc;
  }
  if (acc.open.entries.length < MIN_STREAK) {
    return { open: undefined, streaks: acc.streaks };
  }
  return { open: undefined, streaks: [...acc.streaks, acc.open] };
}

function foldCall(
  acc: { streaks: Streak[]; open: Streak | undefined },
  entry: CompletedCall,
): {
  streaks: Streak[];
  open: Streak | undefined;
} {
  if (isMutatingCall(entry.call)) {
    return closeStreak(acc);
  }
  if (acc.open !== undefined && sameStreak(acc.open, entry)) {
    return {
      open: { ...acc.open, entries: [...acc.open.entries, entry] },
      streaks: acc.streaks,
    };
  }
  const closed = closeStreak(acc);
  return { open: startStreak(entry), streaks: closed.streaks };
}

function streakToFinding(streak: Streak): Finding {
  const name = streak.entries[0]?.call.name ?? 'unknown';
  const sample =
    streak.entries[0]?.result?.contentPreview ?? '(no result content)';
  const timestamps = streak.entries.flatMap((entry) =>
    entry.callTs ? [entry.callTs] : [],
  );
  const callIndexes = streak.entries.map((entry) => entry.eventIndex);
  return {
    eventIndexes: callIndexes,
    evidence: [
      `call: ${streak.key}`,
      `identical result: ${sample.length > 80 ? `${sample.slice(0, 77)}...` : sample}`,
      `spacing: ${formatGap(medianGapMs(timestamps))}`,
      `at events: ${callIndexes.join(', ')}`,
    ],
    meta: { count: streak.entries.length, tool: name },
    ruleId: 'AL104',
    summary: `\`${name}\` ran ${streak.entries.length}× with identical args and identical results, with no mutating work in between`,
    tier: 'candidate',
    title: 'loop — identical no-progress calls',
  };
}

/**
 * AL104: N identical no-progress calls (identical args + identical successful
 * results, no mutation between). Candidate tier: polls and intentional
 * retries can look identical; evidence is shown for review, never a verdict.
 */
export const ruleAl104: Rule = {
  evaluate(run: AgentRun, _ctx: RuleContext): RuleResult {
    const folded = pairCallsWithResults(run).reduce(foldCall, {
      open: undefined,
      streaks: [],
    } satisfies { streaks: Streak[]; open: Streak | undefined });
    const closed = closeStreak(folded);
    return { findings: closed.streaks.map(streakToFinding), suppressions: [] };
  },
  id: 'AL104',
  tier: 'candidate',
  title: 'loop — identical no-progress calls',
};
