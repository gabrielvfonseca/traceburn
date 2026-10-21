# Trace adapters skill

This skill describes how agentburn loads and normalizes agent execution traces into the canonical `AgentRun` schema.

## Loading pipeline

```
trace file  →  loadRun / loadRunFromContent  →  detectFormat  →  adapter  →  AgentRun
```

## Format detection (`src/loaders.ts`)

### `detectFormat(content, filePath): SourceFormat | undefined`

Logic:
1. If extension is `.json` AND content starts with `{`:
   - Try to parse as JSON and check `schemaVersion === SCHEMA_VERSION` (1).
   - If yes → `"native"`.
   - If parse fails or version mismatch → fall through to `looksLikeClaudeCode`.
2. If `looksLikeClaudeCode(content)` → `"claude-code"`.
3. Otherwise → `undefined` (unrecognized).

### `looksLikeClaudeCode(content): boolean`

Parses the first non-empty line as JSON and checks for:
- `record.type` is one of `"user"`, `"assistant"`, `"attachment"`, `"summary"`, OR
- `record.sessionId` is defined.

### Supported formats

| Format | Extension | Detected by |
|--------|-----------|-------------|
| `claude-code` | `.jsonl` | `looksLikeClaudeCode` on first line |
| `native` | `.json` | `schemaVersion === 1` in root JSON |

### Public API

```ts
export function loadRun(filePath: string): LoadResult
export function loadRunFromContent(content: string, filePath: string): LoadResult
export function detectFormat(content: string, filePath: string): SourceFormat | undefined
export class UnrecognizedFormatError extends Error
```

`LoadResult = { run: AgentRun; format: SourceFormat }`

## Claude Code adapter (`src/adapters/claude-code.ts`)

### Purpose

Normalizes Claude Code session transcripts (`.jsonl` files under `~/.claude/projects/*/`) into `AgentRun`.

### Input format

Each line is a JSON record with these relevant fields:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"user" \| "assistant"` | Record type (only these two are processed) |
| `timestamp` | ISO string | Event timestamp |
| `sessionId` | string | Session identifier (used for run `id`) |
| `cwd` | string | Working directory |
| `isSidechain` | boolean | If `true`, record is filtered out |
| `message.role` | `"user" \| "assistant"` | Message role |
| `message.model` | string | Model ID |
| `message.content` | string \| block[] | Text or array of content blocks |
| `message.usage` | `{ input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens }` | Token usage |

### Content block types

| Block `type` | Produces |
|--------------|----------|
| `tool_use` | `tool_call` event (requires `id` and `name`) |
| `tool_result` | `tool_result` event (in user records) |
| `text` | Appended to message `text` |
| `thinking` | Ignored |
| other | Ignored |

### Key behaviors

- **Sidechain filtering:** Records with `isSidechain === true` are excluded from the main chain.
- **Run `id`:** First record's `sessionId`, or `basename(filePath, '.jsonl')` fallback.
- **Run `source`:** `"claude-code"`.
- **Timestamps:** `startedAt` = first timestamp, `endedAt` = last timestamp (via `timestamps.at(-1)`).
- **Tool call args:** Stored as `args` (parsed object) and `argsRaw` (JSON-stringified).
- **Tool result:** `contentHash` = SHA-256 of raw content; `contentPreview` = first 160 chars flattened; `contentBytes` = UTF-8 byte length.
- **Usage:** Normalized from Claude's `input_tokens`/`output_tokens`/`cache_read_input_tokens`/`cache_creation_input_tokens`.

### Public API

```ts
export function parseClaudeCodeSession(content: string, filePath: string): AgentRun
export function loadClaudeCodeFile(filePath: string): AgentRun
```

## Native run format (`src/loaders.ts`)

### Format

A single JSON object matching the `runSchema`:

```json
{
  "schemaVersion": 1,
  "id": "run-123",
  "source": "native",
  "tools": [
    { "name": "Read", "argsSchema": { ... } },
    { "name": "Bash" }
  ],
  "events": [
    { "type": "message", "role": "assistant", "model": "...", "usage": { ... } },
    { "type": "tool_call", "call": { "id": "c1", "name": "Read", "args": { ... } } },
    { "type": "tool_result", "result": { "callId": "c1", "isError": false, ... } }
  ]
}
```

### Parsing

- Validated against `runSchema` (Zod).
- `filePath` defaults to the actual file path if not present in the JSON.

## Pinned golden fixture

`fixtures/claude-code/fixture-session-001.jsonl` is the pinned golden fixture. Tests assert exact values from it:

- `run.id === 'fixture-session-001'`
- `run.source === 'claude-code'`
- `run.cwd === '/Users/dev/project'`
- 5 tool calls, 5 tool results
- 6 assistant turns with usage
- Model: `claude-sonnet-4-5`
- Planted loop: `git status --short` called 3× (AL104)
- Planned redundant read: `cat src/foo.ts` called twice (AL105)

**Important:** If the Claude Code format changes, update this fixture and the corresponding test assertions. A format change should fail CI loudly.

## Adding a new adapter

1. Create `src/adapters/<name>.ts` exporting `parse<Name>Session(content, filePath)` and/or `load<Name>File(filePath)`.
2. Add format detection logic in `src/loaders.ts` `detectFormat` and `looksLike<Name>`.
3. Wire into `loadRun` / `loadRunFromContent`.
4. Add a fixture under `fixtures/<name>/`.
5. Add tests under `tests/<name>-adapter.test.ts`.
6. Export from `src/index.ts` if needed.
7. Run `npm run typecheck && npm test`.
