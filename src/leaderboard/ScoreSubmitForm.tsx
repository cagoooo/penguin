// Lazy-loaded score-submission form. Pulling Firebase into its own chunk
// keeps the initial JS bundle ~85 KB lighter (gzip).

import { useRef, useState } from 'react';
import { submitScore } from './firebase';

interface Props {
  score: number;
  level: number;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
}

type SubmitState = 'idle' | 'submitting' | 'submitted' | 'error';

export default function ScoreSubmitForm({ score, level, playerName, onPlayerNameChange }: Props) {
  // Component is conditionally rendered only inside GAME_OVER, so each fresh
  // game-over event mounts a fresh component with default state — no manual reset needed.
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);
  const submittedScoreRef = useRef<number | null>(null);

  const onSubmit = async () => {
    const trimmed = playerName.trim();
    if (!trimmed) {
      setError('請先輸入暱稱');
      return;
    }
    if (submittedScoreRef.current === score) return;
    setState('submitting');
    setError(null);
    try {
      await submitScore(trimmed, score, level);
      try { localStorage.setItem('penguin_player_name', trimmed); } catch { /* ignore quota errors */ }
      submittedScoreRef.current = score;
      setState('submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  };

  if (state === 'submitted') {
    return (
      <div className="bg-black/30 border border-white/20 rounded-2xl p-3 sm:p-4 mb-4 w-full max-w-sm">
        <p className="text-green-300 text-sm sm:text-base font-bold flex items-center justify-center gap-2">
          ✓ 已上傳到排行榜！
        </p>
      </div>
    );
  }

  return (
    <div className="bg-black/30 border border-white/20 rounded-2xl p-3 sm:p-4 mb-4 w-full max-w-sm">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={playerName}
            onChange={e => onPlayerNameChange(e.target.value.slice(0, 12))}
            placeholder="輸入暱稱（最多 12 字）"
            maxLength={12}
            className="flex-1 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-sm placeholder-white/40 focus:outline-none focus:border-white/60"
            disabled={state === 'submitting'}
          />
          <button
            onClick={onSubmit}
            disabled={state === 'submitting' || !playerName.trim()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {state === 'submitting' ? '上傳中...' : '上傳'}
          </button>
        </div>
        {error && <p className="text-red-200 text-xs">{error}</p>}
      </div>
    </div>
  );
}
