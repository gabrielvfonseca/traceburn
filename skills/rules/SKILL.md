# Lint rules skill

This skill describes how to work with agentburn's deterministic lint rules. Every rule is a `Rule` object exported from `src/rules/alNNN.ts` and registered in `src/rules/index.ts`.

## Rule architecture

### Rule type (`src/rules/engine.ts`)

```ts
export type Tier = 'hard_defect' | 'hard_event' | 'candidate' | 'warning' | 'info';

export interface Finding {
  ruleId: string;
  title: string;
  tier: Tier;
  summary: string;
  evidence: string[];       // human-readable evidence lines quoting the trace
  eventIndexes: number[];   // indexes into run.events
  cost?: number;            // attributed waste in USD, when priced
  tokens?: number;          // attributed wasted tokens, when counted
  meta?: Record<string, string | number>;
}

export interface Rule {
  id: string;
  title: string;
  tier: Tier;
  evaluate(run: AgentRun, ctx: RuleContext): RuleResult;
}

export interface RuleContext {
  pricing: PricingTable;
  hotspotShare: number;     // per-turn cost share threshold for hotspots (default 0.15)
  bloatGrowthFactor: number; // context growth factor threshold for bloat (default 3)
}

export interface RuleResult {
  findings: Finding[];
  suppressions: Suppression[];
}
```

### Tier ranking (used by `--fail-on`)

| Rank | Tier |
|------|------|
| 0 | `info` |
| 1 | `warning` |
| 2 | `candidate` |
| 3 | `hard_event` |
| 4 | `hard_defect` |

### Rule catalog

| Rule | Tier | File | What it checks |
|------|------|------|----------------|
| AL101 | hard_defect | `al101.ts` | Malformed arguments — `argsRaw` is not valid JSON |
| AL102 | candidate | `al102.ts` | Unknown tool — call absent from declared toolset |
| AL103 | hard_event | `al103.ts` | Tool error — result returned `isError` |
| AL104 | candidate | `al104.ts` | Loop — 3+ identical no-progress calls |
| AL105 | candidate | `al105.ts` | Redundant call — identical call + identical result, no mutation |
| AL200 | warning | `al200.ts` | Token hotspot — outsized per-turn spend |
| AL201 | warning | `al201.ts` | Context bloat — growing prompt, weak cache absorption |
| AL202 | info | `al202.ts` | Run cost — estimated spend |

### Default rules (`src/rules/index.ts`)

```ts
export const defaultRules: readonly Rule[] = [
  ruleAl101, ruleAl102, ruleAl103,
  ruleAl104, ruleAl105,
  ruleAl200, ruleAl201, ruleAl202,
];
```

## Rule details

### AL101 — Malformed arguments (hard_defect)

- **File:** `src/rules/al101.ts`
- **Trigger:** A `tool_call` event whose `argsRaw` is present but not valid JSON.
- **Evidence:** `call`, `argsRaw` (truncated to 160 chars), `at event`.
- **No suppression:** Always reports when malformed args found.
- **Exit:** `2` (hard_defect fails CI by default).

### AL102 — Unknown tool (candidate)

- **File:** `src/rules/al102.ts`
- **Trigger:** A `tool_call` to a tool name not in `run.tools`.
- **Suppression:** If no toolset is declared (`run.tools` empty/absent), returns a suppression with reason "no toolset declared in the run; unknown-tool check requires declared tools".
- **Grouping:** Multiple calls to the same unknown tool are grouped into one finding with `eventIndexes` and `meta.count`.
- **Evidence:** `tool`, `declared tools`, `at events`.

### AL103 — Tool error (hard_event)

- **File:** `src/rules/al103.ts`
- **Trigger:** A completed call whose `result.isError === true`.
- **Skipped:** Calls with no result yet (`result === undefined`) or successful results.
- **Evidence:** `call`, `result` preview, `at event`.
- **Note:** A single error may be benign — reported for review, not an automatic verdict.

### AL104 — Loop — identical no-progress calls (candidate)

- **File:** `src/rules/al104.ts`
- **Trigger:** 3+ consecutive calls (`MIN_STREAK = 3`) with identical `callKey` (name + args) AND identical `resultHash` AND no mutating call between them.
- **Mutation breaks streak:** Any call where `isMutatingCall` returns true closes the current streak.
- **Result requirement:** Streak entries must be successful (`isSuccessful`) and have a `contentHash`.
- **Evidence:** `call`, `identical result` (truncated), `spacing` (median gap), `at events`.
- **Note:** Polls and intentional retries can look identical — evidence shown for review, never a verdict.

### AL105 — Redundant call (candidate)

- **File:** `src/rules/al105.ts`
- **Trigger:** Same call key + same result hash seen twice with no mutating call between them (mutation epoch changed).
- **Mutation resets tracking:** A mutating call increments the epoch, which clears the "seen" cache for that key.
- **Evidence:** `call`, `first at event X, repeated at event Y`, `no mutating tool call occurred between them`.
- **Note:** Deterministic tools legitimately return stable results — human must judge.

### AL200 — Token hotspot (warning)

- **File:** `src/rules/al200.ts`
- **Trigger:** A turn whose cost share of total run spend >= `ctx.hotspotShare` (default 0.15 / 15%).
- **Output:** Up to `MAX_HOTSPOTS = 5` hotspots, sorted by cost descending.
- **Suppression:** No assistant turns with usage, or no priced model matched.
- **Evidence:** `model`, `tokens` breakdown (in/out/cache-read/cache-create), `context carried`.
- **Meta:** `sharePercent`.

### AL201 — Context bloat (warning)

- **File:** `src/rules/al201.ts`
- **Trigger:** Context grew >= `ctx.bloatGrowthFactor` (default 3×) OR grew >= 2× with back-half cache-hit rate < 0.2.
- **Minimum:** Needs >= `MIN_TURNS = 4` assistant turns with usage.
- **Suppression:** Too few turns, or first turn has no context tokens.
- **Evidence:** `turns measured`, `cache-hit rate (back half)`, suggestion text.
- **Meta:** none (uses `tokens` for growth delta).

### AL202 — Run cost (info)

- **File:** `src/rules/al202.ts`
- **Trigger:** Always reports if there are assistant turns with usage.
- **Suppression:** No assistant turns with usage; or unpriced models disclosed as suppression.
- **Evidence:** `pricing as of ...`, `unpriced model: ...` for each unpriced model.
- **Meta:** none (uses `cost` and `tokens`).
- **Note:** Every number is an estimate against a date-stamped pricing table.

## Shared detection helpers (`src/rules/detect.ts`)

| Helper | Purpose |
|--------|---------|
| `isMutatingCall(call)` | Best-effort mutation detector — true for write-ish tool names or shell commands that modify state (`mv`, `rm`, `tee`, `touch`, `mkdir`, `sed -i`, `>>`, `git commit/push`, `npm install/run`, etc.) |
| `isSuccessful(entry)` | True when `result !== undefined && result.isError !== true` |
| `resultHashOf(entry)` | Returns `result.contentHash` if available |
| `hashOf(raw)` | SHA-256 of a raw string |
| `medianGapMs(timestamps)` | Median gap between sorted timestamps; undefined if < 2 parse |
| `formatGap(gapMs)` | Human-readable gap string |

## Usage helpers (`src/rules/usage.ts`)

| Helper | Purpose |
|--------|---------|
| `collectUsage(run, pricing)` | Extracts per-turn usage from assistant `message` events with `usage`; resolves price per model |
| `totalCost(turns)` | Sum of priced turn costs; undefined if no priced turns |
| `unpricedModels(turns)` | Deduplicated list of models with no price match |

## Schema helpers (`src/schema.ts`)

| Helper | Purpose |
|--------|---------|
| `callKey(name, args, argsRaw?)` | Canonical form of a tool call for loop/redundancy comparison |
| `pairCallsWithResults(run)` | Joins tool calls to their results in document order → `CompletedCall[]` |
| `declaredToolNames(run)` | Names of tools declared in `run.tools` |
| `declaredToolArgsSchema(run, name)` | JSON Schema (if any) declared for a tool |
| `stableStringify(value)` | Stable JSON stringify with sorted keys for hashing |

## Adding a new rule

1. Create `src/rules/alNNN.ts`:
   - Export a `ruleAlNNN: Rule` object with `id`, `title`, `tier`, `evaluate`.
   - Use `@/` path aliases for imports (`@/schema.js`, `@/rules/engine.js`, `@/rules/detect.js`).
   - Every finding needs `evidence` (string[]) and `eventIndexes` (number[]).
2. Register in `src/rules/index.ts` `defaultRules`.
3. Add tests in `tests/rules-alNNN.test.ts` using `makeRun`/`makeCall`/`makeResult`/`makeAssistantTurn` from `tests/helpers.ts`.
4. Run `npm run typecheck && npm test`.
5. Add a changeset: `npm run changeset`.

## Testing conventions

- Test files: `tests/rules-alNNN.test.ts`
- Helpers: `tests/helpers.ts` exports `makeCall`, `makeResult`, `makeAssistantTurn`, `makeRun`, `callKey`.
- Use `DEFAULT_CONTEXT` from `src/rules/engine.js` for rule context in tests.
- Every rule should test: positive case, negative case, edge cases (no results, errors, mutations between calls).

## Formatting & lint

- Biome is configured in `biome.json` (extends ultracite core, `noBarrelFile` off).
- Run `npm run lint` to check, `npm run lint:fix` to auto-fix.
- No comments in code unless asked.
- Path aliases: `@/` → `./src/`, `@@/` → `./tests/`.
