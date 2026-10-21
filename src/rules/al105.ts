import { isMutatingCall, resultHashOf } from '@/rules/detect.js';
import {
  type AgentRun,
  type CompletedCall,
  callKey,
  pairCallsWithResults,
} from '@/schema.js';
import type { Finding, Rule, RuleContext, RuleResult } from './engine.js';

interface Seen {
  eventIndex: number;
  key: string;
  mutationEpoch: number;
  resultHash: string;
}

interface FoldState {
  epoch: number;
  findings: Finding[];
  seen: Map<string, Seen>;
}

function findingForRedundant(earlier: Seen, entry: CompletedCall): Finding {
  const {
    call: { name },
  } = entry;
  return {
    eventIndexes: [earlier.eventIndex, entry.eventIndex],
    evidence: [
      `call: ${callKey(entry.call.name, entry.call.args, entry.call.argsRaw)}`,
      `first at event ${earlier.eventIndex}, repeated at event ${entry.eventIndex}`,
      'no mutating tool call occurred between them',
    ],
    meta: { tool: name },
    ruleId: 'AL105',
    summary: `\`${name}\` was called again with identical args and got an identical result; nothing mutated between the two calls`,
    tier: 'candidate',
    title: 'redundant call — same call, same result, no change in between',
  };
}

function foldCall(state: FoldState, entry: CompletedCall): FoldState {
  if (isMutatingCall(entry.call)) {
    return { ...state, epoch: state.epoch + 1 };
  }
  const hash = resultHashOf(entry);
  if (hash === undefined) {
    return state;
  }
  const key = callKey(entry.call.name, entry.call.args, entry.call.argsRaw);
  const previous = state.seen.get(key);
  if (previous === undefined || previous.resultHash !== hash) {
    const nextSeen = new Map(state.seen);
    nextSeen.set(key, {
      eventIndex: entry.eventIndex,
      key,
      mutationEpoch: state.epoch,
      resultHash: hash,
    });
    return { ...state, seen: nextSeen };
  }
  if (previous.mutationEpoch !== state.epoch) {
    const nextSeen = new Map(state.seen);
    nextSeen.set(key, {
      eventIndex: entry.eventIndex,
      key,
      mutationEpoch: state.epoch,
      resultHash: hash,
    });
    return { ...state, seen: nextSeen };
  }
  return {
    ...state,
    findings: [...state.findings, findingForRedundant(previous, entry)],
  };
}

/**
 * AL105: identical call + identical result with no mutation between.
 * Candidate tier: deterministic tools legitimately return stable results;
 * the finding names both events so a human can judge.
 */
export const ruleAl105: Rule = {
  evaluate(run: AgentRun, _ctx: RuleContext): RuleResult {
    const folded = pairCallsWithResults(run).reduce(foldCall, {
      epoch: 0,
      findings: [],
      seen: new Map<string, Seen>(),
    } satisfies FoldState);
    return { findings: folded.findings, suppressions: [] };
  },
  id: 'AL105',
  tier: 'candidate',
  title: 'redundant call — same call, same result, no change in between',
};
