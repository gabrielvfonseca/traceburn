import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import {
  loadClaudeCodeFile,
  parseClaudeCodeSession,
} from '@/adapters/claude-code.js';
import { type AgentRun, runSchema, SCHEMA_VERSION } from '@/schema.js';

export type SourceFormat = 'claude-code' | 'native';

export interface LoadResult {
  format: SourceFormat;
  run: AgentRun;
}

function looksLikeClaudeCode(content: string): boolean {
  const firstLine = content.split('\n').find((line) => line.trim().length > 0);
  if (firstLine === undefined) {
    return false;
  }
  try {
    const record = JSON.parse(firstLine) as {
      type?: string;
      sessionId?: string;
      message?: unknown;
    };
    return (
      typeof record.type === 'string' &&
      (record.type === 'user' ||
        record.type === 'assistant' ||
        record.type === 'attachment' ||
        record.type === 'summary' ||
        record.sessionId !== undefined)
    );
  } catch {
    return false;
  }
}

function parseNative(content: string, filePath: string): AgentRun {
  const parsed = JSON.parse(content) as unknown;
  const run = runSchema.parse(parsed) as AgentRun;
  return { ...run, filePath: run.filePath ?? filePath };
}

export function detectFormat(
  content: string,
  filePath: string,
): SourceFormat | undefined {
  if (extname(filePath) === '.json' && content.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(content) as { schemaVersion?: number };
      if (parsed.schemaVersion === SCHEMA_VERSION) {
        return 'native';
      }
    } catch {
      return looksLikeClaudeCode(content) ? 'claude-code' : undefined;
    }
  }
  if (looksLikeClaudeCode(content)) {
    return 'claude-code';
  }
  return undefined;
}

export function loadRun(filePath: string): LoadResult {
  const content = readFileSync(filePath, 'utf8');
  const format = detectFormat(content, filePath);
  if (format === 'native') {
    return { format, run: parseNative(content, filePath) };
  }
  if (format === 'claude-code') {
    return { format, run: loadClaudeCodeFile(filePath) };
  }
  throw new UnrecognizedFormatError(filePath);
}

export function loadRunFromContent(
  content: string,
  filePath: string,
): LoadResult {
  const format = detectFormat(content, filePath);
  if (format === 'native') {
    return { format, run: parseNative(content, filePath) };
  }
  if (format === 'claude-code') {
    return { format, run: parseClaudeCodeSession(content, filePath) };
  }
  throw new UnrecognizedFormatError(filePath);
}

export class UnrecognizedFormatError extends Error {
  readonly filePath: string;
  constructor(filePath: string) {
    super(
      `${filePath}: unrecognized trace format (expected a Claude Code session .jsonl or an traceburn native run .json)`,
    );
    this.name = 'UnrecognizedFormatError';
    this.filePath = filePath;
  }
}
