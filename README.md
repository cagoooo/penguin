# 🐧 南極大冒險：企鵝跑酷

> 致敬 Konami 1983 年經典遊戲《Antarctic Adventure》的 React 重製版。
> 由 **阿凱老師** 為石門國小學生製作。

🎮 **線上玩**：https://cagoooo.github.io/penguin/

📖 **詳細玩法說明**：[USAGE.md](USAGE.md)
🚀 **部署與優化指南**：[DEPLOY-AND-OPTIMIZE.md](DEPLOY-AND-OPTIMIZE.md)

---

## 快速開始

```bash
# 安裝
npm install

# 開發伺服器
npm run dev   # → http://localhost:3000

# 打包
npm run build
```

## 操作

| 鍵盤 | 動作 |
|---|---|
| ← / → | 切換車道 |
| ↑ / Space | 跳躍 |
| ↓ | 減速 |

**手機觸控**：長按左右切換車道並加速、輕點跳躍

**🥚 隱藏指令**：在開始畫面依序按 `↑↑↓↓←←→→AB` 啟動 God Mode

---

## 技術棧

React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS v4 · Motion · Lucide Icons · Canvas Confetti

---

## 致謝

- 致敬：Konami《Antarctic Adventure》(1983, MSX/NES)
- 音樂：Émile Waldteufel《Les Patineurs / Skater's Waltz》(1882, 公共領域)
- 起源：Google AI Studio Remix 模板

---

🤖 Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/)

---

<!-- BEGIN:PROJECT_GUIDE -->
## 專案導覽

南極大冒險：企鵝跑酷

- 專案定位：互動遊戲／遊戲化學習專案
- Repository：`cagoooo/penguin`
- 可見性：公開
- 主要技術：TypeScript、React、Vite、Firebase、Tailwind CSS、Playwright
- 線上入口：未在 GitHub repository metadata 設定

### 可以怎麼應用

- 課堂暖身、複習活動或學習站任務
- 校慶、闖關或社團活動中的互動挑戰
- 替換題庫、美術、音效與規則後，延伸成其他學科或主題遊戲

這些是依目前專案定位整理的延伸方向，不代表所有情境都已內建完成；實作前請先確認現有功能與資料格式。

### 技術與專案結構

- `README.md`
- `firebase.json`
- `index.html`
- `package.json`
- `public`
- `scripts`
- `src`
- `vite.config.ts`

檔案結構會隨版本演進；若本節與程式碼不一致，以目前預設分支的原始碼為準。

### 本機執行

```bash
npm install
# dev
npm run dev
# build
npm run build
# test
npm run test
# lint
npm run lint
```
請以 `package.json` 的 `scripts` 為準；若專案需要雲端服務，請先建立自己的環境變數與測試專案。

### 給 AI Agent 的接手指南

1. 先閱讀本 README、`AGENTS.md`（若有）、套件腳本與部署設定。
2. 先找出遊戲狀態、關卡／題庫資料與輸入控制的來源，再調整規則。
3. 更換素材時同步檢查授權、載入路徑、碰撞區域與不同螢幕比例。
4. 修改後至少驗證開始、遊玩、計分／勝負、重新開始，以及手機與桌面版面。
5. 不要捏造尚未存在的功能；README 與實作有落差時，應同時更新文件。
6. 提交前只納入本次任務檔案，並記錄實際執行過的驗證。

### 安全與資料注意事項

- 不要提交 `.env`、服務帳號、API 金鑰、token、學生個資或正式環境匯出資料。
- 使用 Firebase、Supabase、Google API 或其他雲端服務時，請建立自己的測試專案並套用最小權限。
- 若要公開衍生作品，請先確認程式碼、圖片、音訊、字型與教材內容的授權。

### 貢獻與客製化

歡迎依教學現場、活動或工作流程需求進行 fork／客製化。建議在變更說明中交代使用情境、主要修改、測試方式，以及是否影響資料格式或部署設定。
<!-- END:PROJECT_GUIDE -->
