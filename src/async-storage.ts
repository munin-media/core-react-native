/**
 * AsyncStorage backend — lightweight fallback for simple use cases.
 * Stores all data as JSON strings in @react-native-async-storage/async-storage.
 *
 * Limitations:
 * - No queries — loads all user data into memory for filtering
 * - Suitable for small datasets (<1000 entries)
 * - Not recommended for power users with large libraries
 *
 * Key structure:
 *   {prefix}progress:{userId}:{titleId}
 *   {prefix}series:{userId}:{seriesId}
 *   {prefix}ratings:{userId}:{titleId}
 *   {prefix}affinity:{userId}
 *   {prefix}collections:{userId}:{collectionId}
 *   {prefix}contributions:{userId}:{contributionId}
 */

import type {
  StorageBackend,
  DeletionCounts,
  ProgressEntry,
  SeriesProgress,
  UserRating,
  TagAffinityProfile,
  Collection,
  ContributionEntry,
  UserDataBundle,
} from '@munin/core';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class AsyncStorageBackend implements StorageBackend {
  private prefix: string;

  constructor(prefix: string = '@munin:') {
    this.prefix = prefix;
  }

  async initialize(): Promise<void> {
    // AsyncStorage doesn't need initialization
  }

  // --- Progress ---

  async getProgress(userId: string, titleId: string): Promise<ProgressEntry | null> {
    const key = this.key('progress', userId, titleId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return this.deserializeProgress(JSON.parse(raw) as SerializedProgressEntry);
  }

  async setProgress(entry: ProgressEntry): Promise<void> {
    const key = this.key('progress', entry.userId, entry.titleId);
    await AsyncStorage.setItem(key, JSON.stringify(this.serializeProgress(entry)));
  }

  async getSeriesProgress(userId: string, seriesId: string): Promise<SeriesProgress | null> {
    const key = this.key('series', userId, seriesId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return this.deserializeSeriesProgress(JSON.parse(raw) as SerializedSeriesProgress);
  }

  async setSeriesProgress(entry: SeriesProgress): Promise<void> {
    const key = this.key('series', entry.userId, entry.seriesId);
    await AsyncStorage.setItem(key, JSON.stringify(this.serializeSeriesProgress(entry)));
  }

  async getAllProgress(userId: string): Promise<ProgressEntry[]> {
    const prefix = this.key('progress', userId, '');
    return this.getAllByPrefix<SerializedProgressEntry, ProgressEntry>(
      prefix,
      (data) => this.deserializeProgress(data),
    );
  }

  // --- Ratings ---

  async getRating(userId: string, titleId: string): Promise<UserRating | null> {
    const key = this.key('ratings', userId, titleId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return this.deserializeRating(JSON.parse(raw) as SerializedRating);
  }

  async setRating(rating: UserRating): Promise<void> {
    const key = this.key('ratings', rating.userId, rating.titleId);
    await AsyncStorage.setItem(key, JSON.stringify(this.serializeRating(rating)));
  }

  async getAllRatings(userId: string): Promise<UserRating[]> {
    const prefix = this.key('ratings', userId, '');
    return this.getAllByPrefix<SerializedRating, UserRating>(
      prefix,
      (data) => this.deserializeRating(data),
    );
  }

  async deleteRating(userId: string, titleId: string): Promise<boolean> {
    const key = this.key('ratings', userId, titleId);
    const existing = await AsyncStorage.getItem(key);
    if (!existing) return false;
    await AsyncStorage.removeItem(key);
    return true;
  }

  // --- Affinity ---

  async getAffinityProfile(userId: string): Promise<TagAffinityProfile | null> {
    const key = this.key('affinity', userId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as SerializedAffinity;
    return {
      userId,
      affinities: new Map(Object.entries(data.affinities)),
      lastCalculated: new Date(data.lastCalculated),
    };
  }

  async setAffinityProfile(userId: string, profile: TagAffinityProfile): Promise<void> {
    const key = this.key('affinity', userId);
    const data: SerializedAffinity = {
      affinities: Object.fromEntries(profile.affinities),
      lastCalculated: profile.lastCalculated.toISOString(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }

  // --- Collections ---

  async getCollection(userId: string, collectionId: string): Promise<Collection | null> {
    const key = this.key('collections', userId, collectionId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return this.deserializeCollection(JSON.parse(raw) as SerializedCollection);
  }

  async getCollections(userId: string): Promise<Collection[]> {
    const prefix = this.key('collections', userId, '');
    return this.getAllByPrefix<SerializedCollection, Collection>(
      prefix,
      (data) => this.deserializeCollection(data),
    );
  }

  async setCollection(coll: Collection): Promise<void> {
    const key = this.key('collections', coll.userId, coll.collectionId);
    await AsyncStorage.setItem(key, JSON.stringify(this.serializeCollection(coll)));
  }

  async deleteCollection(userId: string, collectionId: string): Promise<void> {
    const key = this.key('collections', userId, collectionId);
    await AsyncStorage.removeItem(key);
  }

  // --- Contributions ---

  async getContribution(userId: string, contributionId: string): Promise<ContributionEntry | null> {
    const key = this.key('contributions', userId, contributionId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return this.deserializeContribution(JSON.parse(raw) as SerializedContribution);
  }

  async getContributions(userId: string): Promise<ContributionEntry[]> {
    const prefix = this.key('contributions', userId, '');
    return this.getAllByPrefix<SerializedContribution, ContributionEntry>(
      prefix,
      (data) => this.deserializeContribution(data),
    );
  }

  async setContribution(entry: ContributionEntry): Promise<void> {
    const key = this.key('contributions', entry.userId, entry.contributionId);
    await AsyncStorage.setItem(key, JSON.stringify(this.serializeContribution(entry)));
  }

  async deleteContributions(userId: string): Promise<number> {
    const prefix = this.key('contributions', userId, '');
    const allKeys = await AsyncStorage.getAllKeys();
    const matchingKeys = allKeys.filter((k) => k.startsWith(prefix));
    if (matchingKeys.length === 0) return 0;
    await AsyncStorage.multiRemove(matchingKeys);
    return matchingKeys.length;
  }

  // --- Bulk Operations ---

  async exportAll(userId: string): Promise<UserDataBundle> {
    return {
      progress: await this.getAllProgress(userId),
      ratings: await this.getAllRatings(userId),
      collections: await this.getCollections(userId),
      contributions: await this.getContributions(userId),
      exportedAt: new Date(),
    };
  }

  async deleteAll(userId: string): Promise<DeletionCounts> {
    const allKeys = await AsyncStorage.getAllKeys();
    const userPrefix = this.prefix;

    const progressKeys = allKeys.filter((k) => k.startsWith(`${userPrefix}progress:${userId}:`));
    const seriesKeys = allKeys.filter((k) => k.startsWith(`${userPrefix}series:${userId}:`));
    const ratingsKeys = allKeys.filter((k) => k.startsWith(`${userPrefix}ratings:${userId}:`));
    const collectionsKeys = allKeys.filter((k) => k.startsWith(`${userPrefix}collections:${userId}:`));
    const contributionsKeys = allKeys.filter((k) => k.startsWith(`${userPrefix}contributions:${userId}:`));
    const affinityKey = `${userPrefix}affinity:${userId}`;
    const hasAffinity = allKeys.includes(affinityKey);

    const keysToDelete = [
      ...progressKeys,
      ...seriesKeys,
      ...ratingsKeys,
      ...collectionsKeys,
      ...contributionsKeys,
      ...(hasAffinity ? [affinityKey] : []),
    ];

    if (keysToDelete.length > 0) {
      await AsyncStorage.multiRemove(keysToDelete);
    }

    return {
      progress: progressKeys.length,
      ratings: ratingsKeys.length,
      collections: collectionsKeys.length,
      contributions: contributionsKeys.length,
      affinityProfile: hasAffinity,
    };
  }

  // --- Lifecycle ---

  async close(): Promise<void> {
    // AsyncStorage doesn't need explicit cleanup
  }

  // --- Private Helpers ---

  private key(...parts: string[]): string {
    return this.prefix + parts.join(':');
  }

  private async getAllByPrefix<TSerialized, TResult>(
    prefix: string,
    deserialize: (data: TSerialized) => TResult,
  ): Promise<TResult[]> {
    const allKeys = await AsyncStorage.getAllKeys();
    const matchingKeys = allKeys.filter((k) => k.startsWith(prefix));
    if (matchingKeys.length === 0) return [];

    const pairs = await AsyncStorage.multiGet(matchingKeys);
    const results: TResult[] = [];
    for (const [, value] of pairs) {
      if (value) {
        results.push(deserialize(JSON.parse(value) as TSerialized));
      }
    }
    return results;
  }

  // --- Serialization ---

  private serializeProgress(entry: ProgressEntry): SerializedProgressEntry {
    return {
      userId: entry.userId,
      titleId: entry.titleId,
      type: entry.type,
      currentSeconds: entry.currentSeconds,
      durationSeconds: entry.durationSeconds,
      percent: entry.percent,
      isCompleted: entry.isCompleted,
      lastUpdated: entry.lastUpdated.toISOString(),
      deviceId: entry.deviceId,
      lastDeviceIds: entry.lastDeviceIds,
      seriesId: entry.seriesId,
      seasonId: entry.seasonId,
      seasonNumber: entry.seasonNumber,
      episodeNumber: entry.episodeNumber,
    };
  }

  private deserializeProgress(data: SerializedProgressEntry): ProgressEntry {
    return {
      userId: data.userId,
      titleId: data.titleId,
      type: data.type,
      currentSeconds: data.currentSeconds,
      durationSeconds: data.durationSeconds,
      percent: data.percent,
      isCompleted: data.isCompleted,
      lastUpdated: new Date(data.lastUpdated),
      deviceId: data.deviceId,
      lastDeviceIds: data.lastDeviceIds,
      seriesId: data.seriesId,
      seasonId: data.seasonId,
      seasonNumber: data.seasonNumber,
      episodeNumber: data.episodeNumber,
    };
  }

  private serializeSeriesProgress(entry: SeriesProgress): SerializedSeriesProgress {
    return {
      userId: entry.userId,
      seriesId: entry.seriesId,
      seasons: entry.seasons,
      overallPercent: entry.overallPercent,
      totalEpisodes: entry.totalEpisodes,
      completedEpisodes: entry.completedEpisodes,
      lastWatchedEpisodeId: entry.lastWatchedEpisodeId,
      lastUpdated: entry.lastUpdated.toISOString(),
    };
  }

  private deserializeSeriesProgress(data: SerializedSeriesProgress): SeriesProgress {
    return {
      userId: data.userId,
      seriesId: data.seriesId,
      seasons: data.seasons,
      overallPercent: data.overallPercent,
      totalEpisodes: data.totalEpisodes,
      completedEpisodes: data.completedEpisodes,
      lastWatchedEpisodeId: data.lastWatchedEpisodeId,
      lastUpdated: new Date(data.lastUpdated),
    };
  }

  private serializeRating(rating: UserRating): SerializedRating {
    return {
      userId: rating.userId,
      titleId: rating.titleId,
      score: rating.score,
      tags: rating.tags,
      notes: rating.notes,
      ratedAt: rating.ratedAt.toISOString(),
    };
  }

  private deserializeRating(data: SerializedRating): UserRating {
    return {
      userId: data.userId,
      titleId: data.titleId,
      score: data.score,
      tags: data.tags,
      notes: data.notes,
      ratedAt: new Date(data.ratedAt),
    };
  }

  private serializeCollection(coll: Collection): SerializedCollection {
    return {
      collectionId: coll.collectionId,
      userId: coll.userId,
      name: coll.name,
      type: coll.type,
      items: coll.items,
      smartFilter: coll.smartFilter,
      createdAt: coll.createdAt.toISOString(),
      updatedAt: coll.updatedAt.toISOString(),
    };
  }

  private deserializeCollection(data: SerializedCollection): Collection {
    return {
      collectionId: data.collectionId,
      userId: data.userId,
      name: data.name,
      type: data.type,
      items: data.items,
      smartFilter: data.smartFilter,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  private serializeContribution(entry: ContributionEntry): SerializedContribution {
    return {
      contributionId: entry.contributionId,
      userId: entry.userId,
      titleId: entry.titleId,
      title: entry.title,
      type: entry.type,
      year: entry.year,
      language: entry.language,
      tags: entry.tags,
      region: entry.region,
      studio: entry.studio,
      description: entry.description,
      submittedAt: entry.submittedAt.toISOString(),
    };
  }

  private deserializeContribution(data: SerializedContribution): ContributionEntry {
    return {
      contributionId: data.contributionId,
      userId: data.userId,
      titleId: data.titleId,
      title: data.title,
      type: data.type,
      year: data.year,
      language: data.language,
      tags: data.tags,
      region: data.region,
      studio: data.studio,
      description: data.description,
      submittedAt: new Date(data.submittedAt),
    };
  }
}

// --- Serialized Types (JSON-safe, Dates as strings) ---

interface SerializedProgressEntry {
  userId: string;
  titleId: string;
  type: 'movie' | 'episode';
  currentSeconds: number;
  durationSeconds: number;
  percent: number;
  isCompleted: boolean;
  lastUpdated: string;
  deviceId?: string;
  lastDeviceIds?: string[];
  seriesId?: string;
  seasonId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

interface SerializedSeriesProgress {
  userId: string;
  seriesId: string;
  seasons: SeriesProgress['seasons'];
  overallPercent: number;
  totalEpisodes: number;
  completedEpisodes: number;
  lastWatchedEpisodeId: string;
  lastUpdated: string;
}

interface SerializedRating {
  userId: string;
  titleId: string;
  score: number;
  tags: string[];
  notes?: string;
  ratedAt: string;
}

interface SerializedAffinity {
  affinities: Record<string, number>;
  lastCalculated: string;
}

interface SerializedCollection {
  collectionId: string;
  userId: string;
  name: string;
  type: 'manual' | 'smart';
  items: string[];
  smartFilter?: Collection['smartFilter'];
  createdAt: string;
  updatedAt: string;
}

interface SerializedContribution {
  contributionId: string;
  userId: string;
  titleId: string;
  title: string;
  type: 'movie' | 'series';
  year?: number;
  language?: string;
  tags: string[];
  region?: string;
  studio?: string;
  description?: string;
  submittedAt: string;
}
