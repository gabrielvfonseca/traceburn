import { Command } from 'commander';
import { type LintOptions, lintRun } from '@/lint.js';
import { loadRun, UnrecognizedFormatError } from '@/loaders.js';
import { renderJson, renderReport } from '@/reporters/terminal.js';
import type { Tier } from '@/rules/engine.js';

const TIER_CHOICES: readonly Tier[] = [
  'hard_defect',
  'hard_event',
  'candidate',
  'warning',
  'info',
];

function parseFailOn(value: string): Tier {
  if ((TIER_CHOICES as readonly string[]).includes(value)) {
    return value as Tier;
  }
  throw new Error(`--fail-on must be one of: ${TIER_CHOICES.join(', ')}`);
}

interface CheckOptions {
  failOn?: Tier;
  hotspotShare?: string;
  json?: boolean;
  noColor?: boolean;
  pricing?: string;
}

function resolveColor(
  noColor: boolean | undefined,
  streamIsTty: boolean,
): boolean {
  if (noColor === true) {
    return false;
  }
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
    return false;
  }
  return streamIsTty;
}

function checkFiles(files: readonly string[], options: CheckOptions): number {
  const lintOptions: LintOptions = {
    failOn: options.failOn,
    hotspotShare:
      options.hotspotShare === undefined
        ? undefined
        : Number(options.hotspotShare),
    pricingPath: options.pricing,
  };
  const color = resolveColor(options.noColor, process.stdout.isTTY === true);
  const exitCodes = files.flatMap((file) => {
    try {
      const { run, format } = loadRun(file);
      const report = lintRun(run, lintOptions, format);
      const output =
        options.json === true
          ? renderJson(report)
          : renderReport(report, { color });
      process.stdout.write(`${output}\n\n`);
      return [report.exitCode];
    } catch (error) {
      if (
        error instanceof UnrecognizedFormatError ||
        error instanceof SyntaxError
      ) {
        process.stderr.write(`error: ${error.message}\n`);
        return [3];
      }
      throw error;
    }
  });
  return exitCodes.reduce((worst, code) => Math.max(worst, code), 0) as
    | 0
    | 1
    | 2
    | 3;
}

const program = new Command();

program
  .name('traceburn')
  .description(
    'See where your agent burned money and tokens. Deterministic linter for agent runs — token hotspots, loops, cache waste, structural defects. No LLM judge.',
  )
  .version('0.1.0');

program
  .command('check')
  .description('lint one or more agent session traces')
  .argument(
    '<files...>',
    'Claude Code .jsonl session(s) or traceburn native run .json',
  )
  .option('--json', 'machine-readable JSON output')
  .option(
    '--pricing <file>',
    'pricing table JSON overriding the built-in table',
  )
  .option(
    '--fail-on <tier>',
    `exit 1 on findings at/above this tier (${TIER_CHOICES.join(', ')})`,
    parseFailOn,
  )
  .option(
    '--hotspot-share <pct>',
    'per-turn cost share (0-1) that flags a hotspot, default 0.15',
  )
  .option('--no-color', 'disable ANSI color')
  .action((files: string[], options: CheckOptions) => {
    const code = checkFiles(files, options);
    process.exitCode = code;
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 3;
});
