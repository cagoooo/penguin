import { useEffect, useState } from 'react';
import { subscribeTopScores, type LeaderboardEntry } from './firebase';

export interface LeaderboardState {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: Error | null;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function useLeaderboard(enabled: boolean, topN = 10): LeaderboardState {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<Status>(enabled ? 'loading' : 'idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const unsub = subscribeTopScores(
      topN,
      e => {
        setEntries(e);
        setStatus('ready');
      },
      err => {
        setError(err);
        setStatus('error');
      },
    );
    return unsub;
  }, [enabled, topN]);

  return { entries, loading: status === 'loading', error };
}
