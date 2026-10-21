# Architecture

## Layers

1. **Loaders** (`src/loaders.ts`) — format detection + loading (Claude Code `.jsonl` or native `.json`)
2. **Adapters** (`src/adapters/claude-code.ts`) — Claude Code transcript → `AgentRun` normalizer
3. **Schema** (`src/schema.ts`) — canonical `AgentRun`, `RunEvent`, `ToolCall`, `ToolDeclaration`, helpers
4. **Lint engine** (`src/lint.ts`, `src/rules/engine.ts`) — `lintRun`, `Rule`, `Finding`, `Tier`, `mergeResults`
5. **Rules** (`src/rules/alNNN.ts`) — individual lint rules, registered in `src/rules/index.ts`
6. **Detection helpers** (`src/rules/detect.ts`) — shared helpers (`isMutatingCall`, `isSuccessful`, `resultHashOf`, `medianGapMs`)
7. **Usage** (`src/rules/usage.ts`) — `collectUsage`, `totalCost`, `unpricedModels`
8. **Pricing** (`src/pricing/index.ts`) — pricing table, `estimateCost`, `formatUsd`, `formatTokens`
9. **Reporters** (`src/reporters/terminal.ts`) — `renderReport`, `renderJson`
10. **CLI** (`src/cli.ts`) — commander CLI (`traceburn check`)

## Data flow

```
trace file  →  loadRun  →  AgentRun  →  lintRun  →  LintReport  →  renderReport/renderJson
```

## Tier ordering

`info` < `warning` < `candidate` < `hard_event` < `hard_defect` — used by `--fail-on` comparisons and exit-code logic.

## Conventions

- Rule ids: `AL1xx` = structural defects, `AL2xx` = efficiency/cost.
- Every rule result must include `evidence` lines quoting the trace and `eventIndexes`.
- No LLM judges — every verdict is decided from the trace alone.
