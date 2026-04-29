import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
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

function getDb(): Firestore {
  if (!appInstance) appInstance = initializeApp(firebaseConfig);
  if (!dbInstance) dbInstance = getFirestore(appInstance);
  return dbInstance;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  level: number;
  createdAt: Date | null;
}

export async function submitScore(name: string, score: number, level: number): Promise<void> {
  const db = getDb();
  const trimmed = name.trim().slice(0, 12);
  if (!trimmed) throw new Error('Name is required');
  if (score < 0 || score > 100_000_000) throw new Error('Score out of range');
  if (level < 1 || level > 999) throw new Error('Level out of range');
  await addDoc(collection(db, 'leaderboard'), {
    name: trimmed,
    score: Math.floor(score),
    level: Math.floor(level),
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
