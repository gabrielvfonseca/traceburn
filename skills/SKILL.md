# agentburn — project skill

This skill describes how to work with `agentburn`, a deterministic CLI linter for agent execution traces. It ingests a trace (Claude Code `.jsonl` or native `.json`) and flags redundant tool calls, context bloat, infinite-ish loops, token hotspots, and structural defects — with no LLM judge.

## Project identity

- **Name:** agentburn (CLI binary: `agentburn`)
- **Package:** `agentburn` (ESM, NodeNext, Node >= 18)
- **Entry:** `dist/cli.js` (exposed via `bin`)
- **License:** MIT
- **Version:** 0.1.0

## Core purpose

Read an agent execution trace after the run, normalize it into a canonical `AgentRun` schema, run deterministic lint rules over it, and report findings with exact trace evidence and a CI exit code.

## Directory layout

```
agent-lint/
├── AGENTS.md            # Project instructions (canonical conventions)
├── README.md            # User-facing install + usage guide
├── biome.json           # Biome linter + formatter config
├── ultracite.json       # Ultracite meta-linter config
├── tsconfig.json        # Strict TypeScript, NodeNext, path aliases
├── tsup.config.ts       # Build config (ESM, dts, path-alias plugin)
├── vitest.config.ts     # Test runner config
├── package.json         # Scripts + dependencies
├── .changeset/          # Changeset config + pending changesets
├── .claude/             # Claude Code settings + project instructions
│   ├── settings.json    # Permissions, hooks, environment
│   └── CLAUDE.md        # Project instructions for Claude Code
├── docs/                # Snake-case uppercase *.md docs
│   ├── INSTALL_GUIDE.md
│   ├── USAGE_GUIDE.md
│   ├── API_REFERENCE.md
│   ├── RULES_REFERENCE.md
│   ├── CONTRIBUTING.md
│   ├── SECURITY.md
│   ├── SUPPORT.md
│   └── ARCHITECTURE.md
├── src/
│   ├── index.ts         # Public exports
│   ├── cli.ts           # Commander CLI (`agentburn check`)
│   ├── loaders.ts       # Format detection + loading (.jsonl / .json)
│   ├── lint.ts          # lintRun, exit-code logic
│   ├── schema.ts        # Canonical AgentRun schema + helpers
│   ├── adapters/
│   │   └── claude-code.ts   # Claude Code .jsonl → AgentRun normalizer
│   ├── pricing/
│   │   └── index.ts     # Pricing table, estimateCost, formatUsd, formatTokens
│   ├── reporters/
│   │   └── terminal.ts  # renderReport, renderJson
│   └── rules/
│       ├── engine.ts    # Rule, Finding, Tier, RuleContext, mergeResults
│       ├── detect.ts    # Shared helpers (isMutatingCall, isSuccessful, ...)
│       ├── usage.ts     # collectUsage, totalCost, unpricedModels
│       ├── index.ts     # defaultRules registration
│       ├── al101.ts     # Malformed arguments (hard_defect)
│       ├── al102.ts     # Unknown tool (candidate)
│       ├── al103.ts     # Tool error (hard_event)
│       ├── al104.ts     # Loop — identical no-progress calls (candidate)
│       ├── al105.ts     # Redundant call (candidate)
│       ├── al200.ts     # Token hotspot (warning)
│       ├── al201.ts     # Context bloat (warning)
│       └── al202.ts     # Run cost — estimated spend (info)
├── tests/
│   ├── helpers.ts       # makeCall, makeResult, makeAssistantTurn, makeRun
│   ├── lint-integration.test.ts
│   ├── rules-al101.test.ts … rules-al105.test.ts
│   └── rules-efficiency.test.ts
├── fixtures/
│   └── claude-code/
│       └── fixture-session-001.jsonl  # Pinned golden fixture
├── skills/              # This skill directory
└── dist/                # Build output (gitignored)
```

## Key conventions

- Rule ids: `AL1xx` = structural defects, `AL2xx` = efficiency/cost.
- Tiers: `hard_defect` (exit 2), `hard_event`, `candidate`, `warning`, `info`.
- Every rule result must include `evidence` lines quoting the trace and `eventIndexes`.
- No LLM judges — every verdict is decided from the trace alone.
- `noUncheckedIndexedAccess` is on — guard array/maybe accesses.
- No comments in code unless asked.
- ESM (`"type": "module"`), NodeNext module resolution.
- Path aliases: `@/` → `./src/`, `@@/` → `./tests/`.

## Common commands

| Command | Purpose |
|---------|---------|
| `npm run typecheck` | `tsc --noEmit` — strict TypeScript |
| `npm test` | `vitest run` — all tests under `tests/` |
| `npm run build` | `tsup` — builds `dist/` (esm, dts) |
| `npm run dev` | `tsup --watch` |
| `npm run lint` | `biome check` — lint source and config |
| `npm run lint:fix` | `biome check --write` — auto-fix |
| `npm run format` | `biome format` — format code |
| `npm run check` | `ultracite check` — meta-linter |
| `npm run fix` | `ultracite fix` — auto-fix |
| `npm run changeset` | `changeset` — create a changeset |
| `npm run version` | `changeset version` — apply version bumps |
| `npm run release` | `changeset publish` — publish to npm |
| `npm run ci` | typecheck + lint + test |

## CLI usage

```bash
agentburn check <files...> [options]
```

Options:
- `--json` — machine-readable JSON output
- `--pricing <file>` — pricing table JSON overriding the built-in table
- `--fail-on <tier>` — exit 1 on findings at/above this tier (`hard_defect`, `hard_event`, `candidate`, `warning`, `info`)
- `--hotspot-share <pct>` — per-turn cost share (0-1) that flags a hotspot, default `0.15`
- `--no-color` — disable ANSI color

Exit codes: `0` clean, `1` fail-on threshold met, `2` hard_defect found, `3` I/O error.

## Adding a rule (see skills/rules/SKILL.md)

1. Create `src/rules/alNNN.ts` exporting a `Rule` object (`id`, `title`, `tier`, `evaluate`).
2. Register it in `src/rules/index.ts` `defaultRules`.
3. Add tests in `tests/rules-alNNN.test.ts` using `makeRun`/`helpers.ts`.
4. Run `npm run typecheck && npm test`.
5. Add a changeset: `npm run changeset`.

## Before submitting changes

Run: `npm run typecheck && npm run lint && npm test`
