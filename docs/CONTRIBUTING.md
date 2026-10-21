# Contributing

## Development setup

```bash
npm install
```

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

## Adding a rule

1. Create `src/rules/alNNN.ts` exporting a `Rule` object (`id`, `title`, `tier`, `evaluate`).
2. Register it in `src/rules/index.ts` `defaultRules`.
3. Add tests in `tests/rules-alNNN.test.ts` using `makeRun`/`helpers.ts`.
4. Run `npm run typecheck && npm test`.
5. Add a changeset: `npm run changeset`.

## Conventions

- Rule ids: `AL1xx` = structural defects, `AL2xx` = efficiency/cost.
- Tiers: `hard_defect` (exit 2), `hard_event`, `candidate`, `warning`, `info`.
- Every rule result must include evidence lines quoting the trace and `eventIndexes`.
- No LLM judges — every verdict is decided from the trace alone.
- `noUncheckedIndexedAccess` is on — guard array/maybe accesses.
- No comments in code unless asked.
- ESM (`"type": "module"`), NodeNext module resolution.
- Path aliases: `@/` → `./src/`, `@@/` → `./tests/`.
