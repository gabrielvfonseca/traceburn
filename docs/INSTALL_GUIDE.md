# Install Guide

See where your agent burned money and tokens. agentburn is a deterministic linter for agent execution traces — token hotspots, loops, cache waste, and structural defects. No LLM judge.

## Requirements

- Node.js >= 18
- npm or your preferred package manager

## Install from npm

```bash
npm install -g agentburn
```

## Install from source

```bash
git clone https://github.com/gabrielfonseca/agent-lint.git
cd agent-lint
npm install
npm run build
```

The CLI entry point is `dist/cli.js`, exposed as the `agentburn` binary.

## Verify

```bash
agentburn --version
```

## Supported trace formats

- Claude Code session transcripts (`.jsonl` under `~/.claude/projects/*/`)
- agentburn native run files (`.json` matching the canonical run schema)

See `USAGE_GUIDE.md` for the full command reference.
