import pc from 'picocolors';
import { formatTokens, formatUsd } from '@/pricing/index.js';
import type { Finding, Suppression, Tier } from '@/rules/engine.js';
import type { TurnUsage } from '@/rules/usage.js';
import { collectUsage, totalCost } from '@/rules/usage.js';
import type { RunEvent } from '@/schema.js';
import type { LintReport } from '../lint.js';

export interface ReporterOptions {
  color: boolean;
}

function paint(color: boolean) {
  return color ? pc : pc.createColors(false);
}

function tierBadge(p: ReturnType<typeof paint>, tier: Tier): string {
  switch (tier) {
    case 'hard_defect':
      return p.red('defect');
    case 'hard_event':
      return p.magenta('event');
    case 'candidate':
      return p.yellow('candidate');
    case 'warning':
      return p.cyan('warn');
    case 'info':
      return p.dim('info');
    default:
      return p.dim('?');
  }
}

function findingLines(p: ReturnType<typeof paint>, finding: Finding): string[] {
  const cost = finding.cost === undefined ? '' : formatUsd(finding.cost);
  const head = `${cost.padStart(7)}  ${p.bold(finding.ruleId)}  ${tierBadge(p, finding.tier)}  ${finding.summary}`;
  const evidence = finding.evidence.map(
    (line: string) => `        ${p.dim(line)}`,
  );
  return [head, ...evidence];
}

export function renderReport(
  report: LintReport,
  options: ReporterOptions,
): string {
  const p = paint(options.color);
  const turns = collectUsage(report.run, report.pricing);
  const cost = totalCost(turns);
  const toolCallCount = report.run.events.filter(
    (event: RunEvent) => event.type === 'tool_call',
  ).length;
  const header =
    `${p.green('●')} traceburn — ${p.bold(report.run.id)} · ` +
    `${report.run.source} · ${turns.length} priced turn(s) · ${toolCallCount} tool call(s) · ` +
    `est. ${cost === undefined ? p.dim('cost n/a') : p.bold(formatUsd(cost))}`;
  const priced =
    cost === undefined
      ? ''
      : ` · ${formatTokens(turns.reduce((sum: number, t: TurnUsage) => sum + t.billed, 0))} tokens`;
  const pricedLine = priced.length > 0 ? p.dim(priced) : '';

  const body =
    report.findings.length === 0
      ? p.green('  no findings')
      : report.findings
          .map((finding: Finding) => findingLines(p, finding).join('\n'))
          .join('\n');

  const suppressions =
    report.suppressions.length === 0
      ? ''
      : [
          '',
          p.dim(
            `suppressed (${report.suppressions.length}) — checked nothing, not a clean pass:`,
          ),
          ...report.suppressions.map((s: Suppression) =>
            p.dim(`  ${s.ruleId}: ${s.reason}`),
          ),
        ].join('\n');

  const footer = p.dim(
    `  est. cost @ prices as of ${report.pricing.asOf} · exit ${report.exitCode}`,
  );
  return [`${header}${pricedLine}`, '', body, suppressions, footer]
    .filter((part) => part.length > 0)
    .join('\n');
}

export function renderJson(report: LintReport): string {
  return JSON.stringify(
    {
      exitCode: report.exitCode,
      findings: report.findings,
      pricing: { asOf: report.pricing.asOf, currency: report.pricing.currency },
      run: {
        endedAt: report.run.endedAt,
        filePath: report.run.filePath,
        id: report.run.id,
        source: report.run.source,
        startedAt: report.run.startedAt,
      },
      suppressions: report.suppressions,
    },
    null,
    2,
  );
}
