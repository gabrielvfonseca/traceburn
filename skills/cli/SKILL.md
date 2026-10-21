# CLI skill

This skill describes how to work with the agentburn command-line interface (`agentburn check`).

## CLI entry point

- **Binary:** `agentburn` → `dist/cli.js`
- **Framework:** commander
- **Build:** `tsup` with entry points `src/index.ts` and `src/cli.ts`

## `agentburn check`

```
agentburn check <files...> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `<files...>` | One or more Claude Code `.jsonl` sessions or agentburn native run `.json` files |

### Options

| Option | Type | Description |
|--------|------|-------------|
| `--json` | boolean | Machine-readable JSON output |
| `--pricing <file>` | string | Pricing table JSON overriding the built-in table |
| `--fail-on <tier>` | string | Exit 1 on findings at/above this tier |
| `--hotspot-share <pct>` | string (0-1) | Per-turn cost share that flags a hotspot (default `0.15`) |
| `--no-color` | boolean | Disable ANSI color |

### `--fail-on` tier choices

`hard_defect`, `hard_event`, `candidate`, `warning`, `info`

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | No findings above the fail-on threshold |
| `1` | Findings at/above `--fail-on` tier |
| `2` | A `hard_defect` finding was detected |
| `3` | Input/output error (unrecognized format, bad JSON) |

When multiple files are checked, the worst exit code across all files is returned.

### Color resolution

1. `--no-color` → disabled
2. `NO_COLOR` env var set → disabled
3. `process.stdout.isTTY` → enabled if TTY, otherwise disabled

## Programmatic API (`src/lint.ts`)

### `lintRun(run, options?, format?)`

```ts
export interface LintOptions {
  pricingPath?: string;
  failOn?: Tier;
  hotspotShare?: number;
  bloatGrowthFactor?: number;
  rules?: readonly Rule[];
}

export interface LintReport {
  run: AgentRun;
  format: SourceFormat | 'library';
  findings: Finding[];
  suppressions: Suppression[];
  pricing: PricingTable;
  exitCode: 0 | 1 | 2;
}
```

Behavior:
1. Load pricing (built-in table or override via `pricingPath`).
2. Build `RuleContext` with `hotspotShare`, `bloatGrowthFactor`, `pricing`.
3. Run all rules (default or custom `rules` option) via `mergeResults`.
4. Sort findings by cost descending, then tier rank descending.
5. Compute exit code via `exitCodeFor`.

### Exit code logic (`exitCodeFor`)

1. If any finding is `hard_defect` → return `2`.
2. If `failOn` is undefined → return `0`.
3. If any finding's tier rank >= `failOn` tier rank → return `1`.
4. Otherwise → return `0`.

## Reporters (`src/reporters/terminal.ts`)

### `renderReport(report, { color })`

Produces a human-readable terminal report:

```
● agentburn — run-id · claude-code · 6 priced turn(s) · 5 tool call(s) · est. $0.35 · 270.6k tokens
  $0.35  AL202  info  est. $0.35 across 6 priced turn(s), 270.6k tokens
        pricing as of 2026-10 (override with --pricing)
         AL104  candidate  `Bash` ran 3× with identical args and identical results
        call: Bash {"command":"git status --short"}
        identical result: M src/foo.ts
        spacing: ~5s apart
        at events: 2, 5, 8
  est. cost @ prices as of 2026-10 · exit 0
```

Header shows: run id, source, priced turn count, tool call count, estimated cost, total tokens.

Findings are sorted by cost (descending) then tier (descending).

Suppressed rules are listed after findings with "checked nothing, not a clean pass".

Footer shows estimated cost pricing date and exit code.

### `renderJson(report)`

Produces machine-readable JSON with `run`, `pricing`, `findings`, `suppressions`, `exitCode`.

## Tier badges (colored output)

| Tier | Badge color | Label |
|------|-------------|-------|
| `hard_defect` | red | `defect` |
| `hard_event` | magenta | `event` |
| `candidate` | yellow | `candidate` |
| `warning` | cyan | `warn` |
| `info` | dim | `info` |

## Error handling

- `UnrecognizedFormatError` → stderr message, exit code `3`.
- `SyntaxError` (bad JSON) → stderr message, exit code `3`.
- Other errors → thrown (uncaught, process exits non-zero).
- Commander parse errors → stderr message, exit code `3`.

## Examples

```bash
# Lint a single Claude Code session
agentburn check ~/.claude/projects/*/session.jsonl

# Lint multiple files
agentburn check trace1.jsonl trace2.jsonl

# Fail CI on anything candidate or worse
agentburn check trace.jsonl --fail-on candidate

# JSON output for CI integration
agentburn check trace.jsonl --json

# Use a custom pricing table
agentburn check trace.jsonl --pricing pricing.json

# Disable color for non-TTY output
agentburn check trace.jsonl --no-color

# Adjust hotspot sensitivity
agentburn check trace.jsonl --hotspot-share 0.10
```

## Related

- Rule documentation: `skills/rules/SKILL.md`
- Adapter documentation: `skills/adapters/SKILL.md`
- Usage guide: `docs/USAGE_GUIDE.md`
