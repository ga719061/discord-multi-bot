# AGENTS.md

## 專案速讀

這是「吉吉國王」Discord bot 專案，使用 Node.js 20+、Discord.js v14、SQLite/better-sqlite3。功能包含 AI 對話與知識庫、管理控制台、等級與排行榜、提醒、Steam 特價查詢、VALORANT/LoL 戰績、抽獎、投票、身分組、伺服器紀錄與圖片渲染。

新對話開始時，先讀這份文件，再依需求查看 `README.md`、`package.json` 與相關原始碼。

## 快速開始

- 安裝依賴：`npm install`
- 啟動 bot：`npm start`
- 開發模式：`npm run dev`
- 部署 slash commands：`npm run deploy`
- 完整檢查：`npm run check`
- 僅檢查 command import / manifest：`npm run verify:commands`

必要環境變數：

- `DISCORD_TOKEN`：Discord bot token。
- `CLIENT_ID`：Discord application client id。`npm run deploy` 可嘗試從 token 解析，但建議設定。
- `GOOGLE_AI_KEY`：Google Gemini API key。
- `AI_ADMIN_PASSWORD`：AI 管理功能使用的密碼。
- `PORT`：health server port，預設可用 `3000`。
- `GUILD_ID`：可選。設定後 `npm run deploy` 會同步到單一開發 guild；未設定時走 production/global 同步流程。

不要把 `.env` 實值、token、password 或任何密鑰寫進文件或提交。

## 架構導覽

- 入口：`src/bot.js` 建立 Discord client、註冊 interaction handler、初始化資料庫、載入 commands/events、啟動 scheduled jobs 與 health server。
- Slash commands：放在 `src/commands/<category>/*.js`。每個正式指令要 export `data` 與 `execute`；可用 `aliases` 補別名；`helpOnly` 檔案不會註冊成實際指令。
- Events：放在 `src/events/**`，由 `src/handlers/eventHandler.js` 遞迴載入。事件模組應 export `register(client)`。
- Command loading：`src/handlers/commandHandler.js` 會掃描 `src/commands` 下各分類目錄。
- Database：`src/utils/database.js` 負責 SQLite schema、簡易遷移、guild settings、AI settings、levels、reminders、giveaways、polls、reaction roles。
- AI 知識：`src/knowledge/*` 放 persona、features、commands、permissions、lore；`src/utils/serverKnowledge.js` 與 `src/utils/aiChat.js` 組合 AI 上下文。
- Components V2：互動式訊息與 notices 優先看 `src/utils/componentsV2.js`，避免混用不相容 payload。
- 圖片渲染：公告、每日一汪、占卜與戰績圖片分散在 `src/utils/announcementImage.js`、`src/commands/fun/lib/funImage.js`、`src/commands/esports/lib/statsImage.js`，素材在 `assets/`。

## 開發規則

- 先保護工作樹：這個 repo 可能有使用者未提交變更。不要 revert、覆蓋或格式化無關檔案。
- 新增或改 slash command 時，確認 `data.name`、`execute`、alias 與 help/knowledge 內容一致。
- Command manifest 規則：除了 `/help`，避免新增英文 slash command；不要讓舊的 `volume`、`stop`、`shuffle` 回到 manifest。
- 改資料庫欄位時，在 `initDatabase()` 補 `CREATE TABLE` 預設欄位，也補既有 DB 的 `ALTER TABLE` 遷移。
- 改 guild 或 AI setting key 時，同步更新 allowlist，例如 `ALLOWED_GUILD_KEYS` 或 `ALLOWED_AI_KEYS`。
- 改互動 UI 時，先找現有 builder/helper，特別是 Components V2 payload、settings panel、announcement preview、Steam detail、reaction role。
- 改對外 API、爬蟲或第三方資料來源時，測試要 mock fixture，避免測試依賴即時網路。
- 文件或字串內容可使用繁體中文；程式碼命名與註解保持簡潔，避免不必要的大重構。

## 驗證方式

- 一般程式碼改動：跑 `npm run check`。
- 指令新增、移除、改名或 alias 變更：至少跑 `npm run verify:commands`，必要時再跑 `npm run deploy`。
- 資料庫 schema 或設定面板改動：跑 settings/database 相關測試，例如 `tests/settingsPanel.test.js`、`tests/guildDiagnostics.test.js`。
- 圖片或卡片排版改動：跑相關 image tests，例如 `tests/imageRendering.test.js`、`tests/funImage.test.js`、`src/commands/esports/__tests__/embed.test.js`。
- 文件-only 變更通常不需要跑完整測試；確認 diff 與內容可讀即可。

## AI 維護本文件

AI 之後工作時要自行維護 `AGENTS.md`：

- 若新增、移除或改名功能、指令、資料表、環境變數、測試指令或部署流程，必須同步更新本文件。
- 若工作中發現反覆踩坑、重要慣例或能幫下一次新對話更快上手的資訊，可以補一條短規則。
- 更新時保持精簡，只記穩定且有用的專案知識。
- 不寫暫時性 debug 紀錄、個人猜測、密鑰、`.env` 實值或會快速過期的狀態。
- 若內容與實際程式碼衝突，以程式碼為準，並修正本文件。
