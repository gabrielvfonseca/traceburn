import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  type AgentRun,
  type RunEvent,
  SCHEMA_VERSION,
  type TokenUsage,
} from '@/schema.js';

// Adapter for Claude Code session transcripts under ~/.claude/projects (any .jsonl file).
//
// This is a reverse-engineered internal format — the acquisition hook and a
// permanent maintenance tax. The pinned golden fixture in tests protects
// against silent drift: a format change fails CI loudly before users hit it.

/** Minimal structural types for the records we consume (unknown fields pass through). */
interface ClaudeUsage {
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
}

interface ClaudeTextBlock {
  text?: string;
  type: 'text';
}

interface ClaudeThinkingBlock {
  type: 'thinking';
}

interface ClaudeToolUseBlock {
  id?: string;
  input?: unknown;
  name?: string;
  type: 'tool_use';
}

interface ClaudeToolResultBlock {
  content?: unknown;
  is_error?: boolean;
  tool_use_id?: string;
  type: 'tool_result';
}

type ClaudeContentBlock =
  | ClaudeTextBlock
  | ClaudeThinkingBlock
  | ClaudeToolUseBlock
  | ClaudeToolResultBlock
  | { type: string };

interface ClaudeRecord {
  cwd?: string;
  isSidechain?: boolean;
  message?: {
    role?: string;
    model?: string;
    content?: string | ClaudeContentBlock[];
    usage?: ClaudeUsage;
  };
  parentUuid?: string | null;
  sessionId?: string;
  timestamp?: string;
  type?: string;
  uuid?: string;
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function normalizeUsage(
  usage: ClaudeUsage | undefined,
): TokenUsage | undefined {
  if (!usage) {
    return undefined;
  }
  return {
    cacheCreate: usage.cache_creation_input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
  };
}

function contentAsBlocks(
  content: string | ClaudeContentBlock[] | undefined,
): ClaudeContentBlock[] | undefined {
  if (Array.isArray(content)) {
    return content;
  }
  return undefined;
}

function previewOf(raw: string): string {
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}...` : flat;
}

function toolResultFromBlock(block: ClaudeToolResultBlock): RunEvent {
  const rawContent = block.content;
  let raw: string;
  if (typeof rawContent === 'string') {
    raw = rawContent;
  } else if (rawContent === undefined) {
    raw = '';
  } else {
    raw = JSON.stringify(rawContent);
  }
  return {
    result: {
      callId: block.tool_use_id ?? '',
      contentBytes: Buffer.byteLength(raw, 'utf8'),
      contentHash: raw.length > 0 ? sha256(raw) : undefined,
      contentPreview: previewOf(raw),
      isError: block.is_error ?? false,
    },
    type: 'tool_result',
  };
}

function eventsFromAssistantRecord(
  record: ClaudeRecord,
  ts?: string,
): RunEvent[] {
  const { message } = record;
  if (!message) {
    return [];
  }
  const blocks = contentAsBlocks(message.content);
  const usage = normalizeUsage(message.usage);
  const headerEvent: RunEvent = {
    model: message.model,
    role: 'assistant',
    ts,
    type: 'message',
    usage,
  };
  if (blocks === undefined) {
    const text =
      typeof message.content === 'string' ? message.content : undefined;
    return [{ ...headerEvent, text }];
  }
  const blockEvents: RunEvent[] = blocks.flatMap((block) => {
    if (block.type === 'tool_use') {
      const toolBlock = block as ClaudeToolUseBlock;
      if (toolBlock.id === undefined || toolBlock.name === undefined) {
        return [];
      }
      return [
        {
          call: {
            args: toolBlock.input,
            argsRaw:
              toolBlock.input === undefined
                ? undefined
                : JSON.stringify(toolBlock.input),
            id: toolBlock.id,
            name: toolBlock.name,
          },
          ts,
          type: 'tool_call',
        } satisfies RunEvent,
      ];
    }
    if (block.type === 'text') {
      return [];
    }
    return [];
  });
  const text = blocks
    .filter((block): block is ClaudeTextBlock => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n');
  const withText: RunEvent =
    text.length > 0 ? { ...headerEvent, text } : headerEvent;
  return [withText, ...blockEvents];
}

function eventsFromUserRecord(record: ClaudeRecord, ts?: string): RunEvent[] {
  const { message } = record;
  if (!message) {
    return [];
  }
  const blocks = contentAsBlocks(message.content);
  if (blocks === undefined) {
    const text =
      typeof message.content === 'string' ? message.content : undefined;
    if (text === undefined || text.length === 0) {
      return [];
    }
    return [{ role: 'user', text, ts, type: 'message' }];
  }
  const resultEvents: RunEvent[] = blocks.flatMap((block) => {
    if (block.type === 'tool_result') {
      return [toolResultFromBlock(block as ClaudeToolResultBlock)];
    }
    return [];
  });
  const text = blocks
    .filter((block): block is ClaudeTextBlock => block.type === 'text')
    .map((block) => block.text ?? '')
    .filter((part) => part.length > 0)
    .join('\n');
  const messageEvent: RunEvent[] =
    text.length > 0 ? [{ role: 'user', text, ts, type: 'message' }] : [];
  return [...messageEvent, ...resultEvents];
}

export function parseClaudeCodeSession(
  content: string,
  filePath: string,
): AgentRun {
  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  const records = lines.flatMap((line) => {
    try {
      return [JSON.parse(line) as ClaudeRecord];
    } catch {
      return [];
    }
  });
  const mainChain = records.filter((record) => record.isSidechain !== true);
  const events = mainChain.flatMap((record) => {
    const ts = record.timestamp;
    if (record.type === 'assistant') {
      return eventsFromAssistantRecord(record, ts);
    }
    if (record.type === 'user') {
      return eventsFromUserRecord(record, ts);
    }
    return [];
  });
  const timestamps = mainChain
    .map((record) => record.timestamp)
    .filter((ts): ts is string => typeof ts === 'string');
  const first = records.find((record) => record.sessionId !== undefined);
  const cwd = records.find((record) => record.cwd !== undefined)?.cwd;
  return {
    cwd,
    endedAt: timestamps.at(-1),
    events,
    filePath,
    id: first?.sessionId ?? basename(filePath, '.jsonl'),
    schemaVersion: SCHEMA_VERSION,
    source: 'claude-code',
    startedAt: timestamps[0],
  };
}

export function loadClaudeCodeFile(filePath: string): AgentRun {
  return parseClaudeCodeSession(readFileSync(filePath, 'utf8'), filePath);
}
