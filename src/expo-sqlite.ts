/**
 * Expo SQLite storage backend for local-first mobile storage.
 * Uses expo-sqlite (JSI-based synchronous SQLite) for fast, offline-capable persistence.
 * Schema mirrors the better-sqlite3 backend from @munin-media/core for data compatibility.
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
} from '@munin-media/core';
import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

interface ProgressRow {
  userId: string;
  titleId: string;
  type: string;
  currentSeconds: number;
  durationSeconds: number;
  percent: number;
  isCompleted: number;
  lastUpdated: string;
  deviceId: string | null;
  lastDeviceIds: string | null;
  seriesId: string | null;
  seasonId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
}

interface SeriesProgressRow {
  userId: string;
  seriesId: string;
  jsonData: string;
  overallPercent: number;
  lastUpdated: string;
}

interface RatingRow {
  userId: string;
  titleId: string;
  score: number;
  tagsJson: string;
  notes: string | null;
  ratedAt: string;
}

interface AffinityRow {
  userId: string;
  affinitiesJson: string;
  lastCalculated: string;
}

interface CollectionRow {
  userId: string;
  collectionId: string;
  name: string;
  type: string;
  itemsJson: string;
  smartFilterJson: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContributionRow {
  userId: string;
  contributionId: string;
  titleId: string;
  title: string;
  type: string;
  year: number | null;
  language: string | null;
  tagsJson: string;
  region: string | null;
  studio: string | null;
  description: string | null;
  submittedAt: string;
}

export class ExpoSQLiteBackend implements StorageBackend {
  private db: SQLiteDatabase;

  constructor(dbName: string = 'munin.db') {
    this.db = openDatabaseSync(dbName);
  }

  async initialize(): Promise<void> {
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS progress (
        userId TEXT NOT NULL,
        titleId TEXT NOT NULL,
        type TEXT NOT NULL,
        currentSeconds REAL NOT NULL,
        durationSeconds REAL NOT NULL,
        percent REAL NOT NULL,
        isCompleted INTEGER NOT NULL DEFAULT 0,
        lastUpdated TEXT NOT NULL,
        deviceId TEXT,
        lastDeviceIds TEXT,
        seriesId TEXT,
        seasonId TEXT,
        seasonNumber INTEGER,
        episodeNumber INTEGER,
        PRIMARY KEY (userId, titleId)
      );

      CREATE TABLE IF NOT EXISTS series_progress (
        userId TEXT NOT NULL,
        seriesId TEXT NOT NULL,
        jsonData TEXT NOT NULL,
        overallPercent REAL NOT NULL,
        lastUpdated TEXT NOT NULL,
        PRIMARY KEY (userId, seriesId)
      );

      CREATE TABLE IF NOT EXISTS ratings (
        userId TEXT NOT NULL,
        titleId TEXT NOT NULL,
        score REAL NOT NULL,
        tagsJson TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        ratedAt TEXT NOT NULL,
        PRIMARY KEY (userId, titleId)
      );

      CREATE TABLE IF NOT EXISTS affinity_profiles (
        userId TEXT NOT NULL PRIMARY KEY,
        affinitiesJson TEXT NOT NULL,
        lastCalculated TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collections (
        userId TEXT NOT NULL,
        collectionId TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        itemsJson TEXT NOT NULL DEFAULT '[]',
        smartFilterJson TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (userId, collectionId)
      );

      CREATE TABLE IF NOT EXISTS contributions (
        userId TEXT NOT NULL,
        contributionId TEXT NOT NULL,
        titleId TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        year INTEGER,
        language TEXT,
        tagsJson TEXT NOT NULL DEFAULT '[]',
        region TEXT,
        studio TEXT,
        description TEXT,
        submittedAt TEXT NOT NULL,
        PRIMARY KEY (userId, contributionId)
      );
    `);
  }

  // --- Progress ---

  async getProgress(userId: string, titleId: string): Promise<ProgressEntry | null> {
    const row = this.db.getFirstSync<ProgressRow>(
      'SELECT * FROM progress WHERE userId = ? AND titleId = ?',
      userId,
      titleId,
    );
    return row ? this.rowToProgress(row) : null;
  }

  async setProgress(entry: ProgressEntry): Promise<void> {
    this.db.runSync(
      `INSERT OR REPLACE INTO progress
       (userId, titleId, type, currentSeconds, durationSeconds, percent, isCompleted, lastUpdated, deviceId, lastDeviceIds, seriesId, seasonId, seasonNumber, episodeNumber)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.userId,
      entry.titleId,
      entry.type,
      entry.currentSeconds,
      entry.durationSeconds,
      entry.percent,
      entry.isCompleted ? 1 : 0,
      entry.lastUpdated.toISOString(),
      entry.deviceId ?? null,
      entry.lastDeviceIds ? JSON.stringify(entry.lastDeviceIds) : null,
      entry.seriesId ?? null,
      entry.seasonId ?? null,
      entry.seasonNumber ?? null,
      entry.episodeNumber ?? null,
    );
  }

  async getSeriesProgress(userId: string, seriesId: string): Promise<SeriesProgress | null> {
    const row = this.db.getFirstSync<SeriesProgressRow>(
      'SELECT * FROM series_progress WHERE userId = ? AND seriesId = ?',
      userId,
      seriesId,
    );
    return row ? this.rowToSeriesProgress(row) : null;
  }

  async setSeriesProgress(entry: SeriesProgress): Promise<void> {
    this.db.runSync(
      `INSERT OR REPLACE INTO series_progress (userId, seriesId, jsonData, overallPercent, lastUpdated)
       VALUES (?, ?, ?, ?, ?)`,
      entry.userId,
      entry.seriesId,
      JSON.stringify({
        seasons: entry.seasons,
        totalEpisodes: entry.totalEpisodes,
        completedEpisodes: entry.completedEpisodes,
        lastWatchedEpisodeId: entry.lastWatchedEpisodeId,
      }),
      entry.overallPercent,
      entry.lastUpdated.toISOString(),
    );
  }

  async getAllProgress(userId: string): Promise<ProgressEntry[]> {
    const rows = this.db.getAllSync<ProgressRow>(
      'SELECT * FROM progress WHERE userId = ?',
      userId,
    );
    return rows.map((row) => this.rowToProgress(row));
  }

  // --- Ratings ---

  async getRating(userId: string, titleId: string): Promise<UserRating | null> {
    const row = this.db.getFirstSync<RatingRow>(
      'SELECT * FROM ratings WHERE userId = ? AND titleId = ?',
      userId,
      titleId,
    );
    return row ? this.rowToRating(row) : null;
  }

  async setRating(rating: UserRating): Promise<void> {
    this.db.runSync(
      `INSERT OR REPLACE INTO ratings (userId, titleId, score, tagsJson, notes, ratedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      rating.userId,
      rating.titleId,
      rating.score,
      JSON.stringify(rating.tags),
      rating.notes ?? null,
      rating.ratedAt.toISOString(),
    );
  }

  async getAllRatings(userId: string): Promise<UserRating[]> {
    const rows = this.db.getAllSync<RatingRow>(
      'SELECT * FROM ratings WHERE userId = ?',
      userId,
    );
    return rows.map((row) => this.rowToRating(row));
  }

  async deleteRating(userId: string, titleId: string): Promise<boolean> {
    const result = this.db.runSync(
      'DELETE FROM ratings WHERE userId = ? AND titleId = ?',
      userId,
      titleId,
    );
    return result.changes > 0;
  }

  // --- Affinity ---

  async getAffinityProfile(userId: string): Promise<TagAffinityProfile | null> {
    const row = this.db.getFirstSync<AffinityRow>(
      'SELECT * FROM affinity_profiles WHERE userId = ?',
      userId,
    );
    if (!row) return null;
    const affinitiesObj = JSON.parse(row.affinitiesJson) as Record<string, number>;
    return {
      userId: row.userId,
      affinities: new Map(Object.entries(affinitiesObj)),
      lastCalculated: new Date(row.lastCalculated),
    };
  }

  async setAffinityProfile(userId: string, profile: TagAffinityProfile): Promise<void> {
    const affinitiesObj = Object.fromEntries(profile.affinities);
    this.db.runSync(
      `INSERT OR REPLACE INTO affinity_profiles (userId, affinitiesJson, lastCalculated)
       VALUES (?, ?, ?)`,
      userId,
      JSON.stringify(affinitiesObj),
      profile.lastCalculated.toISOString(),
    );
  }

  // --- Collections ---

  async getCollection(userId: string, collectionId: string): Promise<Collection | null> {
    const row = this.db.getFirstSync<CollectionRow>(
      'SELECT * FROM collections WHERE userId = ? AND collectionId = ?',
      userId,
      collectionId,
    );
    return row ? this.rowToCollection(row) : null;
  }

  async getCollections(userId: string): Promise<Collection[]> {
    const rows = this.db.getAllSync<CollectionRow>(
      'SELECT * FROM collections WHERE userId = ?',
      userId,
    );
    return rows.map((row) => this.rowToCollection(row));
  }

  async setCollection(collection: Collection): Promise<void> {
    this.db.runSync(
      `INSERT OR REPLACE INTO collections
       (userId, collectionId, name, type, itemsJson, smartFilterJson, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      collection.userId,
      collection.collectionId,
      collection.name,
      collection.type,
      JSON.stringify(collection.items),
      collection.smartFilter ? JSON.stringify(collection.smartFilter) : null,
      collection.createdAt.toISOString(),
      collection.updatedAt.toISOString(),
    );
  }

  async deleteCollection(userId: string, collectionId: string): Promise<void> {
    this.db.runSync(
      'DELETE FROM collections WHERE userId = ? AND collectionId = ?',
      userId,
      collectionId,
    );
  }

  // --- Contributions ---

  async getContribution(userId: string, contributionId: string): Promise<ContributionEntry | null> {
    const row = this.db.getFirstSync<ContributionRow>(
      'SELECT * FROM contributions WHERE userId = ? AND contributionId = ?',
      userId,
      contributionId,
    );
    return row ? this.rowToContribution(row) : null;
  }

  async getContributions(userId: string): Promise<ContributionEntry[]> {
    const rows = this.db.getAllSync<ContributionRow>(
      'SELECT * FROM contributions WHERE userId = ?',
      userId,
    );
    return rows.map((row) => this.rowToContribution(row));
  }

  async setContribution(entry: ContributionEntry): Promise<void> {
    this.db.runSync(
      `INSERT OR REPLACE INTO contributions
       (userId, contributionId, titleId, title, type, year, language, tagsJson, region, studio, description, submittedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.userId,
      entry.contributionId,
      entry.titleId,
      entry.title,
      entry.type,
      entry.year ?? null,
      entry.language ?? null,
      JSON.stringify(entry.tags),
      entry.region ?? null,
      entry.studio ?? null,
      entry.description ?? null,
      entry.submittedAt.toISOString(),
    );
  }

  async deleteContributions(userId: string): Promise<number> {
    const result = this.db.runSync(
      'DELETE FROM contributions WHERE userId = ?',
      userId,
    );
    return result.changes;
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
    const progressResult = this.db.runSync('DELETE FROM progress WHERE userId = ?', userId);
    this.db.runSync('DELETE FROM series_progress WHERE userId = ?', userId);
    const ratingsResult = this.db.runSync('DELETE FROM ratings WHERE userId = ?', userId);
    const collectionsResult = this.db.runSync('DELETE FROM collections WHERE userId = ?', userId);
    const contributionsResult = this.db.runSync('DELETE FROM contributions WHERE userId = ?', userId);
    const affinityRow = this.db.getFirstSync<AffinityRow>(
      'SELECT * FROM affinity_profiles WHERE userId = ?',
      userId,
    );
    this.db.runSync('DELETE FROM affinity_profiles WHERE userId = ?', userId);

    return {
      progress: progressResult.changes,
      ratings: ratingsResult.changes,
      collections: collectionsResult.changes,
      contributions: contributionsResult.changes,
      affinityProfile: affinityRow !== null,
    };
  }

  // --- Lifecycle ---

  async close(): Promise<void> {
    this.db.closeSync();
  }

  // --- Private Helpers ---

  private rowToProgress(row: ProgressRow): ProgressEntry {
    return {
      userId: row.userId,
      titleId: row.titleId,
      type: row.type as 'movie' | 'episode',
      currentSeconds: row.currentSeconds,
      durationSeconds: row.durationSeconds,
      percent: row.percent,
      isCompleted: row.isCompleted === 1,
      lastUpdated: new Date(row.lastUpdated),
      deviceId: row.deviceId ?? undefined,
      lastDeviceIds: row.lastDeviceIds ? (JSON.parse(row.lastDeviceIds) as string[]) : undefined,
      seriesId: row.seriesId ?? undefined,
      seasonId: row.seasonId ?? undefined,
      seasonNumber: row.seasonNumber ?? undefined,
      episodeNumber: row.episodeNumber ?? undefined,
    };
  }

  private rowToSeriesProgress(row: SeriesProgressRow): SeriesProgress {
    const data = JSON.parse(row.jsonData) as {
      seasons: SeriesProgress['seasons'];
      totalEpisodes: number;
      completedEpisodes: number;
      lastWatchedEpisodeId: string;
    };
    return {
      userId: row.userId,
      seriesId: row.seriesId,
      seasons: data.seasons,
      overallPercent: row.overallPercent,
      totalEpisodes: data.totalEpisodes,
      completedEpisodes: data.completedEpisodes,
      lastWatchedEpisodeId: data.lastWatchedEpisodeId,
      lastUpdated: new Date(row.lastUpdated),
    };
  }

  private rowToRating(row: RatingRow): UserRating {
    return {
      userId: row.userId,
      titleId: row.titleId,
      score: row.score,
      tags: JSON.parse(row.tagsJson) as string[],
      notes: row.notes ?? undefined,
      ratedAt: new Date(row.ratedAt),
    };
  }

  private rowToCollection(row: CollectionRow): Collection {
    return {
      collectionId: row.collectionId,
      userId: row.userId,
      name: row.name,
      type: row.type as 'manual' | 'smart',
      items: JSON.parse(row.itemsJson) as string[],
      smartFilter: row.smartFilterJson ? (JSON.parse(row.smartFilterJson) as Collection['smartFilter']) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private rowToContribution(row: ContributionRow): ContributionEntry {
    return {
      contributionId: row.contributionId,
      userId: row.userId,
      titleId: row.titleId,
      title: row.title,
      type: row.type as 'movie' | 'series',
      year: row.year ?? undefined,
      language: row.language ?? undefined,
      tags: JSON.parse(row.tagsJson) as string[],
      region: row.region ?? undefined,
      studio: row.studio ?? undefined,
      description: row.description ?? undefined,
      submittedAt: new Date(row.submittedAt),
    };
  }
}
