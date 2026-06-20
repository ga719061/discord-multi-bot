# AGENTS.md

## AI 工作前後檢查

- 每次新對話或接手工作時，先讀本文件，再看 `README.md`、`package.json` 與相關原始碼。
- 每次完成實作、審查或修 bug 前，做一次「是否需要更新 AGENTS.md」檢查。
- 只要新增、移除或改名功能、指令、資料表、環境變數、測試指令、部署流程，或發現可避免下次踩坑的穩定規則，就同步更新本文件。
- final 回覆前，若本次有更新本文件，簡短提到更新位置；若沒有更新且變更涉及長期專案慣例，重新確認是否漏記。

## 子代理分派工作流

- 接手任務並完成初步速讀後，先建立任務地圖，主動判斷哪些工作可交由子代理平行調查或實作；不要為了使用子代理而拆分簡單任務。
- 適合分派的工作包括：可獨立進行的程式碼探索、不同模組的影響分析、測試失敗調查、文件查核、互不重疊的實作，以及完成後的獨立 code review。
- 不適合分派的工作包括：範圍很小的修改、需要頻繁共享中間狀態的緊密耦合工作、會同時修改相同檔案的工作，以及涉及正式資料、密鑰、部署或不可逆操作的工作。
- 分派前要明確提供任務目標、範圍、已知背景、限制、預期產出與驗證方式，並要求子代理不得修改範圍外檔案或覆蓋既有未提交變更。
- 只有彼此獨立的工作才能平行執行；每個檔案或模組應有明確單一負責者。若工作存在前後依賴，應依序分派。
- 優先讓子代理回報具體證據，例如檔案與行號、根因、風險、執行過的命令、測試結果與建議修改；避免只回報模糊結論。
- 主代理仍對最終成果負責：必須審查子代理產出、處理衝突、依實際程式碼整合修改，並親自執行必要驗證；不得直接把子代理宣稱的完成或測試成功視為已驗收。
- 若子代理結果彼此衝突或與實際行為不一致，以程式碼、測試與實際執行結果為準，主代理應進一步調查後再決策。

## 專案速讀

這是「吉吉國王」Discord bot 專案，使用 Node.js 20+、Discord.js v14、SQLite/better-sqlite3。目前專案部署於 Synology DS920+ Container Manager (Docker) 容器環境。功能包含 AI 對話與知識庫、管理控制台、等級與排行榜、提醒、Steam 特價查詢、VALORANT/LoL 戰績、鳴潮抽卡紀錄、抽獎、投票、身分組、伺服器紀錄與圖片渲染。

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
- AI 上下文：`src/knowledge/persona.js` 僅提供角色語氣；`src/utils/aiGuildContext.js` 按需提供提問者、明確提及成員與目前伺服器／頻道的公開摘要。不得注入完整名冊、不可見頻道、管理設定、權限診斷或憑證，Discord mention 安全規則仍須強制套用。
- Components V2：互動式訊息與 notices 優先看 `src/utils/componentsV2.js`，避免混用不相容 payload。
- 圖片渲染：公告、每日一汪、占卜與戰績圖片分散在 `src/utils/announcementImage.js`、`src/commands/fun/lib/funImage.js`、`src/commands/esports/lib/statsImage.js`，素材在 `assets/`。
- 鳴潮抽卡：`src/commands/gacha/wuwa.js` 負責綁定、更新、查詢與解除綁定；`src/commands/gacha/lib/` 負責喚取 API、匯入、歷史合併、統計與 1600×900 圖片渲染。

## 開發規則

- 先保護工作樹：這個 repo 可能有使用者未提交變更。不要 revert、覆蓋或格式化無關檔案。
- 新增或改 slash command 時，確認 `data.name`、`execute`、alias 與 help/knowledge 內容一致。
- Command manifest 規則：除了 `/help`，避免新增英文 slash command；不要讓舊的 `volume`、`stop`、`shuffle` 回到 manifest。
- 改資料庫欄位時，在 `initDatabase()` 補 `CREATE TABLE` 預設欄位，也補既有 DB 的 `ALTER TABLE` 遷移。
- 依賴新欄位的 SQLite 索引必須在既有資料庫完成 `ALTER TABLE` 遷移後建立，並以舊 schema temp DB 測試驗證。
- 改 guild 或 AI setting key 時，同步更新 allowlist，例如 `ALLOWED_GUILD_KEYS` 或 `ALLOWED_AI_KEYS`。
- AI 白名單與派對模式仍受 `ai_settings.enabled` 全域開關限制；AI 設定面板必須顯示並提供核心啟用／停用控制，重新啟用時清除舊的 `expires_at`。
- 會呼叫 `initDatabase()` 的測試要使用 temp DB helper，不要寫入真實 `data/bot.db`。
- 改互動 UI 時，先找現有 builder/helper，特別是 Components V2 payload、settings panel、announcement preview、Steam detail、reaction role。
- Components V2 單則訊息最多 40 個元件；擴充 settings panel 或 AI 草稿中心時要用 `countV2Components()` 補 regression test。
- AI 草稿功能只使用私人設定面板 session 狀態；不得直接公開發文或直接修改設定，公告仍必須走 preview 與發布確認。
- 公告發布必須在第一個 `await` 前從 `pendingAnnouncements` 原子 claim 草稿；發布失敗時恢復草稿，成功後不可再發布。
- 改對外 API、爬蟲或第三方資料來源時，測試要 mock fixture，避免測試依賴即時網路。
- `tmp/` 是本機預覽產物目錄；需要納入版本控制的測試素材請放到 fixture 或 assets。
- 文件或字串內容可使用繁體中文；程式碼命名與註解保持簡潔，避免不必要的大重構。
- AI 預覽與附件限制：由於 Discord API 限制對已發送的 Ephemeral 訊息在 Edit 時無法新增/追加檔案附件，公告預覽必須以一則全新的 Ephemeral 訊息發送（使用 `component.reply` 或其 `deferReply` + `editReply` 組合），不得直接在原有面板中以 Edit 置換方式加入圖片附件。
- AI 公告草稿標題限制：為防止 AI 產生的公告標題在圖片中過長被截斷，System Prompt 必須限制公告標題在 15 字以內（包含表情符號），確保其天然符合單行排版要求。
- 公告圖片渲染排版：公告卷軸圖片需使用 `smartWrap` 函數進行中英文混合折行排版（中文/全角權重=2，英文/半角權重=1），確保英文單字在行尾不被生硬斷開並遵循避頭尾標點規則。文字的 Y 座標必須依據提及與標題行數採用垂直流式動態累加計算，避免各元素重疊。大標題需使用 `smartWrap` 限制在 `1` 行（寬度上限 `38`），內文與標題的垂直留白間距 `bodyStart` 應採用 `+ 75`（增加 45 像素）以呈現舒適的呼吸感。正文單行字數上限 `BODY_MAX_CHARS` 為 `18`（長文本為 `21`），且左側 `X` 座標對齊至 `220`，頁尾和日期亦統一在 `220` 處對齊以保持視覺平衡與工整。
- SVG 表情符號渲染優化：為防止 `sharp` / `librsvg` 因繼承粗體樣式而使黑白 Emoji 輪廓被填滿成無細節色塊，在 SVG `<tspan>` 中中必須顯式設定 `font-weight="normal"`，且 `font-size` 建議調整為 `1.3em`，並使其繼承文字的深色（不設 `fill` 屬性）以融入卷軸古典風格。為防止 XML 屬性單引號解析失敗，需在 `<style>` 中定義 `.emoji` 樣式類別，並用 `<tspan class="emoji">` 套用。
- 群暉 Docker 容器字型加載：本專案部署於 Synology Container Manager 環境。當圖片渲染模組（如公告卷軸、戰績卡）因為容器缺少系統字型而出現中文字型缺失或表情符號顯示為帶十六進位編碼的「豆腐塊」方框時，應在大易（Dockerfile）中以 `RUN apt-get update && apt-get install -y fonts-noto-cjk fonts-noto-color-emoji` 補齊 Linux 字型，或在群暉 Container Manager 介面中，將包含 `Noto Sans CJK` 和 `Segoe UI Emoji` 的本地字型資料夾掛載映射至容器內的 `/usr/share/fonts/truetype/` 目錄中，即可在不重建鏡像的情況下即時加載。
- 快取與資源管理：模組級快取 Map 必須實施容量上限限制（如 100）與 FIFO 淘汰以防止記憶體無界膨脹；每日產生的日誌檔案須實施保留天數清理（如 30 天）。
- 資源與生命週期管理：所有定時排程應提供對應的 `stop` 函數以支援 Graceful Shutdown，並在 `src/utils/scheduledJobs.js` 中統一經由 `stopScheduledJobs()` 關閉；健康檢查伺服器可由 `stopHealthServer()` 關閉。
- 大檔案下載防禦：對於外部資源下載，優先使用 `fetchWithLimit(url, fetchImpl, { maxBytes })`，並設定適當的 `maxBytes` (例如公告圖片 8MB/15MB，AI 圖片 5MB)，以防無 `content-length` 的超大檔案在下載時被全部載入記憶體而導致崩潰。
- 提醒系統優化：`reminders` 表支援錯誤重試 (最大 5 次，重試間隔為 attempts 分鐘，使用 `attempts`、`next_retry_at` 與 `last_error` 欄位) 與跨伺服器隔離 (查詢/刪除時帶入 `guildId`)，特定永久性錯誤 (找不到 guild/channel) 應直接改為對應失敗狀態。
- 抽獎結果可靠性：抽出得主後先持久化 `winner_ids` 與 `drawn_pending_notify`；公開結果成功發送後才能標記 `completed`，通知失敗重試時不得重新抽獎。
- 鳴潮喚取授權：完整 URL、`recordId`、`serverId`、`cardPoolId` 只能存在單次記憶體流程，不得寫入資料庫或 log；`wuwa_accounts` 只保存 Discord user、UID 與版本化歷史。更新紀錄要以有序序列合併，不能用時間作唯一鍵。
- 鳴潮 URL 教學在私人首頁直接顯示 WuWa Tracker 官方固定 commit 的 PowerShell 指令，並附腳本檢視與遠端執行警告；若更新 commit 必須先核對官方 repo。圖片 renderer 必須載入直接生成的點陣底圖 `assets/wuwa/card-background-v3.png`，不得以 SVG 轉檔替代；最近五星頭像依實際筆數動態置中。
- `/幫助` 會將 `esports` 與 `gacha` 模組合併顯示為「遊戲查詢」分類，分類內分別提供 `/戰績` 與 `/鳴潮抽卡` 的直接入口；不可在首頁拆成兩個獨立分類。

## 驗證方式

- 一般程式碼改動：跑 `npm run check`。
- 指令新增、移除、改名或 alias 變更：至少跑 `npm run verify:commands`，必要時再跑 `npm run deploy`。
- 資料庫 schema 或設定面板改動：跑 settings/database 相關測試，例如 `tests/settingsPanel.test.js`、`tests/guildDiagnostics.test.js`。
- 圖片或卡片排版改動：跑相關 image tests，例如 `tests/imageRendering.test.js`、`tests/funImage.test.js`、`src/commands/esports/__tests__/embed.test.js`。
- 鳴潮綁定、匯入、合併、統計或圖片改動：跑 `tests/wuwaGacha.test.js`，並確認不會輸出完整授權欄位。
- 文件-only 變更通常不需要跑完整測試；確認 diff 與內容可讀即可。

## AI 維護本文件

AI 之後工作時要自行維護 `AGENTS.md`：

- 若新增、移除或改名功能、指令、資料表、環境變數、測試指令或部署流程，必須同步更新本文件。
- 若工作中發現反覆踩坑、重要慣例或能幫下一次新對話更快上手的資訊，可以補一條短規則。
- 更新時保持精簡，只記穩定且有用的專案知識。
- 不寫暫時性 debug 紀錄、個人猜測、密鑰、`.env` 實值或會快速過期的狀態。
- 若內容與實際程式碼衝突，以程式碼為準，並修正本文件。
