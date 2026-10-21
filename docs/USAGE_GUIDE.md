# Usage Guide

## `traceburn check`

Lint one or more agent session traces.

```bash
traceburn check <files...> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--json` | Machine-readable JSON output |
| `--pricing <file>` | Pricing table JSON overriding the built-in table |
| `--fail-on <tier>` | Exit 1 on findings at/above this tier (`hard_defect`, `hard_event`, `candidate`, `warning`, `info`) |
| `--hotspot-share <pct>` | Per-turn cost share (0-1) that flags a hotspot, default `0.15` |
| `--no-color` | Disable ANSI color |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | No findings above the fail-on threshold |
| `1` | Findings at/above `--fail-on` tier |
| `2` | A `hard_defect` finding was detected |
| `3` | Input/output error (unrecognized format, bad JSON) |

### Examples

```bash
# Lint a Claude Code session transcript
traceburn check ~/.claude/projects/*/session.jsonl

# Fail CI on anything candidate or worse
traceburn check trace.jsonl --fail-on candidate

# JSON output for CI
traceburn check trace.jsonl --json

# Use a custom pricing table
traceburn check trace.jsonl --pricing pricing.json
```

## Rules

See `RULES_REFERENCE.md` for the full rule catalog.

## Native run schema

See `API_REFERENCE.md` for the canonical `AgentRun` schema.
