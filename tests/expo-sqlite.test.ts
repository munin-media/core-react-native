/**
 * ExpoSQLiteBackend unit tests.
 * Mocks expo-sqlite with an in-memory implementation that tracks SQL calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory table storage for the mock
type Row = Record<string, unknown>;
const tables = new Map<string, Row[]>();

function parseInsertOrReplace(sql: string, params: unknown[]): { table: string; row: Row } | null {
  const match = sql.match(/INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)\s*VALUES/i);
  if (!match) return null;
  const table = match[1]!;
  const columns = match[2]!.split(',').map((c) => c.trim());
  const row: Row = {};
  columns.forEach((col, i) => {
    row[col] = params[i];
  });
  return { table, row };
}

function matchesWhere(row: Row, conditions: Array<[string, unknown]>): boolean {
  return conditions.every(([col, val]) => row[col] === val);
}

const mockDb = {
  execSync: vi.fn((sql: string) => {
    // Parse CREATE TABLE statements to initialize tables
    const tableMatches = sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g);
    for (const m of tableMatches) {
      if (!tables.has(m[1]!)) {
        tables.set(m[1]!, []);
      }
    }
  }),
  getAllSync: vi.fn(<T>(_sql: string, ..._params: unknown[]): T[] => {
    // Simple mock: parse WHERE userId = ?
    const tableMatch = _sql.match(/FROM (\w+)/i);
    if (!tableMatch) return [] as T[];
    const table = tableMatch[1]!;
    const rows = tables.get(table) ?? [];
    const conditions: Array<[string, unknown]> = [];
    const whereMatches = _sql.matchAll(/(\w+)\s*=\s*\?/g);
    let paramIdx = 0;
    for (const m of whereMatches) {
      conditions.push([m[1]!, _params[paramIdx]]);
      paramIdx++;
    }
    return rows.filter((r) => matchesWhere(r, conditions)) as T[];
  }),
  getFirstSync: vi.fn(<T>(_sql: string, ..._params: unknown[]): T | null => {
    const results = mockDb.getAllSync<T>(_sql, ..._params);
    return results[0] ?? null;
  }),
  runSync: vi.fn((_sql: string, ..._params: unknown[]) => {
    if (_sql.match(/INSERT OR REPLACE/i)) {
      const parsed = parseInsertOrReplace(_sql, _params);
      if (parsed) {
        const rows = tables.get(parsed.table) ?? [];
        // Find primary key columns (simplified: userId + next column)
        const existing = rows.findIndex((r) =>
          r['userId'] === parsed.row['userId'] &&
          (parsed.row['titleId'] !== undefined ? r['titleId'] === parsed.row['titleId'] :
           parsed.row['seriesId'] !== undefined ? r['seriesId'] === parsed.row['seriesId'] :
           parsed.row['collectionId'] !== undefined ? r['collectionId'] === parsed.row['collectionId'] :
           parsed.row['contributionId'] !== undefined ? r['contributionId'] === parsed.row['contributionId'] :
           true),
        );
        if (existing >= 0) {
          rows[existing] = parsed.row;
        } else {
          rows.push(parsed.row);
        }
        tables.set(parsed.table, rows);
        return { changes: 1, lastInsertRowId: rows.length };
      }
    }
    if (_sql.match(/DELETE/i)) {
      const tableMatch = _sql.match(/FROM (\w+)/i);
      if (tableMatch) {
        const table = tableMatch[1]!;
        const rows = tables.get(table) ?? [];
        const conditions: Array<[string, unknown]> = [];
        const whereMatches = _sql.matchAll(/(\w+)\s*=\s*\?/g);
        let paramIdx = 0;
        for (const m of whereMatches) {
          conditions.push([m[1]!, _params[paramIdx]]);
          paramIdx++;
        }
        const before = rows.length;
        const remaining = rows.filter((r) => !matchesWhere(r, conditions));
        tables.set(table, remaining);
        return { changes: before - remaining.length, lastInsertRowId: 0 };
      }
    }
    return { changes: 0, lastInsertRowId: 0 };
  }),
  closeSync: vi.fn(),
};

vi.mock('expo-sqlite', () => ({
  openDatabaseSync: vi.fn(() => mockDb),
}));

import { ExpoSQLiteBackend } from '../src/expo-sqlite.js';

describe('ExpoSQLiteBackend', () => {
  let backend: ExpoSQLiteBackend;

  beforeEach(() => {
    tables.clear();
    vi.clearAllMocks();
    backend = new ExpoSQLiteBackend('test.db');
  });

  it('initializes tables on initialize()', async () => {
    await backend.initialize();
    expect(mockDb.execSync).toHaveBeenCalledOnce();
    expect(tables.has('progress')).toBe(true);
    expect(tables.has('series_progress')).toBe(true);
    expect(tables.has('ratings')).toBe(true);
    expect(tables.has('affinity_profiles')).toBe(true);
    expect(tables.has('collections')).toBe(true);
    expect(tables.has('contributions')).toBe(true);
  });

  describe('progress', () => {
    beforeEach(async () => {
      await backend.initialize();
    });

    it('returns null for missing progress', async () => {
      const result = await backend.getProgress('user1', 'title1');
      expect(result).toBeNull();
    });

    it('stores and retrieves progress', async () => {
      const entry = {
        userId: 'user1',
        titleId: 'title1',
        type: 'movie' as const,
        currentSeconds: 120,
        durationSeconds: 7200,
        percent: 0.017,
        isCompleted: false,
        lastUpdated: new Date('2026-01-01T00:00:00Z'),
      };
      await backend.setProgress(entry);
      expect(mockDb.runSync).toHaveBeenCalled();
      // Verify the data was stored
      const rows = tables.get('progress');
      expect(rows).toHaveLength(1);
      expect(rows![0]!['userId']).toBe('user1');
      expect(rows![0]!['titleId']).toBe('title1');
    });
  });

  describe('ratings', () => {
    beforeEach(async () => {
      await backend.initialize();
    });

    it('stores a rating', async () => {
      const rating = {
        userId: 'user1',
        titleId: 'title1',
        score: 8,
        tags: ['action', 'sci-fi'],
        notes: 'Great',
        ratedAt: new Date('2026-01-01T00:00:00Z'),
      };
      await backend.setRating(rating);
      const rows = tables.get('ratings');
      expect(rows).toHaveLength(1);
      expect(rows![0]!['score']).toBe(8);
      expect(rows![0]!['tagsJson']).toBe('["action","sci-fi"]');
    });

    it('deletes a rating and returns true', async () => {
      tables.set('ratings', [{ userId: 'user1', titleId: 'title1', score: 8, tagsJson: '[]', notes: null, ratedAt: '2026-01-01T00:00:00.000Z' }]);
      const result = await backend.deleteRating('user1', 'title1');
      expect(result).toBe(true);
      expect(tables.get('ratings')).toHaveLength(0);
    });
  });

  describe('lifecycle', () => {
    it('closes the database', async () => {
      await backend.close();
      expect(mockDb.closeSync).toHaveBeenCalledOnce();
    });
  });
});
