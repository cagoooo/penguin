# 🐧 南極大冒險：企鵝跑酷 — 詳細使用說明

> Pseudo-3D 前向捲動冒險遊戲，致敬 Konami 1983 年經典《南極大冒險》。
> 帶領企鵝穿越冰原、避開障礙、收集魚片，在時限內抵達各關卡終點（石門國小）。

> 📅 文件版本：v6 ｜ 最後更新：2026-04-30
> 🌐 線上玩：https://cagoooo.github.io/penguin/

---

## 📑 目錄
1. [專案總覽](#-專案總覽)
2. [遊戲特色一覽](#-遊戲特色一覽)
3. [檔案結構](#-檔案結構)
4. [技術棧](#-技術棧)
5. [本機開發環境設置](#-本機開發環境設置)
6. [可用指令](#-可用指令)
7. [遊戲玩法](#-遊戲玩法)
8. [遊戲模式](#-遊戲模式)
9. [操作方式](#-操作方式)
10. [遊戲機制深入解析](#-遊戲機制深入解析)
11. [補給站道具列表（19 項）](#-補給站道具列表19-項)
12. [障礙與敵人](#-障礙與敵人)
13. [連擊系統](#-連擊系統)
14. [企鵝皮膚（5 款）](#-企鵝皮膚5-款)
15. [BGM 音樂（3 軌）](#-bgm-音樂3-軌)
16. [成就系統（13 個）](#-成就系統13-個)
17. [季節限定活動](#-季節限定活動)
18. [雲端排行榜](#-雲端排行榜)
19. [PWA 與安裝](#-pwa-與安裝)
20. [URL 深度連結](#-url-深度連結)
21. [教師後台](#-教師後台)
22. [彩蛋／隱藏功能](#-彩蛋隱藏功能)
23. [疑難排解](#-疑難排解)

---

## 🎮 專案總覽

| 項目 | 內容 |
|---|---|
| 專案名稱 | 南極大冒險：企鵝跑酷 |
| 語系 | 繁體中文 UI |
| 玩法類型 | Pseudo-3D 跑酷／賽道閃避 |
| 平台 | Web（PWA · 可離線玩） |
| 後端 | Firebase Firestore（排行榜）+ Anonymous Auth |
| 主要原始碼 | [src/App.tsx](src/App.tsx) + render/ + game/ + audio/ + shop/ + skins/ + achievements/ + leaderboard/ + teacher/ + utils/ + store/ + components/ + hooks/ |
| 模組架構 | 13 個 src/ 子目錄、6 個 lazy chunks |
| 單元測試 | 66 個（Vitest） |
| E2E 測試 | 13 個（Playwright，CI 自動跑） |

---

## ✨ 遊戲特色一覽

| 類別 | 數量 | 說明 |
|---|---:|---|
| 🐧 障礙物種類 | **10** | 含 8 種一般 + 北極熊 / 冰山 / 雪球（Boss）/ Warp Flag |
| 🌦️ 環境天氣 | **4** | 暴風雪 / 強風 / 極夜 / 大霧 |
| 🛒 補給站道具 | **19** | 1 級遞解，最多到 L15 全開 |
| 🏆 成就 | **13** | 含 2 個祕密成就 |
| 🎨 企鵝皮膚 | **5** | 4 種解鎖條件 |
| 🎵 BGM 軌道 | **3** | 溜冰圓舞曲 / 鬥牛士進行曲 / 卡林卡 |
| 🎮 遊戲模式 | **3** | 標準 / 每日挑戰（7 主題輪替）/ 時間競速 |
| 🌟 隱藏房間 | **1** | 0.3% 機率出現的彩虹漩渦旗 |
| ⚔️ Boss 戰 | **1** | 第 20 關企鵝王 |
| 📅 季節活動 | **6** | 聖誕／農曆新年／中秋／萬聖／春假／暑假自動觸發 |
| 🔥 連擊倍率 | **6 階** | ×1 → ×15 |

---

## 📂 檔案結構

```
penguin/
├── .github/workflows/            # CI: deploy / e2e / lighthouse
├── .storybook/                   # Storybook 配置
├── e2e/                          # Playwright E2E 測試
├── public/                       # 靜態資源 (favicon, OG image, icons)
├── scripts/                      # 工具腳本 (e.g. generate-og-image.mjs)
├── src/
│   ├── App.tsx                   # 主程式 (~2,800 行)
│   ├── main.tsx                  # React 入口 + ErrorBoundary
│   ├── index.css                 # Tailwind v4 + Press Start 2P 字型
│   ├── render/                   # Canvas 繪製模組
│   │   ├── project.ts            # 偽 3D 投影
│   │   ├── drawFire.ts           # 火焰特效
│   │   ├── drawEnvironment.ts    # 天空 / 地面 / 山 / 海 / 終點門
│   │   ├── drawObstacles.ts      # 10 種障礙物
│   │   ├── drawPenguin.ts        # 企鵝 + 皮膚配件
│   │   └── drawWeather.ts        # 4 種天氣 + 隱藏房間
│   ├── game/                     # 遊戲規則
│   │   ├── constants.ts          # 物理 / 地圖常數
│   │   ├── types.ts              # Obstacle 等共用 type
│   │   ├── combo.ts              # 連擊系統
│   │   ├── dailyChallenge.ts     # 每日挑戰主題
│   │   └── seasonalEvents.ts     # 季節限定活動
│   ├── audio/                    # 音效系統
│   │   ├── sounds.ts             # 音效合成 + Vibration
│   │   └── bgm.ts                # 3 軌 8-bit BGM
│   ├── shop/                     # 補給站
│   │   ├── items.ts              # 19 道具定義
│   │   └── SkinPickerModal.tsx   # 商店模態 (見下)
│   ├── skins/                    # 企鵝造型
│   │   ├── skins.ts              # 5 款皮膚 + 解鎖條件
│   │   └── SkinPickerModal.tsx   # 換造型 modal (lazy)
│   ├── achievements/             # 成就系統
│   │   ├── definitions.ts        # 13 個成就
│   │   ├── useAchievements.ts    # 解鎖 hook
│   │   └── AchievementsModal.tsx # 成就 modal (lazy)
│   ├── leaderboard/              # 雲端排行榜
│   │   ├── firebase.ts           # Firestore + Anonymous Auth
│   │   ├── useLeaderboard.ts     # 即時訂閱 hook
│   │   ├── LeaderboardModal.tsx  # 排行榜 modal (lazy)
│   │   └── ScoreSubmitForm.tsx   # 上傳分數表單 (lazy)
│   ├── teacher/                  # 教師後台
│   │   └── TeacherDashboard.tsx  # 學生數據儀表板 (lazy)
│   ├── store/                    # 設定持久化
│   │   ├── settings.ts           # 9 個 localStorage key 集中管理
│   │   └── savedGame.ts          # 快速繼續存檔
│   ├── components/               # UI 元件
│   │   ├── ErrorBoundary.tsx     # React Error Boundary
│   │   ├── OnboardingHints.tsx   # 第一次玩教學箭頭
│   │   ├── UpdatePrompt.tsx      # PWA 新版本提示 (lazy)
│   │   ├── InstallPrompt.tsx     # PWA 加到主畫面 (lazy)
│   │   └── BgmPicker.tsx         # BGM 選擇器 (lazy)
│   ├── hooks/                    # 自訂 hooks
│   │   └── useReducedMotion.ts   # 無障礙：減少動態
│   ├── utils/                    # 工具函式
│   │   ├── haptics.ts            # Vibration API
│   │   └── shareImage.ts         # 截圖分享 (lazy)
│   └── stories/                  # Storybook stories
├── firebase.json                 # Firebase 設定
├── firestore.rules               # Firestore 安全規則
├── firestore.indexes.json
├── playwright.config.ts          # E2E 設定
├── vitest.config.ts              # 單元測試設定
├── eslint.config.js              # ESLint flat config
├── .size-limit.json              # Bundle 大小預算
├── vite.config.ts                # Vite + PWA + chunks
└── tsconfig.json                 # TypeScript strict mode
```

---

## 🧱 技術棧

| 套件 | 用途 |
|---|---|
| **React 19** | UI 框架（含 Suspense + lazy） |
| **TypeScript 5.8 strict** | 嚴格型別 |
| **Vite 6** | 開發伺服器 + 打包 |
| **Tailwind CSS v4** | 樣式系統 |
| **motion (Framer Motion)** | UI 動畫 |
| **lucide-react** | 圖示 |
| **canvas-confetti** | 慶祝特效 |
| **Firebase 12** | Firestore + Anonymous Auth |
| **vite-plugin-pwa** | Service Worker + manifest |
| **@fontsource/press-start-2p** | 8-bit 復古字型 |
| **vitest** | 單元測試 |
| **@playwright/test** | E2E 測試 |
| **@storybook/react-vite** | UI 組件預覽 |
| **@size-limit/preset-app** | Bundle 預算 |

---

## 🚀 本機開發環境設置

```bash
# 1. 安裝依賴（首次）
npm install

# 2. 啟動開發伺服器
npm run dev   # → http://localhost:3000
```

第一次跑 E2E 需要安裝 Chromium：

```bash
npm run e2e:install
```

---

## 🛠️ 可用指令

| 指令 | 行為 |
|---|---|
| `npm run dev` | Vite 開發伺服器（port 3000，host 0.0.0.0） |
| `npm run build` | 打包到 `dist/` |
| `npm run preview` | 預覽打包版本（port 4173） |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm run lint` | ESLint（`--max-warnings=0`） |
| `npm run lint:fix` | 自動修可修的 lint 問題 |
| `npm run test` | Vitest 單元測試一次跑完 |
| `npm run test:watch` | Vitest watch 模式 |
| `npm run e2e` | Playwright E2E（vs vite preview） |
| `npm run e2e:ui` | Playwright UI 模式（互動 debug） |
| `npm run e2e:visual` | 視覺迴歸測試 |
| `npm run e2e:visual:update` | 更新視覺基線 |
| `npm run size` | Bundle 大小預算檢查 |
| `npm run size:why` | 分析哪個套件貢獻最多 |
| `npm run storybook` | Storybook UI 預覽（port 6006） |
| `npm run storybook:build` | 打包 Storybook |
| `npm run generate-og` | 重新產 OG 預覽圖 |
| `npm run clean` | 刪 dist/ 與 dev-dist/ |

---

## 🎯 遊戲玩法

### 核心目標
- 駕駛企鵝在 3 條車道（左／中／右）的冰原賽道上前進
- **時間結束前抵達該關卡的終點距離**（每關起始距離 +15%）
- 收集魚片獲得分數，分數可在路途中的「補給站」購買強化道具

### 遊戲狀態機
```
START ──[開始冒險]──▶ PLAYING ──[時間到]──▶ GAME_OVER
                       │  ▲
                       │  └──[再試一次]
                       │
                       ├──[抵達終點]──▶ LEVEL_CLEAR ──[下一關]──▶ PLAYING
                       │
                       ├──[撞 SHOP_STATION]──▶ SHOP ──[離開]──▶ PLAYING
                       │
                       └──[撞 WARP_FLAG]──▶ BONUS_ROOM (隱藏房間 8 秒)
```

---

## 🎮 遊戲模式

### 1. 標準模式
時間倒數、收集魚刷分數、闖關到無止境（理論上）。

### 2. 📅 每日挑戰
每天主題自動輪替（7 種）：
- 🐧 經典日（無修正）
- 🐻‍❄️ 北極熊日（北極熊 +50%）
- 🏔️ 冰山日（冰山 +50%、時間 +30%）
- ✨ 黃金魚日（魚全變金、分數 ×1.5）
- ⏰ 時間充裕日（時間 ×1.5）
- ⚡ 極速日（速度 ×1.5、時間 ×0.8、分數 ×1.2）
- 🌨️ 暴風雪日（L1 就有暴風雪、分數 ×2）
- 🔥 連擊狂熱日（魚 ×1.5）

每天紀錄存於 localStorage（嘗試次數、最高分、最高關卡），跨日自動重置。

### 3. ⚡ 時間競速
時間從倒數**改成正數計時**，無時限，看誰最快通關。LEVEL_CLEAR 顯示 `12.34s` 完成時間。

---

## 🕹️ 操作方式

### 鍵盤
| 按鍵 | 動作 |
|---|---|
| `←` / `A` | 左切車道 |
| `→` / `D` | 右切車道 |
| `↑` / `W` / `Space` | 跳躍（飛行模式時 = 上升） |
| `↓` / `S` | 減速 |
| `P` / `Esc` | 暫停 / 繼續 |

### 觸控（手機 / 平板）
- **左滑** → 左切車道
- **右滑** → 右切車道
- **上滑** / 點擊 → 跳躍
- **長按** → 持續加速
- **連點兩下** → 啟動「特製螺旋槳」加倍飛行（如有）

第一次 PLAYING 會出現 3 段教學箭頭：切車道 → 跳躍 → 長按。看完後永久跳過。

### Gamepad
| 按鈕 | 動作 |
|---|---|
| 左搖桿 / 十字鍵 ←→ | 切車道 |
| 左搖桿 ↑ / RT (R2) / 十字鍵 ↑ | 加速 |
| A / B / X / Y | 跳躍 |
| Start | 開始遊戲 |

---

## 🔧 遊戲機制深入解析

### 偽 3D 賽道渲染
- 賽道由 **150 個區段**組成，每段 100 單位深度
- 每幀使用 `project(x, y, z)` 函數做透視投影：`scale = 1 / (z/500 + 1)`
- 「累積偏移量」做 OutRun 風格彎道效果

### 關卡難度遞增
| 關卡 | 新增障礙 / 事件 |
|---|---|
| L1 | HOLE / SEAL / FISH / FLAG |
| L2+ | + CRACK 冰裂縫 |
| L4+ | + SNOWDRIFT 雪堆 |
| L7+ | + ICE_PATCH 結冰區（操控性下降） |
| L9+ | + POLAR_BEAR 北極熊（追蹤車道，撞到 -2 命） |
| L11+ | + ICEBERG 冰山（1.5 車道寬，必須跳） |
| L13+ | 🌨️ BLIZZARD 暴風雪 |
| L15+ | 💨 WIND 強風（推玩家） |
| L17+ | 🌑 NIGHT 極夜（視野限制） |
| L19+ | 🌫️ FOG 大霧 |
| **L20** | ⚔️ **BOSS：企鵝王 + SNOWBALL（雪球攻擊）** |

### 計時與分數
- 每關初始時間 30 秒（剩餘秒數會帶到下一關）
- 通關 LEVEL_CLEAR 加 `time × 10` 分數獎勵（時間競速模式不加）
- 時間到 → 若有「企鵝娃娃」生命 → 復活 +20 秒；否則 GAME_OVER
- 最後 5 秒會有警示音

### 速度系統
- `MAX_SPEED = 40`（基準）
- 噴射滑板：×2 上限
- 流線領巾：永久 +10% 上限與加速
- 氮氣噴發：5 秒內 200 速無敵
- 黃旗：0.5 秒 turbo（200 速衝刺）

---

## 🛒 補給站道具列表（19 項）

每關可購買 `min(19, 4 + 關卡數)` 種道具（God Mode 全開）。

| # | 道具 | 售價 | 時機 | 效果 |
|---:|---|---:|---|---|
| 1 | 黃金碼表 | 10,000 | 立即 | +10 秒 |
| 2 | 特製螺旋槳 | 4,000 | 下關 | 飛行時間 ×2 |
| 3 | 噴射滑板 | 8,000 | 下關 | 速度 ×2，撞到才結束 |
| 4 | 企鵝娃娃 | 20,000 | 立即 | +1 額外生命 |
| 5 | 磁力項圈 | 12,000 | 下關 | 30 秒自動吸魚 |
| 6 | 冰原護盾 | 18,000 | 下關 | 抵擋下次撞擊 |
| 7 | 氮氣噴發 | 25,000 | 下關 | 5 秒極速無敵 |
| 8 | 高級偵測器 | 15,000 | 下關 | 金魚出現率 ↑ |
| 9 | 白金碼表 | 35,000 | 立即 | +30 秒 |
| 10 | 重型雪靴 | 45,000 | 下關 | 撞冰縫不跌倒 |
| 11 | 流線領巾 | 50,000 | 下關 | **永久** +10% 加速度與最速 |
| 12 | 極光羅盤 | 65,000 | 立即 | 距離 −1000m |
| 13 | 神奇魚餌 | 80,000 | 下關 | 該關剩餘魚 ×3 分 |
| 14 | 克羅諾斯之戒 | 100,000 | 下關 | 凍結計時 15 秒 |
| 15 | 反重力引擎 | 150,000 | 下關 | 直接 20 秒長效飛行 |
| 16 | 探險王之冠 | 500,000 | 下關 | **永久** ×3 分數與距離 |
| 17 | 🌀 **傳送門** | 30,000 | 立即 | 跳過 500m 距離 |
| 18 | ⏮️ **時光倒流** | 70,000 | 下關 | 抵消下次撞擊 / 冰滑（連擊不歸零！） |
| 19 | 🐧🐧 **雙人企鵝** | 120,000 | 下關 | 永久磁力 + 魚分數 ×2 |

---

## ⚠️ 障礙與敵人

### 一般障礙
| 物件 | 解鎖 | 撞擊效果 | 對策 |
|---|---|---|---|
| 🦭 海豹 (SEAL) | L1 | 跌倒、大量減速 | 跳過、火焰、護盾、God Mode |
| 🕳️ 冰洞 (HOLE) | L1 | 跌倒 | 跳過、護盾 |
| ❄️ 冰裂縫 (CRACK) | L2 | 大幅減速 | 跳過、重型雪靴（變輕微減速） |
| ⛰️ 雪堆 (SNOWDRIFT) | L4 | 嚴重減速 | 跳過 |
| 🧊 結冰區 (ICE_PATCH) | L7 | 操控性大降 | 跳過、God Mode |
| 🐻‍❄️ 北極熊 (POLAR_BEAR) | **L9** | **直接 -2 條命** + 重摔；無命時 -15 秒 | 跳過、火焰（撞死得 6000）、護盾 |
| 🏔️ 冰山 (ICEBERG) | **L11** | 1.5 車道寬，硬撞速度歸零 + 1.4 秒重摔 | **必須跳**（火焰可穿越得 4000） |
| 🌨️ 雪球 (SNOWBALL) | **L20** | 重摔（企鵝王投擲） | 跳過、火焰 |

### 環境事件（不直接傷害）
| 事件 | 解鎖 | 視覺 / 效果 |
|---|---|---|
| 🌨️ 暴風雪 (BLIZZARD) | L13+ | 4-7 秒視線降低 + 雪花特效 |
| 💨 強風 (WIND) | L15+ | 橫向飄移運動線 + **力推玩家** 0.4× |
| 🌑 極夜 (NIGHT) | L17+ | 螢幕變暗 + 企鵝周圍 250px 光圈 |
| 🌫️ 大霧 (FOG) | L19+ | 垂直漸層霧 + 漂移霧團 |

### 收集物
| 物件 | 分數 | 額外效果 |
|---|---:|---|
| 🐟 紅魚 | 500 | — |
| 🐟 黃魚 | 1,000 | — |
| 🐟 綠魚 | 1,500 | — |
| 🐟 跳躍魚 (JUMPING_FISH) | 同上 | 動態軌跡 |
| 🚩 紅旗 | 1,500 | 4 秒火焰無敵 |
| 🚩 黃旗 | 1,800 | 0.5 秒 Turbo |
| 🚩 橘旗 | 2,400 | +1 秒計時 |
| 🚩 藍旗 (BLUE_FLAG) | 3,000 | 螺旋槳飛行 3 秒（大螺旋槳 6 秒） |
| 🌈 彩虹旗 (RAINBOW_FLAG) | 5,000 | +5 秒計時 |
| 🌟 **WARP_FLAG**（漩渦旗） | 5,000 | **進入 BONUS_ROOM 8 秒**！ |
| 🏪 補給站 (SHOP_STATION) | — | 進入商店 |

---

## 🔥 連擊系統

連續收魚 / 旗（不撞障礙物）累積，6 階倍率：

| 連擊數 | 倍率 | 標語 | 顏色 |
|---:|---:|---|---|
| 5–9 | **×2** | NICE! | 綠 |
| 10–19 | **×3** | GREAT! | 黃 |
| 20–29 | **×5** | AMAZING! | 橘 |
| 30–49 | **×8** | INSANE! | 紅 |
| 50+ | **×15** | GODLIKE!!! | 粉 |

撞到任何障礙物 → 連擊歸零（時光倒流道具可保住連擊）。
達 30 連擊 → 解鎖「連擊大師 🔥」成就。

---

## 🎨 企鵝皮膚（5 款）

| 皮膚 | 解鎖條件 | 視覺 |
|---|---|---|
| 🐧 **經典企鵝** | 永遠可用 | 預設黑白 |
| 🧣 **紅領巾** | 通過第 5 關 | 隨風飄揚紅圍巾 + 白條紋 |
| 😎 **酷企鵝** | 通過第 10 關 | 太陽眼鏡含反光 |
| 👑 **王者企鵝** | 啟動 God Mode | 金色皇冠 + 紅寶石 |
| ✨ **黃金企鵝** | 解開**全部 13 個成就** | 金色光澤漸層 + 閃爍粒子 + 皇冠 |

START 畫面點「換造型」按鈕切換。

---

## 🎵 BGM 音樂（3 軌）

8-bit 樂譜純 Web Audio API 合成（無音檔依賴）：

| 軌道 | 曲目 | 風格 |
|---|---|---|
| 🎵 | **溜冰圓舞曲**（Skater's Waltz） | Konami NES 經典致敬 |
| 🐂 | **鬥牛士進行曲**（Carmen） | 緊張刺激 4/4 進行曲 |
| 🪆 | **卡林卡**（Kalinka） | 俄羅斯民謠加速感 |

START 畫面下拉選單可即時切換，選擇存於 localStorage。

---

## 🏆 成就系統（13 個）

| # | 成就 | 條件 | 圖示 |
|---:|---|---|---|
| 1 | 初登南極 | 通過第 1 關 | 🐧 |
| 2 | 冰原行者 | 通過第 5 關 | 🏔️ |
| 3 | 極地勇者 | 通過第 10 關 | 🏆 |
| 4 | 十萬富翁 | 單局 ≥ 100,000 分 | 💎 |
| 5 | 百萬大亨 | 單局 ≥ 1,000,000 分 | 👑 |
| 6 | **上古祕技** 🤫 | 神秘條件 | 🌟 |
| 7 | 購物狂 | 單場購買 5 件以上 | 🛒 |
| 8 | 魚之饗宴 | 單局收 50 條魚 | 🐟 |
| 9 | 南極之心 | 第 7 關後仍存活 | ❄️ |
| 10 | 極速企鵝 | 達 80 km/h 時速 | ⚡ |
| 11 | 連擊大師 | 單局 30 連擊 | 🔥 |
| 12 | **時空旅人** 🤫 | 神秘條件 | 🌟 |
| 13 | 弒王者 | 擊敗第 20 關企鵝王 | ⚔️ |

🤫 = 秘密成就，未解前在 modal 顯示為 ???，看不到實際內容。

---

## 📅 季節限定活動

依當下日期自動觸發 START 畫面 banner + 套用修正：

| 期間 | 活動 | 修正 |
|---|---|---|
| 12/18-31 | 🎄 聖誕節 | 魚 ×1.5 + 起始時間 +5 秒 |
| 1/20-2/20 | 🧧 農曆新年 | 魚 ×2 |
| 9/15-10/5 | 🌕 中秋節 | 時間 +3 秒 |
| 10/25-11/2 | 🎃 萬聖節 | 北極熊 +50%（顯示 banner） |
| 4/1-7 | 🌸 春假 | 時間 +10 秒 |
| 7-8 月 | 🌊 暑假 | 魚 ×1.3 |

---

## 🌐 雲端排行榜

- **Firebase Firestore**（免費層）+ Anonymous Auth
- 每瀏覽器/裝置一個穩定 `uid`
- **暱稱與 uid 綁定**：第一個 uid 認領後永久擁有，他人試用同名會被擋
- 寫入需要 auth.uid 與 doc.uid 一致（防 curl 灌水）
- 純讀公開
- 排行榜 Modal 顯示 top 10 即時更新
- GAME_OVER 直接輸入暱稱上傳

---

## 📱 PWA 與安裝

### 離線可玩
- Service Worker 預先快取所有資源
- NetworkFirst 策略：先打網路、3 秒逾時才用快取（防舊版 SW 卡住）
- 每 60 秒主動偵測新版

### 加到主畫面
第一次通關後跳綠色 toast「📱 加到主畫面」。
- iOS Safari → 分享 → 「加到主畫面」
- Android Chrome → 點 toast「安裝」按鈕

安裝後：
- 桌面圖示秒開
- 全螢幕無瀏覽器 UI
- 完全離線可玩（除排行榜上傳）

### 新版本提示
新版本就緒時自動跳藍紫漸層 toast「✨ 新版本已就緒」+ 「更新」按鈕。
點下去 skipWaiting + reload，0 等待 0 快取問題。

---

## 🔗 URL 深度連結

啟動時自動讀取 query 參數：

| URL | 動作 |
|---|---|
| `?screen=leaderboard` | 開啟排行榜 modal |
| `?screen=achievements` | 開啟成就 modal |
| `?screen=skins` | 開啟換造型 modal |
| `?skin=red-scarf` | 套用紅領巾皮膚 |
| `?skin=sunglasses` | 套用酷企鵝 |
| `?skin=crown` | 套用王者皮膚 |
| `?skin=golden` | 套用黃金皮膚 |
| `?teacher=1` | 開啟教師後台 |

讀取後自動 `replaceState` 清除 URL 參數，重整不會重複觸發。

---

## 🎓 教師後台

訪問 https://cagoooo.github.io/penguin/**?teacher=1**

**5 大區塊**：
1. **4 個 stat cards**：總提交次數 / 不重複玩家數 / 平均分數 / 最高關卡
2. **🥇 目前王者**橫幅
3. **📈 分數分佈**長條圖（6 區間）
4. **📅 最近 14 天活躍度**日線圖
5. **📋 完整 200 筆紀錄**（sticky header + 滾動）

無 auth gating（v1 用 URL 隱蔽）。未來可改 Firebase Google sign-in 限定特定 email。

---

## 🥚 彩蛋／隱藏功能

### Konami Code（God Mode）
START 畫面依序按：
```
↑ ↑ ↓ ↓ ← ← → → A B
```
觸發：
- 🎉 confetti + do-mi-sol-do-mi 慶祝音
- 解鎖隱藏成就「上古祕技 🌟」（第一個秘密成就）
- 進遊戲後：99,999 分起手 + 商店全解 + **完全無敵**

### 隱藏房間（Bonus Room）
0.3% 機率出現的彩虹漩渦旗（L5+）：
- 撞到觸發 8 秒金魚饗宴（時間凍結 + 魚雨 + 完全無敵）
- 解鎖隱藏成就「時空旅人 🌟」（第二個秘密成就）
- 螢幕邊框彩虹脈動 + 30 顆金色 sparkle

### 老闆對話（商店 Merchant）
商店畫面有戴頭戴式耳機的「老企鵝商人」SVG 像（含掃描線 CRT 特效）。

---

## 🐛 疑難排解

### Q1：`npm run dev` 後頁面空白
- 開瀏覽器 DevTools → Console 看錯誤
- 確認 port 3000 沒被佔用

### Q2：手機 iOS Safari 全螢幕沒反應
iOS Safari 不支援 `requestFullscreen()`，已有 CSS fallback。

### Q3：聲音沒出來
瀏覽器自動播放政策需使用者先點擊。在「開始冒險」時呼叫 `initAudio()`，這是合法手勢。

### Q4：Gamepad 無回應
需要先按手把任一按鈕，瀏覽器才列出該手把（W3C Gamepad API 規範）。

### Q5：排行榜上傳失敗「需啟用匿名登入」
管理員需到 Firebase Console 啟用 Anonymous provider：
https://console.firebase.google.com/project/penguin-leaderboard/authentication/providers

### Q6：暱稱被拒絕「暱稱已被其他玩家認領」
nicknames collection 第一個 uid 認領後永久擁有，請換一個或從原本的瀏覽器繼續用。

### Q7：玩到一半 F5 整局丟失
**自動存檔每 2 秒**寫一次 localStorage。重整後 START 畫面會出現「上次未完成」橘色 banner，點「▶ 繼續」即可。

### Q8：版面動畫太多看不慣
作業系統設定 → 顯示器 → 啟用「減少動態效果」→ 重整網頁。
所有 motion 動畫會關閉、marquee 不滾動。

### Q9：API key 暴露在原始碼？
Firebase Web SDK 的 publishable API key 是**設計上要公開**的。我們已用：
1. HTTP referrer 限制（只接受 `cagoooo.github.io`）
2. API target 限制（只能呼叫 Firestore / IdentityToolkit / SecureToken）
3. Firestore rules 強制 auth.uid 比對

GitHub Secret Scanning 跳警告是 false positive，已 dismiss。

---

## 📝 授權與致謝
- 致敬：Konami《Antarctic Adventure》(1983, MSX/NES)
- 音樂：Émile Waldteufel《Les Patineurs》(1882)、Bizet《Carmen》(1875)、Russian trad.《Kalinka》(1860) 公共領域
- 程式：來自 Google AI Studio Remix 模板，可自由修改

---

> 🚀 **部署與優化建議**請參閱 [DEPLOY-AND-OPTIMIZE.md](DEPLOY-AND-OPTIMIZE.md)
> 🤖 文件由 Claude (Opus 4.7) 協助阿凱老師整理 ｜ Made with ♥ by 阿凱老師 × antarctic
