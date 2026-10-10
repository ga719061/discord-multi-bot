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

這是「吉吉國王」Discord bot 專案，使用 Node.js 24+、Discord.js v14、SQLite/better-sqlite3。目前專案部署於 Synology DS920+ Container Manager (Docker) 容器環境。功能包含 AI 對話與知識庫、管理控制台、等級與排行榜、提醒、Steam 特價查詢、VALORANT/LoL 戰績、鳴潮抽卡紀錄、抽獎、投票、身分組、伺服器紀錄與圖片渲染。

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
- NAS／YouTube 音樂：`src/commands/music/music.js` 與 `lib/ui.js` 提供 `/音樂`、私人登入／搜尋／YouTube 連結輸入與公開 Components V2 播放面板；`src/events/music.js` 接收播放器互動及語音狀態並在 shutdown 停止播放器。`src/utils/musicAccounts.js` 管理 guild/user 記憶體登入，`musicLibrary.js` 以各自的月下樂藏 session cookie 讀取館藏，YouTube provider 使用官方 yt-dlp，`musicPlayback.js` 共用 FFmpeg Ogg Opus transport 與 `@discordjs/voice`，不依賴 JavaScript Opus 編碼器。

## 開發規則

- 先保護工作樹：這個 repo 可能有使用者未提交變更。不要 revert、覆蓋或格式化無關檔案。
- 新增或改 slash command 時，確認 `data.name`、`execute`、alias 與 help/knowledge 內容一致。
- Command manifest 規則：除了 `/help`，避免新增英文 slash command；不要讓舊的 `volume`、`stop`、`shuffle` 回到 manifest。
- 改資料庫欄位時，在 `initDatabase()` 補 `CREATE TABLE` 預設欄位，也補既有 DB 的 `ALTER TABLE` 遷移。
- 依賴新欄位的 SQLite 索引必須在既有資料庫完成 `ALTER TABLE` 遷移後建立，並以舊 schema temp DB 測試驗證。
- 改 guild 或 AI setting key 時，同步更新 allowlist，例如 `ALLOWED_GUILD_KEYS` 或 `ALLOWED_AI_KEYS`。
- AI 白名單與派對模式仍受 `ai_settings.enabled` 全域開關限制；AI 設定面板必須顯示並提供核心啟用／停用控制，重新啟用時清除舊的 `expires_at`。
- AI 操作工具由 `ai_settings.action_tools_enabled` 獨立總開關控制且預設關閉；只解析移除 bot Mention 後緊接於字串開頭的 `提醒:`／`提醒：`、`投票:`／`投票：`、`公告:`／`公告：`。工具只開放 AI 白名單，派對模式不得授予工具權；公告另須 Administrator 與 `admin_ids` 授權，並維持私人草稿預覽、原子 claim 與發布確認。
- AI 模型選單固定使用 Stable ID：預設 `gemini-3.8-flash` 與經濟型 `gemini-3.5-flash-lite`；舊 Flash／Pro 設定遷移到前者，舊 Flash-Lite 設定遷移到後者，未知值回退預設模型。
- AI 對話歷史只可在提問者具備 `ReadMessageHistory` 時讀取，只保留 30 分鐘內該提問者訊息與本 bot 直接 reference 它的完整 reply pair，並排除一般頻道發言、system、webhook 與第三方 bot；歷史須從最新完整 pair 往舊套用單則與總字元預算，再恢復時間順序。
- AI 請求維持每使用者 8 秒冷卻與單一 in-flight、每 guild 2 個及全域 6 個 in-flight 上限；整個圖片下載、Gemini 請求與重試流程共用 45 秒 deadline，逾時須中止 client request、typing timer 並釋放 slot。
- AI 一般回答固定限制 1,200 output tokens，Discord 最多發布 3 則、每則不超過 1,990 字；分段不得切斷 UTF-16 surrogate 或未閉合 Markdown code fence，截斷時要明確提示。
- AI 圖片每次最多 2 張，下載與處理後 payload 各自總計不超過 8 MB；只接受 Discord HTTPS CDN host、拒絕 redirect，並驗證 MIME、magic bytes 與實際 decode。輸入像素須有上限，送出前縮至最長邊 2,048 px 並重編碼 WebP；純圖片請求若沒有任何有效圖片不得呼叫 Gemini。
- `gemini-3.8-flash` 一般聊天使用 `low` thinking（不支援 `minimal`），`gemini-3.5-flash-lite` 使用 `minimal`；若未經 usage／latency／品質數據驗證，不要提高一般聊天的 thinking level。
- AI 回應只記錄模型、延遲、重試、token／thinking／cache 數、Search query 數與 finish reason，不得記錄 prompt、回覆、附件 URL 或 grounding query 內容；`citations_enabled` 預設關閉，且須與 `search_enabled` 獨立控制。只有前者開啟時，Search 回答才最多附 3 個經過清理的 HTTP(S) 來源。
- 會呼叫 `initDatabase()` 的測試要使用 temp DB helper，不要寫入真實 `data/bot.db`。
- 改互動 UI 時，先找現有 builder/helper，特別是 Components V2 payload、settings panel、announcement preview、Steam detail、reaction role。
- Components V2 單則訊息最多 40 個元件；擴充 settings panel 或 AI 草稿中心時要用 `countV2Components()` 補 regression test。
- 核心互動訊息優先使用原生 Components V2；每個主要畫面最多使用一個由 `ansiRows()` 產生的短 ANSI 摘要框，且每行必須保留文字標籤，不能只靠顏色傳意。長文、Mention、URL、Discord 時間標籤及短 notices 維持一般 Markdown；每個操作列最多一個 Primary，Danger 只留給最終高風險確認。
- 成果型圖片卡必須在圖片前提供可掃讀的文字摘要，並為 Media Gallery 圖片設定具體 description；互動與管理流程不應為了品牌效果改成純圖片。
- AI 草稿功能只使用私人設定面板 session 狀態；不得直接公開發文或直接修改設定，公告仍必須走 preview 與發布確認。
- 公告發布必須在第一個 `await` 前從 `pendingAnnouncements` 原子 claim 草稿；發布失敗時恢復草稿，成功後不可再發布。
- 改對外 API、爬蟲或第三方資料來源時，測試要 mock fixture，避免測試依賴即時網路。
- VALORANT 的 OP.GG action discovery 必須選取玩家路由的 `page-*.js`，不能取第一個含 `valorant/profile` 的腳本（可能是 `not-found-*.js`）；測試須涵蓋錯誤頁腳本在前、action 位於玩家頁 dependency chunk 的情況。
- Steam 限時免費看板以 `steam_free_boards` 保存每個 guild 的目前貼文與完整 snapshot；只有新增 app ID 時建立新貼文，成功發布後刪除舊帖，只移除項目或截止時間變動時編輯原貼文。截止時間使用 Steam Store Browse `free_to_keep_ends` 並轉成台灣時間；Browse 暫時失敗、漏項或驗證欄位不完整時保留已通過搜尋頁 100% 折扣檢查的候選、標示永久入庫待複核、將截止時間標為未提供並記錄 warning，不得因此整批停止發布。搜尋頁回報非零結果卻完全無法解析時必須視為資料錯誤並保留原看板。測試必須 mock Steam 回應。
- `tmp/` 是本機預覽產物目錄；需要納入版本控制的測試素材請放到 fixture 或 assets。
- 文件或字串內容可使用繁體中文；程式碼命名與註解保持簡潔，避免不必要的大重構。
- AI 預覽與附件限制：由於 Discord API 限制對已發送的 Ephemeral 訊息在 Edit 時無法新增/追加檔案附件，公告預覽必須以一則全新的 Ephemeral 訊息發送（使用 `component.reply` 或其 `deferReply` + `editReply` 組合），不得直接在原有面板中以 Edit 置換方式加入圖片附件。
- AI 公告草稿標題限制：為防止 AI 產生的公告標題在圖片中過長被截斷，System Prompt 必須限制公告標題在 15 字以內（包含表情符號），確保其天然符合單行排版要求。
- 公告圖片渲染排版：公告卷軸圖片需使用 `smartWrap` 函數進行中英文混合折行排版（中文/全角權重=2，英文/半角權重=1），確保英文單字在行尾不被生硬斷開並遵循避頭尾標點規則。文字的 Y 座標必須依據提及與標題行數採用垂直流式動態累加計算，避免各元素重疊。大標題需使用 `smartWrap` 限制在 `1` 行（寬度上限 `38`），內文與標題的垂直留白間距 `bodyStart` 應採用 `+ 75`（增加 45 像素）以呈現舒適的呼吸感。正文單行字數上限 `BODY_MAX_CHARS` 為 `18`（長文本為 `21`），且左側 `X` 座標對齊至 `220`，頁尾和日期亦統一在 `220` 處對齊以保持視覺平衡與工整。
- SVG 表情符號渲染優化：為防止 `sharp` / `librsvg` 因繼承粗體樣式而使黑白 Emoji 輪廓被填滿成無細節色塊，在 SVG `<tspan>` 中中必須顯式設定 `font-weight="normal"`，且 `font-size` 建議調整為 `1.3em`，並使其繼承文字的深色（不設 `fill` 屬性）以融入卷軸古典風格。為防止 XML 屬性單引號解析失敗，需在 `<style>` 中定義 `.emoji` 樣式類別，並用 `<tspan class="emoji">` 套用。
- 群暉 Docker 容器字型加載：本專案部署於 Synology Container Manager 環境。當圖片渲染模組（如公告卷軸、戰績卡）因為容器缺少系統字型而出現中文字型缺失或表情符號顯示為帶十六進位編碼的「豆腐塊」方框時，應在大易（Dockerfile）中以 `RUN apt-get update && apt-get install -y fonts-noto-cjk fonts-noto-color-emoji` 補齊 Linux 字型，或在群暉 Container Manager 介面中，將包含 `Noto Sans CJK` 和 `Segoe UI Emoji` 的本地字型資料夾掛載映射至容器內的 `/usr/share/fonts/truetype/` 目錄中，即可在不重建鏡像的情況下即時加載。
- 快取與資源管理：模組級快取 Map 必須實施容量上限限制（如 100）與 FIFO 淘汰以防止記憶體無界膨脹；每日產生的日誌檔案須實施保留天數清理（如 30 天）。
- 資源與生命週期管理：所有定時排程應提供對應的 `stop` 函數以支援 Graceful Shutdown，並在 `src/utils/scheduledJobs.js` 中統一經由 `stopScheduledJobs()` 關閉；健康檢查伺服器可由 `stopHealthServer()` 關閉。`/livez`（以及相容用 `/`）只檢查 HTTP 存活，`/readyz` 必須同時確認 Discord ready 與 SQLite 可查詢；Docker healthcheck 使用 `/readyz`。
- 語音 XP 必須依實際在線毫秒累積，每滿 10 分鐘才結算一次，離線後保留未滿一個區塊的餘額；語音獎勵不得更新文字訊息 XP 的 `last_xp_time` cooldown。
- 大檔案下載防禦：對於外部資源下載，優先使用 `fetchWithLimit(url, fetchImpl, { maxBytes })`，並設定適當的 `maxBytes` (例如公告圖片 8MB/15MB，AI 圖片 5MB)，以防無 `content-length` 的超大檔案在下載時被全部載入記憶體而導致崩潰。
- 戰績圖片只下載允許清單內的 HTTPS 資產，拒絕 redirect，圖片與 metadata 上限皆為 5MB；不得重新接受上游 HTML 提供的任意 host。VALORANT 地圖縮圖依序使用 `listViewIcon`、`displayIcon`、`splash`，避免為小縮圖下載超過 5MB 的 splash；資產索引需支援本地化名稱回退，圖片或 metadata 暫時失敗不得永久快取 `null`。
- 提醒系統優化：`reminders` 表支援錯誤重試 (最大 5 次，重試間隔為 attempts 分鐘，使用 `attempts`、`next_retry_at` 與 `last_error` 欄位) 與跨伺服器隔離 (查詢/刪除時帶入 `guildId`)，特定永久性錯誤 (找不到 guild/channel) 應直接改為對應失敗狀態。
- 抽獎結果可靠性：抽出得主後先持久化 `winner_ids` 與 `drawn_pending_notify`；公開結果成功發送後才能標記 `completed`，通知失敗重試時不得重新抽獎。
- 抽獎反應使用者必須以每頁 100 人完整分頁並依 ID 去重後才抽出得主，不得只使用 `reaction.users.fetch()` 的第一頁。
- 鳴潮喚取授權：完整 URL、`recordId`、`serverId`、`cardPoolId` 只能存在單次記憶體流程，不得寫入資料庫或 log；`wuwa_accounts` 只保存 Discord user、UID 與版本化歷史。更新紀錄要以有序序列合併，不能用時間作唯一鍵。
- 鳴潮 URL 教學在私人首頁直接顯示 WuWa Tracker 官方固定 commit 的 PowerShell 指令，並附腳本檢視與遠端執行警告；若更新 commit 必須先核對官方 repo。圖片 renderer 必須載入直接生成的點陣底圖 `assets/wuwa/card-background-v3.png`，不得以 SVG 轉檔替代；最近五星頭像依實際筆數動態置中。角色／武器 catalog 快取須有 TTL 並依 fetch implementation 隔離；頭像只允許固定 HTTPS host、拒絕 redirect，類型文字無法辨識時須以資產 ID 在角色與武器目錄間回退。
- `/幫助` 會將 `esports` 與 `gacha` 模組合併顯示為「遊戲查詢」分類，分類內分別提供 `/戰績` 與 `/鳴潮抽卡` 的直接入口；不可在首頁拆成兩個獨立分類。首頁「音樂播放器」與「音樂」分類／詳情按鈕直接呼叫音樂 execute，不依賴 `/音樂` 註冊；必須維持私人回應、使用者 scope 與原有音樂權限檢查，首頁四個快捷入口不得互相擠掉。
- Docker image 使用 Node.js 24 多階段建置，runtime 不保留編譯工具；apt 安裝使用 `--no-install-recommends`，保留 FFmpeg、CJK／Emoji 字型、fontconfig 與 gosu 及其必要依賴。首次建置的 `Get:N` 是套件下載序號，不能當作時間或百分比。Compose 必須以 `user: "0:0"` 啟動 entrypoint，對掛載的 `/app/data` 與 `/app/logs` 執行 `chown node:node`、`chmod u+rwX` 並以 UID 1000 驗證可寫後，隨即透過 `gosu` 降權成 `node` 執行 bot。不得刪除或重建既有 volume 來處理 SQLite 權限問題。
- 音樂設定讀取 NAS 專用 `MUSIC_API_BASE_URL`、可選 `MUSIC_FFMPEG_PATH` 與 `MUSIC_YTDLP_PATH`；NAS 未設定或無效不阻擋 YouTube，不讀舊 ENV 帳密或 guild 白名單。每人以 owner/guild/nonce 綁定的私人 modal 登入已核准的月下樂藏帳號，Discord 無密碼遮罩，不可回填密碼或接受任意 NAS 來源 URL。帳密與 cookie 僅存記憶體，30 分鐘未使用清除（本人 NAS 正在播放／待播持續使用，YouTube 不保活 NAS 帳號）、全域最多 100 個登入、6 個登入 in-flight、每人 8 秒冷卻；shutdown 清理計時器、pending login 與帳密。登入後異步搜尋/getTrack 返回及 enqueue 前須檢查相同 account ID；登出只清除自己的 NAS queued/current、NAS 封面、舊 nonce/browser，不影響 YouTube，晚到登入不可復活。每首 NAS 播放由 guild/requestedBy 解析本人 client，不能使用其他人帳號 fallback；公開控制仍限同一一般語音頻道。月下樂藏媒體 ID 是 32 位 hex（亦接受 UUID），不能當檔案路徑。API 與 stream 使用固定 origin、拒絕 redirect，帳密、URL、NAS 路徑與上游錯誤不得出現在公開面板或 log。
- YouTube 點播入口位於公開播放器／私人登入卡／私人曲庫，不需 NAS 登入；只接受固定 HTTPS YouTube 網域與一般影片／Shorts／YouTube Music 單曲路徑，抽出影片 ID 後重建標準 URL，忽略清單／起播時間，不支援直播、超過 2 小時或整份播放清單。曲目以 `source: nas | youtube` 分流，缺 source 視為 NAS，影片 ID 不可交給 NAS API；佇列只存 ID 與顯示資料，播放／重播時重新解析。Modal 綁 owner/guild/player lifecycle，提交先消耗 nonce；每人一個 in-flight、8 秒冷卻、全域兩個解析，Map 上限 100，停止／shutdown 取消待處理工作並拒絕晚到結果。yt-dlp 固定參數 `shell: false`、忽略設定，不使用 cookies／帳號／PO Token 或遠端 EJS 下載；解析與首筆音訊各 30 秒，音訊 512MB，純音訊優先 WebM、其次 M4A 沿用私有暫存，失敗保留其餘佇列等待手動下一首。停止／跳歌／錯誤／shutdown 必須等待 yt-dlp 程序樹、FFmpeg 與暫存清理，不記原始 stderr 或 URL。Docker 固定官方 `yt-dlp_linux` x86_64 `2026.08.19` 並驗 SHA256 `58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a`，standalone 含 EJS，沿用 Node.js 24，不新增 Python／Deno runtime。
- CUE 分軌由月下樂藏後端建立虛擬曲目與獨立 UUID，bot 只保留 `isCueTrack` bool／1–99 `trackNumber`，不讀來源路徑或自行解讀任意裁切時間。API 提供已裁切的單首 FLAC；CUE stream header deadline 最多 60 秒（可 stop abort），普通 stream 與 JSON 維持 8 秒。改 CUE 需在音樂庫重掃，不能只改 bot。
- 音樂面板使用原生文字／Section 縮圖、三首公開預覽、十首私人分頁，標示 NAS／YouTube 來源，CUE 顯示分軌號，進度約 15 秒更新且不能 seek。`src/commands/music/lib/panel.js` 序列化公開 edit；NAS 封面由 requestedBy 本人 account 以固定 ID cover API 讀取，YouTube 封面只由影片 ID 組合固定 `i.ytimg.com` 路徑，不讀 NAS 帳號。共用 2MB／總期限 5 秒，驗證 PNG/JPEG/WebP 與單張 16M 像素後轉最大 512px WebP。換歌／停止取消並以 current、generation 檢查晚到結果，NAS 另驗 account ID；NAS 登出只取消 NAS 封面。附件上傳一次後保留 ID 重用、清除 buffer。封面讀取／上傳錯誤記錄不含上游資訊的 warning 並保留文字播放器，音訊不等待封面；shutdown 關閉 presenter。不得為美化增加字型、編碼器或整張卡片渲染；封面會公開到面板頻道，NAS URL／帳密不可公開。音樂每畫面最多一個由 `ansiRows()` 產生的受控 ANSI 摘要（`labelTone: neutral`、`maxWidth: 40`），只有摘要可含 helper 產生的合法 SGR 色碼；外來 metadata 與其他文字／元件仍禁止 ESC 及控制碼，不把曲名等任意長文字放入摘要。底色、色彩與字寬依 Discord 客戶端呈現，不承諾跨客戶端完全一致或任意字型／字色；按鈕圖示須使用 `.setEmoji()` 注入並嚴格保留原有 `.label` 文字以維持合約相容。
- 音樂四畫面沿用王國金色容器；公開播放器資訊順序為品牌／語音頻道、歌曲／Section 縮圖、單一 ANSI 摘要（狀態、12 格進度與時間、循環）、三首待播預覽、三列操作與提示。播放／待命用 `ROYAL`、暫停用 `ROYAL_SOFT`、連線／載入用 `INFO`、失敗用 `DANGER`、停止用 `MUTED` 且優先於錯誤；不可固定宣稱語音正常。操作列依序為暫停／繼續及下一首、點歌／YouTube／查看佇列、循環／隨機／停止；維持原 customId、label、emoji 與 disabled 規則。ANSI 內容色調：播放／待命 `royal`、暫停 `warning`、連線／載入與進度 `info`、失敗 `danger`、循環開啟 `special`／關閉 `neutral`；停止不顯示摘要。私人曲庫採歌名及歌手／專輯／時長／CUE 的兩行項目，搜尋分頁與帳號／YouTube 分列；佇列列出來源／歌手／時長，兩者摘要為頁碼 `info`、結果數／待播數 `royal`。登入卡分列 NAS 帳號與 YouTube，登入及 NAS／YouTube 可用狀態摘要採正常 `success`／未登入或未設定 `warning`。美化不得改搜尋排序、單首選取、100 首上限／十首分頁、權限、封面附件重用、音訊或刷新。UI 回歸須檢查單一摘要、不重複時間／循環文字、摘要僅含 helper 合法 SGR 且其餘 payload 無 ESC、40 元件上限及每列最多五個按鈕／一個 Primary；合成資料預覽可用 Message.style，桌面／手機與深淺主題另在 Discord 驗收。
- 音樂每 guild 一個播放器、全域最多 2 個、佇列最多 100 首；空佇列／無真人均持續待命，不設 idle／audience 自動離開計時器；手動停止或 bot 被移出／切換語音頻道時結束，連線錯誤與 shutdown 仍清理。待命 session 也占用全域名額；空佇列 idle 不做每 15 秒面板刷新，idle 仍有待播時持續刷新以保活各自帳號。停止／shutdown 必須中止 HTTP stream、FFmpeg 與語音連線。音訊以 backpressure 串流且單檔上限 512MB，JSON 上限 1MB；聽眾以 Discord 個人音量設定調整聽感，bot 固定套用 50% 音訊增益、不保留播放音量設定。Docker runtime 的 FFmpeg 必須支援 `libopus`，本機可用 `MUSIC_FFMPEG_PATH` 指定。
- 播放器允許連續缺少 50 個 20ms 封包（約 1 秒），短暫供料恢復後繼續同一首。SDK Idle 時已銷毀串流，不能以 `resource.ended`／`destroyed` 當正常曲尾證據；若目前 resource 的 `playStream.readableEnded === false`，須回報 `MUSIC_STREAM_STALLED`，保留待播歌曲且不循環重播失敗曲目。非預期 FFmpeg exit signal／非零 exit code 回報 `MUSIC_FFMPEG`；stop／skip／logout 的自行取消不得當音訊失敗。`onPlaybackError` 只記 prepare／audio stage、安全 code 與 playedSeconds，不記原始錯誤、曲目或 URL。音樂私人曲庫／登入面板不設 TTL；曲庫依 session 與 account ID 驗證，停止時清除該 session 的 browser，新開曲庫時清理已結束 session，登出清除本人 views。登入卡沿用每人每 guild 最新 nonce，各 Map 保留 100 份 FIFO 上限，shutdown 清除；不得把面板期限與帳號未使用 30 分鐘清除混為一談。`MUSIC_EXPIRED` 是失效 nonce／舊 session 的互動錯誤，不能據此推定音訊中斷。

## 驗證方式

- Docker `youtube-tool` 由 `scripts/install-ytdlp.mjs` 下載固定官方 standalone；每 5 秒顯示連線／下載進度，header 連線期限 30 秒、單次總期限 900 秒、下載連續 30 秒沒有資料即逾時、網路／HTTP 暫時失敗最多 3 次，串流上限 64MiB，SHA256 通過後原子安裝；逾時／失敗刪除部分下載，不能跳過 checksum 或使用未核准鏡像。改此流程跑 `tests/ytdlpBuild.test.js` 與 `tests/dockerRuntime.test.js`，以合成 HTTP 回應覆蓋停住、重試、hash／大小限制與清理，測試不依賴即時網路。

- Discord Components V2 引用的封面可能不出現在 `Message.attachments`；上傳回應須優先從 Container → Section → Thumbnail 的 `media.attachment_id` 及 `url`／`proxy_url` 取得附件 ID 與圖片網址，再相容舊 attachments 集合。只有首次上傳使用 `attachment://檔名`；進度更新保留附件 ID 並使用 Discord CDN 網址，移除簽名 query，由 Discord 自動刷新。僅接受 Discord HTTPS attachments 路徑且網址內附件 ID 須一致。封面 regression 必須使用真正 Discord.js Message 與 MessagePayload 模擬 `attachments: []`、首次成功後刷新回報 50035，並確認多次刷新與暫停保留封面、換歌／登出／停止移除附件；不可只測傳統附檔回應。封面失敗日誌只記 download／upload stage 與固定安全代碼，不輸出上游錯誤內容。

- 一般程式碼改動：跑 `npm run check`。
- 指令新增、移除、改名或 alias 變更：至少跑 `npm run verify:commands`，必要時再跑 `npm run deploy`。
- 資料庫 schema 或設定面板改動：跑 settings/database 相關測試，例如 `tests/settingsPanel.test.js`、`tests/guildDiagnostics.test.js`。
- 圖片或卡片排版改動：跑相關 image tests，例如 `tests/imageRendering.test.js`、`tests/funImage.test.js`、`src/commands/esports/__tests__/embed.test.js`。
- ANSI 或 Components V2 共用 helper 改動：跑 `tests/componentsV2Migration.test.js`，並確認移除 ANSI escape codes 後仍保有可讀標籤與數值。`ansiRows()` 的 `labelTone` 必須 opt-in 並保留未指定時的整行上色輸出；色調只查 `ANSI_TONES` 自有屬性，未知值／原型屬性回退 `neutral`，輸入清理雙向文字方向控制碼但保留組合 emoji 的 ZWJ。測試涵蓋分色、舊輸出相容及 ESC／反引號／方向控制碼清理，不得刪除或削弱音樂安全檢查。
- 等級與排行榜卡片改動：跑 `tests/levelingUi.test.js`。
- NAS 音樂 API、登入、播放生命週期或 UI 改動：跑 `tests/musicAccounts.test.js`、`tests/musicLibrary.test.js`、`tests/musicPlayback.test.js`、`tests/musicUi.test.js`、`tests/musicCommand.test.js`；使用 mock 曲庫與 voice adapter，不登入真實服務或寫正式資料。音訊轉碼以合成音訊驗證，不使用實際館藏。
- YouTube provider／音樂來源分流改動另跑 `tests/musicYoutube.test.js`、command tests、`tests/musicYoutubePanel.test.js`；yt-dlp 使用 mock 子程序及本機 Node 子程序驗證完整 drain／停止等待 close，封面來源切換／NAS 登出隔離用真正 Discord.js Message／MessagePayload。首次點播及重用 connecting session 都須等待語音 ready；無播放器 modal 在提交時綁定當下的 session；失去語音權限時清理尚無面板的空 session。Manager `onStop` 在開始停止時同步取消 guild 待處理點播；停止最終通知只能取消相同 session ID 的請求，不能誤取消 replacement。測試不連真實 YouTube，另由使用者在 NAS 驗收實際播放、混排與兩個播放器負載；mock／合成音訊不能證明 YouTube 驗證或 403 可繞過。
- 播放供料 regression 使用真正 `@discordjs/voice` 與合成 Opus，僅 mock 網路 receiver；需涵蓋短暫停頓恢復、持續缺幀、正常 EOF、FFmpeg signal 終止及 skip／stop／logout 對照，不能只用 FakePlayer 的 Idle 模擬。
- SDK 的 `AudioPlayerError` 不保留原始 stream error 的 code／cause；transport 必須只保存已清理的 `MusicError` failure，由 manager 配對 `error.resource` 後取回安全原因。FFmpeg／stream 分類測試須經過真正 player 的 error 包裝，不能只監聽底層 stream。
- `npm run verify:music` 需要支援 `libopus` 的 FFmpeg，以合成 WAV、MP3、CUE 單首 FLAC、檔尾索引 M4A 及 mock YouTube WebM／M4A 實際驗證 Ogg Opus 串流與取消時等待 close／暫存清理；不讀取正式音樂、帳密或 Discord。此腳本另量測 20ms 即時發送；不能代表 NAS 播放負載，斷音排查仍須區分主執行緒延誤、空音訊緩衝與 Discord 網路問題。
- M4A／MP4 使用私有暫存檔支援 seek（512MB、下載 60 秒上限），固定 MOV demuxer 並禁止外部 references；停止／換曲需等待 FFmpeg 關閉及暫存清理，容器需預留約 1GB 暫存空間。其他格式維持限制 protocol 的 pipe 串流。
- 鳴潮綁定、匯入、合併、統計或圖片改動：跑 `tests/wuwaGacha.test.js`，並確認不會輸出完整授權欄位。
- 文件-only 變更通常不需要跑完整測試；確認 diff 與內容可讀即可。

## AI 維護本文件

AI 之後工作時要自行維護 `AGENTS.md`：

- 若新增、移除或改名功能、指令、資料表、環境變數、測試指令或部署流程，必須同步更新本文件。
- 若工作中發現反覆踩坑、重要慣例或能幫下一次新對話更快上手的資訊，可以補一條短規則。
- 更新時保持精簡，只記穩定且有用的專案知識。
- 不寫暫時性 debug 紀錄、個人猜測、密鑰、`.env` 實值或會快速過期的狀態。
- 若內容與實際程式碼衝突，以程式碼為準，並修正本文件。
