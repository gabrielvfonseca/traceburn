# Project instructions for agent-lint (agentburn)

This repo is `agentburn`, a deterministic CLI linter for agent execution traces.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run typecheck` | `tsc --noEmit` — strict TypeScript |
| `npm test` | `vitest run` — all tests under `tests/` |
| `npm run build` | `tsup` — builds `dist/` (esm, dts) |
| `npm run lint` | `biome check` — lint source and config |
| `npm run lint:fix` | `biome check --write` — auto-fix lint issues |
| `npm run format` | `biome format` — format code |
| `npm run check` | `ultracite check` — run ultracite |
| `npm run changeset` | `changeset` — create a changeset |
| `npm run version` | `changeset version` — apply version bumps |
| `npm run release` | `changeset publish` — publish to npm |

## Project structure

- `src/schema.ts` — canonical run schema (`AgentRun`, `RunEvent`, `ToolCall`, `ToolDeclaration`), `callKey`, `pairCallsWithResults`, `declaredToolNames`
- `src/loaders.ts` — format detection + loading (Claude Code `.jsonl` or native `.json`)
- `src/adapters/claude-code.ts` — Claude Code transcript → `AgentRun` normalizer
- `src/lint.ts` — `lintRun`, `LintOptions`, `LintReport`, exit-code logic
- `src/rules/engine.ts` — `Rule`, `Finding`, `Tier`, `RuleContext`, `TIER_RANK`, `mergeResults`
- `src/rules/al101.ts` … `al202.ts` — individual lint rules
- `src/rules/detect.ts` — shared helpers (`isMutatingCall`, `isSuccessful`, `resultHashOf`, `medianGapMs`)
- `src/rules/usage.ts` — `collectUsage`, `totalCost`, `unpricedModels`
- `src/pricing/index.ts` — pricing table, `estimateCost`, `formatUsd`, `formatTokens`
- `src/reporters/terminal.ts` — `renderReport`, `renderJson`
- `src/cli.ts` — commander CLI (`agentburn check`)
- `tests/` — vitest tests, `helpers.ts` (`makeCall`, `makeResult`, `makeAssistantTurn`, `makeRun`)
- `fixtures/claude-code/fixture-session-001.jsonl` — pinned golden fixture
- `docs/` — snake_case uppercase `*.md` documentation (`INSTALL_GUIDE.md`, `USAGE_GUIDE.md`, `API_REFERENCE.md`, `RULES_REFERENCE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, `ARCHITECTURE.md`)
- `.changeset/` — changesets configuration and pending changesets

## Conventions

- Rule ids: `AL1xx` = structural defects, `AL2xx` = efficiency/cost.
- Tiers: `hard_defect` (exit 2), `hard_event`, `candidate`, `warning`, `info`.
- Every rule result must include evidence lines quoting the trace and `eventIndexes`.
- No LLM judges — every verdict is decided from the trace alone.
- `noUncheckedIndexedAccess` is on — guard array/maybe accesses.
- No comments in code unless asked.
- ESM (`"type": "module"`), NodeNext module resolution.
- Path aliases: `@/` → `./src/`, `@@/` → `./tests/`.

## Adding a rule

1. Create `src/rules/alNNN.ts` exporting a `Rule` object (`id`, `title`, `tier`, `evaluate`).
2. Register it in `src/rules/index.ts` `defaultRules`.
3. Add tests in `tests/rules-alNNN.test.ts` using `makeRun`/`helpers.ts`.
4. Run `npm run typecheck && npm test`.
5. Add a changeset: `npm run changeset`.

## Verification

Before submitting changes, run:
- `npm run typecheck`
- `npm run lint`
- `npm test`
