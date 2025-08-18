/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Optional dependency - only imported if timings are enabled
let Database: any = null;

/**
 * Query options for timing records
 */
export interface QueryOptions {
  since?: Date;
  command?: string;
  provider?: string;
  limit?: number;
}

/**
 * Timing record stored in SQLite database
 */
export interface TimingRecord {
  id?: number;
  ts: number; // Unix timestamp in milliseconds
  command: 'chat' | 'embed';
  provider: string;
  model?: string;
  duration_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  ok: boolean; // 1 for success, 0 for failure
}

/**
 * Timing collection interface
 */
export interface TimingCollector {
  record(timing: Omit<TimingRecord, 'id'>): Promise<void>;
  query(options?: {
    since?: Date;
    command?: string;
    provider?: string;
    limit?: number;
  }): Promise<TimingRecord[]>;
  close(): Promise<void>;
}

/**
 * SQLite-based timing collector
 */
class SQLiteTimingCollector implements TimingCollector {
  private db: import('better-sqlite3').Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  private async ensureDatabase(): Promise<void> {
    if (this.db) return;

    try {
      // Try to import better-sqlite3 (optional dependency)
      if (!Database) {
        Database = (await import('better-sqlite3')).default;
      }

      // Ensure cache directory exists
      const cacheDir = join(homedir(), '.cache', 'entole');
      await mkdir(cacheDir, { recursive: true });

      // Open database
      this.db = new Database!(this.dbPath);

      // Create table if it doesn't exist
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS timings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts INTEGER NOT NULL,
          command TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT,
          duration_ms INTEGER NOT NULL,
          input_tokens INTEGER,
          output_tokens INTEGER,
          ok INTEGER NOT NULL
        )
      `);

      // Create index for common queries
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_timings_ts ON timings(ts);
        CREATE INDEX IF NOT EXISTS idx_timings_command ON timings(command);
        CREATE INDEX IF NOT EXISTS idx_timings_provider ON timings(provider);
      `);
    } catch (error) {
      // If better-sqlite3 is not available, throw a helpful error
      if ((error as { code?: string })?.code === 'MODULE_NOT_FOUND') {
        throw new Error(
          'Timing collection requires the optional dependency "better-sqlite3". ' +
            'Install it with: npm install better-sqlite3'
        );
      }
      throw error;
    }
  }

  async record(timing: Omit<TimingRecord, 'id'>): Promise<void> {
    await this.ensureDatabase();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT INTO timings (ts, command, provider, model, duration_ms, input_tokens, output_tokens, ok)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      timing.ts,
      timing.command,
      timing.provider,
      timing.model || null,
      timing.duration_ms,
      timing.input_tokens || null,
      timing.output_tokens || null,
      timing.ok ? 1 : 0
    );
  }

  async query(options: QueryOptions = {}): Promise<TimingRecord[]> {
    await this.ensureDatabase();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let sql = 'SELECT * FROM timings WHERE 1=1';
    const params: unknown[] = [];

    if (options.since) {
      sql += ' AND ts >= ?';
      params.push(options.since.getTime());
    }

    if (options.command) {
      sql += ' AND command = ?';
      params.push(options.command);
    }

    if (options.provider) {
      sql += ' AND provider = ?';
      params.push(options.provider);
    }

    sql += ' ORDER BY ts DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as number,
        ts: r.ts as number,
        command: r.command as 'chat' | 'embed',
        provider: r.provider as string,
        model: r.model as string | undefined,
        duration_ms: r.duration_ms as number,
        input_tokens: r.input_tokens as number | undefined,
        output_tokens: r.output_tokens as number | undefined,
        ok: Boolean(r.ok),
      };
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * No-op timing collector for when timings are disabled
 */
class NoOpTimingCollector implements TimingCollector {
  async record(_timing: Omit<TimingRecord, 'id'>): Promise<void> {
    // No-op
  }

  async query(_options?: QueryOptions): Promise<TimingRecord[]> {
    return [];
  }

  async close(): Promise<void> {
    // No-op
  }
}

/**
 * Global timing collector instance
 */
let globalCollector: TimingCollector | null = null;

/**
 * Initialize timing collection based on configuration
 *
 * @param enabled - Whether timing collection should be enabled
 * @returns The timing collector instance
 *
 * @example
 * ```typescript
 * import { initializeTimings } from 'entole';
 *
 * // Enable timing collection
 * const collector = initializeTimings(true);
 *
 * // Disable timing collection (no-op)
 * const noopCollector = initializeTimings(false);
 * ```
 */
export function initializeTimings(enabled: boolean): TimingCollector {
  if (globalCollector) {
    return globalCollector;
  }

  if (enabled) {
    const dbPath = join(homedir(), '.cache', 'entole', 'timings.sqlite');
    globalCollector = new SQLiteTimingCollector(dbPath);
  } else {
    globalCollector = new NoOpTimingCollector();
  }

  return globalCollector;
}

/**
 * Get the current timing collector
 */
export function getTimingCollector(): TimingCollector {
  if (!globalCollector) {
    // Default to no-op if not initialized
    globalCollector = new NoOpTimingCollector();
  }
  return globalCollector;
}

/**
 * Utility function to measure and record timing for an operation
 *
 * @param operation - The async operation to measure
 * @param metadata - Metadata about the operation for timing records
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * import { withTiming } from 'entole';
 *
 * const response = await withTiming(
 *   () => provider.invokeChat(params),
 *   {
 *     command: 'chat',
 *     provider: 'openai',
 *     model: 'gpt-4o-mini'
 *   }
 * );
 * ```
 */
export async function withTiming<T>(
  operation: () => Promise<T>,
  metadata: {
    command: 'chat' | 'embed';
    provider: string;
    model?: string;
  }
): Promise<T> {
  const collector = getTimingCollector();
  const startTime = Date.now();
  let result: T;
  let success = false;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  try {
    result = await operation();
    success = true;

    // Extract token usage if available
    if (result && typeof result === 'object') {
      const resultObj = result as Record<string, unknown>;
      const meta = resultObj.meta as Record<string, unknown> | undefined;
      const usage = meta?.usage as Record<string, unknown> | undefined;
      if (usage) {
        inputTokens = usage.prompt_tokens as number | undefined;
        outputTokens = usage.completion_tokens as number | undefined;
      }
    }

    return result;
  } finally {
    const endTime = Date.now();
    const duration = endTime - startTime;

    await collector.record({
      ts: startTime,
      command: metadata.command,
      provider: metadata.provider,
      model: metadata.model,
      duration_ms: duration,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      ok: success,
    });
  }
}

/**
 * Clean up timing resources
 */
export async function closeTimings(): Promise<void> {
  if (globalCollector) {
    await globalCollector.close();
    globalCollector = null;
  }
}
