# 🚀 部署到 GitHub Pages + 後續優化詳細步驟

> 給阿凱老師（`cagoooo`）的完整移植與改良指南。
> 📅 **最後更新**：2026-04-29 ｜ 🌐 **線上版**：https://cagoooo.github.io/penguin/

---

## 📊 當前完成狀態（截至 2026-04-29）

| 階段 | 完成度 | 重點 |
|---|---|---|
| **Phase 1** 上線 | ✅ 100% | GitHub Pages + Actions 自動部署 |
| **Phase 2** 玩家體驗 | ✅ 90% | 最高分／靜音／暫停／虛擬觸控（剩自適應尺寸） |
| **Phase 3** 程式碼健康 | ✅ 100% | 模組化／ESLint／TS strict／17 單元測試 |
| **Phase 4** 擴充功能 | ✅ 95% | PWA／成就／Firebase 排行榜（剩朋友邀請連結） |
| **🔒 安全強化** | ✅ 100% | API key 限制 + Secret Scanning 處理 |
| **Phase 5+** 未來改良 | ⬜ 待規劃 | 50+ 項建議見 [§六](#六未來改良藍圖phase-512) |

**目前統計**：
- 📦 Bundle：~227 KB gzip（react+motion+game+firebase 拆成 4 chunks）
- 🧪 測試：17 個單元測試，全綠
- 🔍 CI：typecheck + lint + test + build 四道關卡
- 🌐 線上：HTTP 200 OK，Service Worker 啟用，可離線玩

---

## 📑 目錄
- [一、可移植性評估](#一-可移植性評估tldr-100-可以)
- [二、移植到 GitHub 的詳細步驟](#二-移植到-github-的詳細步驟)
- [三、後續優化改良建議（依優先級排序）](#三-後續優化改良建議依優先級排序)
  - [P0 必做](#p0-必做先做這幾個)
  - [P1 強烈建議](#p1-強烈建議遊戲體驗類)
  - [P2 中期重構](#p2-中期重構程式碼健康度)
  - [P3 進階／加分](#p3-進階加分)
- [四、CI/CD 與部署自動化](#四-cicd-與部署自動化)
- [五、優化進度檢核清單](#五-優化進度檢核清單)
- [**六、未來改良藍圖（Phase 5–12）**](#六未來改良藍圖phase-512) ← Phase 5+ 50+ 項詳細建議

---

## 一、可移植性評估（TL;DR：100% 可以）

| 評估項 | 結論 | 說明 |
|---|---|---|
| 是否需要後端 | ❌ 不需要 | 純前端 React，所有狀態都在記憶體裡 |
| 是否真的用 Gemini API | ❌ 沒用 | `@google/genai` 只是依賴，**程式碼裡沒 import** |
| 是否需要 Firebase | ❌ 不需要 | 沒有登入、沒有資料庫、沒有 Storage |
| 是否需要敏感金鑰 | ❌ 不需要 | `.env.example` 列的 `GEMINI_API_KEY` 沒實際用途 |
| 打包後體積 | 估 ~500KB ~ 1MB | React 19 + motion + lucide-react，可放心 |
| 是否能離線玩 | ⚠️ 需加 PWA | 加 service worker 即可（見 P3） |
| 是否相容 GitHub Pages | ✅ 完美 | 純靜態檔案，不用 SSR |

**🎯 結論**：直接 build → push → 開啟 GitHub Pages 就能上線，全程 0 元、不需要計費方案。

---

## 二、移植到 GitHub 的詳細步驟

### 步驟 1：在資料夾內初始化 Git

```bash
cd /h/penguin

# 初始化 git
git init -b main

# 確認 .gitignore 已涵蓋 node_modules、dist、.env*（已存在，OK）
cat .gitignore
```

### 步驟 2：清理 AI Studio 模板殘留

> 這些不需要清也能跑，但保留會讓 bundle 變大、誤導維護者。

#### 2a. 移除沒用到的依賴
編輯 `package.json`，刪掉這幾行：

```diff
   "dependencies": {
-    "@google/genai": "^1.29.0",
     "@tailwindcss/vite": "^4.1.14",
     "@types/canvas-confetti": "^1.9.0",
     "@vitejs/plugin-react": "^5.0.4",
     "canvas-confetti": "^1.9.4",
-    "dotenv": "^17.2.3",
-    "express": "^4.21.2",
     "lucide-react": "^0.546.0",
     "motion": "^12.23.24",
     "react": "^19.0.0",
     "react-dom": "^19.0.0",
     "vite": "^6.2.0"
   },
   "devDependencies": {
-    "@types/express": "^4.17.21",
     "@types/node": "^22.14.0",
```

執行：
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 2b. 簡化 `vite.config.ts`（去掉 Gemini 注入）

```diff
 import tailwindcss from '@tailwindcss/vite';
 import react from '@vitejs/plugin-react';
 import path from 'path';
-import {defineConfig, loadEnv} from 'vite';
+import {defineConfig} from 'vite';

-export default defineConfig(({mode}) => {
-  const env = loadEnv(mode, '.', '');
-  return {
+export default defineConfig({
     plugins: [react(), tailwindcss()],
-    define: {
-      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
-    },
+    base: './',  // ⭐ 重要：GitHub Pages 子路徑相容
     resolve: {
       alias: {
         '@': path.resolve(__dirname, '.'),
       },
     },
     server: {
       hmr: process.env.DISABLE_HMR !== 'true',
     },
-  };
-});
+});
```

> **⚠️ 關鍵**：`base: './'` 讓打包後的資源用相對路徑載入，這樣放在 `cagoooo.github.io/penguin/` 子路徑也能正確載入 JS/CSS。

#### 2c. 刪除多餘檔案
```bash
rm .env.example     # 沒實際用
rm metadata.json    # AI Studio 專用
```

#### 2d. 修正 `package.json` 的 `clean` 腳本（跨平台）
```diff
   "scripts": {
     "dev": "vite --port=3000 --host=0.0.0.0",
     "build": "vite build",
     "preview": "vite preview",
-    "clean": "rm -rf dist",
+    "clean": "rimraf dist",
     "lint": "tsc --noEmit"
   },
```
並安裝：
```bash
npm i -D rimraf
```

#### 2e. 改寫 README.md
覆寫成你的：
```markdown
# 🐧 南極大冒險：企鵝跑酷

致敬 Konami 1983 經典《Antarctic Adventure》的 React 重製版。
> 由阿凱老師為石門國小學生製作

🎮 **線上玩**：https://cagoooo.github.io/penguin/
📖 **使用說明**：[USAGE.md](USAGE.md)

## 快速開始
\`\`\`bash
npm install
npm run dev   # → http://localhost:3000
\`\`\`

## 線上部署
\`\`\`bash
npm run build
# dist/ 內容會自動透過 GitHub Actions 部署
\`\`\`

## 操作
- ←→ 切換車道
- ↑/Space 跳躍
- ↓ 減速
- 隱藏指令：在開始畫面輸入 ↑↑↓↓←←→→AB 啟動 God Mode

🤖 Made with ❤️ by 阿凱老師
```

### 步驟 3：建立 GitHub Repo

```bash
# 用 gh CLI（你已認證為 cagoooo）
gh repo create penguin \
  --public \
  --description "🐧 南極大冒險：企鵝跑酷 - Konami 經典重製 (React + Vite)" \
  --source=. \
  --remote=origin

# 也可以加 topics
gh repo edit cagoooo/penguin \
  --add-topic game \
  --add-topic react \
  --add-topic typescript \
  --add-topic vite \
  --add-topic penguin
```

### 步驟 4：首次提交 + 推送

```bash
git add -A
git commit -m "🎮 init: penguin antarctic adventure remake"
git push -u origin main
```

### 步驟 5：建立 GitHub Actions Workflow（自動部署）

建立 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install
        run: npm ci

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 步驟 6：啟用 GitHub Pages（用 gh CLI 一鍵）

```bash
# 啟用 Pages，build_type=workflow（讓 Actions 接管）
gh api -X POST \
  -H "Accept: application/vnd.github+json" \
  /repos/cagoooo/penguin/pages \
  -f build_type=workflow

# 確認啟用狀態
gh api /repos/cagoooo/penguin/pages
```

### 步驟 7：推送觸發部署

```bash
git add .github/
git commit -m "🚀 ci: add GitHub Pages deploy workflow"
git push

# 觀察部署過程
gh run watch
```

### 步驟 8：驗證上線

```
✅ 部署成功後，網址會是：
   https://cagoooo.github.io/penguin/

📱 用手機開無痕模式測試（避開瀏覽器快取）
🎮 試試 Konami Code: ↑↑↓↓←←→→AB
```

---

## 三、後續優化改良建議（依優先級排序）

### P0 必做（先做這幾個）

#### ✅ 0-1. 修復觸控操作的 UX 問題
**問題**：目前手機觸控操作只有「長按左／右」與「輕點跳躍」，但畫面上**沒有顯示虛擬按鈕**，新手無法察覺。
**檔案**：`src/App.tsx` 第 2600 行附近 `{/* Virtual Controls Overlay (Only during PLAYING) */}` ← 註解保留但沒實作。

**改進方法**：在 `gameState === 'PLAYING'` 時加上半透明的虛擬搖桿與跳躍鈕。

```tsx
{gameState === 'PLAYING' && isPortrait && (
  <div className="absolute inset-0 z-50 pointer-events-none flex justify-between items-end p-6">
    <div className="flex gap-4 pointer-events-auto">
      <button className="w-16 h-16 bg-white/20 backdrop-blur rounded-full" onTouchStart={...}>←</button>
      <button className="w-16 h-16 bg-white/20 backdrop-blur rounded-full" onTouchStart={...}>→</button>
    </div>
    <button className="w-20 h-20 bg-blue-500/40 backdrop-blur rounded-full pointer-events-auto" onTouchStart={...}>
      <ArrowUp size={28} />
    </button>
  </div>
)}
```

#### ✅ 0-2. 加上「最高分」記錄（localStorage）
**現況**：每次刷新分數歸零，沒有競爭感。
**改進**：加 localStorage 記最高分。

```tsx
// 在 GAME_OVER 畫面：
useEffect(() => {
  if (gameState === 'GAME_OVER') {
    const best = parseInt(localStorage.getItem('penguin_best') || '0');
    if (score > best) {
      localStorage.setItem('penguin_best', String(score));
      // 觸發新紀錄特效
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    }
  }
}, [gameState, score]);
```

並在開始畫面顯示「歷史最高分：XXX」。

#### ✅ 0-3. 加上「阿凱老師作者頁尾」
依 user-global skill `akai-author-footer` 規定，所有阿凱老師的網站都應該掛上頁尾連結。

在 `src/App.tsx` 最外層 `<div>` 結尾前加：

```tsx
<footer className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-white/40 z-[9999] pointer-events-auto">
  Made with ❤️ by{' '}
  <a
    href="https://www.smes.tyc.edu.tw/aboutme/index.aspx?Parser=24,3,40,,,,,,,,,,,,,,,8404"
    target="_blank"
    rel="noopener noreferrer"
    className="underline hover:text-white"
  >
    阿凱老師
  </a>
</footer>
```

> ⚠️ 注意：上面的 URL 是學校教師頁的格式範例，請改成正確的阿凱老師個人頁網址（可在學校網站「教師專區」找到）。

#### ✅ 0-4. 設定正確的 `<title>` 與 OG meta（社群分享預覽）
**現況**：`index.html` 裡 `<title>` 是 `My Google AI Studio App`，社群分享出去不好看。

```html
<!doctype html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>南極大冒險 · 企鵝跑酷｜阿凱老師</title>
    <meta name="description" content="致敬 Konami 1983 經典遊戲。帶領企鵝穿越冰原，避開海豹與冰縫，抵達石門國小！" />
    <meta name="theme-color" content="#0a0a1a" />
    
    <!-- Open Graph -->
    <meta property="og:title" content="南極大冒險 · 企鵝跑酷" />
    <meta property="og:description" content="Konami 經典遊戲重製版" />
    <meta property="og:image" content="https://cagoooo.github.io/penguin/og-image.png" />
    <meta property="og:url" content="https://cagoooo.github.io/penguin/" />
    <meta property="og:type" content="website" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body class="bg-black">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

> 用 `og-social-preview-zh` skill 可自動產生 1200×630 的中文 OG 圖（避免方框）。

---

### P1 強烈建議（遊戲體驗類）

#### 🎯 1-1. 拆分 `App.tsx`（目前 2607 行，難以維護）
**現況**：所有東西都塞在 `App.tsx`。
**目標結構**：

```
src/
├── main.tsx
├── App.tsx                  ← 只剩 100 行內，做狀態切換
├── audio/
│   ├── audioContext.ts      ← initAudio, playTone
│   ├── sounds.ts            ← sounds.jump, sounds.fish 等
│   └── bgm.ts               ← Skater's Waltz 譜 + startBGM/stopBGM
├── game/
│   ├── constants.ts         ← CANVAS_WIDTH, MAX_SPEED 等
│   ├── render.ts            ← canvas 繪製函數
│   ├── physics.ts           ← project(), 碰撞偵測
│   ├── obstacles.ts         ← 障礙物 spawn 與更新
│   └── gameLoop.ts          ← requestAnimationFrame 主迴圈
├── shop/
│   ├── items.ts             ← ALL_SHOP_ITEMS 定義
│   └── ShopScreen.tsx       ← 商店 UI
├── screens/
│   ├── StartScreen.tsx
│   ├── GameOverScreen.tsx
│   ├── LevelClearScreen.tsx
│   └── PlayingHUD.tsx
├── input/
│   ├── keyboard.ts
│   ├── touch.ts
│   └── gamepad.ts
└── hooks/
    ├── useFullscreen.ts
    ├── useKonamiCode.ts
    └── useBestScore.ts
```

**重構步驟**：
1. 先提 `audio/` 和 `game/constants.ts`（最獨立）
2. 再提 `shop/items.ts`（道具陣列在程式碼中重複了 3 處！）
3. 再提各 Screen 組件
4. 最後處理 game loop 與 canvas 繪製

#### 🎯 1-2. 修掉 ALL_SHOP_ITEMS 重複定義的 bug
在 `App.tsx` 中我看到至少有 **3 處**幾乎一樣的商店物品列表（line 165、line 494、line 2258、line 2304），維護地獄！

**改進**：抽到 `src/shop/items.ts`，所有地方共用。

```typescript
// src/shop/items.ts
export interface ShopItem {
  id: string;
  name: string;
  iconKey: string;
  desc: string;
  price: number;
  applyEffect: (g: GameState) => void;
}

export const ALL_SHOP_ITEMS: ShopItem[] = [
  { id: 'timer', name: '黃金碼表', iconKey: 'clock', price: 10000, desc: '...', applyEffect: g => { g.time += 10; } },
  // ...
];
```

#### 🎯 1-3. 加上音量控制 + 靜音切換
**現況**：BGM 一播就停不下來，只能用瀏覽器分頁靜音。
**改進**：HUD 右上角加 🔊／🔇 圖示，點擊切換 + localStorage 記住。

```tsx
const [muted, setMuted] = useState(() => localStorage.getItem('muted') === '1');

// 在 playTone 開頭加：
const playTone = (...) => {
  if (muted) return;
  // ...
};
```

#### 🎯 1-4. 加上「暫停」功能
**現況**：開始遊戲就停不下來。
**改進**：按 `P` 或 `Esc` 暫停，再按一次繼續。

```tsx
const [paused, setPaused] = useState(false);
// game loop 內加 if (paused) return;
```

#### 🎯 1-5. 排行榜（搭配 Supabase 免費層）
進階：用 Supabase（免費層綽綽有餘）做雲端排行榜。
- 不要強制登入，存「暱稱+分數」即可
- 用 `supabase-google-oauth-integration` skill 可一鍵串好

#### 🎯 1-6. 解決畫面尺寸固定 800×600 的問題
**現況**：Canvas 固定 800×600，在大螢幕上會變很小、在直立手機上比例怪怪的。
**改進**：用 CSS `aspect-ratio` + `transform: scale` 自適應視窗。

或更進一步：把 Canvas 邏輯改用 ResizeObserver，動態調整 `CANVAS_WIDTH`、`CANVAS_HEIGHT`。

---

### P2 中期重構（程式碼健康度）

#### 🔨 2-1. 加上 ESLint + Prettier
```bash
npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
         eslint-plugin-react eslint-plugin-react-hooks prettier
```

建立 `.eslintrc.cjs` 與 `.prettierrc`。CI 加上 lint 步驟。

#### 🔨 2-2. 把 `gameRef.current` 拆成多個 ref + 用 reducer
**現況**：`gameRef.current` 內塞了 30+ 個欄位，當作 mutable global。
**改進**：分成 `gameStateRef`（時間、分數）、`playerRef`（位置、速度）、`itemsRef`（道具狀態）。

或用 `useReducer` + 不可變狀態，清晰許多。

#### 🔨 2-3. 抽出常數魔術數字
`MAX_SPEED = 40` / `JUMP_FORCE = -14` 這種還好，但程式中到處有 `obs.z < 1200`、`heightTolerance = 40` 這類魔術數字，建議集中到 `constants.ts`。

#### 🔨 2-4. 加上單元測試
```bash
npm i -D vitest @vitest/ui happy-dom @testing-library/react
```

優先測試：
- `project()` 函數的偽 3D 投影是否正確
- 商店購買邏輯（餘額、pendingShopItems）
- Konami Code 偵測

#### 🔨 2-5. TypeScript 嚴格模式
`tsconfig.json` 目前沒開 `strict`，補上：
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```
然後修補所有 `(window as any)` 之類的逃避型別。

---

### P3 進階／加分

#### ✨ 3-1. PWA 化（離線可玩）
加 `vite-plugin-pwa`：
```bash
npm i -D vite-plugin-pwa
```

`vite.config.ts`：
```ts
import { VitePWA } from 'vite-plugin-pwa';

plugins: [
  react(),
  tailwindcss(),
  VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: '南極大冒險',
      short_name: '企鵝跑酷',
      theme_color: '#0a0a1a',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
  }),
],
```

> ⚠️ PWA 加完後若改了程式但使用者看舊版，請參考 `pwa-cache-bust` skill 處理快取。

#### ✨ 3-2. 多語系 i18n（中／英／日）
用 `react-i18next`，把繁中字串抽出。為什麼？因為遊戲懷舊感對日本玩家特別有共鳴。

#### ✨ 3-3. 成就系統（Achievements）
- 第一次通關
- God Mode 啟動
- 收集所有道具
- 累積跑 10000m
- 連續通 5 關

每個成就觸發時跳出徽章 + confetti，可放 localStorage。

#### ✨ 3-4. Replay / 影片分享
用 MediaRecorder API 錄遊戲過程（最後 30 秒），通關後可下載或分享到社群。

#### ✨ 3-5. WebGL / Three.js 升級畫面
目前是 Canvas 2D 偽 3D。若要升級成真 3D，可改用 React Three Fiber：
```bash
npm i three @react-three/fiber @react-three/drei
```

效果：真實山脈、光照、極光粒子系統。**但工作量大，建議當「v2.0」**。

#### ✨ 3-6. 排行榜（Supabase Free Tier）
- Free Tier 完全夠用（500MB DB + 50,000 月活）
- 用 `supabase-secrets-for-browser-apis` skill 處理 anon key 設置
- 表結構：`leaderboard(id, nickname, score, level_reached, created_at)`

---

## 四、CI/CD 與部署自動化

### 4-1. 加上 PR 預檢
建立 `.github/workflows/check.yml`：

```yaml
name: PR Check
on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run build  # 確保 PR 不會把 build 弄壞
```

### 4-2. 自動標版本（Conventional Commits）
搭配 `release-please-action`，每次 push 自動建立 release PR + tag。

### 4-3. 部署到備援平台（Vercel / Cloudflare Pages）
GitHub Pages 偶爾會掛，可同時部署到 Cloudflare Pages 當備案：
1. 連 GitHub repo 給 Cloudflare Pages
2. Build command: `npm run build`
3. Output directory: `dist`
4. **在 Cloudflare 設定**：Build settings → Environment variables → 加 `NODE_VERSION = 22`

### 4-4. 部署完自動驗證
寫一個 Playwright smoke test：
```ts
test('遊戲可以開始', async ({ page }) => {
  await page.goto('https://cagoooo.github.io/penguin/');
  await page.click('text=開始冒險');
  await expect(page.locator('canvas')).toBeVisible();
});
```

每次部署完跑一次，失敗就 GitHub Issue 自動開出來。

---

## 五、優化進度檢核清單

> 📅 最後更新：2026-04-29

### ✅ Phase 1：上線（已完成）
- [x] 清理 AI Studio 殘留依賴（`@google/genai`、`express`、`dotenv` 全砍）
- [x] `vite.config.ts` 加 `base: './'`
- [x] 建立 GitHub repo + Actions workflow + Pages 啟用
- [x] 線上驗證 200 OK
- [x] 阿凱老師作者頁尾（含「共同開發者：antarctic」）
- [x] 繁中 `<title>` + OG meta + 企鵝 emoji favicon

### ✅ Phase 2：玩家體驗（已完成）
- [x] 行動裝置虛擬觸控按鈕（左/右切道 + 跳躍鈕，僅小螢幕顯示）
- [x] localStorage 最高分 + GAME_OVER「新紀錄」動畫
- [x] 🔇 靜音切換（HUD 按鈕 + localStorage）
- [x] ⏸ 暫停功能（P / Esc / HUD 按鈕，遮罩 + 繼續）
- [ ] 自適應畫面尺寸（Canvas 仍固定 800×600，桌機沒問題、手機有縮放空間）

### ✅ Phase 3：程式碼健康（已完成）
- [x] 拆分 App.tsx → `src/shop/`、`src/audio/`、`src/game/`、`src/achievements/`、`src/leaderboard/`
- [x] **消除 ALL_SHOP_ITEMS 4 處重複定義**（單一真實來源 in `src/shop/items.ts`）
- [x] ESLint 9 flat config（typescript-eslint + react-hooks + react-refresh）
- [x] TypeScript strict 模式啟用 + `@types/react` 補裝
- [x] Vitest 4 + 17 個單元測試（shop / constants / achievements）
- [x] CI workflow 加入 typecheck → lint → test → build 四道關卡

### ✅ Phase 4：擴充功能（已完成）
- [x] PWA 化（vite-plugin-pwa、Service Worker、manifest、可離線）
- [x] 10 個成就 + toast UI + Modal 列表 + localStorage
- [x] **Firebase 雲端排行榜**（不是 Supabase；新建 `penguin-leaderboard` 專案、Firestore asia-east1、嚴格 rules）
- [x] GAME_OVER 直接輸暱稱上傳，前 10 名即時更新
- [x] 🔒 API Key 加 HTTP referrer + API 白名單限制
- [x] 🛡️ GitHub Secret Scanning Alert dismiss as false_positive
- [ ] 排行榜的好友邀請連結（分享 URL 帶分數，如 `?challenge=12345`）

### ⬜ Phase 5：v2.0（半年內）
- [ ] Three.js 真 3D 重製（見下方詳細評估）
- [ ] i18n 多語系（中／英／日）
- [ ] Replay 錄影分享（MediaRecorder API）

---

> 📦 **下方「六、未來改良藍圖」**整理了 Phase 5+ 之後的 50+ 項建議，依「立即就能做」→「需要外部協助」分類，可挑著做。

---

## 六、未來改良藍圖（Phase 5–12）

> 以下每項都標註：
> - 🟢 **難度**：⭐ 1 顆星（30 分鐘內）／⭐⭐ 半天／⭐⭐⭐ 1-3 天／⭐⭐⭐⭐ 1 週／⭐⭐⭐⭐⭐ 1 個月+
> - 💎 **價值**：玩家有感／開發體驗／長期維護
> - 🔧 **可由 Claude 自動執行**（✅／部分／❌）

### 📐 Phase 5 — 效能與打磨（Performance & Polish）

#### 5-1. 動態載入 Firebase ⭐⭐ ✅
**為什麼**：目前 Firebase chunk 是 84KB（gzip），不開排行榜也會載入。改成用 React `lazy` + `Suspense`，只在按下「排行榜」按鈕時才下載。
**省**：首次載入快 0.5–1 秒（特別是行動網路）。
**怎麼做**：
```tsx
const LeaderboardModal = lazy(() => import('./leaderboard/LeaderboardModal'));

{showLeaderboard && (
  <Suspense fallback={<LoadingSpinner />}>
    <LeaderboardModal onClose={...} />
  </Suspense>
)}
```
需要先把 leaderboard JSX 抽到獨立檔案。

#### 5-2. Canvas 尺寸自適應 ⭐⭐ ✅
**現況**：`CANVAS_WIDTH = 800` / `CANVAS_HEIGHT = 600` 固定值。在 4K 螢幕只佔小小一塊，在橫向手機切下方又看不全。
**怎麼做**：用 `ResizeObserver` 動態調整 Canvas 尺寸，重新計算 `HORIZON_Y`、`LANE_PIXELS` 比例。或保持邏輯尺寸 800×600 + CSS `aspect-ratio` + `transform: scale()` 自動撐滿。
**注意**：偽 3D 投影公式都用 `CANVAS_WIDTH/2` 當中心，要小心不能破壞透視感。

#### 5-3. `prefers-reduced-motion` 支援 ⭐ ✅
**為什麼**：阿凱老師可能有學生對動畫敏感（暈動症 / 注意力障礙）。
**怎麼做**：
```tsx
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
// 傳給 motion 組件
<motion.div animate={prefersReducedMotion ? false : { ... }} />
```

#### 5-4. 觸覺回饋（Vibration API）⭐ ✅
**為什麼**：手機玩家撞到障礙、收魚、按按鈕時有震動會更爽。
**怎麼做**：
```ts
const haptic = (pattern: number | number[]) => {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
};
// 在 sounds.hit 旁邊加 haptic(50);
```
免費，相容性好（除了 iPhone Safari，但會 silently fail 不會壞）。

#### 5-5. React 19 Concurrent Features ⭐⭐⭐ ✅
**現況**：所有 state 更新都同步。
**升級**：用 `useTransition` + `useDeferredValue`：
- 排行榜 modal 開啟動畫不被 Firebase 訂閱卡住
- 開始畫面背景動畫不被滾動文字 thrash

#### 5-6. Bundle Size Monitoring（size-limit）⭐⭐ ✅
**為什麼**：避免後續加套件不知不覺把 bundle 撐到 1MB+。
**怎麼做**：
```bash
npm i -D size-limit @size-limit/preset-app
```
建 `.size-limit.json` + 加進 CI，超過上限就 fail。

#### 5-7. Lighthouse CI ⭐⭐⭐ ✅
**為什麼**：每次部署自動測效能/SEO/a11y 分數，分數掉就告警。
**怎麼做**：加 `.github/workflows/lighthouse.yml`，用 `treosh/lighthouse-ci-action`。

#### 5-8. 圖片資產優化 ⭐⭐ 部分
**現況**：所有圖示都是 SVG（已經很小），但若以後加 PNG 角色圖，要走 `vite-plugin-image-optimizer`。

#### 5-9. 字型優化 ⭐⭐ ✅
**現況**：用瀏覽器預設字型。若想改用 Google Fonts（如 Press Start 2P 8-bit 風）：
- 用 `@fontsource/press-start-2p`（self-host，沒有 CDN 風險）
- subsetting 只載入需要的字（CJK 中文要小心，全字集 5MB+）

---

### 🎮 Phase 6 — 遊戲設計擴充（Game Design Enhancements）

#### 6-1. 新障礙物：北極熊 / 冰山 / 暴風雪 ⭐⭐⭐ ✅
**為什麼**：目前只有 5 種障礙（HOLE/CRACK/SEAL/SNOWDRIFT/ICE_PATCH），15 關玩到後面太單調。
**建議新增**：
| 名稱 | 解鎖關卡 | 效果 |
|---|---|---|
| 🐻‍❄️ 北極熊 | L9+ | 水平移動會追蹤玩家車道，撞到 -2 條命 |
| 🏔️ 冰山 | L11+ | 整條車道擋住，必須跳過 |
| 🌨️ 暴風雪 | L13+ | 短暫遮蔽視線（Canvas 半透明白色 overlay） |
| 🔥 火山熔岩 | L15+ | 終局關卡，全動態障礙 |

**程式檔案**：`src/App.tsx` 的 `Obstacle['type']` union type，加完就改 spawn 邏輯。

#### 6-2. 新道具：傳送門 / 時光倒流 / 雙人企鵝 ⭐⭐ ✅
- **🌀 傳送門 (60,000)**：跳過 500m 距離
- **⏮️ 時光倒流 (40,000)**：撞到障礙時自動 rewind 1 秒
- **🐧🐧 雙人企鵝 (90,000)**：同時控制兩隻企鵝（左右各一）

抽到 `src/shop/items.ts` 即可，不用動 UI。

#### 6-3. 每日挑戰 ⭐⭐⭐⭐ ✅
**為什麼**：留住玩家、提升回訪率。
**怎麼做**：
- 每天用日期當 seed 產生固定關卡（同一天所有玩家挑戰一樣的地圖）
- Firestore 加 `daily_leaderboard/{YYYY-MM-DD}` 子集合
- 開始畫面顯示「今日挑戰：⭐⭐⭐ 預估難度」

#### 6-4. 時間競速模式（Time Attack）⭐⭐⭐ ✅
固定距離（如 5000m），看誰跑最快。獨立排行榜。

#### 6-5. Boss 戰：企鵝王 ⭐⭐⭐⭐ ✅
**目標**：在第 20 關打敗會丟雪球的「企鵝王」。
**機制**：HP bar、躲雪球攻擊、收集藍旗反擊。
**獎勵**：解鎖「探險王之冠」永久免費版。

#### 6-6. 季節限定活動 ⭐⭐⭐ ✅
- **聖誕節**：背景下雪、收聖誕老人帽得 5000 分
- **農曆新年**：紅包、龍年金龍企鵝皮膚
- **暑假**：海灘關卡（沙灘 vs 冰原對比）

用 `new Date()` 自動偵測，免維護。

#### 6-7. 企鵝皮膚／配件 ⭐⭐⭐ ✅
**怎麼做**：用累積成就解鎖：
| 成就條件 | 解鎖 |
|---|---|
| 通過 5 關 | 紅領巾企鵝 |
| 通過 10 關 | 太陽眼鏡企鵝 |
| 達成所有成就 | 金色企鵝（會發光） |
| God Mode | 戴皇冠企鵝 |

純畫面變化，存 localStorage，不用後端。

#### 6-8. 自製關卡編輯器 ⭐⭐⭐⭐⭐ ✅
**用途**：阿凱老師可以做「老師專屬關卡」，學生玩固定地圖比拚分數。
**架構**：
- 關卡資料 = JSON（陣列：每段 z 距離放什麼障礙）
- 編輯器 UI 用拖放
- 上傳到 Firestore `custom_levels/{slug}`
- 分享 URL：`?level=teacher-akai-001`

---

### 🌍 Phase 7 — 多人 / 社群（Multiplayer & Social）

#### 7-1. 即時雙人對戰 ⭐⭐⭐⭐⭐ 部分
**機制**：兩個玩家同時跑相同地圖（用同一 random seed），即時 Firestore presence 顯示對方位置。
**難點**：60fps 同步太貴，建議改成「鬼影模式」（看對方 1 秒前的位置）。

#### 7-2. 朋友邀請賽 ⭐⭐ ✅
**機制**：通關後產生分享連結 `?challenge=eyJ...`（base64 編碼挑戰參數），朋友打開直接挑戰你的紀錄。
**價值**：病毒式傳播，學生在班上分享。

#### 7-3. 截圖分享 ⭐⭐ ✅
通關時用 `html2canvas` 或 Canvas API 直接擷圖，加上「我在企鵝跑酷拿到 XX 分！」 + QR Code，下載 PNG 或直接 Web Share API 分享到 LINE。

#### 7-4. Replay 影片下載 ⭐⭐⭐ ✅
用 `MediaRecorder` 錄整個 Canvas，通關後可下載 mp4。
**注意**：時間越長檔案越大，建議只錄最後 30 秒。

#### 7-5. 學校/班級私人排行榜 ⭐⭐⭐⭐ ✅
**機制**：
- 加 `class_id` 欄位到 Firestore
- 老師發配對碼（如 `SHIMEN-A6`）給學生
- URL 帶 `?class=SHIMEN-A6` → 只看該班排名

---

### ♿ Phase 8 — 無障礙與國際化（A11y & i18n）

#### 8-1. i18n 多語系 ⭐⭐⭐ ✅
**為什麼**：日本玩家對 Konami 致敬遊戲特別有共鳴。
**怎麼做**：
```bash
npm i react-i18next i18next i18next-browser-languagedetector
```
把所有繁中字串抽到 `src/i18n/locales/zh-TW.json`、`en.json`、`ja.json`。
**起手式**：先做最常見字串（按鈕、HUD、商店名），其他先 fallback 中文。

#### 8-2. 螢幕閱讀器支援 ⭐⭐⭐ ✅
**現況**：所有按鈕已有 `aria-label`。
**還缺**：
- HUD（分數/距離/時間）用 `role="status"` + `aria-live="polite"`
- 撞到障礙物時 `aria-announce`
- 商店物品圖示要有文字替代

#### 8-3. 色盲模式 ⭐⭐ ✅
**現況**：紅/黃/綠魚用顏色區分（紅綠色盲看不出）。
**怎麼做**：加 settings → 色盲模式 → 改用形狀（◯△▢）+ 顏色雙重編碼。

#### 8-4. 鍵盤可重綁定 ⭐⭐⭐ ✅
**為什麼**：左撇子或習慣 IJKL 的玩家。
**怎麼做**：settings → 自訂 → 點「跳躍」→ 按下任意鍵就綁定。

#### 8-5. 難度等級 ⭐⭐⭐ ✅
**現況**：難度跟著關卡走，新手第 5 關就死。
**改進**：開始畫面選 簡單／普通／困難：
- 簡單：時間 +50%、障礙 -30%、初始 1 條命
- 困難：時間 -20%、障礙 +30%、God Mode 也不無敵

---

### 📊 Phase 9 — 分析與監控（Analytics & Telemetry）

#### 9-1. Plausible / Umami 分析 ⭐⭐ ✅
**為什麼**：知道有多少人玩、來自哪裡、停留多久。
**為什麼不是 Google Analytics**：Plausible/Umami 隱私友善（無 cookie、GDPR 合規），對小學專案更合適。
**選 Plausible**：付費 $9/月起，但開源版可自架。
**選 Umami**：完全免費自架，省事可用 [umami.is](https://umami.is/) 雲端版。

#### 9-2. Sentry 錯誤監控 ⭐⭐ ✅
**為什麼**：學生回報「壞掉」但你重現不了 → Sentry 自動把 stack trace + 瀏覽器資訊送過來。
**免費額度**：每月 5,000 errors，對小學專案綽綽有餘。
```bash
npm i @sentry/react
```

#### 9-3. Web Vitals 上報 ⭐⭐ ✅
LCP/FID/CLS 三大指標，傳到 Plausible 或 Umami custom events，看效能趨勢。

#### 9-4. A/B 測試 UI 變體 ⭐⭐⭐⭐ 部分
**用例**：要不要把「開始冒險」按鈕從藍色改成綠色，先 50/50 灰度測 A/B 哪個點擊率高。
**工具**：GrowthBook（免費自架）或 Vercel Edge Config。

---

### 🚀 Phase 10 — 現代化 / 進階（Pro Modernization）

#### 10-1. Three.js / React Three Fiber 真 3D ⭐⭐⭐⭐⭐ ✅
**現況**：Canvas 2D 偽 3D，效果很棒但已經是天花板。
**升級到真 3D 後可獲得**：
- 真實山脈光照（太陽位置會變動）
- 極光粒子系統（Shader 寫的真極光）
- 企鵝 3D 模型（旋轉、表情變化）
- 後處理特效（Bloom、Motion Blur、景深）
- 空間音效（聲源距離 attenuation）

**工作量**：1-3 週重寫 game loop，但 UI/HUD 部分可保留。
**建議**：當作 v2.0 大改版，做完保留 1.x 在 `legacy` 分支。

#### 10-2. WebGPU 高效粒子 ⭐⭐⭐⭐⭐ 部分
雪花、衝刺火焰用 WebGPU compute shader，可同時跑 100k 粒子不掉幀。
僅 Chrome 113+ 與 Safari 18+ 支援，要做 fallback。

#### 10-3. Cloud Functions 反作弊 ⭐⭐⭐⭐ ✅
**現況**：排行榜分數來自客戶端，理論上玩家可開 DevTools 直接 `submitScore('我', 999999, 1)`。
**改進**：Cloud Functions for Firebase + 收集「分數—距離—時間」比例做合理性檢查，超過合理上限拒絕寫入。
**成本**：Firebase Blaze 方案才能用 Functions，但每月 200萬次調用免費，這專案絕對用不完。

#### 10-4. Firebase Anonymous Auth ⭐⭐ ✅
**現況**：排行榜誰都可寫，名字隨便填。
**改進**：加匿名登入 → 每個瀏覽器一個 uid → 同 uid 只保留最高分（自動覆蓋）。
- 玩家不用註冊
- 防止單人灌爆排行榜
- uid 還可以做「同一人多次破紀錄」的時間線

#### 10-5. PostHog Session Replay ⭐⭐⭐ ✅
觀察學生實際操作（哪裡卡住、哪裡退出），找出 UI 問題。
**注意**：要在隱私政策說明，未成年用戶要家長同意。

---

### 🏗️ Phase 11 — 基礎設施（Infrastructure）

#### 11-1. PR Preview Deployments ⭐⭐⭐ ✅
**為什麼**：開 PR 自動產生 `https://cagoooo.github.io/penguin/pr-42/` 預覽連結。
**怎麼做**：Cloudflare Pages 原生支援，或用 GitHub Pages + 子目錄部署。

#### 11-2. Visual Regression Testing ⭐⭐⭐⭐ ✅
**為什麼**：改 CSS 容易不小心把 HUD 弄壞。
**怎麼做**：Playwright + `expect(page).toHaveScreenshot()`，每個關鍵畫面快照，diff 超過 0.1% 就 fail。

#### 11-3. Conventional Commits + Auto Changelog ⭐⭐ ✅
用 [release-please](https://github.com/googleapis/release-please)：
- 看 commit 訊息（feat: / fix: / chore:）自動算版本號
- 自動產 CHANGELOG.md
- 自動建 GitHub Release

我們現在的 commit 都已經是這個格式了，加進去 30 分鐘搞定。

#### 11-4. 自訂網域 ⭐⭐ ✅
**現況**：`cagoooo.github.io/penguin/`
**改成**：`penguin.akai-laoshi.com`（如果你有買網域）
- 加 CNAME 到 GitHub Pages
- Cloudflare 前端 CDN
- 證書自動續

#### 11-5. Renovate / Dependabot 自動升依賴 ⭐ ✅
**為什麼**：每月自動開 PR 升級套件，CI 跑過就 merge。
**設定**：丟一個 `.github/renovate.json` 進去就好。

#### 11-6. Bundle 分析 ⭐⭐ ✅
```bash
npm i -D rollup-plugin-visualizer
```
產生互動式 treemap，看哪個套件最肥。

#### 11-7. Service Worker 預熱排行榜資料 ⭐⭐⭐ 部分
背景 sync 排行榜前 10 名，玩家打開時瞬間看到（即使離線）。

---

### 🎓 Phase 12 — 教學專屬擴充（Education-Specific）

> **這一段是阿凱老師專屬：把遊戲變教材**

#### 12-1. 教師後台儀表板 ⭐⭐⭐⭐ 部分
**功能**：
- 看本班所有學生最高分
- 哪些成就解鎖了
- 平均通過關卡
- 出題：「全班合作累積跑 100 萬公尺」

**架構**：另一個 `/teacher` 路徑，需 Google 登入驗證老師身分。

#### 12-2. 程式碼開放教學 ⭐⭐ ✅
**怎麼做**：在資訊課用這個專案教：
- 第 1 課：怎麼讀 GitHub repo
- 第 2 課：偽 3D 投影怎麼算（`src/App.tsx` 的 `project()` 函數）
- 第 3 課：Konami Code 是怎麼偵測的（`useEffect` + KeyboardEvent）
- 第 4 課：學生改源碼加自己的成就，部署到自己的 GitHub Pages

#### 12-3. 課程嵌入式挑戰 ⭐⭐⭐⭐ ✅
**範例**：
- 「修改 `MAX_SPEED` 從 40 改 60，看遊戲變多快」
- 「在 `ALL_SHOP_ITEMS` 加一個自己設計的道具」
- 「把鍵盤控制從 WASD 改成 IJKL」

學生 fork repo → 改 → 在自己的 PR 比效果。**直接整合 Git 教學！**

#### 12-4. 數學教學版 ⭐⭐⭐⭐⭐ ✅
**用遊戲機制教數學**：
- 老師設定「分數 = 距離 × 速度」公式，學生算各種策略哪個分數高
- 「平均速度 vs 瞬時速度」用 HUD 即時顯示
- 「機率」用魚的色彩出現比例（紅 50% / 黃 30% / 綠 20%）

#### 12-5. 開源教育授權 ⭐ ✅
加 LICENSE 檔案（MIT 或 CC-BY-NC-SA）：
- 其他老師可以 fork 改成自己學校版
- 阿凱老師留名

---

### 🐛 Phase 13 — 已知問題待修（Known Issues Backlog）

> 開發過程發現但還沒處理的小問題：

| 問題 | 影響 | 優先級 |
|---|---|---|
| Canvas 固定 800×600，桌機 4K 時太小 | 中 | P2 |
| Node 20 actions 將於 2026-09 廢棄，需升 v5 | 低 | P3 |
| `App.tsx` 還有 ~2400 行，可繼續拆 Screens / Game Loop | 低 | P3 |
| `gameRef.current` 30+ 個欄位，可拆成多個 ref + reducer | 低 | P3 |
| 排行榜沒分頁（超過 10 筆只看 top 10） | 低 | P2 |
| 暫停時 BGM 沒淡出，是直接停 | 極低 | P3 |
| 觸控按鈕只有「點下去」沒有 long-press 持續切換 | 中 | P2 |

---

### 🗺️ 建議執行順序（給阿凱老師）

如果有時間做下一輪改良，建議這個順序（每個都有立即的玩家有感效益）：

**🥇 第一波（共 1 天，高 CP 值）**：
1. **5-1 動態載入 Firebase**（首次載入快 1 秒）
2. **5-4 觸覺回饋**（手機玩家撞到/收魚有震動）
3. **6-7 企鵝皮膚**（成就解鎖視覺獎勵）
4. **7-3 截圖分享**（學生愛分享）

**🥈 第二波（共 1 週）**：
1. **6-1 新障礙物**（北極熊 + 冰山）
2. **6-3 每日挑戰**（提升回訪）
3. **7-2 朋友邀請賽**（病毒式傳播）
4. **9-1 Plausible 分析**（看實際遊玩數據）

**🥉 第三波（給長假時做）**：
1. **8-1 i18n**（拓展到日本/英語使用者）
2. **10-3 Cloud Functions 反作弊**（排行榜公平性）
3. **12-3 課程嵌入式挑戰**（變教材）
4. **6-8 關卡編輯器**（教學王牌）

**🚀 終極改版（暑假大專案）**：
1. **10-1 Three.js 真 3D 重製**（v2.0 招牌）

---

### 💡 我可以幫你直接做的（30 分鐘內）

如果你說「這幾項幫我做掉」，我可以一次性執行：

- ✅ 5-1 動態載入 Firebase
- ✅ 5-3 prefers-reduced-motion
- ✅ 5-4 Vibration API
- ✅ 5-9 Press Start 2P 字型
- ✅ 11-3 release-please 自動 changelog
- ✅ 11-5 Renovate 自動升級
- ✅ 12-5 加 LICENSE
- ✅ 13 backlog 中的觸控 long-press

要的話直接點名給我清單，我就批次處理。

---

## 📞 常見部署問題

| 問題 | 解法 |
|---|---|
| GitHub Pages 顯示 404 | 確認 `vite.config.ts` 有 `base: './'`、Settings → Pages → Source 設成 GitHub Actions |
| 部署成功但看到空白頁 | 開 DevTools Console 看錯誤；多半是路徑問題（base 沒設對） |
| Actions 跑不起來 | 用 `gh run list --workflow deploy.yml` 看哪步失敗，常見是 `npm ci` 因 `package-lock.json` 不同步 |
| 改了 code 但網頁沒更新 | 強制重整 (Ctrl+F5) 或開無痕；長期解 → 加 PWA cache busting（見 P3-1） |
| 想要自訂網域 | Settings → Pages → Custom domain，加 CNAME 到 `cagoooo.github.io` |

---

## 🎯 一句話總結

> Phase 1–4 全數完成，遊戲已在 https://cagoooo.github.io/penguin/ 線上運行，含 PWA、成就、Firebase 排行榜、單元測試、嚴格 CI。
> 接下來請依「[§六、未來改良藍圖](#六未來改良藍圖phase-512)」依興趣與時間選擇下一步，不必照順序。

---

> 📘 **遊戲玩法請參閱**：[USAGE.md](USAGE.md)
> 🤖 **本文件由 Claude (Opus 4.7) 協助阿凱老師整理**
