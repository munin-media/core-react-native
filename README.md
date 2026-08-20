# @munin-media/core-react-native

React Native-compatible storage backends implementing `@munin-media/core`'s `StorageBackend` interface.

## Backends

| Backend | Library | Use Case |
|---------|---------|----------|
| `ExpoSQLiteBackend` | `expo-sqlite` | Local-first mobile storage (fast, offline) |
| `FirebaseClientBackend` | `firebase` client SDK | Cloud-synced multi-device storage |
| `AsyncStorageBackend` | `@react-native-async-storage/async-storage` | Lightweight fallback (<1000 entries) |

## Installation

```bash
yarn add @munin-media/core-react-native @munin-media/core
```

Then install the backend you need:

```bash
# For Expo SQLite (recommended for local-first)
npx expo install expo-sqlite

# For Firebase cloud sync
yarn add firebase

# For AsyncStorage fallback
npx expo install @react-native-async-storage/async-storage
```

## Usage

```typescript
import { createMunin } from '@munin-media/core';
import { ExpoSQLiteBackend } from '@munin-media/core-react-native/expo-sqlite';

const munin = createMunin({
  storage: new ExpoSQLiteBackend('myapp.db'),
});
```

### Tree-shakeable Imports

Each backend is a separate entry point — unused backends are not bundled:

```typescript
import { ExpoSQLiteBackend } from '@munin-media/core-react-native/expo-sqlite';
import { FirebaseClientBackend } from '@munin-media/core-react-native/firebase-client';
import { AsyncStorageBackend } from '@munin-media/core-react-native/async-storage';
```

## Schema Compatibility

- **ExpoSQLiteBackend** uses the same table schema as the server `SQLiteBackend` — data exported from one is importable by the other.
- **FirebaseClientBackend** uses the same Firestore collection paths (`users/{userId}/progress/{titleId}`, etc.) as the server `FirestoreBackend` — they share the same database.

## Development

```bash
yarn install
yarn build       # tsc → dist/
yarn test        # vitest
yarn typecheck   # tsc --noEmit
```

## Peer Dependencies

| Package | Version | Required |
|---------|---------|----------|
| `@munin-media/core` | ^0.1.0 | Yes |
| `expo-sqlite` | >=15.0.0 | Optional |
| `firebase` | >=10.0.0 | Optional |
| `@react-native-async-storage/async-storage` | >=2.0.0 | Optional |
