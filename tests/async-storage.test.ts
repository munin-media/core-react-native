/**
 * AsyncStorageBackend unit tests.
 * Mocks @react-native-async-storage/async-storage with an in-memory Map.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AsyncStorage with an in-memory store
const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { store.delete(key); }),
    getAllKeys: vi.fn(async () => [...store.keys()]),
    multiGet: vi.fn(async (keys: string[]) =>
      keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]),
    ),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k);
    }),
  },
}));

import { AsyncStorageBackend } from '../src/async-storage.js';

describe('AsyncStorageBackend', () => {
  let backend: AsyncStorageBackend;

  beforeEach(() => {
    store.clear();
    backend = new AsyncStorageBackend('@test:');
  });

  describe('progress', () => {
    const entry = {
      userId: 'user1',
      titleId: 'title1',
      type: 'movie' as const,
      currentSeconds: 120,
      durationSeconds: 7200,
      percent: 0.017,
      isCompleted: false,
      lastUpdated: new Date('2026-01-01T00:00:00Z'),
      deviceId: 'device1',
    };

    it('returns null for missing progress', async () => {
      const result = await backend.getProgress('user1', 'title1');
      expect(result).toBeNull();
    });

    it('stores and retrieves progress', async () => {
      await backend.setProgress(entry);
      const result = await backend.getProgress('user1', 'title1');
      expect(result).toEqual(entry);
    });

    it('gets all progress for a user', async () => {
      await backend.setProgress(entry);
      await backend.setProgress({ ...entry, titleId: 'title2', percent: 0.5 });
      const all = await backend.getAllProgress('user1');
      expect(all).toHaveLength(2);
    });

    it('does not return other users progress', async () => {
      await backend.setProgress(entry);
      await backend.setProgress({ ...entry, userId: 'user2', titleId: 'title2' });
      const all = await backend.getAllProgress('user1');
      expect(all).toHaveLength(1);
      expect(all[0]!.userId).toBe('user1');
    });
  });

  describe('ratings', () => {
    const rating = {
      userId: 'user1',
      titleId: 'title1',
      score: 8,
      tags: ['action', 'sci-fi'],
      notes: 'Great movie',
      ratedAt: new Date('2026-02-01T00:00:00Z'),
    };

    it('returns null for missing rating', async () => {
      const result = await backend.getRating('user1', 'title1');
      expect(result).toBeNull();
    });

    it('stores and retrieves rating', async () => {
      await backend.setRating(rating);
      const result = await backend.getRating('user1', 'title1');
      expect(result).toEqual(rating);
    });

    it('deletes a rating', async () => {
      await backend.setRating(rating);
      const deleted = await backend.deleteRating('user1', 'title1');
      expect(deleted).toBe(true);
      const result = await backend.getRating('user1', 'title1');
      expect(result).toBeNull();
    });

    it('returns false when deleting non-existent rating', async () => {
      const deleted = await backend.deleteRating('user1', 'title1');
      expect(deleted).toBe(false);
    });

    it('gets all ratings for a user', async () => {
      await backend.setRating(rating);
      await backend.setRating({ ...rating, titleId: 'title2', score: 6 });
      const all = await backend.getAllRatings('user1');
      expect(all).toHaveLength(2);
    });
  });

  describe('affinity profile', () => {
    const profile = {
      userId: 'user1',
      affinities: new Map([['action', 0.8], ['comedy', 0.3]]),
      lastCalculated: new Date('2026-03-01T00:00:00Z'),
    };

    it('returns null for missing profile', async () => {
      const result = await backend.getAffinityProfile('user1');
      expect(result).toBeNull();
    });

    it('stores and retrieves affinity profile', async () => {
      await backend.setAffinityProfile('user1', profile);
      const result = await backend.getAffinityProfile('user1');
      expect(result).toEqual(profile);
    });
  });

  describe('collections', () => {
    const coll = {
      collectionId: 'coll1',
      userId: 'user1',
      name: 'Favorites',
      type: 'manual' as const,
      items: ['title1', 'title2'],
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };

    it('returns null for missing collection', async () => {
      const result = await backend.getCollection('user1', 'coll1');
      expect(result).toBeNull();
    });

    it('stores and retrieves collection', async () => {
      await backend.setCollection(coll);
      const result = await backend.getCollection('user1', 'coll1');
      expect(result).toEqual(coll);
    });

    it('deletes a collection', async () => {
      await backend.setCollection(coll);
      await backend.deleteCollection('user1', 'coll1');
      const result = await backend.getCollection('user1', 'coll1');
      expect(result).toBeNull();
    });

    it('gets all collections for a user', async () => {
      await backend.setCollection(coll);
      await backend.setCollection({ ...coll, collectionId: 'coll2', name: 'Watch Later' });
      const all = await backend.getCollections('user1');
      expect(all).toHaveLength(2);
    });
  });

  describe('contributions', () => {
    const contrib = {
      contributionId: 'contrib1',
      userId: 'user1',
      titleId: 'title-new',
      title: 'Niche Film',
      type: 'movie' as const,
      year: 2025,
      language: 'en',
      tags: ['indie', 'drama'],
      submittedAt: new Date('2026-04-01T00:00:00Z'),
    };

    it('returns null for missing contribution', async () => {
      const result = await backend.getContribution('user1', 'contrib1');
      expect(result).toBeNull();
    });

    it('stores and retrieves contribution', async () => {
      await backend.setContribution(contrib);
      const result = await backend.getContribution('user1', 'contrib1');
      expect(result).toEqual(contrib);
    });

    it('deletes all contributions for a user', async () => {
      await backend.setContribution(contrib);
      await backend.setContribution({ ...contrib, contributionId: 'contrib2' });
      const count = await backend.deleteContributions('user1');
      expect(count).toBe(2);
      const all = await backend.getContributions('user1');
      expect(all).toHaveLength(0);
    });
  });

  describe('bulk operations', () => {
    it('exports all user data', async () => {
      await backend.setProgress({
        userId: 'user1',
        titleId: 'title1',
        type: 'movie',
        currentSeconds: 60,
        durationSeconds: 3600,
        percent: 0.017,
        isCompleted: false,
        lastUpdated: new Date('2026-01-01T00:00:00Z'),
      });
      await backend.setRating({
        userId: 'user1',
        titleId: 'title1',
        score: 9,
        tags: ['great'],
        ratedAt: new Date('2026-01-01T00:00:00Z'),
      });

      const bundle = await backend.exportAll('user1');
      expect(bundle.progress).toHaveLength(1);
      expect(bundle.ratings).toHaveLength(1);
      expect(bundle.collections).toHaveLength(0);
      expect(bundle.contributions).toHaveLength(0);
      expect(bundle.exportedAt).toBeInstanceOf(Date);
    });

    it('deletes all user data', async () => {
      await backend.setProgress({
        userId: 'user1',
        titleId: 'title1',
        type: 'movie',
        currentSeconds: 60,
        durationSeconds: 3600,
        percent: 0.017,
        isCompleted: false,
        lastUpdated: new Date('2026-01-01T00:00:00Z'),
      });
      await backend.setRating({
        userId: 'user1',
        titleId: 'title1',
        score: 9,
        tags: ['great'],
        ratedAt: new Date('2026-01-01T00:00:00Z'),
      });
      await backend.setAffinityProfile('user1', {
        userId: 'user1',
        affinities: new Map([['action', 0.9]]),
        lastCalculated: new Date('2026-01-01T00:00:00Z'),
      });

      const counts = await backend.deleteAll('user1');
      expect(counts.progress).toBe(1);
      expect(counts.ratings).toBe(1);
      expect(counts.collections).toBe(0);
      expect(counts.contributions).toBe(0);
      expect(counts.affinityProfile).toBe(true);

      // Verify everything is gone
      expect(await backend.getProgress('user1', 'title1')).toBeNull();
      expect(await backend.getRating('user1', 'title1')).toBeNull();
      expect(await backend.getAffinityProfile('user1')).toBeNull();
    });
  });
});
