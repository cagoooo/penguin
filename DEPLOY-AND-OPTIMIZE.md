# 🚀 部署到 GitHub Pages + 後續優化詳細步驟

> 給阿凱老師（`cagoooo`）的完整移植與改良指南。
> 這份專案是純前端 React + Vite SPA，**100% 可以放上 GitHub Pages**，不需要 Firebase / 後端 / Cloud Run。

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

### Phase 1：上線（1 小時內）
- [ ] 步驟 2：清理 AI Studio 殘留依賴
- [ ] 步驟 2b：`vite.config.ts` 加 `base: './'`
- [ ] 步驟 3-7：建立 GitHub repo + Pages workflow
- [ ] 步驟 8：開無痕視窗驗證上線
- [ ] P0-3：加阿凱老師作者頁尾
- [ ] P0-4：修 `<title>` 與 OG meta

### Phase 2：玩家體驗（1 週內）
- [ ] P0-1：補虛擬觸控按鈕
- [ ] P0-2：localStorage 最高分
- [ ] P1-3：靜音切換
- [ ] P1-4：暫停功能
- [ ] P1-6：自適應畫面尺寸

### Phase 3：程式碼健康（1 個月內）
- [ ] P1-1：拆分 App.tsx
- [ ] P1-2：消除 ALL_SHOP_ITEMS 重複
- [ ] P2-1：ESLint + Prettier
- [ ] P2-5：TypeScript strict
- [ ] P2-4：加單元測試（至少 30% coverage）

### Phase 4：擴充功能（2-3 個月內）
- [ ] P3-1：PWA 化
- [ ] P3-3：成就系統
- [ ] P3-6：Supabase 雲端排行榜
- [ ] P1-5：搭配排行榜的好友邀請連結

### Phase 5：v2.0（半年）
- [ ] P3-5：Three.js 真 3D 重製
- [ ] P3-2：i18n 多語系
- [ ] P3-4：Replay 錄影分享

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

> 這份專案**可以 100% 直接搬到 GitHub Pages**，不需要 Firebase、不需要 Cloud Run、不需要付費服務。
> 上線只要 8 個步驟、估 30 分鐘；上線後再依「優化進度檢核清單」逐步改良即可。

---

> 📘 **遊戲玩法請參閱**：[USAGE.md](USAGE.md)
> 🤖 **本文件由 Claude (Opus 4.7) 協助阿凱老師整理**
