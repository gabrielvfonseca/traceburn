import { z } from 'zod';

/** Canonical traceburn run schema (v1). Adapters normalize every source into this. */

export const SCHEMA_VERSION = 1;

export const tokenUsageSchema = z.object({
  /** tokens written into the prompt cache (billed at a premium) */
  cacheCreate: z.number().nonnegative().optional(),
  /** tokens served from the prompt cache (billed at a discount) */
  cacheRead: z.number().nonnegative().optional(),
  input: z.number().nonnegative().default(0),
  output: z.number().nonnegative().default(0),
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;

export const toolCallSchema = z.object({
  /** parsed args when available */
  args: z.unknown().optional(),
  /** raw argument string as emitted (for malformed-args detection) */
  argsRaw: z.string().optional(),
  id: z.string(),
  name: z.string(),
});
export type ToolCall = z.infer<typeof toolCallSchema>;

export const toolDeclarationSchema = z.object({
  /** JSON Schema describing valid args for this tool */
  argsSchema: z.unknown().optional(),
  name: z.string(),
});
export type ToolDeclaration = z.infer<typeof toolDeclarationSchema>;

export const toolResultSchema = z.object({
  callId: z.string(),
  /** byte length of the full result content when known */
  contentBytes: z.number().nonnegative().optional(),
  /** stable hash of full result content when known */
  contentHash: z.string().optional(),
  /** short preview for evidence display */
  contentPreview: z.string().optional(),
  isError: z.boolean().optional(),
});
export type ToolResult = z.infer<typeof toolResultSchema>;

export const eventSchema = z.discriminatedUnion('type', [
  z.object({
    model: z.string().optional(),
    role: z.enum(['user', 'assistant', 'system']),
    text: z.string().optional(),
    ts: z.string().datetime().optional(),
    type: z.literal('message'),
    usage: tokenUsageSchema.optional(),
  }),
  z.object({
    call: toolCallSchema,
    ts: z.string().datetime().optional(),
    type: z.literal('tool_call'),
  }),
  z.object({
    result: toolResultSchema,
    ts: z.string().datetime().optional(),
    type: z.literal('tool_result'),
  }),
]);
export type RunEvent = z.infer<typeof eventSchema>;

export const runSchema = z.object({
  cwd: z.string().optional(),
  endedAt: z.string().datetime().optional(),
  events: z.array(eventSchema),
  /** path of the file the run was loaded from, when applicable */
  filePath: z.string().optional(),
  id: z.string(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  source: z.string(),
  startedAt: z.string().datetime().optional(),
  /** declared toolset; when present, unknown-tool and schema checks can run */
  tools: z.array(toolDeclarationSchema).optional(),
});
export type AgentRun = z.infer<typeof runSchema>;

/** Stable JSON stringify (sorted keys) for hashing args/objects. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(compareStableKeys)
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

function compareStableKeys(
  [a]: [string, unknown],
  [b]: [string, unknown],
): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/** Canonical form of a tool call for loop/redundancy comparison. */
export function callKey(name: string, args: unknown, argsRaw?: string): string {
  if (args !== undefined) {
    return `${name} ${stableStringify(args)}`;
  }
  if (argsRaw !== undefined) {
    return `${name} raw:${argsRaw}`;
  }
  return `${name} <noargs>`;
}

/** Names of tools declared in the run's toolset, if any. */
export function declaredToolNames(run: AgentRun): string[] {
  return (run.tools ?? []).map((t) => t.name);
}

/** JSON Schema (if any) declared for a tool by name. */
export function declaredToolArgsSchema(
  run: AgentRun,
  name: string,
): unknown | undefined {
  return run.tools?.find((t) => t.name === name)?.argsSchema;
}

/** Join tool calls to their results in document order. */
export interface CompletedCall {
  call: ToolCall;
  callTs?: string;
  /** index of the tool_call event */
  eventIndex: number;
  result?: ToolResult;
  resultTs?: string;
}

export function pairCallsWithResults(run: AgentRun): CompletedCall[] {
  const results = new Map<string, ToolResult & { ts?: string }>();
  for (const ev of run.events) {
    if (ev.type === 'tool_result') {
      results.set(ev.result.callId, { ...ev.result, ts: ev.ts });
    }
  }
  return run.events.flatMap((ev, i) => {
    if (ev.type !== 'tool_call') {
      return [];
    }
    const r = results.get(ev.call.id);
    return [
      {
        call: ev.call,
        callTs: ev.ts,
        eventIndex: i,
        result: r,
        resultTs: r?.ts,
      } satisfies CompletedCall,
    ];
  });
}
