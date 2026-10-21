# agentburn

See where your agent burned money and tokens. A deterministic linter for agent runs — token hotspots, loops, cache waste, and structural defects. No LLM judge.

`agentburn` reads an agent execution trace (a Claude Code session `.jsonl` or an agentburn native run `.json`) after the run and reports structural defects deterministically, with exact trace evidence and a CI exit code.

## Install

```bash
npm install -g agentburn
```

Or run from source:

```bash
npm install
npm run build
```

## Usage

```bash
agentburn check <files...> [options]
```

Lint one or more agent session traces.

```
Options:
  --json                  machine-readable JSON output
  --pricing <file>        pricing table JSON overriding the built-in table
  --fail-on <tier>        exit 1 on findings at/above this tier
                          (hard_defect, hard_event, candidate, warning, info)
  --hotspot-share <pct>   per-turn cost share that flags a hotspot, 0-1 (default 0.15)
  --no-color              disable ANSI color
```

Exit codes:
- `0` — no findings above the fail-on threshold
- `1` — findings at/above `--fail-on` tier
- `2` — a `hard_defect` finding was detected
- `3` — input/output error (unrecognized format, bad JSON)

### Examples

```bash
# Lint a Claude Code session transcript
agentburn check ~/.claude/projects/*/session.jsonl

# Fail CI on hard defects only (default)
agentburn check trace.jsonl

# Fail CI on anything candidate or worse
agentburn check trace.jsonl --fail-on candidate

# JSON output for CI
agentburn check trace.jsonl --json

# Use a custom pricing table
agentburn check trace.jsonl --pricing pricing.json
```

## How it works

`agentburn` normalizes every supported trace into a canonical run schema, then runs deterministic rules over it. Every rule emits findings with:
- the rule id and tier,
- a human summary,
- evidence lines quoting the trace,
- the event indexes involved,
- attributed cost/tokens when priced.

Findings fall into tiers:

| Tier | Meaning | CI behavior |
|------|---------|-------------|
| `hard_defect` | Proven structural bug | exit 2 |
| `hard_event` | Real observed event (e.g. tool error) | review |
| `candidate` | Possible issue (loop, redundant call) | review only |
| `warning` | Efficiency issue (hotspot, bloat) | review |
| `info` | Estimated run cost | informational |

By default `agentburn check` exits `0` unless a `hard_defect` is found. Use `--fail-on` to tighten the threshold.

## Rules

### Structural defects (AL1xx)

| Rule | Tier | What it checks |
|------|------|----------------|
| AL101 | hard_defect | Malformed arguments — tool-call `argsRaw` is not valid JSON |
| AL102 | candidate | Unknown tool — a call to a tool absent from the declared toolset (suppressed when no toolset is declared) |
| AL103 | hard_event | Tool error — a tool result returned `is_error` |
| AL104 | candidate | Loop — 3+ identical no-progress calls (same args, same result, no mutation in between) |
| AL105 | candidate | Redundant call — identical call + identical result with no mutation between |

### Efficiency & cost (AL2xx)

| Rule | Tier | What it checks |
|------|------|----------------|
| AL200 | warning | Token hotspot — a turn accounting for an outsized share of run spend |
| AL201 | warning | Context bloat — prompt growing across the run with weak cache absorption |
| AL202 | info | Run cost — estimated USD spend against a date-stamped pricing table |

### Finding tiers

Hard defects (`AL101`) are proven by the trace and fail CI (exit 2). Hard events (`AL103`) and candidates (`AL104`, `AL105`) are real signals but may be legitimate (e.g. an intentional retry), so they are shown for review. Warnings (`AL200`, `AL201`) surface efficiency waste. Info (`AL202`) reports estimated spend.

No rule uses an LLM judge. Every verdict is decided from the trace alone plus facts you declare (tool schemas, pricing).

## Supported formats

### Claude Code session (`.jsonl`)

Auto-detected from `~/.claude/projects/**/*.jsonl` or any `.jsonl` whose records look like Claude Code transcript lines (`user`/`assistant` message records with `sessionId`).

### Agentburn native run (`.json`)

A single JSON object matching the canonical run schema:

```json
{
  "schemaVersion": 1,
  "id": "run-123",
  "source": "native",
  "tools": [
    { "name": "Read", "argsSchema": { "type": "object", "properties": { "path": { "type": "string" } } } },
    { "name": "Bash" }
  ],
  "events": [
    { "type": "message", "role": "assistant", "model": "claude-sonnet-4-5", "usage": { "input": 100, "output": 50 } },
    { "type": "tool_call", "call": { "id": "c1", "name": "Read", "args": { "path": "src/a.ts" } } },
    { "type": "tool_result", "result": { "callId": "c1", "isError": false, "contentHash": "…" } }
  ]
}
```

## Pricing

Cost estimates use a built-in, date-stamped pricing table (`2026-10`) covering Claude, GPT, Gemini, and o-series models. Override with `--pricing <file>`. Unpriced models are disclosed as suppressions, never silently excluded.

## Developing

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # tsup
```

## License

MIT
