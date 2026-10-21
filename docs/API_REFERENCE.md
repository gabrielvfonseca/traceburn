# API Reference

## Canonical run schema (`AgentRun`)

`traceburn` normalizes every supported trace into this canonical schema:

```ts
interface AgentRun {
  schemaVersion: 1;
  id: string;
  source: string;
  filePath?: string;
  startedAt?: string;
  endedAt?: string;
  cwd?: string;
  tools?: ToolDeclaration[];
  events: RunEvent[];
}
```

### `ToolDeclaration`

```ts
interface ToolDeclaration {
  name: string;
  argsSchema?: unknown; // JSON Schema describing valid args
}
```

### `RunEvent` (discriminated union)

- `message` — model turn (`role: "user" | "assistant" | "system"`, optional `usage`, `model`, `text`)
- `tool_call` — a tool invocation (`call.id`, `call.name`, `call.args`, `call.argsRaw`)
- `tool_result` — a tool response (`result.callId`, `result.isError`, `result.contentBytes`, `result.contentPreview`, `result.contentHash`)

## Helpers

- `stableStringify(value)` — stable JSON stringify with sorted keys for hashing
- `callKey(name, args, argsRaw?)` — canonical form of a tool call for loop/redundancy comparison
- `pairCallsWithResults(run)` — joins tool calls to their results in document order
- `declaredToolNames(run)` — names of tools declared in the run's toolset
- `declaredToolArgsSchema(run, name)` — JSON Schema (if any) declared for a tool

## Programmatic API

```ts
import { loadRun, lintRun, renderReport } from 'traceburn';

const { run, format } = loadRun('session.jsonl');
const report = lintRun(run, {}, format);
console.log(renderReport(report, { color: false }));
```
