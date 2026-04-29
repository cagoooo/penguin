import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Timer, MapPin, Play, RotateCcw, ChevronRight, ChevronLeft, ArrowUp, Maximize, Minimize, ShoppingCart, Heart, Zap, Clock, Smartphone, Shield, Search, Wind, Compass, Rocket, Fish, Volume2, VolumeX, Pause, Camera } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ALL_SHOP_ITEMS as SHOP_DATA, getShopItem, type ShopItemMeta } from './shop/items';
import { initAudio, playTone, sounds, mutedRef, pausedRef } from './audio/sounds';
import { startBGM, stopBGM } from './audio/bgm';
import { useAchievements } from './achievements/useAchievements';
import { generateShareImage, shareScore } from './utils/shareImage';
import { SKINS, drawSkinAccessories, getSkin, isSkinUnlocked, loadSkin, saveSkin, type SkinId } from './skins/skins';

// Firebase lives in its own ~85KB gzip chunk; only loaded when the player opens
// the leaderboard or hits GAME_OVER (where the submit form appears).
const LeaderboardModal = lazy(() => import('./leaderboard/LeaderboardModal'));
const ScoreSubmitForm = lazy(() => import('./leaderboard/ScoreSubmitForm'));
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HORIZON_Y,
  MAX_SPEED,
  ACCELERATION,
  FRICTION,
  GRAVITY,
  JUMP_FORCE,
} from './game/constants';

// Map iconName strings (defined in src/shop/items.ts) to actual lucide-react components.
const ICON_COMPONENTS = {
  Clock, Maximize, Zap, Heart, Shield, Search, ChevronRight, Wind, Compass, Fish, Timer, Rocket, Trophy,
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

interface Obstacle {
  id: number;
  z: number; // Distance from player (0 to 2000)
  lane: number; // -1 (left), 0 (center), 1 (right)
  type:
    | 'CRACK' | 'SEAL' | 'HOLE'
    | 'FISH' | 'FLAG' | 'BLUE_FLAG' | 'JUMPING_FISH' | 'RAINBOW_FLAG'
    | 'SHOP_STATION' | 'ICE_PATCH' | 'SNOWDRIFT'
    | 'POLAR_BEAR'  // L9+: lane-tracking AI, costs 2 lives on hit
    | 'ICEBERG';    // L11+: 1.5-lane wide, must jump over
  collected?: boolean;
  onFire?: boolean;
  /** Dynamic lane offset (-1.5..1.5) for moving obstacles like POLAR_BEAR. */
  laneOffset?: number;
  /** Walking animation phase for POLAR_BEAR. */
  walkPhase?: number;
  fishY?: number;
  fishVy?: number;
  fishVx?: number; // Horizontal speed for parabolic jump
  fishLaneOffset?: number; // For parabolic jump
  fishLaneDirection?: number; // -1 or 1
  fishJumped?: boolean; // Has the fish already jumped?
  color?: string;
}

// --- Helper Functions ---
const project = (x: number, y: number, z: number, segments: number[], segmentOffset: number, cumulativeOffsets?: { x: number, dx: number }[]) => {
  const scale = 1 / (z / 500 + 1);
  const segmentLength = 100;
  let totalXOffset = 0;

  if (cumulativeOffsets && cumulativeOffsets.length > 0) {
    const segIndex = Math.floor(z / segmentLength);
    const cappedIndex = Math.min(segIndex, segments.length - 1);
    const offset = cumulativeOffsets[cappedIndex];
    
    if (offset) {
      const zInSegment = z - cappedIndex * segmentLength;
      const curvatureScale = 2 / 10000;
      const curvature = segments[cappedIndex] * curvatureScale;
      
      totalXOffset = offset.x + offset.dx * zInSegment + 0.5 * curvature * zInSegment * zInSegment;
    } else {
      // Fallback if specific offset is missing
      totalXOffset = 0;
    }
  } else {
    // Fallback if offsets not provided
    let currentDx = 0;
    let currentZ = 0;
    const curvatureScale = 2 / 10000;

    for (let i = 0; i < segments.length; i++) {
      const effectiveSegLen = i === 0 ? Math.max(0, segmentLength - segmentOffset) : segmentLength;
      const segZ = currentZ + effectiveSegLen;
      const zInSegment = Math.min(z, segZ) - currentZ;
      if (zInSegment <= 0) break;
      const curvature = segments[i] * curvatureScale;
      totalXOffset += currentDx * zInSegment + 0.5 * curvature * zInSegment * zInSegment;
      currentDx += curvature * zInSegment;
      currentZ = segZ;
      if (z <= segZ) break;
    }
  }

  const px = CANVAS_WIDTH / 2 + (x + totalXOffset) * scale;
  const py = HORIZON_Y + (290 + y) * scale; 
  return { px, py, scale };
};

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

  // Best score persistence on GAME_OVER
  useEffect(() => {
    if (gameState !== 'GAME_OVER') {
      setIsNewRecord(false);
      return;
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
  }, [gameState, score, bestScore, muted, unlockAchievement]);

  // Level-based achievements + survival check
  useEffect(() => {
    if (gameState === 'LEVEL_CLEAR') {
      if (level === 1) unlockAchievement('first-clear');
      if (level >= 5) unlockAchievement('level-5');
      if (level >= 10) unlockAchievement('level-10');
      if (level >= 7) unlockAchievement('survivor');
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
      const blob = await generateShareImage({
        score,
        level,
        name: playerName.trim() || undefined,
        isNewRecord,
        bestScore,
        achievementsCount: achievementsUnlocked.size,
        achievementsTotal: allAchievements.length,
      });
      const result = await shareScore(blob, { score, level });
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
    timeFrozen: 0,
    nitroTime: 0,
    maxSpeedBonus: 0,
    accelBonus: 0,
    enteredShopLevel: 0,
    isTouchAccelerating: false,
    lastTapTime: 0,
    touchDownTime: 0,
    touchLane: 0,
    traction: 1.0,
    isGamepadAccelerating: false,
    isGodMode: false,
    pendingShopItems: [] as string[],
    // L13+: blizzard storm — periodic visibility-reduction events
    blizzardActive: 0,    // seconds remaining; 0 = inactive
    blizzardStrength: 0,  // 0..1 fade-in/out (avoids snap)
    nextBlizzardAt: 0,    // distance threshold for next blizzard onset
    snowflakes: [] as { x: number; y: number; speed: number; size: number; sway: number }[],
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
  const initGame = (isNextLevel: any = false) => {
    initAudio();
    sounds.start();
    const g = gameRef.current;

    // Ensure isNextLevel is strictly boolean true, not an event object
    const actualNextLevel = isNextLevel === true;

    // Reset per-game stats on a fresh run (NOT on level transitions)
    if (!actualNextLevel) {
      fishCollectedRef.current = 0;
      shopPurchasesRef.current = 0;
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
      ];

      g.pendingShopItems.forEach(itemId => {
        const item = allShopItems.find(i => i.id === itemId);
        if (item) item.apply();
      });
      g.pendingShopItems = [];
    }

    const baseTime = 30;
    if (!actualNextLevel) {
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

    g.distance = g.levelDistance;
    g.speed = 20;
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
    g.blizzardActive = 0;
    g.blizzardStrength = 0;
    g.nextBlizzardAt = g.distance - 800; // First storm hits ~800m into level 13+
    g.snowflakes = [];

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

          const currentLevelItems = g.isGodMode ? ALL_SHOP_ITEMS : ALL_SHOP_ITEMS.slice(0, Math.min(16, 4 + g.level));
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
      if (g.timeFrozen > 0) {
        g.timeFrozen -= 1/60;
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

      if (g.time <= 0) {
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
      if (g.level >= 13) {
        if (g.blizzardActive > 0) {
          g.blizzardActive -= 1 / 60;
          // Ramp strength toward 1 while active, toward 0 once expired
          g.blizzardStrength += (1 - g.blizzardStrength) * 0.04;
          if (g.blizzardActive <= 0) {
            g.blizzardActive = 0;
            // Schedule next storm 800-1500m further along
            g.nextBlizzardAt = g.distance - (800 + Math.random() * 700);
          }
        } else if (g.distance < g.nextBlizzardAt) {
          // Trigger a new storm
          g.blizzardActive = 4 + Math.random() * 3; // 4-7 seconds
          // Spawn a fresh field of snowflakes
          g.snowflakes = Array.from({ length: 80 }, () => ({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            speed: 2 + Math.random() * 5,
            size: 1 + Math.random() * 3,
            sway: Math.random() * Math.PI * 2,
          }));
        }
        // Always fade strength toward target (active=1, inactive=0)
        const target = g.blizzardActive > 0 ? 1 : 0;
        g.blizzardStrength += (target - g.blizzardStrength) * 0.04;
      } else {
        g.blizzardStrength = 0;
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
        // Flying logic: Space/Up to go up
        if (keys.current['Space'] || keys.current['ArrowUp'] || keys.current['KeyW']) {
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

        // Detector increases fish spawn rates
        const fishThreshold = g.hasDetector ? 0.7 : 0.85;
        const jumpingFishThreshold = g.hasDetector ? 0.6 : 0.75;

        if (typeRoll > 0.99) {
          type = 'RAINBOW_FLAG';
        } else if (typeRoll > 0.92) {
          type = 'BLUE_FLAG';
        } else if (typeRoll > fishThreshold) {
          type = 'FISH';
          const fishRoll = Math.random();
          // Detector makes gold fish more common
          const goldThreshold = g.hasDetector ? 0.2 : 0.4;
          const greenThreshold = g.hasDetector ? 0.5 : 0.7;

          if (fishRoll > greenThreshold) color = '#32CD32'; // Green
          else if (fishRoll > goldThreshold) color = '#FFD700'; // Yellow
          else color = '#FF6347'; // Red (Default)
        } else if (typeRoll > jumpingFishThreshold) {
          type = 'JUMPING_FISH';
          const fishRoll = Math.random();
          const goldThreshold = g.hasDetector ? 0.2 : 0.4;
          const greenThreshold = g.hasDetector ? 0.5 : 0.7;
          
          if (fishRoll > greenThreshold) color = '#32CD32'; // Green
          else if (fishRoll > goldThreshold) color = '#FFD700'; // Yellow
          else color = '#FF6347'; // Red (Default)
        } else if (typeRoll > 0.65) {
          type = 'FLAG';
          const flagRoll = Math.random();
          if (flagRoll > 0.7) color = '#FFA500'; // Orange (增加出現機率)
          else if (flagRoll > 0.5) color = '#FFFF00'; // Yellow
          else color = '#FF0000'; // Red
        } else if (typeRoll > 0.45) {
          // ICEBERG (L11+) and POLAR_BEAR (L9+) replace some seal slots at higher levels.
          // Drop chances are gentle so they feel "rare and dangerous", not constant.
          if (g.level >= 11 && Math.random() < 0.2) {
            type = 'ICEBERG';
          } else if (g.level >= 9 && Math.random() < 0.25) {
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
      g.lastObstacleZ -= currentSpeed;

      // 5. Collision Detection
      obstaclesRef.current.forEach(obs => {
        if (obs.z < 150 && obs.z > 50) {
          // 5.1 Check for Item Collection (Fish, Flags)
          if (!obs.collected) {
            const effectiveLane = obs.type === 'JUMPING_FISH' 
              ? obs.lane + (obs.fishLaneOffset || 0)
              : obs.lane;
            const obsX = effectiveLane * 150;
            const dist = Math.abs(p.x - obsX);

            // Magnet increases collection range
            const collectionRange = (g.hasMagnet && (obs.type === 'FISH' || obs.type === 'FLAG' || obs.type === 'BLUE_FLAG' || obs.type === 'JUMPING_FISH' || obs.type === 'RAINBOW_FLAG')) ? 400 : 60;

            if (dist < collectionRange || (obs.type === 'SHOP_STATION' && dist < 120)) {
              if (obs.type === 'FISH' || obs.type === 'FLAG' || obs.type === 'BLUE_FLAG' || obs.type === 'JUMPING_FISH' || obs.type === 'RAINBOW_FLAG' || obs.type === 'SHOP_STATION') {
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
                  } else {
                    let points = 0;
                    if (obs.type === 'FISH' || obs.type === 'JUMPING_FISH') {
                      if (obs.color === '#32CD32') points = 1500;
                      else if (obs.color === '#FFD700') points = 1000;
                      else points = 500;
                      if (g.hasTripleFish) points *= 3;
                      fishCollectedRef.current += 1;
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
                    }
                    if (g.hasKingCrown) points *= 3;
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
              }
            }
            return;
          }

          if (holeDist < 60) {
            if (obs.type === 'HOLE' || obs.type === 'CRACK' || obs.type === 'SEAL' || obs.type === 'JUMPING_FISH' || obs.type === 'SNOWDRIFT' || obs.type === 'ICE_PATCH') {
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
                p.stumbleTime = 1.0;
                p.stumbleSide = p.x > holeX ? 1 : -1;
                g.speed = Math.max(20, g.speed * 0.3);
                g.hasSkateboard = false; // Skateboards break on stumble!
                setSpeed(g.speed);
                sounds.hit();
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

      const drawFire = (x: number, y: number, scale: number) => {
        const time = Date.now() / 50;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // Draw 12 flickering flame particles
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2 + time * 0.2;
          const dist = (20 + Math.sin(time + i) * 10) * scale;
          
          const px = x + Math.cos(angle) * dist;
          const py = y + Math.sin(angle) * dist * 0.5 - (Math.abs(Math.sin(time * 2 + i)) * 40 * scale);
          
          const size = (15 + Math.sin(time * 3 + i) * 5) * scale;
          
          // Gradient-like color selection
          const colorRoll = (i + Math.floor(time)) % 3;
          if (colorRoll === 0) ctx.fillStyle = '#FF4500'; // OrangeRed
          else if (colorRoll === 1) ctx.fillStyle = '#FF8C00'; // DarkOrange
          else ctx.fillStyle = '#FFD700'; // Gold
          
          ctx.beginPath();
          // Flame shape: teardrop
          ctx.moveTo(px, py + size);
          ctx.bezierCurveTo(px - size, py + size, px - size, py - size, px, py - size * 1.5);
          ctx.bezierCurveTo(px + size, py - size, px + size, py + size, px, py + size);
          ctx.fill();
          
          // Add a small inner glow for some particles
          if (i % 3 === 0) {
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(px, py, size * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      };

      // Draw Sky
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON_Y);
      
      // Draw Sun
      ctx.fillStyle = '#FFFACD';
      ctx.beginPath();
      ctx.arc(100, 80, 40, 0, Math.PI * 2);
      ctx.fill();

      // Draw Clouds
      clouds.current.forEach((cloud, index) => {
        // Clouds move with speed (bgOffset) + slow drift
        // We use index to give each cloud a slightly different drift speed
        const drift = Date.now() * 0.02;
        const cloudX = (cloud.x + g.bgOffset * 0.5 + drift * (0.5 + index * 0.1)) % 2000;
        const finalX = cloudX < 0 ? cloudX + 2000 : cloudX;
        const cx = finalX - 1000 + CANVAS_WIDTH / 2;
        const cy = cloud.y;

        ctx.save();
        // Create a soft fluffy cloud with multiple overlapping circles
        // Use a fixed seed-like approach for "randomness" to avoid flickering
        for (let i = 0; i < 5; i++) {
          const offsetX = (i - 2) * (cloud.width * 0.4);
          const offsetY = Math.sin(i + index) * 5;
          const radius = cloud.width * (0.7 + Math.sin(i * 1.5 + index) * 0.1);
          
          const grad = ctx.createRadialGradient(
            cx + offsetX, cy + offsetY, 0,
            cx + offsetX, cy + offsetY, radius
          );
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
          grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx + offsetX, cy + offsetY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // Draw Aurora Borealis (Furthest Layer)
      const time = performance.now() * 0.001;
      ctx.save();
      auroraBorealis.current.forEach((aurora, i) => {
        const parallaxFactor = 0.05;
        const auroraX = (aurora.x - g.curve * 2 * parallaxFactor - g.bgOffset * parallaxFactor) % 3000;
        const finalX = auroraX < -1500 ? auroraX + 3000 : auroraX > 1500 ? auroraX - 3000 : auroraX;
        
        ctx.fillStyle = aurora.color;
        ctx.globalAlpha = 0.3 + Math.sin(time + i) * 0.1;
        
        ctx.beginPath();
        const baseWidth = aurora.width;
        const xPos = CANVAS_WIDTH / 2 + finalX;
        
        // Creating a wavy aurora curtain
        ctx.moveTo(xPos, 0);
        for (let y = 0; y <= aurora.height; y += 20) {
          const waveX = Math.sin(y * 0.01 + time + i) * 20;
          ctx.lineTo(xPos + waveX + baseWidth, y);
        }
        for (let y = aurora.height; y >= 0; y -= 20) {
          const waveX = Math.sin(y * 0.01 + time + i) * 20;
          ctx.lineTo(xPos + waveX, y);
        }
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();

      // Draw Background Elements (Icebergs & Mountains)
      backgroundMountains.current.forEach(mtn => {
        // Parallax: further layers move slower
        const parallaxFactor = (mtn.layer + 0.5) * 0.25 + (g.speed / MAX_SPEED) * 0.2;
        // Shift based on road curve AND player movement
        const mtnX = (mtn.x - g.curve * 5 * parallaxFactor - g.bgOffset * parallaxFactor) % 3000;
        const finalX = mtnX < -1500 ? mtnX + 3000 : mtnX > 1500 ? mtnX - 3000 : mtnX;
        
        ctx.fillStyle = mtn.color;
        ctx.beginPath();
        
        if (mtn.isIceberg) {
          // Flat-top or blocky icebergs in the far distance
          ctx.moveTo(CANVAS_WIDTH / 2 + finalX, HORIZON_Y);
          ctx.lineTo(CANVAS_WIDTH / 2 + finalX + 20, HORIZON_Y - mtn.height);
          ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width - 20, HORIZON_Y - mtn.height);
          ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width, HORIZON_Y);
        } else {
          // Sharp mountains
          ctx.moveTo(CANVAS_WIDTH / 2 + finalX, HORIZON_Y);
          ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width / 2, HORIZON_Y - mtn.height);
          ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width, HORIZON_Y);
        }
        ctx.fill();
        
        // Shadow/Detail (only for mountains)
        if (!mtn.isIceberg) {
          ctx.fillStyle = 'rgba(0,0,0,0.05)';
          ctx.beginPath();
          ctx.moveTo(CANVAS_WIDTH / 2 + finalX + mtn.width / 2, HORIZON_Y - mtn.height);
          ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width, HORIZON_Y);
          ctx.lineTo(CANVAS_WIDTH / 2 + finalX + mtn.width / 2 + 10, HORIZON_Y);
          ctx.fill();
        }
      });

      // Draw Ice Ground
      ctx.fillStyle = '#F0F8FF';
      ctx.fillRect(0, HORIZON_Y, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON_Y);

      // Draw Ice Hill Shadows (NES style)
      ctx.strokeStyle = '#D0E0F0';
      ctx.lineWidth = 1;
      const shadowSpacing = 60;
      const shadowOffset = (g.distance * 10) % shadowSpacing;
      // Use LOD: draw less detail far away
      for (let z = 15000; z > 0; z -= shadowSpacing) {
        // Increase spacing for distant shadows
        const effectiveZ = z + shadowOffset;
        if (effectiveZ > 2000 && z % (shadowSpacing * 2) !== 0) continue;
        if (effectiveZ > 5000 && z % (shadowSpacing * 4) !== 0) continue;

        const { py } = project(0, 0, effectiveZ, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
        if (py < HORIZON_Y) continue;
        
        ctx.beginPath();
        // Left side shadows
        const roadLeft = project(-300, 0, effectiveZ, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
        for (let x = -2000; x < -300; x += 100) {
          const p1 = project(x, 0, effectiveZ, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
          const p2 = project(x + 50, 0, effectiveZ, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
          ctx.moveTo(p1.px, py);
          ctx.lineTo(Math.min(p2.px, roadLeft.px), py);
        }
        
        // Right side shadows
        const roadRight = project(300, 0, effectiveZ, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
        for (let x = 300; x < 2000; x += 100) {
          const p1 = project(x + 50, 0, effectiveZ, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
          const p2 = project(x + 100, 0, effectiveZ, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
          ctx.moveTo(Math.max(p1.px, roadRight.px), py);
          ctx.lineTo(p2.px, py);
        }
        ctx.stroke();
      }

      // Draw Road (Perspective) - Segmented to follow curve
      ctx.fillStyle = '#E0F0FF';
      ctx.beginPath();
      
      // Left edge from front to back - Use LOD steps
      for (let z = 0; z <= 15000; z += (z < 2000 ? 50 : z < 5000 ? 200 : 500)) {
        const { px, py } = project(-300, 0, z, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
        if (z === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      // Right edge from back to front
      for (let z = 15000; z >= 0; z -= (z < 2000 ? 50 : z < 5000 ? 200 : 500)) {
        const { px, py } = project(300, 0, z, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Draw Sea
      if (g.seaTransition > 0.01) {
        ctx.fillStyle = '#0000FF'; // Deep blue sea
        const seaSide = g.seaType === 'LEFT' ? -1 : 1;
        
        ctx.beginPath();
        // Sea starts from the edge of the road
        for (let z = 0; z <= 15000; z += (z < 2000 ? 50 : 500)) {
          const edgeX = seaSide * 300;
          const { px, py } = project(edgeX, 0, z, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
          
          // Apply transition: sea slides in from the side
          const transitionOffset = (1 - g.seaTransition) * 1000 * seaSide;
          if (z === 0) ctx.moveTo(px + transitionOffset, py);
          else ctx.lineTo(px + transitionOffset, py);
        }
        // Connect to screen edge
        ctx.lineTo(seaSide === 1 ? CANVAS_WIDTH : 0, HORIZON_Y);
        ctx.lineTo(seaSide === 1 ? CANVAS_WIDTH : 0, CANVAS_HEIGHT);
        ctx.closePath();
        ctx.fill();
      }

      // Draw Road Lines (Moving)
      ctx.strokeStyle = '#B0C4DE';
      ctx.lineWidth = 2;
      const lineSpacing = 200;
      const offset = (g.distance * 10) % lineSpacing;
      for (let z = 15000; z > 0; z -= (z < 2000 ? 100 : 400)) {
        const p1 = project(-300, 0, z + offset, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
        const p2 = project(300, 0, z + offset, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }

      // Draw Goal (Shihmen Elementary School Gate)
      if (g.distance < 1000) {
        const { px, py, scale } = project(0, 0, g.distance * 10, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(scale, scale);

        // Gate Pillars
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-250, -300, 60, 300);
        ctx.fillRect(190, -300, 60, 300);
        
        // Top Beam
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(-260, -320, 520, 40);
        
        // Signboard
        ctx.fillStyle = '#FFF';
        ctx.fillRect(-150, -280, 300, 60);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 4;
        ctx.strokeRect(-150, -280, 300, 60);
        
        // Text
        ctx.fillStyle = '#8B4513';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('石門國小', 0, -240);

        ctx.restore();
      }

      // Draw Obstacles
      obstaclesRef.current.sort((a, b) => b.z - a.z).forEach(obs => {
        if (obs.collected && !obs.onFire) return;
        
        // Stationary part (Hole/Crack/Base)
        const { px: holePx, py: holePy, scale: holeScale } = project(obs.lane * 150, 0, obs.z, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
        
        ctx.save();
        ctx.translate(holePx, holePy);
        ctx.scale(holeScale, holeScale);

        if (obs.type === 'CRACK') {
          // Ice depth (3D effect)
          ctx.fillStyle = '#2a5bb5'; // Darker blue for depth
          ctx.fillRect(-150, 0, 300, 15);
          
          // Main blue bar (surface)
          ctx.fillStyle = '#4d88ff';
          ctx.fillRect(-150, -5, 300, 10);
          
          // Jagged black ends (with depth)
          ctx.fillStyle = '#000';
          
          // Left jagged end
          ctx.beginPath();
          ctx.moveTo(-150, -5);
          ctx.lineTo(-170, -2);
          ctx.lineTo(-155, 0);
          ctx.lineTo(-175, 3);
          ctx.lineTo(-150, 5);
          ctx.lineTo(-150, 15); // Depth line
          ctx.lineTo(-175, 13);
          ctx.closePath();
          ctx.fill();
          
          // Right jagged end
          ctx.beginPath();
          ctx.moveTo(150, -5);
          ctx.lineTo(170, -2);
          ctx.lineTo(155, 0);
          ctx.lineTo(175, 3);
          ctx.lineTo(150, 5);
          ctx.lineTo(150, 15); // Depth line
          ctx.lineTo(175, 13);
          ctx.closePath();
          ctx.fill();
        } else if (obs.type === 'HOLE' || obs.type === 'JUMPING_FISH') {
          // Grey rim (top half)
          ctx.fillStyle = '#c0c0c0';
          ctx.beginPath();
          ctx.ellipse(0, -1, 62, 16, 0, Math.PI, Math.PI * 2);
          ctx.fill();

          // Hole Depth (Darker inner part)
          ctx.fillStyle = '#1a3a7a';
          ctx.beginPath();
          ctx.ellipse(0, 4, 58, 14, 0, 0, Math.PI * 2);
          ctx.fill();

          // Main blue water (surface)
          ctx.fillStyle = '#4d88ff';
          ctx.beginPath();
          ctx.ellipse(0, 0, 60, 15, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (obs.type === 'ICEBERG') {
          // ICEBERG: large jagged ice peak, ~1.5 lanes wide. Draw with shadow base + 3 jagged peaks.
          // Base shadow on ground
          ctx.fillStyle = 'rgba(40, 60, 120, 0.35)';
          ctx.beginPath();
          ctx.ellipse(0, 5, 110, 20, 0, 0, Math.PI * 2);
          ctx.fill();

          // Iceberg body — jagged silhouette
          ctx.fillStyle = '#cfe6ff';
          ctx.beginPath();
          ctx.moveTo(-100, 5);
          ctx.lineTo(-80, -50);
          ctx.lineTo(-55, -20);
          ctx.lineTo(-30, -110);
          ctx.lineTo(-5, -55);
          ctx.lineTo(20, -135);
          ctx.lineTo(45, -65);
          ctx.lineTo(70, -90);
          ctx.lineTo(95, -25);
          ctx.lineTo(100, 5);
          ctx.closePath();
          ctx.fill();

          // Highlight (sun-lit side)
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(-30, -110);
          ctx.lineTo(20, -135);
          ctx.lineTo(0, -85);
          ctx.lineTo(-15, -85);
          ctx.closePath();
          ctx.fill();

          // Shadow side
          ctx.fillStyle = 'rgba(80, 120, 180, 0.45)';
          ctx.beginPath();
          ctx.moveTo(20, -135);
          ctx.lineTo(70, -90);
          ctx.lineTo(45, -65);
          ctx.closePath();
          ctx.fill();

          // Outline
          ctx.strokeStyle = '#5982bd';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-100, 5);
          ctx.lineTo(-80, -50);
          ctx.lineTo(-55, -20);
          ctx.lineTo(-30, -110);
          ctx.lineTo(-5, -55);
          ctx.lineTo(20, -135);
          ctx.lineTo(45, -65);
          ctx.lineTo(70, -90);
          ctx.lineTo(95, -25);
          ctx.lineTo(100, 5);
          ctx.stroke();

          if (obs.onFire) {
            drawFire(0, -50, 1.5);
          }
        } else if (obs.type === 'POLAR_BEAR') {
          // POLAR_BEAR: walks along lane, can drift between lanes via laneOffset.
          // The static lane is drawn at obs.lane; the laneOffset moves it horizontally
          // by adjusting x (we're already translated to obs.lane * 150 by the project()
          // call upstream). Apply the offset here.
          const offsetX = (obs.laneOffset ?? 0) * 150;
          ctx.save();
          ctx.translate(offsetX, 0);

          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(0, 5, 45, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          // Walking sway
          const phase = obs.walkPhase ?? 0;
          const bob = Math.sin(phase) * 3;
          ctx.translate(0, -bob);

          // Body (off-white fur)
          ctx.fillStyle = '#f5f5f0';
          ctx.beginPath();
          ctx.ellipse(0, -25, 42, 28, 0, 0, Math.PI * 2);
          ctx.fill();

          // Head
          ctx.beginPath();
          ctx.ellipse(0, -65, 30, 28, 0, 0, Math.PI * 2);
          ctx.fill();

          // Ears
          ctx.beginPath();
          ctx.arc(-18, -88, 8, 0, Math.PI * 2);
          ctx.arc(18, -88, 8, 0, Math.PI * 2);
          ctx.fill();
          // Inner ears
          ctx.fillStyle = '#d4b8a0';
          ctx.beginPath();
          ctx.arc(-18, -88, 4, 0, Math.PI * 2);
          ctx.arc(18, -88, 4, 0, Math.PI * 2);
          ctx.fill();

          // Snout
          ctx.fillStyle = '#fafaf2';
          ctx.beginPath();
          ctx.ellipse(0, -55, 14, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          // Eyes
          ctx.fillStyle = '#0a0a0a';
          ctx.beginPath();
          ctx.arc(-10, -68, 3, 0, Math.PI * 2);
          ctx.arc(10, -68, 3, 0, Math.PI * 2);
          ctx.fill();

          // Nose
          ctx.fillStyle = '#1a1a1a';
          ctx.beginPath();
          ctx.ellipse(0, -55, 4, 3, 0, 0, Math.PI * 2);
          ctx.fill();

          // Legs (alternating walk)
          ctx.fillStyle = '#f5f5f0';
          const legA = Math.sin(phase) * 6;
          const legB = Math.sin(phase + Math.PI) * 6;
          ctx.beginPath();
          ctx.ellipse(-22, 0 + legA, 10, 8, 0, 0, Math.PI * 2);
          ctx.ellipse(22, 0 + legB, 10, 8, 0, 0, Math.PI * 2);
          ctx.ellipse(-32, 0 + legB, 10, 8, 0, 0, Math.PI * 2);
          ctx.ellipse(32, 0 + legA, 10, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Subtle outline
          ctx.strokeStyle = '#c4c4b8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(0, -25, 42, 28, 0, 0, Math.PI * 2);
          ctx.stroke();

          if (obs.onFire) {
            drawFire(0, -40, 1.3);
          }
          ctx.restore();
        } else if (obs.type === 'SEAL') {
          // Grey rim (top half)
          ctx.fillStyle = '#c0c0c0';
          ctx.beginPath();
          ctx.ellipse(0, -1, 62, 16, 0, Math.PI, Math.PI * 2);
          ctx.fill();

          // Hole for seal
          ctx.fillStyle = '#4d88ff';
          ctx.beginPath();
          ctx.ellipse(0, 0, 60, 15, 0, 0, Math.PI * 2);
          ctx.fill();

          // Emergence logic: The seal rises from y=30 (hidden) to y=-15 (full)
          if (obs.z < 2000) {
            const emergence = Math.max(0, Math.min(1, (2000 - obs.z) / 1200));
            const sealY = 40 - (emergence * 55);
            const showHands = obs.z < 1000;
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(-100, -150, 200, 155);
            ctx.clip();

            ctx.translate(0, sealY);
            ctx.fillStyle = '#C04040'; // Reddish seal
            
            ctx.beginPath();
            ctx.ellipse(0, 10, 35, 25, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(0, -15, 25, 0, Math.PI * 2);
            ctx.fill();
            
            // Face
            ctx.fillStyle = '#000';
            ctx.fillRect(-12, -22, 6, 3);
            ctx.fillRect(6, -22, 6, 3);
            
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#000';
            ctx.moveTo(0, -15);
            ctx.lineTo(0, -8);
            ctx.moveTo(-8, -10);
            ctx.quadraticCurveTo(0, -5, 8, -10);
            ctx.stroke();
            
            if (showHands) {
              ctx.fillStyle = '#C04040';
              ctx.beginPath();
              ctx.ellipse(-40, 15, 20, 10, 0.3, 0, Math.PI * 2);
              ctx.ellipse(40, 15, 20, 10, -0.3, 0, Math.PI * 2);
              ctx.fill();
            }

            if (obs.onFire) {
              drawFire(0, 0, 1.2);
            }
            ctx.restore();
          }
        } else if (obs.type === 'FISH') {
          ctx.save();
          ctx.translate(0, -30);
          ctx.fillStyle = obs.color || '#FF6347';
          ctx.beginPath();
          ctx.moveTo(20, 0);
          ctx.quadraticCurveTo(0, -12, -15, -4);
          ctx.lineTo(-15, 4);
          ctx.quadraticCurveTo(0, 12, 20, 0);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-15, 0);
          ctx.lineTo(-28, -10);
          ctx.lineTo(-24, 0);
          ctx.lineTo(-28, 10);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#FFF';
          ctx.beginPath();
          ctx.arc(10, -3, 2.5, 0, Math.PI * 2);
          ctx.fill();
          if (obs.onFire) drawFire(0, 0, 0.7);
          ctx.restore();
        } else if (obs.type === 'FLAG' || obs.type === 'BLUE_FLAG' || obs.type === 'RAINBOW_FLAG') {
          ctx.fillStyle = '#FFD700';
          ctx.fillRect(-5, -60, 5, 60);
          if (obs.type === 'FLAG') ctx.fillStyle = obs.color || '#FF0000';
          else if (obs.type === 'BLUE_FLAG') ctx.fillStyle = '#0000FF';
          else {
            const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8B00FF'];
            ctx.fillStyle = colors[Math.floor(Date.now() / 100) % colors.length];
          }
          ctx.beginPath();
          ctx.moveTo(0, -60);
          ctx.lineTo(30, -45);
          ctx.lineTo(0, -30);
          ctx.fill();
        } else if (obs.type === 'SHOP_STATION') {
          // Draw Shop Building (Research Station)
          ctx.save();
          // Main Hut
          ctx.fillStyle = '#C0C0C0';
          ctx.fillRect(-100, -120, 200, 120);
          // Roof
          ctx.beginPath();
          ctx.fillStyle = '#E00';
          ctx.moveTo(-110, -120);
          ctx.lineTo(0, -160);
          ctx.lineTo(110, -120);
          ctx.fill();
          // Window
          ctx.fillStyle = '#87CEEB';
          ctx.fillRect(-60, -80, 40, 40);
          // Door
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(20, -70, 40, 70);
          // SHOP Sign
          ctx.fillStyle = '#FFFF00';
          ctx.fillRect(-30, -110, 60, 20);
          ctx.fillStyle = '#000';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SHOP', 0, -96);
          ctx.restore();
        } else if (obs.type === 'ICE_PATCH') {
          // Shiny blue slick
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
          grad.addColorStop(0, 'rgba(100, 200, 255, 0.6)');
          grad.addColorStop(0.7, 'rgba(150, 220, 255, 0.4)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(0, 0, 80, 20, 0, 0, Math.PI * 2);
          ctx.fill();
          // Shine highlights
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(-20, -5, 30, 5, 0.2, 0, Math.PI);
          ctx.stroke();
        } else if (obs.type === 'SNOWDRIFT') {
          // White mound
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(-100, 0);
          ctx.quadraticCurveTo(-50, -40, 0, -35);
          ctx.quadraticCurveTo(60, -45, 100, 0);
          ctx.fill();
          // Shadow/Texture
          ctx.fillStyle = '#E0F0FF';
          ctx.beginPath();
          ctx.moveTo(-40, -10);
          ctx.quadraticCurveTo(0, -25, 40, -10);
          ctx.quadraticCurveTo(0, -15, -40, -10);
          ctx.fill();
        }
        ctx.restore();

        // Moving part (Jumping Fish)
        if (obs.type === 'JUMPING_FISH' && !obs.collected) {
          const fishX = obs.lane * 150 + (obs.fishLaneOffset || 0) * 150;
          const fishY = obs.fishY || 0;
          const { px: fPx, py: fPy, scale: fScale } = project(fishX, fishY, obs.z, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
          
          // Shadow
          const { px: sPx, py: sPy, scale: sScale } = project(fishX, 0, obs.z, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
          ctx.save();
          ctx.translate(sPx, sPy);
          ctx.scale(sScale, sScale);
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 25, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Fish
          ctx.save();
          ctx.translate(fPx, fPy);
          ctx.scale(fScale, fScale);
          ctx.rotate((obs.fishVy! / 15) * 0.5);
          ctx.fillStyle = obs.color || '#FF6347';
          ctx.beginPath();
          ctx.moveTo(25, 0);
          ctx.quadraticCurveTo(0, -15, -20, -5);
          ctx.lineTo(-20, 5);
          ctx.quadraticCurveTo(0, 15, 25, 0);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-20, 0);
          ctx.lineTo(-35, -12);
          ctx.lineTo(-30, 0);
          ctx.lineTo(-35, 12);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#FFF';
          ctx.beginPath();
          ctx.arc(12, -4, 3, 0, Math.PI * 2);
          ctx.fill();
          if (obs.onFire) drawFire(0, 0, 0.8);
          ctx.restore();
        }
      });

      // Draw Player (Penguin)
      const p = playerRef.current;
      const { px, py, scale } = project(p.x, p.y, 100, g.curveSegments, g.segmentOffset, g.cumulativeOffsets);
      
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(scale, scale);

      // Ground Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 40, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Waddling animation
      const waddle = Math.sin(p.animFrame) * 8;
      const isJumping = p.y < 0;
      
      if (!isJumping) {
        ctx.rotate(waddle * Math.PI / 180);
      }

      // Body
      ctx.fillStyle = '#000';
      if (g.hasSkateboard && !p.isJumping && p.stumbleTime <= 0) {
        // Skateboard Pose: Horizontal
        ctx.save();
        ctx.translate(0, -10);
        // Drawing Skateboard
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(-45, 0, 90, 8);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-30, 8, 5, 0, Math.PI * 2);
        ctx.arc(30, 8, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Penguin lying down
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(0, -15, 50, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        if (isJumping) {
          // Stretch body when jumping
          ctx.ellipse(0, -45, 30, 50, 0, 0, Math.PI * 2);
        } else {
          ctx.ellipse(0, -40, 35, 45, 0, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      
      // White highlight on head (Back reflection)
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.ellipse(-12, -72, 8, 4, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Wings
      ctx.fillStyle = '#000';
      // Flap wings rapidly when jumping
      const wingWobble = isJumping 
        ? Math.sin(Date.now() / 50) * 40 // Rapid flapping
        : Math.sin(p.animFrame) * 15;   // Normal waddle
      
      // Left Wing
      ctx.beginPath();
      ctx.moveTo(-30, -50);
      ctx.quadraticCurveTo(-60, -40 + wingWobble, -30, -20);
      ctx.fill();
      
      // Right Wing
      ctx.beginPath();
      ctx.moveTo(30, -50);
      ctx.quadraticCurveTo(60, -40 + wingWobble, 30, -20); // Symmetrical: both use + wingWobble
      ctx.fill();

      // Feet (Yellow)
      ctx.fillStyle = '#FFD700';
      
      if (p.stumbleTime > 0) {
        ctx.beginPath();
        ctx.ellipse(-18, -5, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(18, -25, 12, 8, 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (isJumping) {
        // Tucked feet when jumping
        ctx.beginPath();
        ctx.ellipse(-15, -15, 10, 6, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(15, -15, 10, 6, -0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Alternating feet movement for waddling
        const leftFootY = Math.sin(p.animFrame) > 0 ? -10 : -5;
        const rightFootY = Math.sin(p.animFrame) <= 0 ? -10 : -5;
        
        ctx.beginPath();
        ctx.ellipse(-18, leftFootY, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(18, rightFootY, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Skin accessories (red scarf, sunglasses, crown, golden sheen, ...)
      drawSkinAccessories(ctx, skinRef.current, {
        isJumping,
        hasSkateboard: g.hasSkateboard && !p.isJumping && p.stumbleTime <= 0,
        animFrame: p.animFrame,
      });

      // Propeller
      if (g.propellerTime > 0) {
        ctx.save();
        ctx.translate(0, -85);
        const propAngle = p.animFrame * 2;
        ctx.rotate(propAngle);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-30, -2, 60, 4);
        ctx.fillRect(-2, -30, 4, 60);
        ctx.restore();

        // Propeller shaft
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-2, -85, 4, 15);
      }

      // Fire Effect
      if (g.fireTime > 0) {
        drawFire(0, -20, 1);
      }

      ctx.restore();

      // Blizzard overlay (drawn last so it covers everything including the penguin)
      if (g.blizzardStrength > 0.02) {
        const s = g.blizzardStrength;
        // Whiteout veil
        ctx.fillStyle = `rgba(220, 230, 245, ${0.45 * s})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        // Snowflakes drift diagonally
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * s})`;
        for (const f of g.snowflakes) {
          // Update position
          f.sway += 0.08;
          f.x += Math.sin(f.sway) * 0.8 + 1.5;
          f.y += f.speed;
          if (f.y > CANVAS_HEIGHT) {
            f.y = -10;
            f.x = Math.random() * CANVAS_WIDTH;
          }
          if (f.x > CANVAS_WIDTH) f.x = 0;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
          ctx.fill();
        }
        // Vignette to push contrast
        const grad = ctx.createRadialGradient(
          CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.2,
          CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.7,
        );
        grad.addColorStop(0, 'rgba(200, 220, 240, 0)');
        grad.addColorStop(1, `rgba(180, 200, 230, ${0.5 * s})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        // Warning text on the first half of the storm
        if (g.blizzardActive > 2.5) {
          ctx.fillStyle = `rgba(20, 30, 60, ${0.6 * s})`;
          ctx.font = 'bold 36px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚠ 暴風雪來襲 ⚠', CANVAS_WIDTH / 2, 60);
        }
      }
    };

    update();
    return () => cancelAnimationFrame(frameId.current);
  }, [gameState]);

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
          : 'w-full max-w-[1000px] flex-1 justify-start pt-0'
      }`}>
        <div className={`w-full flex flex-col ${isFullscreen ? 'h-full' : 'flex-1 h-full'}`}>
          {/* HUD */}
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
                <p className="text-sm sm:text-xl font-mono font-bold text-white leading-tight">{Math.floor(score)}</p>
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
                <p className="text-sm sm:text-xl font-mono font-bold text-white leading-tight">{level}</p>
              </div>
            </div>
            {/* Cell 4: Time */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/20 flex flex-col justify-center items-center text-center">
              <Timer className="text-blue-400 w-4 h-4 sm:w-5 h-5 mb-0.5" />
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] uppercase tracking-wider opacity-60">時間</p>
                <p className={`text-sm sm:text-xl font-mono font-bold text-white leading-tight ${time < 20 ? 'text-red-400 animate-pulse' : ''}`}>
                  {Math.max(0, Math.floor(time))} 秒
                </p>
              </div>
            </div>
            {/* Cell 5: Distance */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/20 flex flex-col justify-center items-center text-center">
              <MapPin className="text-green-400 w-4 h-4 sm:w-5 h-5 mb-0.5" />
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] uppercase tracking-wider opacity-60">距離</p>
                <p className="text-sm sm:text-xl font-mono font-bold text-white leading-tight">{Math.max(0, Math.floor(distance))} 公尺</p>
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
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = e.clientX - rect.left;
                const internalX = x * (CANVAS_WIDTH / rect.width);
                
                g.isTouchAccelerating = true;
                g.touchDownTime = Date.now();
                
                // Determine lane based on touch position
                if (internalX < CANVAS_WIDTH * 0.3) {
                  g.touchLane = -1;
                } else if (internalX > CANVAS_WIDTH * 0.7) {
                  g.touchLane = 1;
                } else {
                  g.touchLane = 0;
                }
                playerRef.current.targetLane = g.touchLane;
              }}
              onPointerMove={(e) => {
                if (gameState !== 'PLAYING') return;
                const g = gameRef.current;
                if (!g.isTouchAccelerating) return;
                
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = e.clientX - rect.left;
                const internalX = x * (CANVAS_WIDTH / rect.width);
                
                if (internalX < CANVAS_WIDTH * 0.3) {
                  g.touchLane = -1;
                } else if (internalX > CANVAS_WIDTH * 0.7) {
                  g.touchLane = 1;
                } else {
                  g.touchLane = 0;
                }
                playerRef.current.targetLane = g.touchLane;
              }}
              onPointerUp={() => {
                if (gameState !== 'PLAYING') return;
                const g = gameRef.current;
                g.isTouchAccelerating = false;
                const duration = Date.now() - g.touchDownTime;
                if (duration < 250) {
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
              onPointerLeave={() => { if (gameRef.current) gameRef.current.isTouchAccelerating = false; }}
              onPointerCancel={() => { if (gameRef.current) gameRef.current.isTouchAccelerating = false; }}
            />

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
                      
                      {/* Left Side: Item Grid */}
                      <div className={`grid gap-1 p-1 bg-[#1a1a3a] border-2 border-[#3a3a5a] flex-shrink-0 ${
                        isPortrait && !mobileOpt ? 'grid-cols-4 h-[250px]' : 'flex-1 grid-cols-4 grid-rows-4'
                      }`}>
                        {(() => {
                          const itemsForLevel = gameRef.current.isGodMode ? ALL_SHOP_ITEMS : ALL_SHOP_ITEMS.slice(0, Math.min(16, 4 + level));
                          const placeholders = Array(Math.max(0, 16 - itemsForLevel.length)).fill(null).map((_, i) => ({ 
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
                    <span className="font-mono font-bold tracking-wider">{bestScore.toLocaleString()}</span>
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
                        <motion.div
                          animate={{ y: ["100%", "-100%"] }}
                          transition={{ 
                            duration: 75, 
                            ease: "linear", 
                            repeat: Infinity 
                          }}
                          className="space-y-12 py-10"
                        >
                          {[
                            { section: "敵人與陷阱", items: [
                              { name: "海豹", desc: "路徑上的伏兵，撞擊會跌倒損失大量時間。" },
                              { name: "冰裂縫", desc: "第二關開始出現。地板上的陷阱，掉入會大幅降低速度。" },
                              { name: "雪堆", desc: "第四關開始出現。厚重的積雪，撞擊會嚴重減速。" },
                              { name: "結冰區域", desc: "第七關開始出現。極其光滑的冰面，轉向能力會下降。" },
                              { name: "旗竿", desc: "沒撞擊到會錯失分數，路徑上的旗幟也能增加挑戰。" }
                            ]},
                            { section: "補給站商品", items: [
                              { name: "黃金碼表", desc: "下關開始生效：立即增加 10 秒計時。" },
                              { name: "特製螺旋槳", desc: "下關開始生效：讓下一次飛行持續時間翻倍。" },
                              { name: "噴射滑板", desc: "下關開始生效：地面時速翻倍，直到碰撞。" },
                              { name: "企鵝娃娃", desc: "下關開始生效：耗盡時間時獲得額外生命。" },
                              { name: "磁力項圈", desc: "下關開始生效：自動吸引所有魚片，持續 30 秒。" },
                              { name: "冰原護盾", desc: "下關開始生效：抵擋下一次碰撞造成的減速。" },
                              { name: "氮氣噴發", desc: "下關開始生效：啟動 5 秒極速衝刺且無敵。" },
                              { name: "高級偵測器", desc: "下關開始生效：該關卡金魚出現率增加。" },
                              { name: "白金碼表", desc: "下關開始生效：立即增加 30 秒計時。" },
                              { name: "重型雪靴", desc: "下關開始生效：碰撞冰縫不再跌倒，僅輕微減速。" },
                              { name: "流線領巾", desc: "下關開始生效：永久提升 10% 加速度與最速上限。" },
                              { name: "極光羅盤", desc: "下關開始生效：縮短該次任務 1000m。" },
                              { name: "神奇魚餌", desc: "下關開始生效：該關卡剩餘所有魚獲得 3 倍積分。" },
                              { name: "克羅諾斯之戒", desc: "下關開始生效：凍結計時鐘 15 秒。" },
                              { name: "反重力引擎", desc: "下關開始生效：直接獲得 20 秒長效飛行。" },
                              { name: "探險王之冠", desc: "下關開始生效：永久獲得 3 倍的分數與距離加成。" }
                            ]},
                            { section: "遊戲規則", items: [
                              { name: "冒險目標", desc: "在時間結束前抵達各關卡的終點（如石門國小）。" },
                              { name: "點數收集", desc: "收集魚片可獲得點數，用於補給站購買裝備。" },
                              { name: "生存技巧", desc: "儘可能避開障礙物，維持最高時速以刷新紀錄。" }
                            ]}
                          ].map((group, gIdx) => (
                            <div key={gIdx} className="space-y-6">
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
                          ))}
                        </motion.div>
                        {/* Gradient Fades for Scrolling */}
                        <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-[#000] to-transparent z-10" />
                        <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#000] to-transparent z-10" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center flex-wrap">
                  <button
                    onClick={() => initGame(false)}
                    className="group relative px-10 sm:px-12 py-3 sm:py-4 bg-blue-500 hover:bg-blue-400 rounded-full font-bold text-lg sm:text-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                  >
                    <Play fill="currentColor" size={20} />
                    開始冒險
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
                  <p className="text-3xl sm:text-5xl font-mono font-bold">{score}</p>
                </div>
                <div className="bg-black/30 px-5 sm:px-6 py-4 rounded-2xl border border-yellow-400/30">
                  <p className="text-[10px] sm:text-sm uppercase opacity-60 mb-1 flex items-center gap-1 justify-center">
                    <Trophy size={12} className="text-yellow-400" /> 最高分
                  </p>
                  <p className="text-3xl sm:text-5xl font-mono font-bold text-yellow-300">{bestScore}</p>
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
              <h2 className="text-7xl font-black mb-4 tracking-tighter">抵達終點！</h2>
              <p className="text-2xl mb-8 opacity-80">歡迎來到石門國小！</p>
              <div className="flex gap-4 mb-12">
                <div className="bg-black/20 p-6 rounded-2xl">
                  <p className="text-sm uppercase opacity-60 mb-1">得分</p>
                  <p className="text-4xl font-mono font-bold">{score}</p>
                </div>
                <div className="bg-black/20 p-6 rounded-2xl">
                  <p className="text-sm uppercase opacity-60 mb-1">時間獎勵</p>
                  <p className="text-4xl font-mono font-bold">+{Math.floor(time * 10)}</p>
                </div>
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

  {/* Achievements Modal */}
  <AnimatePresence>
    {showAchievements && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowAchievements(false)}
        className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
          onClick={e => e.stopPropagation()}
          className="bg-gradient-to-b from-[#1a1a3a] to-[#0a0a1a] border-2 border-blue-500/40 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Trophy className="text-yellow-400" /> 成就 ({achievementsUnlocked.size}/{allAchievements.length})
            </h2>
            <button
              onClick={() => setShowAchievements(false)}
              className="px-4 py-1 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-all"
            >
              關閉
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allAchievements.map(a => {
              const isUnlocked = achievementsUnlocked.has(a.id);
              const hideContent = !!a.secret && !isUnlocked;
              return (
                <div
                  key={a.id}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    isUnlocked
                      ? 'border-yellow-400/50 bg-yellow-500/10'
                      : 'border-white/10 bg-white/5 opacity-50'
                  }`}
                >
                  <div className={`text-3xl mb-1 ${isUnlocked ? '' : 'grayscale'}`}>
                    {hideContent ? '❓' : a.icon}
                  </div>
                  <p className="font-bold text-sm">{hideContent ? '???' : a.title}</p>
                  <p className="text-xs opacity-70">{hideContent ? '???' : a.description}</p>
                  {!isUnlocked && <p className="text-[10px] mt-1 opacity-50">🔒 未解鎖</p>}
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* Skin Picker Modal */}
  <AnimatePresence>
    {showSkinPicker && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowSkinPicker(false)}
        className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
          onClick={e => e.stopPropagation()}
          className="bg-gradient-to-b from-[#1a1a3a] to-[#0a0a1a] border-2 border-purple-400/40 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <span>🎨</span> 換造型
            </h2>
            <button
              onClick={() => setShowSkinPicker(false)}
              className="px-4 py-1 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-all"
            >
              關閉
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SKINS.map(skin => {
              const unlocked = isSkinUnlocked(skin, achievementsUnlocked, allAchievements.length);
              const selected = currentSkin === skin.id;
              return (
                <button
                  key={skin.id}
                  onClick={() => unlocked && setCurrentSkin(skin.id)}
                  disabled={!unlocked}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    selected
                      ? 'border-purple-400 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                      : unlocked
                      ? 'border-white/20 bg-white/5 hover:border-purple-400/50 cursor-pointer'
                      : 'border-white/10 bg-white/5 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className="text-4xl mb-1">{skin.emoji}</div>
                  <p className="font-bold text-sm">{skin.name}</p>
                  <p className="text-xs opacity-70 mt-0.5">{skin.description}</p>
                  {!unlocked && (
                    <p className="text-[10px] mt-2 opacity-60">🔒 {
                      skin.id === 'golden' ? '解開所有成就' :
                      skin.unlockAchievement === 'level-5' ? '解開冰原行者' :
                      skin.unlockAchievement === 'level-10' ? '解開極地勇者' :
                      '神秘解鎖條件'
                    }</p>
                  )}
                  {selected && (
                    <p className="text-[10px] mt-2 text-purple-300 font-bold">✓ 使用中</p>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-white/40 text-center mt-4">造型只是視覺，不影響玩法</p>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>

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
