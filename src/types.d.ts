/**
 * Type declarations for @munin-media/core peer dependency.
 * These mirror the actual types exported by @munin-media/core.
 * When the peer dep is installed, TypeScript will use the real types.
 */

declare module '@munin-media/core' {
  export interface ProgressEntry {
    userId: string;
    titleId: string;
    type: 'movie' | 'episode';
    currentSeconds: number;
    durationSeconds: number;
    percent: number;
    isCompleted: boolean;
    lastUpdated: Date;
    deviceId?: string;
    lastDeviceIds?: string[];
    seriesId?: string;
    seasonId?: string;
    seasonNumber?: number;
    episodeNumber?: number;
  }

  export interface SeriesProgress {
    userId: string;
    seriesId: string;
    seasons: SeasonProgress[];
    overallPercent: number;
    totalEpisodes: number;
    completedEpisodes: number;
    lastWatchedEpisodeId: string;
    lastUpdated: Date;
  }

  export interface SeasonProgress {
    seasonId: string;
    seasonNumber: number;
    episodes: EpisodeProgress[];
    percent: number;
    totalEpisodes: number;
    completedEpisodes: number;
  }

  export interface EpisodeProgress {
    episodeId: string;
    episodeNumber: number;
    currentSeconds: number;
    durationSeconds: number;
    percent: number;
    isCompleted: boolean;
  }

  export interface UserRating {
    userId: string;
    titleId: string;
    score: number;
    tags: string[];
    notes?: string;
    ratedAt: Date;
  }

  export interface TagAffinityProfile {
    userId: string;
    affinities: Map<string, number>;
    lastCalculated: Date;
  }

  export interface Collection {
    collectionId: string;
    userId: string;
    name: string;
    type: 'manual' | 'smart';
    items: string[];
    smartFilter?: SmartFilter;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface SmartFilter {
    minRating?: number;
    tags?: string[];
    isCompleted?: boolean;
    type?: 'movie' | 'series';
  }

  export interface ContributionEntry {
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
    submittedAt: Date;
  }

  export interface UserDataBundle {
    progress: ProgressEntry[];
    ratings: UserRating[];
    collections: Collection[];
    contributions: ContributionEntry[];
    exportedAt: Date;
  }

  export interface DeletionCounts {
    progress: number;
    ratings: number;
    collections: number;
    contributions: number;
    affinityProfile: boolean;
  }

  export interface StorageBackend {
    getProgress(userId: string, titleId: string): Promise<ProgressEntry | null>;
    setProgress(entry: ProgressEntry): Promise<void>;
    getSeriesProgress(userId: string, seriesId: string): Promise<SeriesProgress | null>;
    setSeriesProgress(entry: SeriesProgress): Promise<void>;
    getAllProgress(userId: string): Promise<ProgressEntry[]>;

    getRating(userId: string, titleId: string): Promise<UserRating | null>;
    setRating(rating: UserRating): Promise<void>;
    getAllRatings(userId: string): Promise<UserRating[]>;
    deleteRating(userId: string, titleId: string): Promise<boolean>;

    getAffinityProfile(userId: string): Promise<TagAffinityProfile | null>;
    setAffinityProfile(userId: string, profile: TagAffinityProfile): Promise<void>;

    getCollection(userId: string, collectionId: string): Promise<Collection | null>;
    getCollections(userId: string): Promise<Collection[]>;
    setCollection(collection: Collection): Promise<void>;
    deleteCollection(userId: string, collectionId: string): Promise<void>;

    getContribution(userId: string, contributionId: string): Promise<ContributionEntry | null>;
    getContributions(userId: string): Promise<ContributionEntry[]>;
    setContribution(entry: ContributionEntry): Promise<void>;
    deleteContributions(userId: string): Promise<number>;

    exportAll(userId: string): Promise<UserDataBundle>;
    deleteAll(userId: string): Promise<DeletionCounts>;

    initialize?(): Promise<void>;
    close?(): Promise<void>;
  }
}

/**
 * Type declarations for expo-sqlite peer dependency.
 */
declare module 'expo-sqlite' {
  export interface SQLiteDatabase {
    execSync(sql: string): void;
    getAllSync<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];
    getFirstSync<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | null;
    runSync(sql: string, ...params: unknown[]): SQLiteRunResult;
    closeSync(): void;
  }

  export interface SQLiteRunResult {
    changes: number;
    lastInsertRowId: number;
  }

  export function openDatabaseSync(name: string): SQLiteDatabase;
}

/**
 * Type declarations for @react-native-async-storage/async-storage peer dependency.
 */
declare module '@react-native-async-storage/async-storage' {
  interface AsyncStorageStatic {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    getAllKeys(): Promise<readonly string[]>;
    multiGet(keys: readonly string[]): Promise<readonly [string, string | null][]>;
    multiRemove(keys: readonly string[]): Promise<void>;
  }

  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}

/**
 * Type declarations for firebase/firestore peer dependency.
 */
declare module 'firebase/firestore' {
  export interface Firestore {}
  export interface DocumentReference {}
  export interface CollectionReference {}
  export interface DocumentSnapshot {
    exists(): boolean;
    data(): Record<string, unknown> | undefined;
    id: string;
  }
  export interface QuerySnapshot {
    docs: DocumentSnapshot[];
    empty: boolean;
    size: number;
  }
  export interface Query {}
  export interface WriteBatch {
    delete(ref: DocumentReference): WriteBatch;
    commit(): Promise<void>;
  }
  export interface Timestamp {
    toDate(): Date;
  }

  export function doc(firestore: Firestore, path: string, ...segments: string[]): DocumentReference;
  export function collection(firestore: Firestore, path: string, ...segments: string[]): CollectionReference;
  export function getDoc(ref: DocumentReference): Promise<DocumentSnapshot>;
  export function getDocs(query: Query | CollectionReference): Promise<QuerySnapshot>;
  export function setDoc(ref: DocumentReference, data: Record<string, unknown>): Promise<void>;
  export function deleteDoc(ref: DocumentReference): Promise<void>;
  export function writeBatch(firestore: Firestore): WriteBatch;
  export function Timestamp_fromDate(date: Date): Timestamp;

  export const Timestamp: {
    fromDate(date: Date): Timestamp;
  };
}
