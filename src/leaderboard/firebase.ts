import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Firestore,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';

// Publishable Firebase config — safe to ship to the browser.
// Security is enforced by Firestore rules (see firestore.rules).
const firebaseConfig = {
  apiKey: 'AIzaSyDgfqoqKIeL7ESX_hMBcZeCz2LebQSV28A',
  authDomain: 'penguin-leaderboard.firebaseapp.com',
  projectId: 'penguin-leaderboard',
  storageBucket: 'penguin-leaderboard.firebasestorage.app',
  messagingSenderId: '444482780785',
  appId: '1:444482780785:web:c887b9abdcafc6fca9e5d0',
};

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let signInPromise: Promise<User> | null = null;

function getApp(): FirebaseApp {
  if (!appInstance) appInstance = initializeApp(firebaseConfig);
  return appInstance;
}

function getDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(getApp());
  return dbInstance;
}

function getAuthInstance(): Auth {
  if (!authInstance) authInstance = getAuth(getApp());
  return authInstance;
}

/**
 * Lazily sign in anonymously and return the resulting User.
 * Cached as a singleton — calling again before the first call resolves returns
 * the same in-flight promise. Caching the User itself means subsequent calls
 * are synchronous-fast.
 *
 * Errors are normalized: if the project owner hasn't yet enabled Anonymous
 * Auth in the Firebase Console (a one-time toggle that has no programmatic
 * API for the free tier), Firebase returns `auth/admin-restricted-operation`.
 * We rewrap that with a Chinese message so the GAME_OVER form shows something
 * useful instead of a cryptic Firebase string.
 */
async function ensureAnonymousUser(): Promise<User> {
  const auth = getAuthInstance();
  if (auth.currentUser) return auth.currentUser;
  if (signInPromise) return signInPromise;
  signInPromise = signInAnonymously(auth).then(cred => cred.user);
  try {
    return await signInPromise;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed') {
      throw new Error('排行榜暫時無法上傳（管理員需啟用匿名登入）', { cause: err });
    }
    if (code === 'auth/network-request-failed') {
      throw new Error('連線不穩，請稍後再試', { cause: err });
    }
    throw err;
  } finally {
    signInPromise = null;
  }
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  level: number;
  uid?: string;
  createdAt: Date | null;
}

/**
 * Normalize a nickname for the unique-claim registry. Lowercased + trimmed
 * so "Alice", "alice", "ALICE", " Alice " all collide on the same doc.
 * Document IDs in Firestore can't contain '/' so we strip those too.
 */
function normalizeNickname(name: string): string {
  return name.trim().toLowerCase().replace(/\//g, '_').slice(0, 24);
}

/**
 * Reserve a nickname for the current user. First uid to claim a name keeps
 * it; subsequent attempts by other uids throw a clear error.
 *
 * - If the doc doesn't exist → create it with our uid (first claim wins).
 * - If it exists with our uid → no-op (we already own it).
 * - If it exists with a different uid → throw "name taken" error.
 */
async function claimNickname(displayName: string, uid: string): Promise<void> {
  const db = getDb();
  const key = normalizeNickname(displayName);
  if (!key) throw new Error('暱稱不能空白');

  const ref = doc(db, 'nicknames', key);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const ownerUid = (snap.data() as { uid?: unknown }).uid;
    if (typeof ownerUid !== 'string' || ownerUid !== uid) {
      throw new Error(`暱稱「${displayName}」已被其他玩家認領，請換一個`);
    }
    return; // Already mine
  }

  await setDoc(ref, {
    uid,
    createdAt: serverTimestamp(),
  });
}

export async function submitScore(name: string, score: number, level: number): Promise<void> {
  const db = getDb();
  const trimmed = name.trim().slice(0, 12);
  if (!trimmed) throw new Error('Name is required');
  if (score < 0 || score > 100_000_000) throw new Error('Score out of range');
  if (level < 1 || level > 999) throw new Error('Level out of range');

  // Sign in anonymously first — Firestore rules require auth.uid to match
  // the document's `uid` field. Each browser/profile gets a stable uid.
  const user = await ensureAnonymousUser();

  // Claim the nickname (or verify ownership). Throws if taken by someone else.
  await claimNickname(trimmed, user.uid);

  await addDoc(collection(db, 'leaderboard'), {
    name: trimmed,
    score: Math.floor(score),
    level: Math.floor(level),
    uid: user.uid,
    createdAt: serverTimestamp(),
  });
}

/**
 * Subscribe to top N scores. Returns an unsubscribe function.
 */
export function subscribeTopScores(
  topN: number,
  onUpdate: (entries: LeaderboardEntry[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const db = getDb();
  const q = query(
    collection(db, 'leaderboard'),
    orderBy('score', 'desc'),
    limit(topN),
  );
  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      const entries: LeaderboardEntry[] = snap.docs.map(doc => {
        const data = doc.data();
        const created = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null;
        return {
          id: doc.id,
          name: typeof data.name === 'string' ? data.name : '???',
          score: typeof data.score === 'number' ? data.score : 0,
          level: typeof data.level === 'number' ? data.level : 1,
          uid: typeof data.uid === 'string' ? data.uid : undefined,
          createdAt: created,
        };
      });
      onUpdate(entries);
    },
    err => {
      console.error('[leaderboard] subscription failed', err);
      onError?.(err);
    },
  );
}
