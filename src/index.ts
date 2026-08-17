/**
 * @munin/core-react-native
 *
 * React Native-compatible storage backends implementing @munin/core's StorageBackend interface.
 * Each backend can be imported individually for tree-shaking:
 *
 *   import { ExpoSQLiteBackend } from '@munin/core-react-native/expo-sqlite';
 *   import { FirebaseClientBackend } from '@munin/core-react-native/firebase-client';
 *   import { AsyncStorageBackend } from '@munin/core-react-native/async-storage';
 *
 * Or import all from the main entry:
 *
 *   import { ExpoSQLiteBackend, FirebaseClientBackend, AsyncStorageBackend } from '@munin/core-react-native';
 */

export { ExpoSQLiteBackend } from './expo-sqlite.js';
export { FirebaseClientBackend } from './firebase-client.js';
export { AsyncStorageBackend } from './async-storage.js';
