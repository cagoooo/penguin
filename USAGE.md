# 🐧 南極大冒險：企鵝跑酷 — 詳細使用說明

> Pseudo-3D 前向捲動冒險遊戲，致敬 Konami 1983 年經典《南極大冒險》。
> 帶領企鵝穿越冰原、避開障礙、收集魚片，在時限內抵達各關卡終點（石門國小）。

---

## 📑 目錄
1. [專案總覽](#-專案總覽)
2. [檔案結構](#-檔案結構)
3. [技術棧](#-技術棧)
4. [本機開發環境設置](#-本機開發環境設置)
5. [可用指令](#-可用指令)
6. [遊戲玩法](#-遊戲玩法)
7. [操作方式](#-操作方式)
8. [遊戲機制深入解析](#-遊戲機制深入解析)
9. [補給站道具列表](#-補給站道具列表-共-16-項)
10. [障礙與敵人](#-障礙與敵人)
11. [彩蛋／隱藏功能](#-彩蛋隱藏功能)
12. [疑難排解](#-疑難排解)

---

## 🎮 專案總覽

| 項目 | 內容 |
|---|---|
| 專案名稱 | Remix: Antarctic Adventure: Penguin Run |
| 語系 | 繁體中文 UI |
| 玩法類型 | Pseudo-3D 跑酷／賽道閃避 |
| 來源 | Google AI Studio Remix Template (App ID: `9694d5d0-ff41-449d-9048-16b65688ac82`) |
| 主要程式 | 單檔 [App.tsx](src/App.tsx)（2607 行） |
| 是否需要後端 | **不需要**（純前端，可放靜態託管） |
| 是否使用 Gemini API | **沒有實際使用**（依賴雖列在 package.json，但程式碼中無 import） |

---

## 📂 檔案結構

```
penguin/
├── .env.example          # 環境變數範本（GEMINI_API_KEY、APP_URL，目前無實際用途）
├── .gitignore            # 已排除 node_modules / dist / .env*
├── README.md             # AI Studio 預設 README（之後可覆寫）
├── index.html            # Vite 入口 HTML
├── metadata.json         # AI Studio 用的 App 描述檔
├── package.json          # 依賴與 npm scripts
├── package-lock.json     # 依賴鎖定檔
├── tsconfig.json         # TypeScript 配置
├── vite.config.ts        # Vite + Tailwind + React 配置
└── src/
    ├── App.tsx           # 整個遊戲的單一檔案實作（114 KB）
    ├── index.css         # 只有一行 @import "tailwindcss";
    └── main.tsx          # React 19 createRoot 進入點
```

> **⚠️ 注意**：整個遊戲邏輯全部塞在 `src/App.tsx` 一個檔案裡（包含音效、BGM、商店系統、Canvas 繪製、輸入處理、UI），共 2607 行。後續若要維護，建議拆分（詳見 [部署與優化建議](DEPLOY-AND-OPTIMIZE.md)）。

---

## 🧱 技術棧

| 套件 | 版本 | 用途 |
|---|---|---|
| **React** | 19.0.0 | UI 框架（用 React 19 的 createRoot） |
| **TypeScript** | ~5.8.2 | 型別系統 |
| **Vite** | ^6.2.0 | 開發伺服器 + 打包 |
| **Tailwind CSS** | ^4.1.14 | 樣式系統（v4 透過 `@tailwindcss/vite` 插件） |
| **motion (Framer Motion)** | ^12.23.24 | UI 動畫（畫面轉場、彈出） |
| **lucide-react** | ^0.546.0 | 圖示（齒輪、箭頭、Trophy 等） |
| **canvas-confetti** | ^1.9.4 | 完成關卡時的彩帶特效 |
| **@google/genai** | ^1.29.0 | ⚠️ **目前沒被 import 使用**（AI Studio 模板殘留） |
| **express** | ^4.21.2 | ⚠️ **目前沒被使用**（AI Studio 模板殘留） |
| **dotenv** | ^17.2.3 | ⚠️ **目前沒被使用** |

---

## 🚀 本機開發環境設置

### 前置需求
- **Node.js** ≥ 18（建議 20 或 22；你的環境是 v24.12.0，OK）
- **npm** ≥ 9（你的環境是 11.6.2，OK）
- 任何現代瀏覽器（Chrome / Edge / Firefox / Safari）

### 步驟

```bash
# 1) 進入專案資料夾
cd H:/penguin

# 2) 安裝相依套件（首次執行）
npm install

# 3) 啟動開發伺服器
npm run dev
# → 瀏覽器開啟 http://localhost:3000
```

> **不需要設定 GEMINI_API_KEY**：雖然 `.env.example` 中有列出，但程式碼實際沒用到 Gemini API。

---

## 🛠️ 可用指令

| 指令 | 行為 |
|---|---|
| `npm run dev` | Vite 開發伺服器 (port 3000，host 0.0.0.0 — 區網其他裝置可連) |
| `npm run build` | 打包輸出到 `dist/` 資料夾 |
| `npm run preview` | 在本機預覽已打包的版本 |
| `npm run clean` | 刪除 `dist/`（注意：此指令使用 `rm -rf`，**Windows 純 cmd 環境會失敗**，需在 Git Bash 或 PowerShell 中跑；或改用 `rimraf`） |
| `npm run lint` | TypeScript 型別檢查（`tsc --noEmit`） |

---

## 🎯 遊戲玩法

### 核心目標
- 駕駛企鵝在 3 條車道（左／中／右）的冰原賽道上前進
- **時間結束前抵達該關卡的終點距離**（每關起始距離越來越長，第 1 關 4200m、之後每關 ×1.15）
- 收集魚片獲得分數，分數可在路途中的「補給站」購買強化道具

### 遊戲狀態機
```
START ──[開始冒險]──▶ PLAYING ──[時間到]──▶ GAME_OVER
                       │  ▲
                       │  └──[再試一次]
                       │
                       ├──[抵達終點]──▶ LEVEL_CLEAR ──[下一關]──▶ PLAYING
                       │
                       └──[撞到 SHOP_STATION]──▶ SHOP ──[離開]──▶ PLAYING
```

---

## 🎮 操作方式

### 鍵盤
| 按鍵 | 動作 |
|---|---|
| `←` / `A` | 左切車道 |
| `→` / `D` | 右切車道 |
| `↑` / `W` / `Space` | **跳躍**（飛行模式時 = 上升） |
| `↓` / `S` | 減速 |

### 觸控（手機 / 平板）
- **左滑** → 左切車道
- **右滑** → 右切車道
- **上滑** → 跳躍
- **輕點畫面** → 跳躍
- **長按** → 持續加速
- 點兩下螢幕 → 啟動「特製螺旋槳」加成（如有）

### 遊戲手把（Gamepad API）
| 按鈕 | 動作 |
|---|---|
| 左搖桿 / 十字鍵 ←→ | 切換車道 |
| 左搖桿 ↑ / RT (R2) / 十字鍵 ↑ | 加速 |
| A / B / X / Y（任一） | 跳躍 |
| Start | 開始遊戲 |
| 商店模式：A | 確認購買 |
| 商店模式：B | 離開商店 |

### 全螢幕
- 點擊右上角的 ⛶ 圖示切換全螢幕（含 iOS Safari fallback）

---

## 🔧 遊戲機制深入解析

### 偽 3D 賽道渲染原理
- 賽道由 **150 個區段**組成（每段 100 單位深度，總深 15000 單位）
- 每幀使用 `project(x, y, z)` 函數做透視投影：`scale = 1 / (z/500 + 1)`
- 賽道彎曲用「累積偏移量」計算（`cumulativeOffsets`），達成 **OutRun 風格的彎道效果**
- 海洋（左／右）會根據關卡漸進變多

### 關卡難度遞增規則（從 `App.tsx` 程式碼擷取）
| 關卡 | 新增障礙 | 彎道強度 | 海洋出現率 |
|---|---|---|---|
| L1 | HOLE、SEAL、FISH、FLAG | 25 | 40% |
| L2+ | 加入 **CRACK**（冰裂縫） | +3/關 | +5%/關 |
| L4+ | 加入 **SNOWDRIFT**（雪堆） | … | … |
| L7+ | 加入 **ICE_PATCH**（結冰區，降低操控性） | 上限 45 | 上限 80% |
| **L9+** | 加入 **🐻‍❄️ POLAR_BEAR**（追蹤車道，撞到 -2 命） | … | … |
| **L11+** | 加入 **🏔️ ICEBERG**（1.5 車道寬，必須跳） | … | … |
| **L13+** | 環境事件 **🌨️ BLIZZARD**（暴風雪降低視線） | … | … |

### 計時與分數
- **每關初始時間**：30 秒（剩餘秒數會帶到下一關）
- **時間獎勵**：通關時 `score += time × 10`
- **時間到** → 若有「企鵝娃娃」生命 → 復活 +20 秒，否則 GAME_OVER
- **最後 5 秒**會有警示音

### 速度系統
- `MAX_SPEED = 40`（基準）
- **黃金加速**：噴射滑板 → ×2 上限
- **流線領巾**：永久 +10% 上限與加速
- **氮氣噴發**：5 秒內 `speed = MAX_SPEED + 20`，且無敵
- **黃旗**：0.5 秒 turbo（200 速衝刺）
- **紅旗火焰**：4 秒無敵 + 海豹／障礙可撞穿

---

## 🛒 補給站道具列表（共 16 項）

> 玩家進入路徑上的「補給站」(`SHOP_STATION`) 會自動切換到商店畫面。
> 道具分「立即生效」與「下關生效」兩種。
> 每關可購買的物品數量為 **`min(16, 4 + 關卡數)`**（God Mode 解鎖全部）。

| # | 道具 | 售價 | 效果類型 | 效果 |
|---|---|---:|---|---|
| 1 | 黃金碼表 (timer) | 10,000 | 立即 | +10 秒計時 |
| 2 | 特製螺旋槳 (propeller) | 4,000 | 下關 | 飛行時間 ×2 |
| 3 | 噴射滑板 (skateboard) | 8,000 | 下關 | 地面時速 ×2，撞到才結束 |
| 4 | 企鵝娃娃 (life) | 20,000 | 立即 | +1 額外生命 |
| 5 | 磁力項圈 (magnet) | 12,000 | 下關 | 30 秒自動吸魚片 |
| 6 | 冰原護盾 (shield) | 18,000 | 下關 | 抵擋下次碰撞 |
| 7 | 氮氣噴發 (nitro) | 25,000 | 下關 | 5 秒極速無敵 |
| 8 | 高級偵測器 (detector) | 15,000 | 下關 | 該關金魚出現率 ↑ |
| 9 | 白金碼表 (timer2) | 35,000 | 立即 | +30 秒計時 |
| 10 | 重型雪靴 (boots) | 45,000 | 下關 | 撞冰縫不跌倒 |
| 11 | 流線領巾 (scarf) | 50,000 | 下關 | **永久** +10% 加速與最速 |
| 12 | 極光羅盤 (compass) | 65,000 | 立即 | 該關距離 −1000m |
| 13 | 神奇魚餌 (bait) | 80,000 | 下關 | 該關剩餘魚 ×3 分 |
| 14 | 克羅諾斯之戒 (timering) | 100,000 | 下關 | 凍結計時 15 秒 |
| 15 | 反重力引擎 (antigravity) | 150,000 | 下關 | 直接 20 秒長效飛行 |
| 16 | 探險王之冠 (crown) | 500,000 | 下關 | **永久** ×3 分數與距離 |

---

## ⚠️ 障礙與敵人

| 敵人 / 物件 | 解鎖關卡 | 撞擊效果 | 可破解方式 |
|---|---|---|---|
| 🦭 海豹 (SEAL) | L1 | 跌倒、大量減速 | 跳過、火焰、護盾、God Mode |
| 🕳️ 冰洞 (HOLE) | L1 | 跌倒 | 跳過、護盾 |
| ❄️ 冰裂縫 (CRACK) | L2 | 大幅減速 | 跳過、重型雪靴（變成輕微減速） |
| ⛰️ 雪堆 (SNOWDRIFT) | L4 | 嚴重減速 | 跳過 |
| 🧊 結冰區 (ICE_PATCH) | L7 | 操控性大降（traction = 0.2） | 跳過、God Mode |
| 🐻‍❄️ 北極熊 (POLAR_BEAR) | **L9** | **直接 -2 條命** + 重摔；無命時 -15 秒 | **跳過**、火焰（撞死得 6000）、護盾、God Mode |
| 🏔️ 冰山 (ICEBERG) | **L11** | 1.5 車道寬，硬撞速度歸零 + 1.4 秒重摔 | **必須跳過**（也可火焰穿越得 4000） |
| 🌨️ 暴風雪 (BLIZZARD) | **L13** | 環境事件：4-7 秒視線降低 + 雪花特效 | 純視覺降低，不會直接傷害 |

### 收集物
| 物件 | 分數 | 額外效果 |
|---|---:|---|
| 🐟 紅魚 (FISH 紅) | 500 | — |
| 🐟 黃魚 (FISH 金) | 1,000 | — |
| 🐟 綠魚 (FISH 綠) | 1,500 | — |
| 🐟 跳躍魚 (JUMPING_FISH) | 同上 | 動態軌跡 |
| 🚩 紅旗 (FLAG 紅) | 1,500 | 4 秒火焰無敵 |
| 🚩 黃旗 (FLAG 黃) | 1,800 | 0.5 秒 Turbo |
| 🚩 橘旗 (FLAG 橘) | 2,400 | +1 秒計時 |
| 🚩 藍旗 (BLUE_FLAG) | 3,000 | 啟動螺旋槳飛行（3 秒，有大螺旋槳則 6 秒） |
| 🌈 彩虹旗 (RAINBOW_FLAG) | 5,000 | +5 秒計時 |
| 🏪 補給站 (SHOP_STATION) | — | 進入商店 |

---

## 🥚 彩蛋／隱藏功能

### Konami Code（God Mode）
在開始畫面（`START`）依序輸入：

```
↑ ↑ ↓ ↓ ← ← → → A B
```

啟動 **God Mode**：
- 初始分數變 99,999
- 商店所有 16 個道具立刻全部解鎖（不受關卡限制）
- 完全無敵（包含 ICE_PATCH 都不影響操控）
- 配上歡快音效 + confetti 慶祝特效

### 老闆對話（商店 Merchant）
- 商店畫面有個帶頭戴式耳機的「老企鵝商人」SVG 像（含掃描線 CRT 特效）
- 對話框模仿 **8-bit 終端機**風格，會根據選中物品變化說明文

### NES 風 BGM
- 內建 **8-bit 版《溜冰圓舞曲》(Skater's Waltz)**，整首譜以 `{ f: freq, d: duration }` 陣列硬寫在程式中
- 開始遊戲時延遲 1 秒播放（讓開場音效先響）

---

## 🐛 疑難排解

### Q1：執行 `npm run dev` 後頁面空白
- **檢查 1**：是否在埠 3000，有沒有被其他程式佔用？改 `vite.config.ts` 或加 `--port=3001`
- **檢查 2**：開瀏覽器 DevTools → Console，看有沒有錯誤
- **檢查 3**：Tailwind v4 與 Vite 6 需要 `@tailwindcss/vite` 插件（已配置在 `vite.config.ts`）

### Q2：`npm run clean` 在 Windows cmd 失敗
- 原因：`rm -rf` 是 Unix 指令
- 解法：改成跨平台版本
  ```json
  "clean": "rimraf dist"
  ```
  並 `npm i -D rimraf`

### Q3：手機 iOS Safari 全螢幕沒反應
- iOS Safari 不支援 `requestFullscreen()` API
- 程式內已有 CSS fallback：`setIsFullscreen(true)` 會手動把容器撐滿視窗

### Q4：聲音沒出來
- 瀏覽器自動播放政策：**必須由使用者先點擊**才能 `audioCtx.resume()`
- 程式邏輯：在「開始冒險」按鈕的 `initGame()` 中呼叫 `initAudio()`，這是合法的「使用者手勢」
- 若仍沒聲音 → 檢查瀏覽器分頁有沒有被靜音、系統音量

### Q5：Gamepad 無回應
- 需要先按一下手把任一按鈕，瀏覽器才會列出該手把（W3C Gamepad API 規範）
- Chrome / Edge 支援度最佳

### Q6：套件安裝太慢
- 可改用 pnpm 或設定鏡像：
  ```bash
  npm config set registry https://registry.npmmirror.com
  ```

---

## 📝 授權與致謝
- 致敬：Konami《Antarctic Adventure》(1983, MSX/NES)
- 音樂：Émile Waldteufel《Les Patineurs》(1882) 公共領域
- 程式：來自 Google AI Studio Remix 模板，可自由修改

---

> 📘 **下一步**：請參閱 [DEPLOY-AND-OPTIMIZE.md](DEPLOY-AND-OPTIMIZE.md) 了解如何把這份專案放到你的 GitHub Pages 並進行後續優化。
