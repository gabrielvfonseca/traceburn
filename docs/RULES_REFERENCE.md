# Rules Reference

## Rule tiers

| Tier | Meaning | CI behavior |
|------|---------|-------------|
| `hard_defect` | Proven structural bug | exit 2 |
| `hard_event` | Real observed event (e.g. tool error) | review |
| `candidate` | Possible issue (loop, redundant call) | review only |
| `warning` | Efficiency issue (hotspot, bloat) | review |
| `info` | Estimated run cost | informational |

## Structural defects (AL1xx)

| Rule | Tier | What it checks |
|------|------|----------------|
| AL101 | hard_defect | Malformed arguments — tool-call `argsRaw` is not valid JSON |
| AL102 | candidate | Unknown tool — a call to a tool absent from the declared toolset (suppressed when no toolset is declared) |
| AL103 | hard_event | Tool error — a tool result returned `is_error` |
| AL104 | candidate | Loop — 3+ identical no-progress calls (same args, same result, no mutation in between) |
| AL105 | candidate | Redundant call — identical call + identical result with no mutation between |

## Efficiency & cost (AL2xx)

| Rule | Tier | What it checks |
|------|------|----------------|
| AL200 | warning | Token hotspot — a turn accounting for an outsized share of run spend |
| AL201 | warning | Context bloat — prompt growing across the run with weak cache absorption |
| AL202 | info | Run cost — estimated USD spend against a date-stamped pricing table |

## Finding fields

Every finding includes:
- `ruleId`, `title`, `tier`, `summary`
- `evidence[]` — human-readable evidence lines quoting the trace
- `eventIndexes[]` — indexes into `run.events`
- `cost?` / `tokens?` — attributed waste when priced
- `meta?` — additional structured metadata

## Finding tiers

Hard defects (`AL101`) are proven by the trace and fail CI (exit 2). Hard events (`AL103`) and candidates (`AL104`, `AL105`) are real signals but may be legitimate (e.g. an intentional retry), so they are shown for review. Warnings (`AL200`, `AL201`) surface efficiency waste. Info (`AL202`) reports estimated spend.

No rule uses an LLM judge. Every verdict is decided from the trace alone plus facts you declare (tool schemas, pricing).
