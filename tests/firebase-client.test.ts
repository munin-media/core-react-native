/**
 * FirebaseClientBackend unit tests.
 * Mocks firebase/firestore with an in-memory document store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory Firestore mock
const docs = new Map<string, Record<string, unknown>>();

function docPath(...segments: string[]): string {
  return segments.join('/');
}

const mockSnap = (path: string) => ({
  exists: () => docs.has(path),
  data: () => docs.get(path),
  id: path.split('/').pop()!,
});

const mockCollectionSnap = (prefix: string) => {
  const matchingDocs = [...docs.entries()]
    .filter(([key]) => key.startsWith(prefix + '/') && key.split('/').length === prefix.split('/').length + 1)
    .map(([key]) => mockSnap(key));
  return {
    docs: matchingDocs,
    empty: matchingDocs.length === 0,
    size: matchingDocs.length,
  };
};

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => docPath(...segments)),
  collection: vi.fn((_db: unknown, ...segments: string[]) => docPath(...segments)),
  getDoc: vi.fn(async (path: string) => mockSnap(path)),
  getDocs: vi.fn(async (path: string) => mockCollectionSnap(path)),
  setDoc: vi.fn(async (path: string, data: Record<string, unknown>) => {
    docs.set(path, data);
  }),
  deleteDoc: vi.fn(async (path: string) => {
    docs.delete(path);
  }),
  writeBatch: vi.fn(() => {
    const deletions: string[] = [];
    return {
      delete: vi.fn((path: string) => { deletions.push(path); }),
      commit: vi.fn(async () => {
        for (const path of deletions) docs.delete(path);
      }),
    };
  }),
}));

import { FirebaseClientBackend } from '../src/firebase-client.js';

describe('FirebaseClientBackend', () => {
  let backend: FirebaseClientBackend;

  beforeEach(() => {
    docs.clear();
    vi.clearAllMocks();
    backend = new FirebaseClientBackend({} as never);
  });

  describe('progress', () => {
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

      // Verify doc was written at correct path
      const path = 'users/user1/progress/title1';
      expect(docs.has(path)).toBe(true);
      const stored = docs.get(path)!;
      expect(stored['type']).toBe('movie');
      expect(stored['currentSeconds']).toBe(120);
      expect(stored['isCompleted']).toBe(false);
    });
  });

  describe('ratings', () => {
    it('stores and retrieves a rating', async () => {
      const rating = {
        userId: 'user1',
        titleId: 'title1',
        score: 9,
        tags: ['thriller', 'noir'],
        notes: 'Edge of seat',
        ratedAt: new Date('2026-02-01T00:00:00Z'),
      };
      await backend.setRating(rating);

      const path = 'users/user1/ratings/title1';
      expect(docs.has(path)).toBe(true);
      expect(docs.get(path)!['score']).toBe(9);
      expect(docs.get(path)!['tags']).toEqual(['thriller', 'noir']);
    });

    it('deletes a rating', async () => {
      docs.set('users/user1/ratings/title1', { score: 8, tags: [], ratedAt: '2026-01-01' });
      const deleted = await backend.deleteRating('user1', 'title1');
      expect(deleted).toBe(true);
      expect(docs.has('users/user1/ratings/title1')).toBe(false);
    });

    it('returns false when deleting non-existent rating', async () => {
      const deleted = await backend.deleteRating('user1', 'title1');
      expect(deleted).toBe(false);
    });
  });

  describe('collections', () => {
    it('stores and retrieves a collection', async () => {
      const coll = {
        collectionId: 'coll1',
        userId: 'user1',
        name: 'Favorites',
        type: 'manual' as const,
        items: ['t1', 't2'],
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      };
      await backend.setCollection(coll);

      const path = 'users/user1/collections/coll1';
      expect(docs.has(path)).toBe(true);
      expect(docs.get(path)!['name']).toBe('Favorites');
      expect(docs.get(path)!['items']).toEqual(['t1', 't2']);
    });

    it('deletes a collection', async () => {
      docs.set('users/user1/collections/coll1', { name: 'Test' });
      await backend.deleteCollection('user1', 'coll1');
      expect(docs.has('users/user1/collections/coll1')).toBe(false);
    });
  });

  describe('affinity profile', () => {
    it('returns null when no profile exists', async () => {
      const result = await backend.getAffinityProfile('user1');
      expect(result).toBeNull();
    });

    it('stores and retrieves affinity profile', async () => {
      const profile = {
        userId: 'user1',
        affinities: new Map([['action', 0.9], ['comedy', 0.2]]),
        lastCalculated: new Date('2026-03-01T00:00:00Z'),
      };
      await backend.setAffinityProfile('user1', profile);

      const path = 'users/user1/affinityProfile/current';
      expect(docs.has(path)).toBe(true);
      const stored = docs.get(path)!;
      expect(stored['affinities']).toEqual({ action: 0.9, comedy: 0.2 });
    });
  });

  describe('contributions', () => {
    it('stores a contribution at the correct path', async () => {
      const entry = {
        contributionId: 'c1',
        userId: 'user1',
        titleId: 'new-title',
        title: 'Indie Film',
        type: 'movie' as const,
        tags: ['indie'],
        submittedAt: new Date('2026-04-01T00:00:00Z'),
      };
      await backend.setContribution(entry);

      const path = 'users/user1/contributions/c1';
      expect(docs.has(path)).toBe(true);
      expect(docs.get(path)!['title']).toBe('Indie Film');
    });
  });

  describe('lifecycle', () => {
    it('close() is a no-op', async () => {
      await expect(backend.close()).resolves.toBeUndefined();
    });

    it('initialize() is a no-op', async () => {
      await expect(backend.initialize()).resolves.toBeUndefined();
    });
  });
});
