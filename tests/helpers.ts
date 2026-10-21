import { hashOf } from '@/rules/detect.js';
import { type AgentRun, type RunEvent, SCHEMA_VERSION } from '@/schema.js';

let _autoId = 0;

export function makeResult(
  callId: string,
  content: string,
  isError = false,
): RunEvent {
  return {
    result: {
      callId,
      contentBytes: Buffer.byteLength(content, 'utf8'),
      contentHash: hashOf(content),
      contentPreview: content.slice(0, 120),
      isError,
    },
    type: 'tool_result',
  };
}

export function makeCall(
  id: string,
  name: string,
  args: unknown,
  ts?: string,
): RunEvent {
  return {
    call: { args, argsRaw: JSON.stringify(args), id, name },
    ts,
    type: 'tool_call',
  };
}

export function makeAssistantTurn(
  usage: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheCreate?: number;
  },
  extra: { model?: string; ts?: string } = {},
): RunEvent {
  _autoId += 1;
  return {
    model: extra.model ?? 'claude-sonnet-4-5',
    role: 'assistant',
    ts: extra.ts,
    type: 'message',
    usage: {
      cacheCreate: usage.cacheCreate,
      cacheRead: usage.cacheRead,
      input: usage.input,
      output: usage.output,
    },
  };
}

export function makeRun(events: RunEvent[], id = 'test-run'): AgentRun {
  return { events, id, schemaVersion: SCHEMA_VERSION, source: 'native' };
}
