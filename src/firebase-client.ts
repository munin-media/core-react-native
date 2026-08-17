/**
 * Firebase client SDK storage backend for cloud-synced mobile storage.
 * Uses the firebase client SDK (not admin) — compatible with React Native.
 * Collection paths match the server FirestoreBackend for cross-platform data sharing.
 *
 * Collection structure:
 *   users/{userId}/progress/{titleId}
 *   users/{userId}/series/{seriesId}
 *   users/{userId}/ratings/{titleId}
 *   users/{userId}/affinityProfile (single doc)
 *   users/{userId}/collections/{collectionId}
 *   users/{userId}/contributions/{contributionId}
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
import type { Firestore, DocumentSnapshot } from 'firebase/firestore';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

export class FirebaseClientBackend implements StorageBackend {
  private db: Firestore;

  constructor(firestore: Firestore) {
    this.db = firestore;
  }

  async initialize(): Promise<void> {
    // Firestore client SDK doesn't require explicit initialization beyond constructor
  }

  // --- Progress ---

  async getProgress(userId: string, titleId: string): Promise<ProgressEntry | null> {
    const snap = await getDoc(doc(this.db, 'users', userId, 'progress', titleId));
    if (!snap.exists()) return null;
    return this.docToProgress(userId, titleId, snap);
  }

  async setProgress(entry: ProgressEntry): Promise<void> {
    await setDoc(doc(this.db, 'users', entry.userId, 'progress', entry.titleId), {
      type: entry.type,
      currentSeconds: entry.currentSeconds,
      durationSeconds: entry.durationSeconds,
      percent: entry.percent,
      isCompleted: entry.isCompleted,
      lastUpdated: entry.lastUpdated.toISOString(),
      ...(entry.deviceId !== undefined && { deviceId: entry.deviceId }),
      ...(entry.lastDeviceIds !== undefined && { lastDeviceIds: entry.lastDeviceIds }),
      ...(entry.seriesId !== undefined && { seriesId: entry.seriesId }),
      ...(entry.seasonId !== undefined && { seasonId: entry.seasonId }),
      ...(entry.seasonNumber !== undefined && { seasonNumber: entry.seasonNumber }),
      ...(entry.episodeNumber !== undefined && { episodeNumber: entry.episodeNumber }),
    });
  }

  async getSeriesProgress(userId: string, seriesId: string): Promise<SeriesProgress | null> {
    const snap = await getDoc(doc(this.db, 'users', userId, 'series', seriesId));
    if (!snap.exists()) return null;
    return this.docToSeriesProgress(userId, seriesId, snap);
  }

  async setSeriesProgress(entry: SeriesProgress): Promise<void> {
    await setDoc(doc(this.db, 'users', entry.userId, 'series', entry.seriesId), {
      seasons: entry.seasons,
      overallPercent: entry.overallPercent,
      totalEpisodes: entry.totalEpisodes,
      completedEpisodes: entry.completedEpisodes,
      lastWatchedEpisodeId: entry.lastWatchedEpisodeId,
      lastUpdated: entry.lastUpdated.toISOString(),
    });
  }

  async getAllProgress(userId: string): Promise<ProgressEntry[]> {
    const snap = await getDocs(collection(this.db, 'users', userId, 'progress'));
    return snap.docs.map((d) => this.docToProgress(userId, d.id, d));
  }

  // --- Ratings ---

  async getRating(userId: string, titleId: string): Promise<UserRating | null> {
    const snap = await getDoc(doc(this.db, 'users', userId, 'ratings', titleId));
    if (!snap.exists()) return null;
    return this.docToRating(userId, titleId, snap);
  }

  async setRating(rating: UserRating): Promise<void> {
    await setDoc(doc(this.db, 'users', rating.userId, 'ratings', rating.titleId), {
      score: rating.score,
      tags: rating.tags,
      ...(rating.notes !== undefined && { notes: rating.notes }),
      ratedAt: rating.ratedAt.toISOString(),
    });
  }

  async getAllRatings(userId: string): Promise<UserRating[]> {
    const snap = await getDocs(collection(this.db, 'users', userId, 'ratings'));
    return snap.docs.map((d) => this.docToRating(userId, d.id, d));
  }

  async deleteRating(userId: string, titleId: string): Promise<boolean> {
    const ref = doc(this.db, 'users', userId, 'ratings', titleId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    await deleteDoc(ref);
    return true;
  }

  // --- Affinity ---

  async getAffinityProfile(userId: string): Promise<TagAffinityProfile | null> {
    const snap = await getDoc(doc(this.db, 'users', userId, 'affinityProfile', 'current'));
    if (!snap.exists()) return null;
    const data = snap.data()!;
    const affinitiesObj = (data['affinities'] ?? {}) as Record<string, number>;
    return {
      userId,
      affinities: new Map(Object.entries(affinitiesObj)),
      lastCalculated: new Date(data['lastCalculated'] as string),
    };
  }

  async setAffinityProfile(userId: string, profile: TagAffinityProfile): Promise<void> {
    await setDoc(doc(this.db, 'users', userId, 'affinityProfile', 'current'), {
      affinities: Object.fromEntries(profile.affinities),
      lastCalculated: profile.lastCalculated.toISOString(),
    });
  }

  // --- Collections ---

  async getCollection(userId: string, collectionId: string): Promise<Collection | null> {
    const snap = await getDoc(doc(this.db, 'users', userId, 'collections', collectionId));
    if (!snap.exists()) return null;
    return this.docToCollection(userId, collectionId, snap);
  }

  async getCollections(userId: string): Promise<Collection[]> {
    const snap = await getDocs(collection(this.db, 'users', userId, 'collections'));
    return snap.docs.map((d) => this.docToCollection(userId, d.id, d));
  }

  async setCollection(coll: Collection): Promise<void> {
    await setDoc(doc(this.db, 'users', coll.userId, 'collections', coll.collectionId), {
      name: coll.name,
      type: coll.type,
      items: coll.items,
      ...(coll.smartFilter !== undefined && { smartFilter: coll.smartFilter }),
      createdAt: coll.createdAt.toISOString(),
      updatedAt: coll.updatedAt.toISOString(),
    });
  }

  async deleteCollection(userId: string, collectionId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'users', userId, 'collections', collectionId));
  }

  // --- Contributions ---

  async getContribution(userId: string, contributionId: string): Promise<ContributionEntry | null> {
    const snap = await getDoc(doc(this.db, 'users', userId, 'contributions', contributionId));
    if (!snap.exists()) return null;
    return this.docToContribution(userId, contributionId, snap);
  }

  async getContributions(userId: string): Promise<ContributionEntry[]> {
    const snap = await getDocs(collection(this.db, 'users', userId, 'contributions'));
    return snap.docs.map((d) => this.docToContribution(userId, d.id, d));
  }

  async setContribution(entry: ContributionEntry): Promise<void> {
    await setDoc(doc(this.db, 'users', entry.userId, 'contributions', entry.contributionId), {
      titleId: entry.titleId,
      title: entry.title,
      type: entry.type,
      ...(entry.year !== undefined && { year: entry.year }),
      ...(entry.language !== undefined && { language: entry.language }),
      tags: entry.tags,
      ...(entry.region !== undefined && { region: entry.region }),
      ...(entry.studio !== undefined && { studio: entry.studio }),
      ...(entry.description !== undefined && { description: entry.description }),
      submittedAt: entry.submittedAt.toISOString(),
    });
  }

  async deleteContributions(userId: string): Promise<number> {
    const snap = await getDocs(collection(this.db, 'users', userId, 'contributions'));
    if (snap.empty) return 0;
    const batch = writeBatch(this.db);
    for (const d of snap.docs) {
      batch.delete(doc(this.db, 'users', userId, 'contributions', d.id));
    }
    await batch.commit();
    return snap.size;
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
    const [progressSnap, ratingsSnap, collectionsSnap, contributionsSnap, affinitySnap] =
      await Promise.all([
        getDocs(collection(this.db, 'users', userId, 'progress')),
        getDocs(collection(this.db, 'users', userId, 'ratings')),
        getDocs(collection(this.db, 'users', userId, 'collections')),
        getDocs(collection(this.db, 'users', userId, 'contributions')),
        getDoc(doc(this.db, 'users', userId, 'affinityProfile', 'current')),
      ]);

    // Also fetch series progress for deletion
    const seriesSnap = await getDocs(collection(this.db, 'users', userId, 'series'));

    const batch = writeBatch(this.db);

    for (const d of progressSnap.docs) {
      batch.delete(doc(this.db, 'users', userId, 'progress', d.id));
    }
    for (const d of seriesSnap.docs) {
      batch.delete(doc(this.db, 'users', userId, 'series', d.id));
    }
    for (const d of ratingsSnap.docs) {
      batch.delete(doc(this.db, 'users', userId, 'ratings', d.id));
    }
    for (const d of collectionsSnap.docs) {
      batch.delete(doc(this.db, 'users', userId, 'collections', d.id));
    }
    for (const d of contributionsSnap.docs) {
      batch.delete(doc(this.db, 'users', userId, 'contributions', d.id));
    }
    if (affinitySnap.exists()) {
      batch.delete(doc(this.db, 'users', userId, 'affinityProfile', 'current'));
    }

    await batch.commit();

    return {
      progress: progressSnap.size,
      ratings: ratingsSnap.size,
      collections: collectionsSnap.size,
      contributions: contributionsSnap.size,
      affinityProfile: affinitySnap.exists(),
    };
  }

  // --- Lifecycle ---

  async close(): Promise<void> {
    // Firebase client SDK manages its own connection lifecycle
  }

  // --- Private Helpers ---

  private docToProgress(userId: string, titleId: string, snap: DocumentSnapshot): ProgressEntry {
    const data = snap.data()!;
    return {
      userId,
      titleId,
      type: data['type'] as 'movie' | 'episode',
      currentSeconds: data['currentSeconds'] as number,
      durationSeconds: data['durationSeconds'] as number,
      percent: data['percent'] as number,
      isCompleted: data['isCompleted'] as boolean,
      lastUpdated: new Date(data['lastUpdated'] as string),
      deviceId: data['deviceId'] as string | undefined,
      lastDeviceIds: data['lastDeviceIds'] as string[] | undefined,
      seriesId: data['seriesId'] as string | undefined,
      seasonId: data['seasonId'] as string | undefined,
      seasonNumber: data['seasonNumber'] as number | undefined,
      episodeNumber: data['episodeNumber'] as number | undefined,
    };
  }

  private docToSeriesProgress(userId: string, seriesId: string, snap: DocumentSnapshot): SeriesProgress {
    const data = snap.data()!;
    return {
      userId,
      seriesId,
      seasons: data['seasons'] as SeriesProgress['seasons'],
      overallPercent: data['overallPercent'] as number,
      totalEpisodes: data['totalEpisodes'] as number,
      completedEpisodes: data['completedEpisodes'] as number,
      lastWatchedEpisodeId: data['lastWatchedEpisodeId'] as string,
      lastUpdated: new Date(data['lastUpdated'] as string),
    };
  }

  private docToRating(userId: string, titleId: string, snap: DocumentSnapshot): UserRating {
    const data = snap.data()!;
    return {
      userId,
      titleId,
      score: data['score'] as number,
      tags: data['tags'] as string[],
      notes: data['notes'] as string | undefined,
      ratedAt: new Date(data['ratedAt'] as string),
    };
  }

  private docToCollection(userId: string, collectionId: string, snap: DocumentSnapshot): Collection {
    const data = snap.data()!;
    return {
      collectionId,
      userId,
      name: data['name'] as string,
      type: data['type'] as 'manual' | 'smart',
      items: data['items'] as string[],
      smartFilter: data['smartFilter'] as Collection['smartFilter'],
      createdAt: new Date(data['createdAt'] as string),
      updatedAt: new Date(data['updatedAt'] as string),
    };
  }

  private docToContribution(userId: string, contributionId: string, snap: DocumentSnapshot): ContributionEntry {
    const data = snap.data()!;
    return {
      contributionId,
      userId,
      titleId: data['titleId'] as string,
      title: data['title'] as string,
      type: data['type'] as 'movie' | 'series',
      year: data['year'] as number | undefined,
      language: data['language'] as string | undefined,
      tags: data['tags'] as string[],
      region: data['region'] as string | undefined,
      studio: data['studio'] as string | undefined,
      description: data['description'] as string | undefined,
      submittedAt: new Date(data['submittedAt'] as string),
    };
  }
}
