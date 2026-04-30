import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Timer, MapPin, Play, RotateCcw, ChevronRight, ChevronLeft, ArrowUp, Maximize, Minimize, ShoppingCart, Heart, Zap, Clock, Smartphone, Shield, Search, Wind, Compass, Rocket, Fish, Volume2, VolumeX, Pause, Camera, DoorOpen, Rewind, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ALL_SHOP_ITEMS as SHOP_DATA, getShopItem, type ShopItemMeta } from './shop/items';
import { initAudio, playTone, sounds, mutedRef, pausedRef } from './audio/sounds';
import { startBGM, stopBGM, loadBgmTrack, type BgmTrackId } from './audio/bgm';
import { useAchievements } from './achievements/useAchievements';
import { useReducedMotion } from './hooks/useReducedMotion';
// shareImage is ~250 lines of canvas drawing — only needed when the player
// hits the 📷 share button. Dynamic import keeps it out of the main chunk.
import { getSkin, loadSkin, saveSkin, type SkinId } from './skins/skins';
import { comboMultiplier, getComboTier, justEnteredNewTier, type ComboTier } from './game/combo';
import { getDailyChallenge, loadDailyRecord, recordDailyAttempt } from './game/dailyChallenge';
import { saveGame, loadSavedGame, clearSavedGame, type SavedGame } from './store/savedGame';
import { getSeasonalEvent, isEventActive } from './game/seasonalEvents';
import { drawEnvironment } from './render/drawEnvironment';
import { drawObstacles } from './render/drawObstacles';
import { drawPenguin } from './render/drawPenguin';
import { drawWeather } from './render/drawWeather';

// Firebase lives in its own ~85KB gzip chunk; only loaded when the player opens
// the leaderboard or hits GAME_OVER (where the submit form appears).
const LeaderboardModal = lazy(() => import('./leaderboard/LeaderboardModal'));
const ScoreSubmitForm = lazy(() => import('./leaderboard/ScoreSubmitForm'));
// Other modals — loaded on-demand to keep the initial bundle slim.
const AchievementsModal = lazy(() => import('./achievements/AchievementsModal'));
const SkinPickerModal = lazy(() => import('./skins/SkinPickerModal'));
// PWA update prompt — registers the SW + shows a toast when a new build lands.
const UpdatePrompt = lazy(() => import('./components/UpdatePrompt'));
// First-time-only control hints overlay (lazy because most repeat players never see it).
const OnboardingHints = lazy(() => import('./components/OnboardingHints'));
// PWA install prompt — appears after first GAME_OVER / LEVEL_CLEAR.
const InstallPrompt = lazy(() => import('./components/InstallPrompt'));
// BGM track picker — small dropdown on START screen.
const BgmPicker = lazy(() => import('./components/BgmPicker'));
// Teacher dashboard — gated by ?teacher=1 URL param.
const TeacherDashboard = lazy(() => import('./teacher/TeacherDashboard'));
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  MAX_SPEED,
  ACCELERATION,
  FRICTION,
  GRAVITY,
  JUMP_FORCE,
} from './game/constants';

// Map iconName strings (defined in src/shop/items.ts) to actual lucide-react components.
const ICON_COMPONENTS = {
  Clock, Maximize, Zap, Heart, Shield, Search, ChevronRight, Wind, Compass, Fish, Timer, Rocket, Trophy,
  DoorOpen, Rewind, Users,
} as const;

function renderShopIcon(meta: ShopItemMeta) {
  const Icon = ICON_COMPONENTS[meta.iconName];
  const className = meta.iconExtra ? `${meta.iconClass} ${meta.iconExtra}` : meta.iconClass;
  return <Icon className={className} />;
}

// Display-ready items (with rendered icon nodes); kept for compatibility with existing JSX.
const ALL_SHOP_ITEMS = SHOP_DATA.map(meta => ({
  id: meta.id,
  name: meta.name,
  icon: renderShopIcon(meta),
  desc: meta.desc,
  price: meta.price,
}));

// --- Types ---
type GameState = 'START' | 'PLAYING' | 'LEVEL_CLEAR' | 'GAME_OVER' | 'SHOP';

// Obstacle type lives in src/game/types.ts now.
import type { Obstacle } from './game/types';

// `project()` lives in src/render/project.ts now.

// Static data shown by the START-screen marquee. Lives at module top so the
// closure captures it once instead of allocating fresh arrays each render.
const SCROLL_GROUPS = [
  { section: '敵人與陷阱', items: [
    { name: '海豹', desc: '路徑上的伏兵，撞擊會跌倒損失大量時間。' },
    { name: '冰裂縫', desc: '第二關開始出現。地板上的陷阱，掉入會大幅降低速度。' },
    { name: '雪堆', desc: '第四關開始出現。厚重的積雪，撞擊會嚴重減速。' },
    { name: '結冰區域', desc: '第七關開始出現。極其光滑的冰面，轉向能力會下降。' },
    { name: '北極熊', desc: '第九關開始出現。會追蹤車道，撞到 -2 條命。' },
    { name: '冰山', desc: '第十一關開始出現。1.5 車道寬，必須跳過。' },
    { name: '暴風雪 / 強風 / 極夜 / 大霧', desc: 'L13/15/17/19 起的環境事件。' },
    { name: '隱藏房間', desc: '0.3% 機率出現的彩虹漩渦旗，撞到觸發 8 秒金魚饗宴！' },
  ]},
  { section: '補給站商品', items: [
    { name: '黃金碼表', desc: '下關開始生效：立即增加 10 秒計時。' },
    { name: '特製螺旋槳', desc: '下關開始生效：讓下一次飛行持續時間翻倍。' },
    { name: '噴射滑板', desc: '下關開始生效：地面時速翻倍，直到碰撞。' },
    { name: '企鵝娃娃', desc: '下關開始生效：耗盡時間時獲得額外生命。' },
    { name: '磁力項圈', desc: '下關開始生效：自動吸引所有魚片，持續 30 秒。' },
    { name: '冰原護盾', desc: '下關開始生效：抵擋下一次碰撞造成的減速。' },
    { name: '氮氣噴發', desc: '下關開始生效：啟動 5 秒極速衝刺且無敵。' },
    { name: '高級偵測器', desc: '下關開始生效：該關卡金魚出現率增加。' },
    { name: '白金碼表', desc: '下關開始生效：立即增加 30 秒計時。' },
    { name: '重型雪靴', desc: '下關開始生效：碰撞冰縫不再跌倒，僅輕微減速。' },
    { name: '流線領巾', desc: '下關開始生效：永久提升 10% 加速度與最速上限。' },
    { name: '極光羅盤', desc: '下關開始生效：縮短該次任務 1000m。' },
    { name: '神奇魚餌', desc: '下關開始生效：該關卡剩餘所有魚獲得 3 倍積分。' },
    { name: '克羅諾斯之戒', desc: '下關開始生效：凍結計時鐘 15 秒。' },
    { name: '反重力引擎', desc: '下關開始生效：直接獲得 20 秒長效飛行。' },
    { name: '探險王之冠', desc: '下關開始生效：永久獲得 3 倍的分數與距離加成。' },
  ]},
  { section: '遊戲規則', items: [
    { name: '冒險目標', desc: '在時間結束前抵達各關卡的終點（如石門國小）。' },
    { name: '點數收集', desc: '收集魚片可獲得點數，用於補給站購買裝備。' },
    { name: '連擊系統', desc: '連續收魚不撞到障礙 → 分數倍率最高 ×15！' },
    { name: '每日挑戰', desc: '7 種主題日輪替，啟用後享受獨特修正與獎勵。' },
    { name: '生存技巧', desc: '儘可能避開障礙物，維持最高時速以刷新紀錄。' },
  ]},
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(100);
  const [distance, setDistance] = useState(4200);
  const [speed, setSpeed] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(0);
  const [selectedShopItem, setSelectedShopItem] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [mobileOpt, setMobileOpt] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 2: best score, mute, pause
  const [bestScore, setBestScore] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('penguin_best') || '0') || 0; } catch { return 0; }
  });
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem('penguin_muted') === '1'; } catch { return false; }
  });
  mutedRef.current = muted;
  const [paused, setPaused] = useState(false);
  pausedRef.current = paused;

  // Phase 4: achievements + per-game stats
  const { unlocked: achievementsUnlocked, unlock: unlockAchievement, toasts: achievementToasts, all: allAchievements } = useAchievements();
  const [showAchievements, setShowAchievements] = useState(false);
  const fishCollectedRef = useRef(0);
  const shopPurchasesRef = useRef(0);

  // Phase 4: leaderboard (lazy-loaded; submit form has its own state)
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerName, setPlayerName] = useState<string>(() => {
    try { return localStorage.getItem('penguin_player_name') || ''; } catch { return ''; }
  });

  // Phase 4: penguin skins
  const [currentSkin, setCurrentSkin] = useState<SkinId>(loadSkin);
  const [showSkinPicker, setShowSkinPicker] = useState(false);
  const skinRef = useRef<SkinId>(currentSkin);
  useEffect(() => { skinRef.current = currentSkin; saveSkin(currentSkin); }, [currentSkin]);

  // 16-6 BGM track selection
  const [bgmTrack, setBgmTrack] = useState<BgmTrackId>(loadBgmTrack);

  // Teacher dashboard gate: ?teacher=1
  const [showTeacherDashboard, setShowTeacherDashboard] = useState(false);

  // 16-10 URL deep links: read once on mount
  // Supported: ?screen=leaderboard|achievements|skins · ?skin=red-scarf|sunglasses|crown|golden · ?teacher=1
  // After consuming params we strip them from the URL so a refresh doesn't re-trigger.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const screen = params.get('screen');
    const skin = params.get('skin');
    const teacher = params.get('teacher');

    if (screen === 'leaderboard') setShowLeaderboard(true);
    else if (screen === 'achievements') setShowAchievements(true);
    else if (screen === 'skins') setShowSkinPicker(true);

    if (skin && (['default', 'red-scarf', 'sunglasses', 'crown', 'golden'] as const).includes(skin as SkinId)) {
      setCurrentSkin(skin as SkinId);
    }

    if (teacher === '1') {
      setShowTeacherDashboard(true);
    }

    if (screen || skin || teacher) {
      // Clean URL so future shares of "the URL the player saw" don't re-trigger
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState(null, '', clean);
    }
  }, []);

  // 5-3 Honour OS-level reduce-motion preference
  const reducedMotion = useReducedMotion();

  // Phase 5+: combo system
  const [comboCount, setComboCount] = useState(0);
  const [comboFlash, setComboFlash] = useState<ComboTier | null>(null);
  const comboCountRef = useRef(0);
  const maxComboRef = useRef(0);

  // Phase 6: daily challenge
  const [dailyMode, setDailyMode] = useState(false);
  const [dailyRecord, setDailyRecord] = useState(() => loadDailyRecord());
  const dailyConfig = getDailyChallenge();
  const dailyModeRef = useRef(false);
  useEffect(() => { dailyModeRef.current = dailyMode; }, [dailyMode]);

  // 6-4 Time Attack mode toggle
  const [timeAttackMode, setTimeAttackMode] = useState(false);
  const timeAttackModeRef = useRef(false);
  useEffect(() => { timeAttackModeRef.current = timeAttackMode; }, [timeAttackMode]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // 6-6 Seasonal events — auto-detected based on date
  const seasonalEvent = getSeasonalEvent();

  // 16-15 Quick continue: track if there's a saved session on mount
  const [resumableSave, setResumableSave] = useState<SavedGame | null>(() => loadSavedGame());

  // Auto-save mid-game state every 2 seconds while PLAYING (not in shop, paused, etc.)
  useEffect(() => {
    if (gameState !== 'PLAYING' || paused) return;
    const interval = setInterval(() => {
      const g = gameRef.current;
      saveGame({
        level: g.level,
        score: g.score,
        time: g.time,
        distance: g.distance,
        speed: g.speed,
        lives: g.lives,
        fishCollected: fishCollectedRef.current,
        shopPurchases: shopPurchasesRef.current,
        comboCount: comboCountRef.current,
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [gameState, paused]);

  // Clear save on GAME_OVER / LEVEL_CLEAR (forces a clean session for the leaderboard)
  useEffect(() => {
    if (gameState === 'GAME_OVER' || gameState === 'LEVEL_CLEAR') {
      clearSavedGame();
      setResumableSave(null);
    }
  }, [gameState]);

  // Best score persistence on GAME_OVER
  useEffect(() => {
    if (gameState !== 'GAME_OVER') {
      setIsNewRecord(false);
      return;
    }
    // Daily challenge: record attempt + best
    if (dailyModeRef.current) {
      setDailyRecord(recordDailyAttempt(score, level));
    }
    if (score > bestScore) {
      setBestScore(score);
      setIsNewRecord(true);
      try { localStorage.setItem('penguin_best', String(score)); } catch {}
      if (!muted) {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((n, i) => setTimeout(() => playTone(n, 'square', 0.2, 0.08), i * 100));
      }
    }
    // Score-based achievements
    if (score >= 100000) unlockAchievement('score-100k');
    if (score >= 1000000) unlockAchievement('score-1m');
    if (fishCollectedRef.current >= 50) unlockAchievement('fish-feast');
    if (shopPurchasesRef.current >= 5) unlockAchievement('shop-spree');
  }, [gameState, score, bestScore, muted, level, unlockAchievement]);

  // Level-based achievements + survival check
  useEffect(() => {
    if (gameState === 'LEVEL_CLEAR') {
      if (level === 1) unlockAchievement('first-clear');
      if (level >= 5) unlockAchievement('level-5');
      if (level >= 10) unlockAchievement('level-10');
      if (level >= 7) unlockAchievement('survivor');
      if (level >= 20) unlockAchievement('king-slayer');
    }
  }, [gameState, level, unlockAchievement]);

  // Speed-based achievement (live polling during play)
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    if (speed >= 80) unlockAchievement('speedster');
  }, [gameState, speed, unlockAchievement]);

  const [shareState, setShareState] = useState<'idle' | 'generating' | 'shared' | 'downloaded' | 'error'>('idle');

  const handleShareScore = async () => {
    if (shareState === 'generating') return;
    setShareState('generating');
    try {
      // Dynamic import — pulls shareImage chunk on first use only
      const mod = await import('./utils/shareImage');
      const blob = await mod.generateShareImage({
        score,
        level,
        name: playerName.trim() || undefined,
        isNewRecord,
        bestScore,
        achievementsCount: achievementsUnlocked.size,
        achievementsTotal: allAchievements.length,
      });
      const result = await mod.shareScore(blob, { score, level });
      setShareState(result);
      setTimeout(() => setShareState('idle'), 3000);
    } catch (err) {
      console.error('[share] failed', err);
      setShareState('error');
      setTimeout(() => setShareState('idle'), 3000);
    }
  };

  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
  };

  // Mute toggle: persist + stop BGM if muted mid-game
  useEffect(() => {
    try { localStorage.setItem('penguin_muted', muted ? '1' : '0'); } catch {}
    if (muted) stopBGM();
    else if (gameState === 'PLAYING') startBGM();
  }, [muted, gameState]);

  // Pause toggle via 'P' or 'Escape' (only when PLAYING)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        setPaused(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState]);

  // Warn before accidental F5 / close while a game is in progress.
  // beforeunload only fires the native confirm if returnValue is set; the
  // string itself is ignored by modern browsers (they show a generic message).
  useEffect(() => {
    if (gameState !== 'PLAYING' && gameState !== 'SHOP') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [gameState]);

  const containerRef = useRef<HTMLDivElement>(null);

  // God Mode Sequence Observer
  useEffect(() => {
    if (gameState !== 'START') return;
    let sequence: string[] = [];
    const targetPattern = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'KeyA', 'KeyB'];
    
    const handleSeqKeyDown = (e: KeyboardEvent) => {
      sequence.push(e.code);
      if (sequence.length > targetPattern.length) sequence.shift();
      
      if (sequence.join(',') === targetPattern.join(',')) {
        gameRef.current.isGodMode = true;
        // Play cheerful "God Mode" sound
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((n, i) => setTimeout(() => playTone(n, 'square', 0.15, 0.1), i * 100));
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
        unlockAchievement('god-mode');
        sequence = [];
      }
    };
    
    window.addEventListener('keydown', handleSeqKeyDown);
    return () => window.removeEventListener('keydown', handleSeqKeyDown);
  }, [gameState, unlockAchievement]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.warn(`Native fullscreen failed, using CSS fallback: ${err.message}`);
        // iOS Fallback: Manually toggle our own state
        setIsFullscreen(!isFullscreen);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else {
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    handleResize();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'START') {
      setShowScroll(false);
      idleTimeoutRef.current = setTimeout(() => {
        setShowScroll(true);
      }, 3000);
    } else {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      setShowScroll(false);
    }
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [gameState]);

  const MerchantPortrait = () => (
    <div className="relative w-full aspect-square bg-[#0a0a1a] border-4 border-[#3a3a5a] overflow-hidden rounded-lg shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
      {/* Scanlines Effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-20" />
      <div className="absolute inset-0 bg-blue-500/5 z-10 animate-pulse" />
      
      <motion.div 
        animate={{ 
          y: [0, -2, 0],
          rotate: [0, 0.5, 0]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="w-full h-full flex items-center justify-center relative p-4"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_rgba(0,100,255,0.5)]">
          {/* Headset wire */}
          <path d="M75 45 Q 85 45 85 60" fill="none" stroke="#555" strokeWidth="2" />
          
          {/* Body */}
          <ellipse cx="50" cy="95" rx="40" ry="30" fill="#000" />
          <ellipse cx="50" cy="95" rx="30" ry="25" fill="#fff" />
          
          {/* Head */}
          <circle cx="50" cy="45" r="35" fill="#000" />
          
          {/* Old Face features */}
          <path d="M30 45 Q 50 35 70 45" fill="none" stroke="#333" strokeWidth="1" opacity="0.5" /> {/* Wrinkles */}
          
          {/* White Belly/Face Patch */}
          <ellipse cx="50" cy="55" rx="25" ry="25" fill="#fff" />
          
          {/* Aging details */}
          <path d="M35 35 Q 50 25 65 35" fill="none" stroke="#ccc" strokeWidth="0.5" />
          
          {/* Beak (Old/Dull) */}
          <path d="M45 55 L 55 55 L 50 65 Z" fill="#CC9900" />
          
          {/* Eyes (Old/Wise) */}
          <circle cx="38" cy="45" r="4" fill="#000" />
          <circle cx="62" cy="45" r="4" fill="#000" />
          <circle cx="39" cy="44" r="1.5" fill="#fff" opacity="0.6" />
          <circle cx="63" cy="44" r="1.5" fill="#fff" opacity="0.6" />
          
          {/* Headset */}
          <rect x="25" y="40" width="8" height="15" rx="2" fill="#222" />
          <rect x="67" y="40" width="8" height="15" rx="2" fill="#222" />
          <path d="M30 40 Q 50 15 70 40" fill="none" stroke="#444" strokeWidth="4" />
          <rect x="68" y="55" width="2" height="10" fill="#444" />
          <circle cx="69" cy="67" r="3" fill="#111" />
        </svg>
      </motion.div>
    </div>
  );
  
  // Game Logic Refs
  const gameRef = useRef({
    score: 0,
    time: 100,
    distance: 5000,
    speed: 0,
    lastObstacleZ: 0,
    propellerTime: 0,
    turboTime: 0,
    curve: 0,
    targetCurve: 0,
    curveSegments: Array.from({ length: 150 }, () => 0), // 150 segments of 100 units each
    cumulativeOffsets: [] as { x: number, dx: number }[],
    segmentOffset: 0,
    seaType: 'NONE' as 'NONE' | 'LEFT' | 'RIGHT',
    seaTransition: 0, // 0 to 1 for smooth appearance
    nextSeaChange: 500,
    nextCurveChange: 800,
    levelDistance: 5000,
    level: 1,
    fireTime: 0,
    bgOffset: 0,
    lives: 0,
    hasSkateboard: false,
    hasBigPropeller: false,
    hasMagnet: false,
    hasShield: false,
    hasTripleFish: false,
    hasKingCrown: false,
    hasHeavyBoots: false,
    hasDetector: false,
    // 6-2 new shop items
    rewindCharges: 0,        // 時光倒流: how many remaining "undo" charges
    hasTwinPenguins: false,  // 雙人企鵝: permanent magnet + 2x fish bonus
    // 6-4 Time Attack mode: timer counts UP from 0, no time limit
    timeAttackMode: false,
    elapsedSeconds: 0,
    timeFrozen: 0,
    nitroTime: 0,
    maxSpeedBonus: 0,
    accelBonus: 0,
    enteredShopLevel: 0,
    isTouchAccelerating: false,
    lastTapTime: 0,
    touchDownTime: 0,
    touchLane: 0,
    // Swipe tracking — set on pointerdown, evaluated on pointermove
    touchStartX: 0,
    touchStartY: 0,
    touchSwiped: false, // true if any swipe action has fired this gesture
    traction: 1.0,
    isGamepadAccelerating: false,
    isGodMode: false,
    pendingShopItems: [] as string[],
    // L13+: blizzard storm — periodic visibility-reduction events
    // Weather system (BLIZZARD L13+, WIND L15+, NIGHT L17+, FOG L19+)
    weatherType: 'CLEAR' as 'CLEAR' | 'BLIZZARD' | 'WIND' | 'NIGHT' | 'FOG',
    weatherActive: 0,    // seconds remaining; 0 = inactive
    weatherStrength: 0,  // 0..1 fade-in/out (avoids snap)
    nextWeatherAt: 0,    // distance threshold for next event onset
    snowflakes: [] as { x: number; y: number; speed: number; size: number; sway: number }[],
    windPhase: 0,        // sin-wave time for WIND lateral push animation
    // Hidden bonus room (Phase 14-6): triggered by WARP_FLAG, lasts 8 seconds.
    // While active: time frozen, all spawns are gold fish, player invincible.
    bonusRoomTime: 0,
    bonusRoomFlash: 0,   // flash effect on entry (0..1 fading)
  });

  const auroraBorealis = useRef(Array.from({ length: 5 }).map((_, i) => ({
    x: i * 600 - 1500,
    width: 400 + Math.random() * 400,
    height: 150 + Math.random() * 100,
    color: `rgba(${100 + Math.random() * 100}, ${200 + Math.random() * 55}, ${200 + Math.random() * 55}, 0.2)`,
    speed: 0.1 + Math.random() * 0.2,
    offset: Math.random() * 100
  })));

  const backgroundMountains = useRef(Array.from({ length: 4 }).map((_, layer) => 
    Array.from({ length: 12 }).map((__, i) => ({
      x: (i - 6) * (300 + layer * 200) + (Math.random() * 100 - 50),
      width: (layer === 0 ? 800 : (150 + layer * 100 + Math.random() * 80)) * 0.25,
      height: (layer === 0 ? 10 : (40 + layer * 40 + Math.random() * 30)) * 0.25,
      color: layer === 0 ? '#C0D0E0' : layer === 1 ? '#E0F0FF' : layer === 2 ? '#B0D0F0' : '#FFFFFF',
      layer: layer, // 0: furthest icebergs, 1-3: mountains
      isIceberg: layer === 0
    }))
  ).flat());

  const clouds = useRef(Array.from({ length: 6 }).map(() => ({
    x: Math.random() * 2000 - 1000,
    y: 20 + Math.random() * 60,
    width: 30 + Math.random() * 30,
    speed: 0.2 + Math.random() * 0.3
  })));

  const playerRef = useRef({
    x: 0,
    y: 0,
    lane: 0, // -1, 0, 1
    targetLane: 0,
    isJumping: false,
    vy: 0,
    animFrame: 0,
    stumbleTime: 0,
    stumbleSide: 0
  });
  
  const obstaclesRef = useRef<Obstacle[]>([]);
  const frameId = useRef<number>(0);
  const keys = useRef<{ [key: string]: boolean }>({});

  // --- Initialization ---
  const initGame = (isNextLevel: any = false, resumeFrom: SavedGame | null = null) => {
    initAudio();
    sounds.start();
    const g = gameRef.current;

    // Ensure isNextLevel is strictly boolean true, not an event object
    const actualNextLevel = isNextLevel === true;

    // Resume mid-game from a saved snapshot. Skips fresh-run resets below
    // and restores the per-game counters that drove combo / shop achievements.
    const resuming = resumeFrom != null;

    // Reset per-game stats on a fresh run (NOT on level transitions)
    if (!actualNextLevel) {
      fishCollectedRef.current = 0;
      shopPurchasesRef.current = 0;
      comboCountRef.current = 0;
      maxComboRef.current = 0;
      setComboCount(0);
      setComboFlash(null);
      g.timeAttackMode = timeAttackModeRef.current;
      g.elapsedSeconds = 0;
      setElapsedSeconds(0);
    }
    
    // Apply pending shop items if it's the next level
    if (actualNextLevel) {
      const allShopItems = [
        { id: 'timer', apply: () => { g.time += 10; setTime(g.time); } },
        { id: 'propeller', apply: () => { g.hasBigPropeller = true; } },
        { id: 'skateboard', apply: () => { g.hasSkateboard = true; } },
        { id: 'life', apply: () => { g.lives += 1; setLives(g.lives); } },
        { id: 'magnet', apply: () => { g.hasMagnet = true; setTimeout(() => { g.hasMagnet = false; }, 30000); } },
        { id: 'shield', apply: () => { g.hasShield = true; } },
        { id: 'nitro', apply: () => { g.nitroTime = 5; } },
        { id: 'detector', apply: () => { g.hasDetector = true; } },
        { id: 'timer2', apply: () => { g.time += 30; setTime(g.time); } },
        { id: 'boots', apply: () => { g.hasHeavyBoots = true; } },
        { id: 'scarf', apply: () => { g.maxSpeedBonus += 10; g.accelBonus += 0.05; } },
        { id: 'compass', apply: () => { g.distance = Math.max(0, g.distance - 1000); setDistance(g.distance); } },
        { id: 'bait', apply: () => { g.hasTripleFish = true; } },
        { id: 'timering', apply: () => { g.timeFrozen = 15; } },
        { id: 'antigravity', apply: () => { g.propellerTime = 20; sounds.powerup(); } },
        { id: 'crown', apply: () => { g.hasKingCrown = true; } },
        { id: 'rewind', apply: () => { g.rewindCharges += 1; } },
        { id: 'twin_penguins', apply: () => { g.hasTwinPenguins = true; g.hasMagnet = true; } },
      ];

      g.pendingShopItems.forEach(itemId => {
        const item = allShopItems.find(i => i.id === itemId);
        if (item) item.apply();
      });
      g.pendingShopItems = [];
    }

    const baseTime = 30;
    if (resuming && resumeFrom) {
      // Restore from a previous session — single-source-of-truth from sanitized save
      g.score = resumeFrom.score;
      g.levelDistance = 4200 * Math.pow(1.15, resumeFrom.level - 1);
      g.level = resumeFrom.level;
      g.time = resumeFrom.time;
      g.lives = resumeFrom.lives;
      g.hasSkateboard = false;
      g.hasBigPropeller = false;
      g.enteredShopLevel = 0;
      g.pendingShopItems = [];
      fishCollectedRef.current = resumeFrom.fishCollected;
      shopPurchasesRef.current = resumeFrom.shopPurchases;
      comboCountRef.current = resumeFrom.comboCount;
      maxComboRef.current = resumeFrom.comboCount;
      setScore(g.score);
      setLevel(g.level);
      setLives(g.lives);
      setComboCount(g.score > 0 ? resumeFrom.comboCount : 0);
      setResumableSave(null);
    } else if (!actualNextLevel) {
      g.score = g.isGodMode ? 99999 : 0;
      g.levelDistance = 4200;
      g.level = 1;
      g.time = baseTime;
      g.lives = 0;
      g.hasSkateboard = false;
      g.hasBigPropeller = false;
      g.enteredShopLevel = 0;
      g.pendingShopItems = [];
      setScore(g.score);
      setLevel(1);
      setLives(0);
    } else {
      // Add time bonus to score
      g.score += Math.floor(g.time * 10);
      setScore(g.score);
      // Increase distance for next level
      g.levelDistance *= 1.15;
      g.level += 1;
      setLevel(g.level);
      // Carry over remaining time to next level (new baseline 30s + leftover)
      g.time = baseTime + g.time;
    }

    // Daily challenge modifiers — applied on fresh runs (not next-level)
    if (!actualNextLevel && dailyModeRef.current) {
      const cfg = getDailyChallenge();
      g.time = Math.round(g.time * cfg.timeMultiplier);
      setTime(g.time);
    }

    // 6-6 Seasonal time bonus (Christmas / Spring / Mid-Autumn) on fresh runs
    if (!actualNextLevel && seasonalEvent.timeBonus > 0) {
      g.time += seasonalEvent.timeBonus;
      setTime(g.time);
    }

    g.distance = g.levelDistance;
    g.speed = dailyModeRef.current && !actualNextLevel ? 20 * getDailyChallenge().speedMultiplier : 20;
    g.lastObstacleZ = 0;
    g.propellerTime = 0;
    g.turboTime = 0;
    g.curve = 0;
    g.targetCurve = 0;
    g.curveSegments = Array.from({ length: 150 }, () => 0);
    g.cumulativeOffsets = Array.from({ length: 151 }, () => ({ x: 0, dx: 0 }));
    g.segmentOffset = 0;
    g.seaType = 'NONE';
    g.nextSeaChange = 500;
    g.nextCurveChange = 800;
    g.fireTime = 0;
    g.traction = 1.0;
    // Reset blizzard state per level
    g.weatherType = 'CLEAR';
    g.weatherActive = 0;
    g.weatherStrength = 0;
    g.nextWeatherAt = g.distance - 800; // First weather event hits ~800m in
    g.snowflakes = [];
    g.windPhase = 0;
    g.bonusRoomTime = 0;
    g.bonusRoomFlash = 0;

    setTime(g.time);
    setDistance(g.levelDistance);
    setSpeed(20);

    playerRef.current = {
      x: 0,
      y: 0,
      lane: 0,
      targetLane: 0,
      isJumping: false,
      vy: 0,
      animFrame: 0,
      stumbleTime: 0,
      stumbleSide: 0
    };
    obstaclesRef.current = [];
    setGameState('PLAYING');
  };

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior for game keys (scrolling)
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      
      keys.current[e.code] = true;
      if (gameState === 'PLAYING') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          playerRef.current.targetLane = Math.max(-1, playerRef.current.targetLane - 1);
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          playerRef.current.targetLane = Math.min(1, playerRef.current.targetLane + 1);
        }
        if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && !playerRef.current.isJumping) {
          playerRef.current.isJumping = true;
          playerRef.current.vy = JUMP_FORCE;
          sounds.jump();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  useEffect(() => {
    let timer: any;
    if (gameState === 'PLAYING' && !paused && !muted) {
      // Delay BGM slightly to let start fanfare play
      timer = setTimeout(() => {
        startBGM();
      }, 1000);
    } else {
      stopBGM();
    }
    return () => {
      stopBGM();
      if (timer) clearTimeout(timer);
    };
  }, [gameState, paused, muted]);

  // --- Gamepad Handling ---
  useEffect(() => {
    let gamepadRequest: number;
    const lastButtons = new Set<number>();
    const lastAxes = { x: 0, y: 0 };

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0]; // Just support the first one for now

      if (gp) {
        const g = gameRef.current;
        const p = playerRef.current;

        // Common button state
        const btn0Pressed = gp.buttons[0]?.pressed; // A / Cross
        const btn1Pressed = gp.buttons[1]?.pressed; // B / Circle
        const btn9Pressed = gp.buttons[9]?.pressed; // Start

        // Start game from START screen or GAME_OVER screen
        if ((gameState === 'START' || gameState === 'GAME_OVER' || gameState === 'LEVEL_CLEAR')) {
          const startPressed = btn9Pressed || btn0Pressed;
          if (startPressed && !lastButtons.has(9) && !lastButtons.has(0)) {
            initGame(gameState === 'LEVEL_CLEAR');
          }
        }

        if (gameState === 'PLAYING') {
          // Steering (Left Stick or D-pad)
          const axisX = gp.axes[0];
          const dpadLeft = gp.buttons[14]?.pressed;
          const dpadRight = gp.buttons[15]?.pressed;

          // Left
          if (axisX < -0.5 || dpadLeft) {
            if (!keys.current['GamepadLeft']) {
              p.targetLane = Math.max(-1, p.targetLane - 1);
              keys.current['GamepadLeft'] = true;
            }
          } else {
            keys.current['GamepadLeft'] = false;
          }

          // Right
          if (axisX > 0.5 || dpadRight) {
            if (!keys.current['GamepadRight']) {
              p.targetLane = Math.min(1, p.targetLane + 1);
              keys.current['GamepadRight'] = true;
            }
          } else {
            keys.current['GamepadRight'] = false;
          }

          // Jump (A/B/X/Y or Cross/Circle/Square/Triangle)
          const jumpPressed = btn0Pressed || btn1Pressed || gp.buttons[2]?.pressed || gp.buttons[3]?.pressed;
          if (jumpPressed && !lastButtons.has(0) && !lastButtons.has(1) && !p.isJumping) {
            p.isJumping = true;
            p.vy = JUMP_FORCE;
            sounds.jump();
          }

          // Accelerate (Stick UP or RT/R2 or D-pad Up)
          const stickUp = gp.axes[1] < -0.5;
          const accPressed = gp.buttons[7]?.pressed || gp.buttons[12]?.pressed || stickUp;
          g.isGamepadAccelerating = accPressed;
        }

        if (gameState === 'SHOP') {
          const stickX = gp.axes[0];
          const stickY = gp.axes[1];
          const dpadUp = gp.buttons[12]?.pressed;
          const dpadDown = gp.buttons[13]?.pressed;
          const dpadLeft = gp.buttons[14]?.pressed;
          const dpadRight = gp.buttons[15]?.pressed;

          const currentLevelItems = g.isGodMode ? ALL_SHOP_ITEMS : ALL_SHOP_ITEMS.slice(0, Math.min(ALL_SHOP_ITEMS.length, 4 + g.level));
          let currentIdx = currentLevelItems.findIndex(item => item.id === selectedShopItem);
          if (currentIdx === -1) currentIdx = 0;

          const gridX = currentIdx % 4;
          const gridY = Math.floor(currentIdx / 4);

          // Horizontal Navigation
          if ((stickX < -0.5 && lastAxes.x >= -0.5) || (dpadLeft && !lastButtons.has(14))) {
            if (gridX > 0) setSelectedShopItem(currentLevelItems[currentIdx - 1].id);
          } else if ((stickX > 0.5 && lastAxes.x <= 0.5) || (dpadRight && !lastButtons.has(15))) {
            if (gridX < 3 && currentIdx + 1 < currentLevelItems.length) setSelectedShopItem(currentLevelItems[currentIdx + 1].id);
          }

          // Vertical Navigation
          if ((stickY < -0.5 && lastAxes.y >= -0.5) || (dpadUp && !lastButtons.has(12))) {
            if (gridY > 0) setSelectedShopItem(currentLevelItems[currentIdx - 4].id);
          } else if ((stickY > 0.5 && lastAxes.y <= 0.5) || (dpadDown && !lastButtons.has(13))) {
            if (gridY < 3 && currentIdx + 4 < currentLevelItems.length) setSelectedShopItem(currentLevelItems[currentIdx + 4].id);
          }

          lastAxes.x = stickX;
          lastAxes.y = stickY;

          // Buy Action
          if (btn0Pressed && !lastButtons.has(0)) {
            const buyButton = document.getElementById('shop-buy-btn');
            if (buyButton) (buyButton as HTMLButtonElement).click();
          }

          // Leave Action
          if (btn1Pressed && !lastButtons.has(1)) {
            setGameState('PLAYING');
          }
        }

        // Store button state for edge detection
        gp.buttons.forEach((btn, idx) => {
          if (btn.pressed) lastButtons.add(idx);
          else lastButtons.delete(idx);
        });
      }
      gamepadRequest = requestAnimationFrame(pollGamepad);
    };

    gamepadRequest = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(gamepadRequest);
    // initGame is intentionally omitted from deps — it'd cause the gamepad
    // poller to be torn down + recreated every state change, which would skip
    // input frames. The captured identity is fine because all state
    // mutations happen through the gameRef, not closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, selectedShopItem]);

  // --- Game Loop ---
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const update = () => {
      const g = gameRef.current;
      const p = playerRef.current;

      // Pause: skip simulation but keep redrawing the last frame
      if (pausedRef.current) {
        draw();
        frameId.current = requestAnimationFrame(update);
        return;
      }

      // 1. Update Speed
      const baseMaxSpeed = g.hasSkateboard ? MAX_SPEED * 2 : MAX_SPEED;
      
      if (g.turboTime > 0) {
        g.turboTime -= 1/60;
        g.speed = 200; // Turbo speed
      } else {
        if (keys.current['ArrowUp'] || keys.current['KeyW'] || g.isTouchAccelerating || g.isGamepadAccelerating) {
          g.speed = Math.min(baseMaxSpeed, g.speed + ACCELERATION);
        } else if (keys.current['ArrowDown'] || keys.current['KeyS']) {
          g.speed = Math.max(20, g.speed - ACCELERATION * 2);
        } else {
          g.speed = Math.max(20, g.speed - FRICTION);
        }
      }
      setSpeed(g.speed);

      // Apply touch lane if accelerating via touch
      if (g.isTouchAccelerating) {
        p.targetLane = g.touchLane;
      }

      const currentSpeed = g.speed;

      // 2. Update Distance & Time
      const distAdded = currentSpeed / 10;
      const finalDistAdded = g.hasKingCrown ? distAdded * 3 : distAdded;
      g.distance -= finalDistAdded;
      g.bgOffset += currentSpeed * 0.05; // Base parallax movement
      setDistance(Math.max(0, g.distance));

      if (g.distance <= 0) {
        setGameState('LEVEL_CLEAR');
        sounds.clear();
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
        return;
      }

      // Time decreases slowly
      const prevTime = g.time;
      // Bonus room countdown + time freeze
      if (g.bonusRoomTime > 0) {
        g.bonusRoomTime -= 1/60;
        if (g.bonusRoomFlash > 0) g.bonusRoomFlash -= 0.02;
      }

      if (g.timeFrozen > 0) {
        g.timeFrozen -= 1/60;
      } else if (g.bonusRoomTime > 0) {
        // Time freezes during the bonus room
      } else if (g.timeAttackMode) {
        // Time Attack: count UP, no countdown limit. Used as the speedrun clock.
        g.elapsedSeconds += 1/60;
        setElapsedSeconds(g.elapsedSeconds);
      } else {
        g.time -= 1/60;
        setTime(Math.max(0, g.time));
      }

      // Warning sound for last 5 seconds
      if (g.time <= 5 && g.time > 0) {
        if (Math.floor(prevTime) !== Math.floor(g.time)) {
          sounds.warn();
        }
      }

      // Time Attack mode never runs out of time — only finishes by reaching the goal
      if (!g.timeAttackMode && g.time <= 0) {
        if (g.lives > 0) {
          g.lives -= 1;
          g.time = 20; // Revived with 20 seconds
          setLives(g.lives);
          setTime(g.time);
          sounds.powerup();
        } else {
          setGameState('GAME_OVER');
          sounds.gameOver();
          return;
        }
      }

      // Shop Trigger logic - For testing: every level
      if (g.distance < 550 && g.distance > 500 && g.enteredShopLevel !== g.level) {
        // Spawn Shop
        if (!obstaclesRef.current.find(o => o.type === 'SHOP_STATION')) {
          obstaclesRef.current.push({
            id: 9999,
            z: 1000, // Spawn ahead
            lane: 1, // Move into the road (Right lane) for collision
            type: 'SHOP_STATION'
          });
        }
      }

      // 3. Update Player
      
      // Propeller timer
      if (g.propellerTime > 0) {
        g.propellerTime -= 1/60;
        // Play propeller sound periodically
        if (Math.floor(frameId.current / 5) % 2 === 0) {
          sounds.propeller();
        }
      }

      // Nitro timer
      if (g.nitroTime > 0) {
        g.nitroTime -= 1/60;
        g.speed = Math.max(g.speed, (MAX_SPEED + 20) + (g.maxSpeedBonus || 0));
        if (Math.floor(frameId.current / 4) % 2 === 0) {
          sounds.propeller(); // Use propeller sound for nitro
        }
      }

      // Fire timer
      if (g.fireTime > 0) {
        g.fireTime -= 1/60;
      }

      // Blizzard event (L13+): randomly triggered storm reducing visibility for ~5 seconds.
      // Strength fades in/out smoothly so the world doesn't snap white.
      // Weather system: pick a random eligible weather based on level + daily theme.
      // Each event lasts 4-7s with smooth fade-in/out. Only one type at a time.
      const blizzardForceFromDaily = dailyModeRef.current && getDailyChallenge().blizzardRate >= 5;
      const eligibleWeather: typeof g.weatherType[] = [];
      if (g.level >= 13 || blizzardForceFromDaily) eligibleWeather.push('BLIZZARD');
      if (g.level >= 15) eligibleWeather.push('WIND');
      if (g.level >= 17) eligibleWeather.push('NIGHT');
      if (g.level >= 19) eligibleWeather.push('FOG');

      if (eligibleWeather.length > 0) {
        if (g.weatherActive > 0) {
          g.weatherActive -= 1 / 60;
          if (g.weatherType === 'WIND') g.windPhase += 0.06;
          if (g.weatherActive <= 0) {
            g.weatherActive = 0;
            g.nextWeatherAt = g.distance - (800 + Math.random() * 700);
          }
        } else if (g.distance < g.nextWeatherAt) {
          // Trigger a fresh event — pick from eligible types
          const pick = blizzardForceFromDaily
            ? 'BLIZZARD'
            : eligibleWeather[Math.floor(Math.random() * eligibleWeather.length)];
          g.weatherType = pick;
          g.weatherActive = 4 + Math.random() * 3;

          // BLIZZARD needs snowflake particles
          if (pick === 'BLIZZARD') {
            g.snowflakes = Array.from({ length: 80 }, () => ({
              x: Math.random() * CANVAS_WIDTH,
              y: Math.random() * CANVAS_HEIGHT,
              speed: 2 + Math.random() * 5,
              size: 1 + Math.random() * 3,
              sway: Math.random() * Math.PI * 2,
            }));
          }
        }
        // Smooth fade
        const target = g.weatherActive > 0 ? 1 : 0;
        g.weatherStrength += (target - g.weatherStrength) * 0.04;
        if (g.weatherStrength < 0.01 && g.weatherActive <= 0) {
          g.weatherType = 'CLEAR';
        }
      } else {
        g.weatherStrength = 0;
        g.weatherType = 'CLEAR';
      }

      // WIND: gently push the player sideways (gameplay effect, not just visual)
      if (g.weatherType === 'WIND' && g.weatherStrength > 0.5) {
        const windForce = Math.sin(g.windPhase) * 0.4 * g.weatherStrength;
        p.x += windForce;
      }

      // 2.5 Update Environment (Curves & Sea)
      g.curve += (g.targetCurve - g.curve) * 0.05;
      
      // Smooth sea transition
      if (g.seaType !== 'NONE') {
        g.seaTransition += (1 - g.seaTransition) * 0.05;
      } else {
        g.seaTransition += (0 - g.seaTransition) * 0.05;
      }

      // 3. Update Curves
      g.segmentOffset += currentSpeed;
      if (g.segmentOffset >= 100) {
        g.segmentOffset -= 100;
        g.curveSegments.shift();
        g.curveSegments.push(g.curve);
      }

      // Pre-calculate cumulative offsets for project()
      const curvatureScale = 2 / 10000;
      let curX = 0;
      let curDx = 0;
      const segmentLength = 100;
      
      // We need length + 1 offsets to cover all segments
      if (!g.cumulativeOffsets || g.cumulativeOffsets.length !== g.curveSegments.length + 1) {
        g.cumulativeOffsets = Array.from({ length: g.curveSegments.length + 1 }, () => ({ x: 0, dx: 0 }));
      }

      for (let i = 0; i < g.curveSegments.length; i++) {
        g.cumulativeOffsets[i] = { x: curX, dx: curDx };
        const curvature = g.curveSegments[i] * curvatureScale;
        // The first segment is shortened by segmentOffset
        const effLen = i === 0 ? Math.max(0, segmentLength - g.segmentOffset) : segmentLength;
        curX += curDx * effLen + 0.5 * curvature * effLen * effLen;
        curDx += curvature * effLen;
      }
      g.cumulativeOffsets[g.curveSegments.length] = { x: curX, dx: curDx };

      if (g.distance < g.nextCurveChange) {
        // Chance of curve increases with level - Modified to be much higher
        const curveChance = Math.min(0.95, 0.7 + (g.level - 1) * 0.05);
        if (Math.random() < curveChance) {
          // Curvature intensity capped at 45 (slightly increased)
          const intensity = Math.min(45, 25 + (g.level - 1) * 3);
          g.targetCurve = (Math.random() - 0.5) * intensity;
        } else {
          g.targetCurve = 0;
        }
        // Frequency of checks - Significantly decreased interval for more frequent turns
        const interval = Math.max(200, (400 + Math.random() * 400) - (g.level - 1) * 100);
        g.nextCurveChange = g.distance - interval;
      }

      if (g.distance < g.nextSeaChange) {
        // Occasional sea, more frequent at higher levels
        const roll = Math.random();
        const seaChance = Math.min(0.8, 0.4 + (g.level - 1) * 0.05);
        
        if (roll < seaChance) {
          g.seaType = Math.random() > 0.5 ? 'RIGHT' : 'LEFT';
        } else {
          g.seaType = 'NONE';
        }
        
        const interval = Math.max(400, (800 + Math.random() * 800) - (g.level - 1) * 80);
        g.nextSeaChange = g.distance - interval;
      }

      // 3. Update Player
      
      // Stumble logic
      if (p.stumbleTime > 0) {
        p.stumbleTime -= 1/60;
        // Hop animation
        p.y = -Math.abs(Math.sin(p.stumbleTime * 20) * 20);
        p.x += p.stumbleSide * 2;
        // Slow down
        g.speed *= 0.95;
      } else {
        // Lane movement
        const laneX = p.targetLane * 150;
        const traction = g.traction || 1.0;
        p.x += (laneX - p.x) * 0.15 * traction;

        // Reset traction slowly
        if (g.traction < 1.0) g.traction += 0.01;
        if (g.traction > 1.0) g.traction = 1.0;
        
        // Jump/Fly physics
        if (g.propellerTime > 0) {
        // Flying logic: Space/Up (keyboard), 按住螢幕 (touch), 手把加速 (gamepad) → 上升
        if (keys.current['Space'] || keys.current['ArrowUp'] || keys.current['KeyW'] || g.isTouchAccelerating || g.isGamepadAccelerating) {
          p.vy = -5; // Constant upward force when held
          p.isJumping = true;
        } else {
          p.vy += GRAVITY * 0.5; // Slower fall when flying
        }
        p.y += p.vy;
        if (p.y > 0) {
          p.y = 0;
          p.vy = 0;
        }
        // Limit height
        if (p.y < -150) p.y = -150;
      } else {
        // Normal jump physics
        if (p.isJumping) {
          p.y += p.vy;
          p.vy += GRAVITY;
          if (p.y >= 0) {
            p.y = 0;
            p.isJumping = false;
            p.vy = 0;
          }
        }
      }
      p.animFrame += currentSpeed * 0.1;
    }

      // 4. Update Obstacles
      obstaclesRef.current.forEach(obs => {
        obs.z -= currentSpeed;
        
        // Jumping Fish Logic
        if (obs.type === 'JUMPING_FISH') {
          if (obs.fishY === undefined) {
            obs.fishY = 0;
            obs.fishVy = -15;
            obs.fishVx = 0.03; // Horizontal speed
            obs.fishLaneOffset = 0;
            obs.fishJumped = false;
            // Jump towards the center of the road
            // If lane is -1 (left), jump right (1). If lane is 1 (right), jump left (-1).
            // If lane is 0, pick a random direction.
            obs.fishLaneDirection = obs.lane === 0 ? (Math.random() > 0.5 ? 1 : -1) : -obs.lane;
          }
          // Only jump once when close
          if (obs.z < 1200 && !obs.fishJumped) {
            obs.fishY += obs.fishVy!;
            obs.fishVy! += 0.8; // Gravity for fish
            
            // Move horizontally while in the air
            obs.fishLaneOffset! += obs.fishVx! * obs.fishLaneDirection!;

            if (obs.fishY > 0) {
              obs.fishY = 0;
              obs.fishVy = 0;
              obs.fishVx = 0;
              obs.fishJumped = true; // Mark as jumped so it stays on ground
            }
          }
        }

        // Polar bear AI: tracks the player's lane while still far away.
        // Once it's close enough to commit (z < 600) the bear stops tracking
        // so the player has a fair window to dodge.
        if (obs.type === 'POLAR_BEAR') {
          if (obs.laneOffset === undefined) obs.laneOffset = 0;
          if (obs.walkPhase === undefined) obs.walkPhase = 0;
          obs.walkPhase += 0.15;
          if (obs.z > 600) {
            const targetLane = p.targetLane - obs.lane;
            const trackingSpeed = 0.012; // Slow enough that running can outrun it
            obs.laneOffset += (targetLane - obs.laneOffset) * trackingSpeed;
            // Clamp so the bear never crosses into adjacent lanes too aggressively
            obs.laneOffset = Math.max(-1.2, Math.min(1.2, obs.laneOffset));
          }
        }
      });
      // Remove off-screen obstacles
      obstaclesRef.current = obstaclesRef.current.filter(obs => obs.z > -100);

      // Spawn new obstacles
      if (g.lastObstacleZ < 1000) {
        const spawnZ = 2000 + Math.random() * 500;
        const typeRoll = Math.random();
        let type: Obstacle['type'];
        let color: string | undefined;

        // BONUS_ROOM: every spawn is a gold fish — short fish frenzy
        if (g.bonusRoomTime > 0) {
          obstaclesRef.current.push({
            id: Date.now() + Math.random(),
            z: spawnZ,
            lane: Math.floor(Math.random() * 3) - 1,
            type: 'FISH',
            color: '#FFD700',
          });
          g.lastObstacleZ = spawnZ;
        } else {
        // (Normal-mode spawn logic continues below)

        // Detector increases fish spawn rates
        const fishThreshold = g.hasDetector ? 0.7 : 0.85;
        const jumpingFishThreshold = g.hasDetector ? 0.6 : 0.75;

        // L20 BOSS: ~25% of all spawns are snowballs from the Penguin King.
        // Use a flag rather than early return so the rest of the spawn logic stays linear.
        let bossSnowballSpawned = false;
        if (g.level >= 20 && Math.random() < 0.25) {
          obstaclesRef.current.push({
            id: Date.now() + Math.random(),
            z: spawnZ,
            lane: Math.floor(Math.random() * 3) - 1,
            type: 'SNOWBALL',
          });
          g.lastObstacleZ = spawnZ;
          bossSnowballSpawned = true;
        }

        if (bossSnowballSpawned) {
          // already pushed; skip the rest of the type-roll chain
          type = 'HOLE'; // placeholder — won't be used
        } else if (typeRoll > 0.997 && g.level >= 5 && g.bonusRoomTime <= 0) {
          // 0.3% chance per spawn; only L5+ and not already in a bonus room
          type = 'WARP_FLAG';
        } else if (typeRoll > 0.99) {
          type = 'RAINBOW_FLAG';
        } else if (typeRoll > 0.92) {
          type = 'BLUE_FLAG';
        } else if (typeRoll > fishThreshold) {
          type = 'FISH';
          // GOLDEN_FISH daily theme makes every fish gold
          if (dailyModeRef.current && getDailyChallenge().goldFishBoost) {
            color = '#FFD700';
          } else {
            const fishRoll = Math.random();
            const goldThreshold = g.hasDetector ? 0.2 : 0.4;
            const greenThreshold = g.hasDetector ? 0.5 : 0.7;
            if (fishRoll > greenThreshold) color = '#32CD32';
            else if (fishRoll > goldThreshold) color = '#FFD700';
            else color = '#FF6347';
          }
        } else if (typeRoll > jumpingFishThreshold) {
          type = 'JUMPING_FISH';
          if (dailyModeRef.current && getDailyChallenge().goldFishBoost) {
            color = '#FFD700';
          } else {
            const fishRoll = Math.random();
            const goldThreshold = g.hasDetector ? 0.2 : 0.4;
            const greenThreshold = g.hasDetector ? 0.5 : 0.7;
            if (fishRoll > greenThreshold) color = '#32CD32';
            else if (fishRoll > goldThreshold) color = '#FFD700';
            else color = '#FF6347';
          }
        } else if (typeRoll > 0.65) {
          type = 'FLAG';
          const flagRoll = Math.random();
          if (flagRoll > 0.7) color = '#FFA500'; // Orange (增加出現機率)
          else if (flagRoll > 0.5) color = '#FFFF00'; // Yellow
          else color = '#FF0000'; // Red
        } else if (typeRoll > 0.45) {
          // ICEBERG (L11+) and POLAR_BEAR (L9+) replace some seal slots at higher levels.
          // Drop chances are gentle so they feel "rare and dangerous", not constant.
          // Daily challenge modifiers may amplify these.
          const daily = dailyModeRef.current ? getDailyChallenge() : null;
          const icebergChance = 0.2 * (daily?.icebergRate ?? 1);
          const bearChance = 0.25 * (daily?.bearRate ?? 1);
          if (g.level >= 11 && Math.random() < icebergChance) {
            type = 'ICEBERG';
          } else if (g.level >= 9 && Math.random() < bearChance) {
            type = 'POLAR_BEAR';
          } else {
            type = 'SEAL';
          }
        } else if (typeRoll > 0.35) {
          // ICE_PATCH starts appearing after level 7
          type = (g.level >= 7) ? 'ICE_PATCH' : 'HOLE';
        } else if (typeRoll > 0.25) {
          // SNOWDRIFT starts appearing after level 4
          type = (g.level >= 4) ? 'SNOWDRIFT' : 'HOLE';
        } else if (typeRoll > 0.15) {
          // CRACK starts appearing after level 2
          type = (g.level >= 2) ? 'CRACK' : 'HOLE';
        } else {
          type = 'HOLE';
        }

        if (!bossSnowballSpawned) {
          const newObs: Obstacle = {
            id: Date.now() + Math.random(),
            z: spawnZ,
            lane: Math.floor(Math.random() * 3) - 1,
            type,
            color,
          };
          if (type === 'POLAR_BEAR') {
            newObs.laneOffset = 0;
            newObs.walkPhase = 0;
          }
          obstaclesRef.current.push(newObs);
          g.lastObstacleZ = spawnZ;
        }
        } // end else (normal-mode spawn)
      }
      g.lastObstacleZ -= currentSpeed;

      // 5. Collision Detection
      // BONUS_ROOM: any obstacle in collision range simply gets collected as gold fish
      const bonusInvincible = g.bonusRoomTime > 0;
      obstaclesRef.current.forEach(obs => {
        if (bonusInvincible && obs.type !== 'FISH' && obs.type !== 'JUMPING_FISH') {
          // Pretend it's collected so it doesn't draw or hurt
          obs.collected = true;
        }
        if (obs.z < 150 && obs.z > 50) {
          // 5.1 Check for Item Collection (Fish, Flags)
          if (!obs.collected) {
            const effectiveLane = obs.type === 'JUMPING_FISH' 
              ? obs.lane + (obs.fishLaneOffset || 0)
              : obs.lane;
            const obsX = effectiveLane * 150;
            const dist = Math.abs(p.x - obsX);

            // Magnet increases collection range
            const collectionRange = (g.hasMagnet && (obs.type === 'FISH' || obs.type === 'FLAG' || obs.type === 'BLUE_FLAG' || obs.type === 'JUMPING_FISH' || obs.type === 'RAINBOW_FLAG' || obs.type === 'WARP_FLAG')) ? 400 : 60;

            if (dist < collectionRange || (obs.type === 'SHOP_STATION' && dist < 120)) {
              if (obs.type === 'FISH' || obs.type === 'FLAG' || obs.type === 'BLUE_FLAG' || obs.type === 'JUMPING_FISH' || obs.type === 'RAINBOW_FLAG' || obs.type === 'SHOP_STATION' || obs.type === 'WARP_FLAG') {
                const itemY = (obs.type === 'JUMPING_FISH') ? (obs.fishY || 0) : 0;
                // Items should only be collectible if the penguin's height roughly matches the item's height
                // Significant tolerance for the shop station to allow entry while flying
                const heightTolerance = obs.type === 'SHOP_STATION' ? 500 : 40;
                if (Math.abs(p.y - itemY) < heightTolerance) {
                  if (g.fireTime > 0 && (obs.type === 'FISH' || obs.type === 'JUMPING_FISH')) {
                    obs.onFire = true;
                  }
                  obs.collected = true;
                  if (obs.type === 'BLUE_FLAG') {
                    g.propellerTime = g.hasBigPropeller ? 6 : 3;
                    g.hasBigPropeller = false; // Used once
                    g.score += 3000;
                    sounds.powerup();
                  } else if (obs.type === 'SHOP_STATION') {
                    g.enteredShopLevel = g.level;
                    setGameState('SHOP');
                  } else if (obs.type === 'RAINBOW_FLAG') {
                    g.time += 5;
                    g.score += 5000;
                    setTime(g.time);
                    sounds.powerup();
                  } else if (obs.type === 'WARP_FLAG') {
                    // Hidden bonus room: 8 seconds of gold-fish frenzy
                    g.bonusRoomTime = 8;
                    g.bonusRoomFlash = 1;
                    g.score += 5000;
                    sounds.powerup();
                    confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } });
                    unlockAchievement('warp-master');
                  } else {
                    let points = 0;
                    let isComboItem = false; // FISH and FLAG count toward combo
                    if (obs.type === 'FISH' || obs.type === 'JUMPING_FISH') {
                      if (obs.color === '#32CD32') points = 1500;
                      else if (obs.color === '#FFD700') points = 1000;
                      else points = 500;
                      if (g.hasTripleFish) points *= 3;
                      if (g.hasTwinPenguins) points *= 2;
                      // 6-6 seasonal fish bonus (Christmas/LNY/Summer)
                      if (isEventActive(seasonalEvent) && seasonalEvent.fishBonus !== 1) {
                        points = Math.round(points * seasonalEvent.fishBonus);
                      }
                      fishCollectedRef.current += 1;
                      isComboItem = true;
                      sounds.fish();
                    } else if (obs.type === 'FLAG') {
                      if (obs.color === '#FFA500') {
                        points = 2400;
                        g.time += 1;
                        setTime(g.time);
                        sounds.flag();
                      } else if (obs.color === '#FFFF00') {
                        points = 1800;
                        g.turboTime = 0.5;
                        sounds.powerup();
                      } else {
                        points = 1500;
                        g.fireTime = 4; // 4 seconds of fire/invincibility
                        sounds.flag();
                      }
                      isComboItem = true;
                    }
                    if (g.hasKingCrown) points *= 3;
                    // Daily challenge score multiplier
                    if (dailyModeRef.current) {
                      points = Math.round(points * getDailyChallenge().scoreMultiplier);
                    }
                    // Combo: increment streak and apply multiplier
                    if (isComboItem) {
                      const prev = comboCountRef.current;
                      const next = prev + 1;
                      comboCountRef.current = next;
                      maxComboRef.current = Math.max(maxComboRef.current, next);
                      points = Math.round(points * comboMultiplier(next));
                      const tier = justEnteredNewTier(prev, next);
                      if (tier) {
                        setComboFlash(tier);
                        setTimeout(() => setComboFlash(null), 1200);
                      }
                      if (next >= 30) unlockAchievement('combo-master');
                      setComboCount(next);
                    }
                    g.score += points;
                  }
                  setScore(g.score);
                }
              }
            }
          }

          // 5.2 Check for Obstacle Collision (Hole, Crack, Seal, and JUMPING_FISH's Hole)
          const holeX = obs.lane * 150;
          const holeDist = Math.abs(p.x - holeX);

          // ICEBERG: ~1.5 lane wide. Cannot dodge by lane-switching, must jump.
          // Invincibility powerups still let you crash through it (it's a big chunk of ice).
          if (obs.type === 'ICEBERG' && !obs.collected) {
            const icebergHalfWidth = 110; // Wider than a single lane (75)
            if (Math.abs(p.x - obs.lane * 150) < icebergHalfWidth) {
              const isJumpingOver = p.y < -30;
              if (isJumpingOver) {
                if (!obs.collected) {
                  obs.collected = true;
                  g.score += 1500;
                  setScore(g.score);
                }
              } else {
                if (g.fireTime > 0 || g.nitroTime > 0 || g.isGodMode) {
                  obs.onFire = true;
                  obs.collected = true;
                  g.score += 4000;
                  setScore(g.score);
                } else if (g.hasShield) {
                  g.hasShield = false;
                  obs.collected = true;
                } else if (p.stumbleTime <= 0) {
                  // Hard impact: heavier than a seal, knocks back speed to floor
                  p.stumbleTime = 1.4;
                  p.stumbleSide = p.x > obs.lane * 150 ? 1 : -1;
                  g.speed = 20;
                  g.hasSkateboard = false;
                  setSpeed(g.speed);
                  sounds.hit();
                  obs.collected = true; // Single-hit; bounce off
                  if (comboCountRef.current > 0) { comboCountRef.current = 0; setComboCount(0); }
                }
              }
              return;
            }
          }

          // POLAR_BEAR: tracks player; uses dynamic laneOffset rather than static lane
          if (obs.type === 'POLAR_BEAR' && !obs.collected) {
            const bearX = (obs.lane + (obs.laneOffset ?? 0)) * 150;
            const bearDist = Math.abs(p.x - bearX);
            if (bearDist < 70) {
              const isJumpingOver = p.y < -30;
              if (isJumpingOver) return; // Player can leap over the bear
              if (g.fireTime > 0 || g.nitroTime > 0 || g.isGodMode) {
                obs.onFire = true;
                obs.collected = true;
                g.score += 6000;
                setScore(g.score);
                return;
              }
              if (g.hasShield) {
                g.hasShield = false;
                obs.collected = true;
                return;
              }
              if (p.stumbleTime <= 0) {
                // Polar bear is brutal: -2 lives if available, else immediate game over
                if (g.lives >= 2) {
                  g.lives -= 2;
                  setLives(g.lives);
                } else if (g.lives === 1) {
                  g.lives = 0;
                  setLives(0);
                  // Also halve remaining time as a kicker
                  g.time = Math.max(5, g.time / 2);
                  setTime(g.time);
                } else {
                  // No lives → time penalty + heavy stumble
                  g.time = Math.max(0, g.time - 15);
                  setTime(g.time);
                }
                p.stumbleTime = 1.6;
                p.stumbleSide = p.x > bearX ? 1 : -1;
                g.speed = 15;
                g.hasSkateboard = false;
                setSpeed(g.speed);
                sounds.hit();
                obs.collected = true;
                if (comboCountRef.current > 0) { comboCountRef.current = 0; setComboCount(0); }
              }
            }
            return;
          }

          if (holeDist < 60) {
            if (obs.type === 'HOLE' || obs.type === 'CRACK' || obs.type === 'SEAL' || obs.type === 'JUMPING_FISH' || obs.type === 'SNOWDRIFT' || obs.type === 'ICE_PATCH' || obs.type === 'SNOWBALL') {
              const isJumpingOver = p.y < -30;
              
              // If Penguin is on Fire/Nitro/Shielded or in God Mode, skip collision
              if (g.fireTime > 0 || g.nitroTime > 0 || g.hasShield || g.isGodMode) {
                if (g.hasShield && g.fireTime <= 0 && g.nitroTime <= 0 && !g.isGodMode) {
                  g.hasShield = false; // Absorb hit
                }
                if (obs.type === 'SEAL' && !obs.collected) {
                  obs.onFire = true;
                  if (g.fireTime > 0 || g.nitroTime > 0 || g.isGodMode) {
                    obs.collected = true;
                    g.score += 3000;
                    setScore(g.score);
                  }
                }
                if (obs.type !== 'ICE_PATCH') return; // Ice still affects even if invincible? No, let's make it consistent.
                if (g.isGodMode) return; // In God Mode, even ice doesn't affect traction if we want "absolute" invincibility.
                return;
              }

              // ICE_PATCH: Low traction
              if (obs.type === 'ICE_PATCH' && !isJumpingOver) {
                g.traction = 0.2; // Very slippery
                return;
              }

              // SNOWDRIFT: Heavy slow
              if (obs.type === 'SNOWDRIFT' && !isJumpingOver) {
                if (p.stumbleTime <= 0) {
                  p.stumbleTime = 0.5; // Shorter stumble but heavy speed loss
                  p.stumbleSide = 0; // No side force
                  g.speed = Math.max(10, g.speed * 0.3);
                  setSpeed(g.speed);
                  sounds.hit();
                  if (comboCountRef.current > 0) { comboCountRef.current = 0; setComboCount(0); }
                }
                return;
              }

              // Heavy Boots for Cracks
              if (obs.type === 'CRACK' && g.hasHeavyBoots) {
                 g.speed = Math.max(20, g.speed * 0.85); // Resistant
                 setSpeed(g.speed);
                 return;
              }

              if (p.stumbleTime <= 0 && !isJumpingOver) {
                // Time-rewind charge absorbs the entire stumble (combo stays!)
                if (g.rewindCharges > 0) {
                  g.rewindCharges -= 1;
                  sounds.powerup();
                  return;
                }
                p.stumbleTime = 1.0;
                p.stumbleSide = p.x > holeX ? 1 : -1;
                g.speed = Math.max(20, g.speed * 0.3);
                g.hasSkateboard = false; // Skateboards break on stumble!
                setSpeed(g.speed);
                sounds.hit();
                if (comboCountRef.current > 0) { comboCountRef.current = 0; setComboCount(0); }
              }
            }
          }
        }
      });

      draw();
      frameId.current = requestAnimationFrame(update);
    };

    const draw = () => {
      const g = gameRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Environment (sky, sun, clouds, aurora, mountains, ground, road, sea, lines, goal)
      drawEnvironment(ctx, g, {
        clouds: clouds.current,
        auroras: auroraBorealis.current,
        mountains: backgroundMountains.current,
      });

      // Obstacles (8 types + JUMPING_FISH mover) — see src/render/drawObstacles.ts
      drawObstacles(ctx, obstaclesRef.current, g);


      // Penguin (body / wings / feet / skin / propeller / fire) — see src/render/drawPenguin.ts
      const p = playerRef.current;
      drawPenguin(ctx, p, {
        curveSegments: g.curveSegments,
        segmentOffset: g.segmentOffset,
        cumulativeOffsets: g.cumulativeOffsets,
        hasSkateboard: g.hasSkateboard,
        propellerTime: g.propellerTime,
        fireTime: g.fireTime,
      }, skinRef.current);


      // Weather overlay (BLIZZARD/WIND/NIGHT/FOG) — drawn LAST. See src/render/drawWeather.ts
      drawWeather(ctx, g);
    };

    update();
    return () => cancelAnimationFrame(frameId.current);
  }, [gameState, unlockAchievement, seasonalEvent]);

  return (
    <div 
      ref={containerRef}
      className={`relative min-h-[100dvh] w-full bg-[#1a1a1a] flex flex-col items-center justify-start sm:justify-center font-sans text-white p-2 sm:p-4 transition-all duration-300 ${isFullscreen ? 'p-0' : 'pt-10 sm:pt-4'}`}
    >
      {/* Fullscreen & Mobile Opt Toggle Button */}
      <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-3">
        {isFullscreen && isPortrait && (
          <button
            onClick={() => setMobileOpt(!mobileOpt)}
            className={`p-4 rounded-full border-2 transition-all active:scale-90 group backdrop-blur-md shadow-lg ${
              mobileOpt ? 'bg-blue-600 border-blue-400' : 'bg-white/20 border-white/40'
            }`}
            title="直屏最佳化 (旋轉遊戲)"
          >
            <Smartphone className={`w-6 h-6 text-white transition-transform ${mobileOpt ? 'rotate-90' : ''}`} />
          </button>
        )}
        <button
          onClick={() => { initAudio(); toggleFullscreen(); }}
          onPointerDown={initAudio}
          className="bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] p-4 rounded-full border-2 border-white/30 transition-all active:scale-90 group"
          title={isFullscreen ? '退出全螢幕' : '進入全螢幕'}
        >
          {isFullscreen ? (
            <Minimize className="w-6 h-6 text-white" />
          ) : (
            <Maximize className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      {/* Scaling Wrapper */}
      <div className={`flex flex-col items-center transition-all duration-500 overflow-hidden ${
        isFullscreen 
          ? (isPortrait && mobileOpt ? 'w-[100vh] h-[100vw] rotate-90 fixed inset-0 m-auto z-[999] justify-center' : 'w-screen h-screen fixed inset-0 z-[999] bg-[#1a1a1a] justify-center') 
          : 'w-full max-w-[min(95vw,calc((100dvh-180px)*1.4))] flex-1 justify-start pt-0'
      }`}>
        <div className={`w-full flex flex-col ${isFullscreen ? 'h-full' : 'flex-1 h-full'}`}>
          {/* HUD — only shown during gameplay so START / GAME_OVER / LEVEL_CLEAR overlays can use full height */}
          {gameState === 'PLAYING' && (
          <div className={`w-full mb-0.5 sm:mb-2 grid gap-1 sm:gap-3 flex-shrink-0 transition-all duration-300 h-auto z-10 px-1 sm:px-0 mt-1 ${
            isFullscreen && isPortrait && !mobileOpt
              ? 'grid-cols-3 text-[10px]'
              : 'grid-cols-3 md:grid-cols-6'
          }`}>
            {/* Cell 1: Score */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/20 flex flex-col justify-center items-center text-center">
              <Trophy className="text-yellow-400 w-4 h-4 sm:w-5 h-5 mb-0.5" />
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] uppercase tracking-wider opacity-60">得分</p>
                <p className="text-sm sm:text-xl font-pixel font-bold text-white leading-tight">{Math.floor(score)}</p>
              </div>
            </div>
            {/* Cell 2: Lives */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/20 flex flex-col justify-center items-center text-center">
              <p className="text-[8px] sm:text-[10px] uppercase tracking-wider opacity-60">數量</p>
              <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                {Array.from({ length: lives + 1 }).map((_, i) => (
                  <span key={i} className="text-xs sm:text-lg">🐧</span>
                ))}
              </div>
            </div>
            {/* Cell 3: Level */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/20 flex flex-col justify-center items-center text-center">
              <MapPin className="text-purple-400 w-4 h-4 sm:w-5 h-5 mb-0.5" />
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] uppercase tracking-wider opacity-60">關卡</p>
                <p className="text-sm sm:text-xl font-pixel font-bold text-white leading-tight">{level}</p>
              </div>
            </div>
            {/* Cell 4: Time (countdown) or Elapsed (Time Attack) */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/20 flex flex-col justify-center items-center text-center">
              <Timer className={`w-4 h-4 sm:w-5 h-5 mb-0.5 ${timeAttackMode ? 'text-pink-400' : 'text-blue-400'}`} />
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] uppercase tracking-wider opacity-60">{timeAttackMode ? '計時' : '時間'}</p>
                {timeAttackMode ? (
                  <p className="text-sm sm:text-xl font-pixel font-bold text-pink-200 leading-tight tabular-nums">
                    {elapsedSeconds.toFixed(1)}s
                  </p>
                ) : (
                  <p className={`text-sm sm:text-xl font-pixel font-bold text-white leading-tight ${time < 20 ? 'text-red-400 animate-pulse' : ''}`}>
                    {Math.max(0, Math.floor(time))} 秒
                  </p>
                )}
              </div>
            </div>
            {/* Cell 5: Distance */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/20 flex flex-col justify-center items-center text-center">
              <MapPin className="text-green-400 w-4 h-4 sm:w-5 h-5 mb-0.5" />
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] uppercase tracking-wider opacity-60">距離</p>
                <p className="text-sm sm:text-xl font-pixel font-bold text-white leading-tight">{Math.max(0, Math.floor(distance))} 公尺</p>
              </div>
            </div>
            {/* Cell 6: Speed */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/20 flex items-center justify-center h-auto">
              <div className="flex flex-col items-center w-full">
                <p className="text-[8px] sm:text-[10px] uppercase tracking-wider opacity-60">時速</p>
                <div className="flex gap-0.5 h-2 sm:h-4 w-full justify-center mt-1">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div 
                      key={i}
                      className={`flex-1 rounded-sm transition-colors duration-200 ${
                        i < (speed / MAX_SPEED) * 15 
                          ? i > 10 ? 'bg-red-500' : i > 5 ? 'bg-yellow-400' : 'bg-green-400'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Game Canvas Container */}
          <div className={`relative flex-1 rounded-none sm:rounded-2xl overflow-hidden shadow-2xl border-x-0 sm:border-4 border-white/10 bg-black ${!isFullscreen ? 'mb-0' : ''}`}>
            {/* Top-right control cluster */}
            <div className="absolute top-4 right-4 z-50 flex gap-2">
              {gameState === 'PLAYING' && (
                <button
                  onClick={() => setPaused(p => !p)}
                  className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/20 transition-all active:scale-90"
                  title={paused ? '繼續 (P)' : '暫停 (P)'}
                  aria-label={paused ? '繼續' : '暫停'}
                >
                  {paused ? <Play size={20} /> : <Pause size={20} />}
                </button>
              )}
              <button
                onClick={() => setMuted(m => !m)}
                className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/20 transition-all active:scale-90"
                title={muted ? '取消靜音' : '靜音'}
                aria-label={muted ? '取消靜音' : '靜音'}
              >
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/20 transition-all active:scale-90"
                title={isFullscreen ? '退出全螢幕' : '進入全螢幕'}
                aria-label={isFullscreen ? '退出全螢幕' : '進入全螢幕'}
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>

            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-full object-cover sm:object-contain bg-sky-200 touch-none"
              onPointerDown={(e) => {
                if (gameState !== 'PLAYING') return;
                const g = gameRef.current;
                g.isTouchAccelerating = true;
                g.touchDownTime = Date.now();
                g.touchStartX = e.clientX;
                g.touchStartY = e.clientY;
                g.touchSwiped = false;
                // Stay in current lane on touchdown — swipes will adjust it
                g.touchLane = playerRef.current.targetLane;
              }}
              onPointerMove={(e) => {
                if (gameState !== 'PLAYING') return;
                const g = gameRef.current;
                if (!g.isTouchAccelerating) return;
                if (g.touchSwiped) return; // One swipe per gesture

                const dx = e.clientX - g.touchStartX;
                const dy = e.clientY - g.touchStartY;
                const SWIPE_THRESHOLD_X = 40;
                const SWIPE_THRESHOLD_Y = 50;

                // Horizontal dominant → lane change
                if (Math.abs(dx) > SWIPE_THRESHOLD_X && Math.abs(dx) > Math.abs(dy)) {
                  if (dx > 0) {
                    playerRef.current.targetLane = Math.min(1, playerRef.current.targetLane + 1);
                  } else {
                    playerRef.current.targetLane = Math.max(-1, playerRef.current.targetLane - 1);
                  }
                  g.touchSwiped = true;
                  g.touchLane = playerRef.current.targetLane;
                }
                // Vertical up swipe → jump
                else if (dy < -SWIPE_THRESHOLD_Y) {
                  if (!playerRef.current.isJumping) {
                    playerRef.current.isJumping = true;
                    playerRef.current.vy = JUMP_FORCE;
                    sounds.jump();
                  }
                  g.touchSwiped = true;
                }
              }}
              onPointerUp={() => {
                if (gameState !== 'PLAYING') return;
                const g = gameRef.current;
                g.isTouchAccelerating = false;
                const duration = Date.now() - g.touchDownTime;
                // Tap (no swipe + short hold) → jump or double-tap to activate big propeller
                if (!g.touchSwiped && duration < 250) {
                  const now = Date.now();
                  if (now - g.lastTapTime < 300) {
                    if (g.hasBigPropeller) {
                      g.propellerTime = 6;
                      g.hasBigPropeller = false;
                      sounds.powerup();
                    }
                    g.lastTapTime = 0;
                  } else {
                    if (!playerRef.current.isJumping) {
                      playerRef.current.isJumping = true;
                      playerRef.current.vy = JUMP_FORCE;
                      sounds.jump();
                    }
                    g.lastTapTime = now;
                  }
                }
              }}
              onPointerLeave={() => {
                if (gameRef.current) {
                  gameRef.current.isTouchAccelerating = false;
                  gameRef.current.touchSwiped = false;
                }
              }}
              onPointerCancel={() => {
                if (gameRef.current) {
                  gameRef.current.isTouchAccelerating = false;
                  gameRef.current.touchSwiped = false;
                }
              }}
            />

            {/* Onboarding hints — first-time PLAYING tutorial (lazy) */}
            <Suspense fallback={null}>
              <OnboardingHints active={gameState === 'PLAYING' && !paused} />
            </Suspense>

            {/* Combo HUD — floating at top-center, only visible during play & combo > 0 */}
            {gameState === 'PLAYING' && comboCount >= 2 && (() => {
              const tier = getComboTier(comboCount);
              return (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none"
                >
                  <div className={`flex items-baseline gap-2 px-4 py-2 bg-black/60 backdrop-blur-md border-2 rounded-full ${tier.color || 'text-white border-white/30'}`}>
                    <span className="text-xs uppercase tracking-widest opacity-70">Combo</span>
                    <span className="text-2xl sm:text-3xl font-pixel font-black tabular-nums">×{comboCount}</span>
                    {tier.multiplier > 1 && (
                      <span className="text-sm font-bold opacity-80">{tier.multiplier}x 分數</span>
                    )}
                  </div>
                </motion.div>
              );
            })()}

            {/* Combo tier-up flash */}
            <AnimatePresence>
              {comboFlash && (
                <motion.div
                  key={comboFlash.label}
                  initial={reducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0, y: 0 }}
                  animate={reducedMotion ? { opacity: 1 } : { scale: [1.4, 1, 1], opacity: [0, 1, 1], y: [0, 0, -40] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.2 : 1.2 }}
                  className={`absolute top-32 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none font-black text-4xl sm:text-6xl tracking-tighter italic ${comboFlash.color}`}
                  style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}
                >
                  {comboFlash.label}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Overlays */}
            <AnimatePresence>
              {gameState === 'SHOP' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#050510] flex flex-col items-center justify-center z-50 font-mono overflow-y-auto"
                >
                  {/* Neon Frame */}
                  <div className={`w-full max-w-4xl bg-[#121225] border-4 border-[#3a3a5a] rounded-sm p-2 shadow-[0_0_50px_rgba(0,0,100,0.5)] flex flex-col gap-2 ${
                    isPortrait && !mobileOpt ? 'h-full' : 'overflow-hidden'
                  }`}>
                    
                    {/* Header Row */}
                    <div className="flex justify-between items-center bg-[#1a1a3a] border-2 border-[#3a3a5a] p-2 flex-shrink-0">
                      <h2 className="text-sm sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent uppercase tracking-wider italic">南極補給站</h2>
                      <div className="flex items-center gap-2 sm:gap-6">
                        <div className="text-right">
                          <p className="text-[8px] text-blue-300 opacity-60">持有點數</p>
                          <p className="text-sm sm:text-2xl text-yellow-400 font-bold bg-black/40 px-2 sm:px-4 py-1 border border-blue-500/30 rounded-sm leading-none tabular-nums">
                            {score.toString().padStart(7, '0')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-red-300 opacity-60">剩餘生命</p>
                          <div className="flex items-center gap-1 sm:gap-2 bg-black/40 px-2 py-1 border border-red-500/30 rounded-sm">
                            <p className="text-sm sm:text-2xl text-red-400 font-bold leading-none tabular-nums">
                              {lives}
                            </p>
                            {gameRef.current.pendingShopItems.filter(id => id === 'life').length > 0 && (
                              <p className="text-[10px] sm:text-sm text-green-400 font-bold leading-none">
                                +{gameRef.current.pendingShopItems.filter(id => id === 'life').length}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Main Shop View */}
                    <div className={`flex gap-2 transition-all duration-300 min-h-0 flex-1 ${
                      isPortrait && !mobileOpt ? 'flex-col overflow-y-auto' : ''
                    }`}>
                      
                      {/* Left Side: Item Grid (5×4 = 20 slots, fits 19 items + 1 placeholder) */}
                      <div className={`grid gap-1 p-1 bg-[#1a1a3a] border-2 border-[#3a3a5a] flex-shrink-0 ${
                        isPortrait && !mobileOpt ? 'grid-cols-4 h-[300px]' : 'flex-1 grid-cols-4 grid-rows-5'
                      }`}>
                        {(() => {
                          const itemsForLevel = gameRef.current.isGodMode ? ALL_SHOP_ITEMS : ALL_SHOP_ITEMS.slice(0, Math.min(ALL_SHOP_ITEMS.length, 4 + level));
                          const placeholders = Array(Math.max(0, 20 - itemsForLevel.length)).fill(null).map((_, i) => ({
                            id: `null-${i}`, 
                            name: '無物體', 
                            icon: <span className="text-4xl opacity-20">?</span>, 
                            desc: '正在掃描區域...\n\n插槽空缺。\n此位置未偵測到任何可用技術。', 
                            price: 0, 
                            onBuy: () => {} 
                          }));

                          return [...itemsForLevel, ...placeholders].map((item, idx) => (
                            <motion.button
                              key={item.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: idx * 0.03 }}
                              onClick={() => {
                                if (item.name !== '無物體') {
                                  setSelectedShopItem(item.id);
                                }
                              }}
                              className={`relative flex items-center justify-center border-2 transition-all p-1 group overflow-hidden ${
                                selectedShopItem === item.id 
                                  ? 'border-blue-400 bg-blue-900/30 shadow-[0_0_10px_rgba(0,150,255,0.5)]' 
                                  : 'border-[#3a3a5a] bg-[#0a0a1a] hover:border-blue-500/50'
                              } ${item.name === '無物體' ? 'cursor-default' : 'active:scale-95'}`}
                            >
                              {/* Inner Grid Texture */}
                              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[size:10px_10px]" />
                              <div className="relative z-10 flex flex-col items-center">
                                <div className="scale-75 sm:scale-100">
                                  {item.icon}
                                </div>
                                {item.name !== '無物體' && (
                                  <p className="text-[10px] sm:text-xs mt-0.5 text-yellow-400 font-bold tracking-tighter tabular-nums leading-none">
                                    {item.price}
                                  </p>
                                )}
                              </div>
                              
                              {/* Mechanical Shutter Overlay */}
                              <motion.div
                                initial={{ y: 0, zIndex: 20 }}
                                animate={{ y: "100%", zIndex: 0 }}
                                transition={{ 
                                  y: { delay: idx * 0.1, duration: 1.0, ease: [0.4, 0, 0.2, 1] },
                                  zIndex: { delay: idx * 0.1 + 1.0, duration: 0 } 
                                }}
                                className="absolute inset-0 bg-[#2a2a2a] flex flex-col border-b border-white/10 pointer-events-none"
                              >
                                <div className="w-full h-1/2 bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] border-b border-white/5 flex items-end justify-center pb-2">
                                  <div className="w-12 h-1 bg-white/20 rounded-full mb-1"></div>
                                </div>
                                <div className="w-full h-1/2 bg-gradient-to-t from-[#3a3a3a] to-[#2a2a2a] border-t border-white/5 flex items-start justify-center pt-2">
                                  <div className="w-12 h-1 bg-white/20 rounded-full mt-1"></div>
                                </div>
                              </motion.div>

                              {/* Selection corners */}
                              {selectedShopItem === item.id && (
                                <>
                                  <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-yellow-400" />
                                  <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-yellow-400" />
                                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-yellow-400" />
                                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-yellow-400" />
                                </>
                              )}
                            </motion.button>
                          ));
                        })()}
                      </div>

                      {/* Right Side: Portrait and Dialogue */}
                      <div className={`flex flex-col gap-1 flex-shrink-0 ${
                        isPortrait && !mobileOpt ? 'w-full flex-1 min-h-0' : 'w-1/3'
                      }`}>
                        {/* Merchant Portrait */}
                        <div className={isPortrait && !mobileOpt ? 'hidden' : ''}>
                          <MerchantPortrait />
                        </div>
                        
                        {/* Dialogue Box */}
                        <div className="flex-1 bg-black border-2 border-[#3a3a5a] p-2 text-[#ff9900] text-[10px] sm:text-xs leading-tight overflow-y-auto flex flex-col shadow-[inset_0_0_20px_rgba(255,100,0,0.1)]">
                          <motion.div
                            key={selectedShopItem}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="whitespace-pre-line"
                          >
                            {(() => {
                              const item = getShopItem(selectedShopItem);
                              if (item) {
                                return `${item.name}\n售價：${item.price} 點\n\n${item.desc}`;
                              }
                              return "歡迎來到南極補給站。\n\n點擊物品並按下 [確認購買] 來強化你的企鵝。";
                            })()}
                          </motion.div>
                          <div className="mt-auto pt-2 border-t border-red-900/50 flex justify-between items-center italic text-[9px] opacity-60">
                            <span>通訊鏈路：正常</span>
                            <span className="flex gap-1">
                              <span className="w-1 h-1 bg-green-500 rounded-full animate-ping" />
                              收訊：強
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Controls */}
                    <div className="flex gap-2 h-14">
                      <button
                        onClick={() => setGameState('PLAYING')}
                        className="w-1/4 bg-[#3a1a1a] border-2 border-red-900/50 hover:bg-red-900/40 text-red-500 font-bold transition-all active:scale-95 flex items-center justify-center gap-2 uppercase italic tracking-widest text-sm"
                      >
                        <RotateCcw size={16} />
                        中止 / 離開
                      </button>
                      {(() => {
                        const currentItem = getShopItem(selectedShopItem);
                        const canAfford = currentItem && score >= currentItem.price;
                        const isSelectable = selectedShopItem && !selectedShopItem.includes('null');

                        return (
                          <button
                            id="shop-buy-btn"
                            onClick={() => {
                              if (canAfford) {
                                gameRef.current.score -= currentItem.price;
                                setScore(gameRef.current.score);
                                shopPurchasesRef.current += 1;
                                
                                // Direct immediate items
                                if (currentItem.id === 'life') {
                                  gameRef.current.lives += 1;
                                  setLives(gameRef.current.lives);
                                } else if (currentItem.id === 'timer') {
                                  gameRef.current.time += 10;
                                  setTime(gameRef.current.time);
                                } else if (currentItem.id === 'timer2') {
                                  gameRef.current.time += 30;
                                  setTime(gameRef.current.time);
                                } else if (currentItem.id === 'compass') {
                                  gameRef.current.distance = Math.max(0, gameRef.current.distance - 1000);
                                  setDistance(gameRef.current.distance);
                                } else if (currentItem.id === 'warp_door') {
                                  gameRef.current.distance = Math.max(0, gameRef.current.distance - 500);
                                  setDistance(gameRef.current.distance);
                                } else {
                                  // Buffering into pendingShopItems - will take effect next level
                                  gameRef.current.pendingShopItems.push(currentItem.id);
                                }
                                
                                sounds.fish();
                                confetti({ particleCount: 50, spread: 70, origin: { x: 0.5, y: 0.6 } });
                              }
                            }}
                            disabled={!isSelectable || !canAfford}
                            className={`flex-1 font-bold text-lg uppercase transition-all tracking-widest italic flex items-center justify-center gap-3 border-2 ${
                              isSelectable && canAfford
                                ? 'bg-blue-600 border-blue-400 text-white hover:bg-blue-500 active:scale-[0.98]' 
                                : 'bg-black border-[#3a3a5a] text-[#3a3a5a] cursor-not-allowed'
                            }`}
                          >
                            <ShoppingCart size={20} />
                            確認購買
                          </button>
                        );
                      })()}
                    </div>

                  </div>

                  {/* Retro CRT Overlay */}
                  <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-40" />
                </motion.div>
              )}

              {gameState === 'START' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-start sm:justify-center text-center p-4 sm:p-8 overflow-y-auto z-[200]"
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-full max-w-2xl py-8"
              >
                <h1 className="text-4xl sm:text-6xl font-black mb-2 tracking-tighter italic text-white shadow-sm">
                  南極大冒險
                </h1>
                <p className="text-blue-300 font-medium mb-2 uppercase tracking-[0.3em] text-[10px] sm:text-sm px-2">企鵝跑酷經典重製</p>
                {bestScore > 0 && (
                  <p className="mb-4 sm:mb-6 text-yellow-300/80 text-xs sm:text-sm flex items-center justify-center gap-2">
                    <Trophy size={14} className="text-yellow-400" />
                    <span className="opacity-70">歷史最高分</span>
                    <span className="font-pixel font-bold tracking-wider">{bestScore.toLocaleString()}</span>
                  </p>
                )}
                
                <div className={`relative mb-8 sm:mb-12 h-[200px] sm:h-[300px] overflow-hidden ${isPortrait && !isFullscreen ? 'px-4' : ''}`}>
                  <AnimatePresence mode="wait">
                    {!showScroll ? (
                      <motion.div 
                        key="static"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`grid gap-4 sm:gap-8 text-left h-full ${isPortrait && !isFullscreen ? 'grid-cols-1' : 'grid-cols-2'}`}
                      >
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-bold opacity-40 uppercase mb-2">操作說明</p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs sm:text-sm">
                                <div className="p-1 bg-white/20 rounded"><ChevronLeft size={14}/></div>
                                <div className="p-1 bg-white/20 rounded"><ChevronRight size={14}/></div>
                                <span>長按畫左右側切換車道</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs sm:text-sm">
                                <div className="p-1 bg-white/20 rounded"><Smartphone size={14}/></div>
                                <span>長按加速 / 輕點跳躍</span>
                              </div>
                            </div>
                          </div>
                          {!(isPortrait && !isFullscreen) && (
                            <div>
                              <p className="text-xs font-bold opacity-40 uppercase mb-2">冒險道具</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <span>🐟</span> <span>獲取積分獎勵</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>🚩</span> <span>火焰衝刺 (無敵)</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-bold opacity-40 uppercase mb-2">危險警示</p>
                            <div className="space-y-1 text-xs sm:text-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 flex items-center justify-center bg-red-500/30 rounded text-xs">🦭</span>
                                <span>海豹：撞擊跌倒</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 flex items-center justify-center bg-gray-500/30 rounded text-xs">🕳️</span>
                                <span>冰裂縫：大減速</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-bold opacity-40 uppercase mb-2">遊戲目標</p>
                            <ul className="text-xs sm:text-sm space-y-1">
                              <li className="flex items-center gap-2">🏁 抵達石門國小</li>
                              <li className="flex items-center gap-2">⏱️ 在時間結束前完成</li>
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="scroll"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full relative overflow-hidden"
                      >
                        {/*
                          Marquee: render scrollGroups TWICE so the loop is seamless.
                          Animating y from 0% → -50% scrolls past exactly one copy;
                          when it loops back to 0% the second copy is positioned
                          identically to where the first started — no visual jump.
                          (Previous version animated 100% → -100% which left ~30 s
                          of blank screen at the start of every cycle.)
                        */}
                        <motion.div
                          animate={reducedMotion ? undefined : { y: ['0%', '-50%'] }}
                          transition={{ duration: 50, ease: 'linear', repeat: Infinity }}
                          className="space-y-12 py-2"
                        >
                          {[0, 1].flatMap(copyIdx => SCROLL_GROUPS.map((group, gIdx) => (
                            <div key={`${copyIdx}-${gIdx}`} className="space-y-6">
                              <h3 className="text-blue-400 font-bold border-b border-blue-400/30 pb-2 text-center uppercase tracking-widest">{group.section}</h3>
                              <div className="space-y-4">
                                {group.items.map((item, iIdx) => (
                                  <div key={iIdx} className="text-center sm:text-left sm:flex gap-4">
                                    <span className="text-yellow-400 font-bold whitespace-nowrap block sm:inline">【{item.name}】</span>
                                    <span className="text-white/80 text-xs sm:text-sm">{item.desc}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )))}
                        </motion.div>
                        {/* Gradient Fades for Scrolling */}
                        <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-[#000] to-transparent z-10" />
                        <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#000] to-transparent z-10" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Daily Challenge Banner */}
                <div className={`mb-4 mx-auto max-w-md px-4 py-3 rounded-2xl border-2 transition-all ${
                  dailyMode
                    ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-pink-400'
                    : 'bg-white/5 border-white/20 hover:border-white/40'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{dailyConfig.emoji}</span>
                      <div className="text-left">
                        <p className="text-[10px] uppercase tracking-widest opacity-70">今日挑戰</p>
                        <p className="font-bold text-sm sm:text-base">{dailyConfig.name}</p>
                        <p className="text-[10px] opacity-60 leading-tight">{dailyConfig.description}</p>
                        {dailyRecord.attempts > 0 && (
                          <p className="text-[10px] mt-1 text-yellow-300">
                            今日已挑戰 {dailyRecord.attempts} 次 · 最高 {dailyRecord.bestScore.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      data-testid="daily-toggle"
                      onClick={() => setDailyMode(m => !m)}
                      className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        dailyMode
                          ? 'bg-pink-500 hover:bg-pink-400 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-white border border-white/30'
                      }`}
                    >
                      {dailyMode ? '✓ 已啟用' : '啟用'}
                    </button>
                  </div>
                </div>

                {/* 6-6 Seasonal banner — auto-shown when an event is active */}
                {isEventActive(seasonalEvent) && (
                  <div className={`mb-3 mx-auto max-w-md px-4 py-2 rounded-2xl border-2 bg-gradient-to-r ${seasonalEvent.bannerColor}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{seasonalEvent.emoji}</span>
                      <div className="text-left flex-1">
                        <p className="font-bold text-sm">{seasonalEvent.name}</p>
                        <p className="text-[10px] opacity-70 leading-tight">{seasonalEvent.description}</p>
                      </div>
                      <span className="text-[10px] opacity-50 px-2 py-1 bg-black/30 rounded">活動中</span>
                    </div>
                  </div>
                )}

                {/* Time Attack toggle */}
                <div className={`mb-3 mx-auto max-w-md px-4 py-2 rounded-2xl border-2 transition-all ${
                  timeAttackMode
                    ? 'bg-gradient-to-r from-pink-600/30 to-rose-600/30 border-pink-400'
                    : 'bg-white/5 border-white/15 hover:border-white/30'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚡</span>
                      <div className="text-left">
                        <p className="font-bold text-sm">時間競速模式</p>
                        <p className="text-[10px] opacity-60 leading-tight">無時限，計時跑完一關看誰最快</p>
                      </div>
                    </div>
                    <button
                      data-testid="time-attack-toggle"
                      onClick={() => setTimeAttackMode(m => !m)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        timeAttackMode
                          ? 'bg-pink-500 hover:bg-pink-400 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-white border border-white/30'
                      }`}
                    >
                      {timeAttackMode ? '✓ 已啟用' : '啟用'}
                    </button>
                  </div>
                </div>

                {/* Resumable save banner — only shown if a save exists */}
                {resumableSave && !dailyMode && (
                  <div className="mb-4 mx-auto max-w-md px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-2 border-amber-400/40">
                    <p className="text-[10px] uppercase tracking-widest text-amber-200/80 mb-1">上次未完成</p>
                    <p className="text-sm font-bold text-amber-100 mb-2">
                      L{resumableSave.level} · {resumableSave.score.toLocaleString()} 分 · 剩 {Math.floor(resumableSave.time)} 秒
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => initGame(false, resumableSave)}
                        className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold text-sm transition-all active:scale-95"
                      >
                        ▶ 繼續
                      </button>
                      <button
                        onClick={() => { clearSavedGame(); setResumableSave(null); }}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-all"
                        title="放棄繼續，從頭開始"
                      >
                        ✕ 放棄
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center flex-wrap">
                  <button
                    onClick={() => initGame(false)}
                    className={`group relative px-10 sm:px-12 py-3 sm:py-4 rounded-full font-bold text-lg sm:text-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3 ${
                      dailyMode
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500'
                        : 'bg-blue-500 hover:bg-blue-400'
                    }`}
                  >
                    <Play fill="currentColor" size={20} />
                    {dailyMode ? `挑戰 ${dailyConfig.name}` : '開始冒險'}
                  </button>

                  <button
                    onClick={() => setShowLeaderboard(true)}
                    className="px-6 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 rounded-full font-bold text-sm transition-all flex items-center gap-2"
                  >
                    <Trophy size={16} className="text-cyan-300" />
                    排行榜
                  </button>

                  <button
                    onClick={() => setShowAchievements(true)}
                    className="px-6 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/40 rounded-full font-bold text-sm transition-all flex items-center gap-2"
                  >
                    <Trophy size={16} className="text-yellow-300" />
                    成就 {achievementsUnlocked.size}/{allAchievements.length}
                  </button>

                  <button
                    onClick={() => setShowSkinPicker(true)}
                    className="px-6 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 rounded-full font-bold text-sm transition-all flex items-center gap-2"
                  >
                    <span>{getSkin(currentSkin).emoji}</span>
                    換造型
                  </button>

                  <Suspense fallback={null}>
                    <BgmPicker current={bgmTrack} onChange={setBgmTrack} />
                  </Suspense>

                  {!isFullscreen && isPortrait && (
                    <button
                      onClick={() => { initAudio(); toggleFullscreen(); }}
                      className="group relative px-10 py-3 bg-white/10 hover:bg-white/20 rounded-full font-bold text-sm transition-all flex items-center gap-2 border border-white/20"
                    >
                      <Maximize size={16} />
                      全螢幕遊玩
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'GAME_OVER' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-red-900/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-4"
            >
              <h2 className="text-5xl sm:text-7xl font-black mb-4 tracking-tighter">時間到！</h2>
              <p className="text-xl sm:text-2xl mb-6 opacity-80">企鵝凍僵了...</p>
              {isNewRecord && (
                <motion.p
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: [1, 1.1, 1], opacity: 1 }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="text-yellow-300 font-bold text-lg sm:text-2xl mb-4 tracking-widest"
                >
                  ✨ 新紀錄！NEW RECORD ✨
                </motion.p>
              )}
              <div className="flex gap-3 sm:gap-4 mb-8">
                <div className="bg-black/30 px-5 sm:px-6 py-4 rounded-2xl">
                  <p className="text-[10px] sm:text-sm uppercase opacity-60 mb-1">最終得分</p>
                  <p className="text-3xl sm:text-5xl font-pixel font-bold">{score}</p>
                </div>
                <div className="bg-black/30 px-5 sm:px-6 py-4 rounded-2xl border border-yellow-400/30">
                  <p className="text-[10px] sm:text-sm uppercase opacity-60 mb-1 flex items-center gap-1 justify-center">
                    <Trophy size={12} className="text-yellow-400" /> 最高分
                  </p>
                  <p className="text-3xl sm:text-5xl font-pixel font-bold text-yellow-300">{bestScore}</p>
                </div>
              </div>
              {/* Submit to leaderboard (lazy-loaded — Firebase chunk loads here) */}
              <Suspense fallback={<div className="h-[88px] mb-4" />}>
                <ScoreSubmitForm
                  score={score}
                  level={level}
                  playerName={playerName}
                  onPlayerNameChange={handlePlayerNameChange}
                />
              </Suspense>

              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  onClick={() => initGame(false)}
                  className="px-8 py-3 bg-white text-red-900 rounded-full font-bold text-lg hover:bg-red-50 transition-all flex items-center gap-2 active:scale-95"
                >
                  <RotateCcw size={18} />
                  再試一次
                </button>
                <button
                  onClick={handleShareScore}
                  disabled={shareState === 'generating'}
                  className="px-5 py-3 bg-pink-500/20 border border-pink-300/40 hover:bg-pink-500/30 text-white rounded-full font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Camera size={16} className="text-pink-200" />
                  {shareState === 'generating' ? '產生中…' :
                   shareState === 'shared' ? '✓ 已分享' :
                   shareState === 'downloaded' ? '✓ 已下載' :
                   shareState === 'error' ? '⚠ 失敗' : '分享'}
                </button>
                <button
                  onClick={() => setShowLeaderboard(true)}
                  className="px-5 py-3 bg-yellow-500/20 border border-yellow-300/40 hover:bg-yellow-500/30 text-white rounded-full font-bold text-sm transition-all flex items-center gap-2"
                >
                  <Trophy size={16} className="text-yellow-300" />
                  排行榜
                </button>
              </div>
            </motion.div>
          )}

          {/* Pause Overlay */}
          {gameState === 'PLAYING' && paused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center text-center z-[150]"
            >
              <Pause size={64} className="mb-4 text-white/80" />
              <h2 className="text-4xl sm:text-6xl font-black mb-3 tracking-tighter">暫停中</h2>
              <p className="text-sm sm:text-base opacity-60 mb-6">按 <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs">P</kbd> 或 <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs">Esc</kbd> 繼續</p>
              <button
                onClick={() => setPaused(false)}
                className="px-8 py-3 bg-blue-500 hover:bg-blue-400 rounded-full font-bold text-lg transition-all active:scale-95 flex items-center gap-2"
              >
                <Play size={18} fill="currentColor" />
                繼續遊戲
              </button>
            </motion.div>
          )}

          {gameState === 'LEVEL_CLEAR' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-green-900/80 backdrop-blur-md flex flex-col items-center justify-center text-center"
            >
              <h2 className="text-5xl sm:text-7xl font-black mb-4 tracking-tighter">
                {level >= 20 ? '⚔️ 擊敗企鵝王！' : '抵達終點！'}
              </h2>
              <p className="text-xl sm:text-2xl mb-8 opacity-80">
                {level >= 20 ? '👑 你成了新一代南極之王！' : '歡迎來到石門國小！'}
              </p>
              <div className="flex gap-4 mb-12">
                <div className="bg-black/20 p-6 rounded-2xl">
                  <p className="text-sm uppercase opacity-60 mb-1">得分</p>
                  <p className="text-4xl font-pixel font-bold">{score}</p>
                </div>
                {timeAttackMode ? (
                  <div className="bg-pink-500/20 border-2 border-pink-400/40 p-6 rounded-2xl">
                    <p className="text-sm uppercase opacity-70 mb-1 text-pink-200">⚡ 完成時間</p>
                    <p className="text-4xl font-pixel font-bold text-pink-100">{elapsedSeconds.toFixed(2)}s</p>
                  </div>
                ) : (
                  <div className="bg-black/20 p-6 rounded-2xl">
                    <p className="text-sm uppercase opacity-60 mb-1">時間獎勵</p>
                    <p className="text-4xl font-pixel font-bold">+{Math.floor(time * 10)}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 flex-wrap justify-center items-center">
              <button
                onClick={() => initGame(true)}
                className="px-10 py-4 bg-white text-green-900 rounded-full font-bold text-xl hover:bg-green-50 transition-all flex items-center gap-3"
              >
                <ChevronRight />
                下一關
              </button>
              <button
                onClick={handleShareScore}
                disabled={shareState === 'generating'}
                className="px-5 py-3 bg-pink-500/20 border border-pink-300/40 hover:bg-pink-500/30 text-white rounded-full font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Camera size={16} className="text-pink-200" />
                {shareState === 'generating' ? '產生中…' :
                 shareState === 'shared' ? '✓ 已分享' :
                 shareState === 'downloaded' ? '✓ 已下載' :
                 shareState === 'error' ? '⚠ 失敗' : '分享'}
              </button>
              </div>
            </motion.div>
          )}

          {/* Virtual Controls Overlay (Only during PLAYING on touch devices) */}
          {gameState === 'PLAYING' && !paused && (
            <div className="absolute inset-x-0 bottom-2 sm:bottom-6 z-40 flex items-end justify-between px-3 sm:px-6 pointer-events-none select-none md:hidden">
              <div className="flex gap-2 pointer-events-auto">
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    playerRef.current.targetLane = Math.max(-1, playerRef.current.targetLane - 1);
                  }}
                  className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-md rounded-full border border-white/30 active:bg-white/40 flex items-center justify-center touch-none"
                  aria-label="左切車道"
                >
                  <ChevronLeft size={28} />
                </button>
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    playerRef.current.targetLane = Math.min(1, playerRef.current.targetLane + 1);
                  }}
                  className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-md rounded-full border border-white/30 active:bg-white/40 flex items-center justify-center touch-none"
                  aria-label="右切車道"
                >
                  <ChevronRight size={28} />
                </button>
              </div>
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  initAudio();
                  if (!playerRef.current.isJumping) {
                    playerRef.current.isJumping = true;
                    playerRef.current.vy = JUMP_FORCE;
                    sounds.jump();
                  }
                }}
                className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/40 backdrop-blur-md rounded-full border border-blue-300/50 active:bg-blue-500/70 flex items-center justify-center pointer-events-auto touch-none shadow-lg"
                aria-label="跳躍"
              >
                <ArrowUp size={28} />
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  </div>

  {/* Achievement Toasts (always on top, never blocks input) */}
  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 pointer-events-none">
    <AnimatePresence>
      {achievementToasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ y: -40, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-r from-yellow-500/90 to-amber-600/90 backdrop-blur-md border-2 border-yellow-300 text-black px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm"
        >
          <span className="text-3xl drop-shadow">{t.achievement.icon}</span>
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">成就解鎖</p>
            <p className="font-bold text-sm">{t.achievement.title}</p>
            <p className="text-xs opacity-80">{t.achievement.description}</p>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>

  {/* Leaderboard Modal (lazy-loaded — Firebase chunk loads here) */}
  {showLeaderboard && (
    <Suspense fallback={null}>
      <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
    </Suspense>
  )}

  {/* Achievements Modal (lazy-loaded) */}
  {showAchievements && (
    <Suspense fallback={null}>
      <AchievementsModal
        unlocked={achievementsUnlocked}
        all={allAchievements}
        onClose={() => setShowAchievements(false)}
      />
    </Suspense>
  )}

  {/* Skin Picker Modal (lazy-loaded) */}
  {showSkinPicker && (
    <Suspense fallback={null}>
      <SkinPickerModal
        current={currentSkin}
        onSelect={(id) => { setCurrentSkin(id); setShowSkinPicker(false); }}
        unlockedAchievements={achievementsUnlocked}
        totalAchievements={allAchievements.length}
        onClose={() => setShowSkinPicker(false)}
      />
    </Suspense>
  )}

  {/* PWA update prompt — toast when new SW is ready */}
  <Suspense fallback={null}>
    <UpdatePrompt />
  </Suspense>

  {/* PWA install prompt — only after first GAME_OVER or LEVEL_CLEAR */}
  <Suspense fallback={null}>
    <InstallPrompt triggerVisible={gameState === 'GAME_OVER' || gameState === 'LEVEL_CLEAR'} />
  </Suspense>

  {/* Teacher dashboard — opt-in via ?teacher=1 URL param */}
  {showTeacherDashboard && (
    <Suspense fallback={null}>
      <TeacherDashboard onClose={() => setShowTeacherDashboard(false)} />
    </Suspense>
  )}

  {/* Author Footer */}
  {!isFullscreen && (
    <footer className="w-full text-center text-[10px] sm:text-xs text-white/40 py-2 mt-1 select-none space-y-0.5">
      <div>
        Made with{' '}
        <span className="text-pink-400/70" aria-label="love">♥</span>
        {' '}by{' '}
        <a
          href="https://www.smes.tyc.edu.tw/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-white transition-colors"
        >
          阿凱老師
        </a>
      </div>
      <div className="text-white/30">
        共同開發者：<span className="text-cyan-300/60 font-mono tracking-wider">antarctic</span>
      </div>
    </footer>
  )}
</div>
);
}
