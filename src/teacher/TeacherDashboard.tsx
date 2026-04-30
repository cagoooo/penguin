// Teacher dashboard — read-only aggregate stats over the leaderboard.
//
// Access: ?teacher=1 query parameter (no real auth — just obscurity / opt-in).
// Future: gate behind Firebase Google sign-in restricted to a whitelisted email.

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Users, TrendingUp, Calendar, Award, X } from 'lucide-react';
import { fetchAllLeaderboardEntries, type LeaderboardEntry } from '../leaderboard/firebase';

interface Props {
  onClose: () => void;
}

interface Stats {
  total: number;
  distinctPlayers: number;
  avgScore: number;
  medianScore: number;
  topPlayer: LeaderboardEntry | null;
  highestLevel: number;
  recentDays: { date: string; count: number }[];
  scoreBuckets: { label: string; count: number }[];
}

function computeStats(entries: LeaderboardEntry[]): Stats {
  if (entries.length === 0) {
    return {
      total: 0, distinctPlayers: 0, avgScore: 0, medianScore: 0,
      topPlayer: null, highestLevel: 0, recentDays: [], scoreBuckets: [],
    };
  }

  const distinctUids = new Set<string>();
  let scoreSum = 0;
  let highestLevel = 0;
  for (const e of entries) {
    if (e.uid) distinctUids.add(e.uid);
    scoreSum += e.score;
    if (e.level > highestLevel) highestLevel = e.level;
  }

  // Sort scores ascending for median
  const sorted = [...entries].map(e => e.score).sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  // Daily activity (last 14 days)
  const dayCounts: Record<string, number> = {};
  for (const e of entries) {
    if (!e.createdAt) continue;
    const day = e.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
    dayCounts[day] = (dayCounts[day] ?? 0) + 1;
  }
  const recentDays = Object.entries(dayCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({ date, count }));

  // Score histogram
  const buckets = [
    { min: 0, max: 5_000, label: '< 5K' },
    { min: 5_000, max: 20_000, label: '5K-20K' },
    { min: 20_000, max: 50_000, label: '20K-50K' },
    { min: 50_000, max: 100_000, label: '50K-100K' },
    { min: 100_000, max: 500_000, label: '100K-500K' },
    { min: 500_000, max: Infinity, label: '> 500K' },
  ];
  const scoreBuckets = buckets.map(b => ({
    label: b.label,
    count: entries.filter(e => e.score >= b.min && e.score < b.max).length,
  }));

  return {
    total: entries.length,
    distinctPlayers: distinctUids.size,
    avgScore: Math.round(scoreSum / entries.length),
    medianScore: Math.round(median),
    topPlayer: entries[0] ?? null,
    highestLevel,
    recentDays,
    scoreBuckets,
  };
}

export default function TeacherDashboard({ onClose }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllLeaderboardEntries(200)
      .then(data => { if (!cancelled) setEntries(data); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => entries ? computeStats(entries) : null, [entries]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1500] bg-black/90 backdrop-blur-md overflow-y-auto"
    >
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2">
              🎓 教師後台
            </h1>
            <p className="text-sm opacity-60">阿凱老師的學生數據儀表板</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"
            aria-label="關閉"
          >
            <X size={24} />
          </button>
        </div>

        {!entries && !error && (
          <div className="text-center py-20 text-white/50">
            <p>讀取中...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 text-red-200">
            <p className="font-bold mb-1">⚠️ 讀取失敗</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {stats && entries && (
          <>
            {/* Top stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <StatCard icon={<Users size={20} />} label="總提交次數" value={stats.total.toLocaleString()} color="text-blue-300" />
              <StatCard icon={<Trophy size={20} />} label="不重複玩家" value={stats.distinctPlayers.toLocaleString()} color="text-yellow-300" />
              <StatCard icon={<TrendingUp size={20} />} label="平均分數" value={stats.avgScore.toLocaleString()} color="text-green-300" />
              <StatCard icon={<Award size={20} />} label="最高關卡" value={`L${stats.highestLevel}`} color="text-purple-300" />
            </div>

            {/* Top player */}
            {stats.topPlayer && (
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-400/40 rounded-2xl p-5 mb-8">
                <p className="text-xs uppercase tracking-widest text-yellow-200/80 mb-2">🥇 目前王者</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl sm:text-3xl font-black">{stats.topPlayer.name}</p>
                  <p className="text-3xl sm:text-4xl font-mono font-bold text-yellow-300">{stats.topPlayer.score.toLocaleString()}</p>
                </div>
                <p className="text-xs opacity-60 mt-2">L{stats.topPlayer.level} · {stats.topPlayer.createdAt?.toLocaleString('zh-TW') ?? '—'}</p>
              </div>
            )}

            {/* Score distribution */}
            <Section title="分數分佈" icon={<TrendingUp size={20} />}>
              <div className="space-y-1">
                {stats.scoreBuckets.map(b => {
                  const pct = stats.total === 0 ? 0 : (b.count / stats.total) * 100;
                  return (
                    <div key={b.label} className="flex items-center gap-3">
                      <span className="w-20 text-xs opacity-70">{b.label}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs font-mono">{b.count}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Daily activity */}
            <Section title="最近 14 天活躍度" icon={<Calendar size={20} />}>
              {stats.recentDays.length === 0 ? (
                <p className="text-sm opacity-50">尚無資料</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {stats.recentDays.map(d => {
                    const max = Math.max(...stats.recentDays.map(x => x.count));
                    const h = max === 0 ? 0 : (d.count / max) * 100;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-gradient-to-t from-cyan-500 to-blue-300 rounded-t transition-all"
                          style={{ height: `${h}%`, minHeight: '4px' }}
                          title={`${d.date}: ${d.count}`}
                        />
                        <span className="text-[8px] opacity-50 -rotate-45 origin-top-left whitespace-nowrap mt-2">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Full leaderboard table */}
            <Section title={`全部紀錄 (top ${entries.length})`} icon={<Trophy size={20} />}>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-wider opacity-60 sticky top-0 bg-[#0a0a1a]">
                    <tr>
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">暱稱</th>
                      <th className="text-right py-2 px-2">分數</th>
                      <th className="text-right py-2 px-2">關</th>
                      <th className="text-right py-2 px-2">時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, idx) => (
                      <tr key={e.id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="py-1.5 px-2 text-xs opacity-60 font-mono">{idx + 1}</td>
                        <td className="py-1.5 px-2 font-medium">{e.name}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">{e.score.toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-right text-xs">L{e.level}</td>
                        <td className="py-1.5 px-2 text-right text-[10px] opacity-50">
                          {e.createdAt?.toLocaleDateString('zh-TW') ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <p className="text-[10px] opacity-30 text-center mt-8">
              讀取上限 200 筆 · 統計皆於前端計算 · 中位數 {stats.medianScore.toLocaleString()}
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/15 rounded-xl p-3 text-center">
      <div className={`flex items-center justify-center gap-1 mb-1 ${color}`}>
        {icon}
      </div>
      <p className="text-[10px] uppercase opacity-60 mb-1">{label}</p>
      <p className={`text-xl sm:text-2xl font-mono font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1a3a] border border-white/10 rounded-xl p-5 mb-6">
      <h2 className="font-bold text-base mb-4 flex items-center gap-2">{icon}{title}</h2>
      {children}
    </div>
  );
}
