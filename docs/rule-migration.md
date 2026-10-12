# 原 AGENTS 規則遷移對照

對照基準為 2026-10-12 整理前工作樹的 AGENTS.md（包含既有未提交修改），不是 Git HEAD。舊行號只作穩定識別，不能當成目前檔案的行號；每個原 bullet 各一列，共 **115 條**。短摘要不是規則替代品，維護時讀目的文件的指定章節。

功能規則只放一個模組文件，跨模組使用連結；兩處工作前後／末尾維護說明合併回根 AGENTS。原文的部署「驗證」分類、必要 ENV 統稱與 Dockerfile 錯字依實際流程修正，沒有移除授權、隱私、數值限制或生命週期要求。八模組導覽可從 [根 AGENTS](../AGENTS.md) 開始，檔案歸屬由 [用途清單](file-inventory.md) 與 module-map 維護。

## 逐條對照

| 原規則 ID／行 | 短摘要 | 唯一維護位置／章節 | 處理 |
|---|---|---|---|
| R005／5 | 每次新對話或接手工作時，先讀本文件，再看 README.md、package.json 與相關原… | [../AGENTS.md](../AGENTS.md#接手與安全)：接手與安全 | 合併／移轉 |
| R006／6 | 每次完成實作、審查或修 bug 前，做一次「是否需要更新 AGENTS.md」檢查。 | [../AGENTS.md](../AGENTS.md#文件維護)：文件維護 | 合併／移轉 |
| R007／7 | 只要新增、移除或改名功能、指令、資料表、環境變數、測試指令、部署流程，或發現可避免下次踩坑的穩定… | [../AGENTS.md](../AGENTS.md#文件維護)：文件維護 | 合併／移轉 |
| R008／8 | final 回覆前，若本次有更新本文件，簡短提到更新位置；若沒有更新且變更涉及長期專案慣例，重新… | [../AGENTS.md](../AGENTS.md#文件維護)：文件維護 | 合併／移轉 |
| R012／12 | 接手任務並完成初步速讀後，先建立任務地圖，主動判斷哪些工作可交由子代理平行調查或實作；不要為了使… | [development.md](development.md#子代理分派)：子代理分派 | 合併／移轉 |
| R013／13 | 適合分派的工作包括：可獨立進行的程式碼探索、不同模組的影響分析、測試失敗調查、文件查核、互不重疊… | [development.md](development.md#子代理分派)：子代理分派 | 合併／移轉 |
| R014／14 | 不適合分派的工作包括：範圍很小的修改、需要頻繁共享中間狀態的緊密耦合工作、會同時修改相同檔案的工… | [development.md](development.md#子代理分派)：子代理分派 | 合併／移轉 |
| R015／15 | 分派前要明確提供任務目標、範圍、已知背景、限制、預期產出與驗證方式，並要求子代理不得修改範圍外檔… | [development.md](development.md#子代理分派)：子代理分派 | 合併／移轉 |
| R016／16 | 只有彼此獨立的工作才能平行執行；每個檔案或模組應有明確單一負責者。若工作存在前後依賴，應依序分派… | [development.md](development.md#子代理分派)：子代理分派 | 合併／移轉 |
| R017／17 | 優先讓子代理回報具體證據，例如檔案與行號、根因、風險、執行過的命令、測試結果與建議修改；避免只回… | [development.md](development.md#子代理分派)：子代理分派 | 合併／移轉 |
| R018／18 | 主代理仍對最終成果負責：必須審查子代理產出、處理衝突、依實際程式碼整合修改，並親自執行必要驗證；… | [development.md](development.md#子代理分派)：子代理分派 | 合併／移轉 |
| R019／19 | 若子代理結果彼此衝突或與實際行為不一致，以程式碼、測試與實際執行結果為準，主代理應進一步調查後再… | [development.md](development.md#子代理分派)：子代理分派 | 合併／移轉 |
| R029／29 | 安裝依賴：npm install | [../README.md](../README.md#啟動)：啟動 | 合併／移轉 |
| R030／30 | 啟動 bot：npm start | [../README.md](../README.md#啟動)：啟動 | 合併／移轉 |
| R031／31 | 開發模式：npm run dev | [operations.md](operations.md#windows-與手動啟動)：Windows 與手動啟動 | 合併／移轉 |
| R032／32 | 部署 slash commands：npm run deploy | [operations.md](operations.md#指令發布與備份)：指令發布與備份 | 明確標示會修改 Discord 指令 |
| R033／33 | 完整檢查：npm run check | [development.md](development.md#測試矩陣)：測試矩陣 | 合併／移轉 |
| R034／34 | 僅檢查 command import / manifest：npm run verify:commands | [development.md](development.md#測試矩陣)：測試矩陣 | 合併／移轉 |
| R038／38 | DISCORD_TOKEN：Discord bot token。 | [operations.md](operations.md#環境設定)：環境設定 | 分為啟動必要／功能必要／選配 |
| R039／39 | CLIENT_ID：Discord application client id。npm run … | [operations.md](operations.md#環境設定)：環境設定 | 分為啟動必要／功能必要／選配 |
| R040／40 | GOOGLE_AI_KEY：Google Gemini API key。 | [operations.md](operations.md#環境設定)：環境設定 | 分為啟動必要／功能必要／選配 |
| R041／41 | AI_ADMIN_PASSWORD：AI 管理功能使用的密碼。 | [operations.md](operations.md#環境設定)：環境設定 | 分為啟動必要／功能必要／選配 |
| R042／42 | PORT：health server port，預設可用 3000。 | [operations.md](operations.md#環境設定)：環境設定 | 分為啟動必要／功能必要／選配 |
| R043／43 | GUILD_ID：可選。設定後 npm run deploy 會同步到單一開發 guild；未設… | [operations.md](operations.md#環境設定)：環境設定 | 分為啟動必要／功能必要／選配 |
| R049／49 | 入口：src/bot.js 建立 Discord client、註冊 interaction h… | [architecture.md](architecture.md#啟動與清理)：啟動與清理 | 合併／移轉 |
| R050／50 | Slash commands：放在 src/commands/<category>/*.js。每… | [architecture.md](architecture.md#指令與互動)：指令與互動 | 合併／移轉 |
| R051／51 | Events：放在 src/events/**，由 src/handlers/eventHand… | [architecture.md](architecture.md#啟動與清理)：啟動與清理 | 合併／移轉 |
| R052／52 | Command loading：src/handlers/commandHandler.js 會… | [architecture.md](architecture.md#啟動與清理)：啟動與清理 | 合併／移轉 |
| R053／53 | Database：src/utils/database.js 負責 SQLite schema、… | [modules/settings-database.md](modules/settings-database.md#入口與資料流)：入口與資料流 | 導覽合併 |
| R054／54 | AI 上下文：src/knowledge/persona.js 僅提供角色語氣；src/util… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R055／55 | Components V2：互動式訊息與 notices 優先看 src/utils/compo… | [modules/ui.md](modules/ui.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R056／56 | 圖片渲染：公告、每日一汪、占卜與戰績圖片分散在 src/utils/announcementIm… | [modules/ui.md](modules/ui.md#入口與資料流)：入口與資料流 | 導覽合併 |
| R057／57 | 鳴潮抽卡：src/commands/gacha/wuwa.js 負責綁定、更新、查詢與解除綁定；… | [modules/games.md](modules/games.md#入口與資料流)：入口與資料流 | 導覽合併 |
| R058／58 | NAS／YouTube 音樂：src/commands/music/music.js 與 lib… | [modules/music.md](modules/music.md#入口與資料流)：入口與資料流 | 導覽合併 |
| R062／62 | 先保護工作樹：這個 repo 可能有使用者未提交變更。不要 revert、覆蓋或格式化無關檔案。 | [../AGENTS.md](../AGENTS.md#文件維護)：文件維護 | 合併／移轉 |
| R063／63 | 新增或改 slash command 時，確認 data.name、execute、alias … | [development.md](development.md#修改前後)：修改前後 | 合併／移轉 |
| R064／64 | Command manifest 規則：除了 /help，避免新增英文 slash comman… | [development.md](development.md#修改前後)：修改前後 | 合併／移轉 |
| R065／65 | 改資料庫欄位時，在 initDatabase() 補 CREATE TABLE 預設欄位，也補既… | [modules/settings-database.md](modules/settings-database.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R066／66 | 依賴新欄位的 SQLite 索引必須在既有資料庫完成 ALTER TABLE 遷移後建立，並以舊… | [modules/settings-database.md](modules/settings-database.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R067／67 | 改 guild 或 AI setting key 時，同步更新 allowlist，例如 ALL… | [modules/settings-database.md](modules/settings-database.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R068／68 | AI 白名單與派對模式仍受 ai_settings.enabled 全域開關限制；AI 設定面板… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R069／69 | /設定 的「AI／私人音樂」管理中心沿用 AI_ADMIN_PASSWORD 與 guild a… | [modules/settings-database.md](modules/settings-database.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R070／70 | NAS 使用資格為 guild nas_music_whitelist 成員，或 Adminis… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R071／71 | musicAccess.js 將 NAS 使用資格與 Discord Administrator… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R072／72 | NAS 登入、搜尋、點播及播放／重播須驗有效資格，異步返回後再次驗權限、account ID 與… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R073／73 | /音樂／/幫助 私人音樂卡皆提供 YouTube，只有 NAS 授權者顯示「私人音樂庫」，NAS… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R074／74 | AI 操作工具由 ai_settings.action_tools_enabled 獨立總開關控… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R075／75 | AI 模型選單固定使用 Stable ID：預設 gemini-3.8-flash 與經濟型 g… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R076／76 | AI 對話歷史只可在提問者具備 ReadMessageHistory 時讀取，只保留 30 分鐘… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R077／77 | AI 請求維持每使用者 8 秒冷卻與單一 in-flight、每 guild 2 個及全域 6 … | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R078／78 | AI 一般回答固定限制 1,200 output tokens，Discord 最多發布 3 則… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R079／79 | AI 圖片每次最多 2 張，下載與處理後 payload 各自總計不超過 8 MB；只接受 Di… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R080／80 | gemini-3.8-flash 一般聊天使用 low thinking（不支援 minimal… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R081／81 | AI 回應只記錄模型、延遲、重試、token／thinking／cache 數、Search q… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R082／82 | 會呼叫 initDatabase() 的測試要使用 temp DB helper，不要寫入真實 … | [modules/settings-database.md](modules/settings-database.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R083／83 | 改互動 UI 時，先找現有 builder/helper，特別是 Components V2 p… | [modules/ui.md](modules/ui.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R084／84 | Components V2 單則訊息最多 40 個元件；擴充 settings panel 或 … | [modules/ui.md](modules/ui.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R085／85 | 核心互動訊息優先使用原生 Components V2；每個主要畫面最多使用一個由 ansiRow… | [modules/ui.md](modules/ui.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R086／86 | 成果型圖片卡必須在圖片前提供可掃讀的文字摘要，並為 Media Gallery 圖片設定具體 d… | [modules/ui.md](modules/ui.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R087／87 | AI 草稿功能只使用私人設定面板 session 狀態；不得直接公開發文或直接修改設定，公告仍必… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R088／88 | 公告發布必須在第一個 await 前從 pendingAnnouncements 原子 clai… | [modules/ui.md](modules/ui.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R089／89 | 改對外 API、爬蟲或第三方資料來源時，測試要 mock fixture，避免測試依賴即時網路。 | [development.md](development.md#修改前後)：修改前後 | 合併／移轉 |
| R090／90 | VALORANT 的 OP.GG action discovery 必須選取玩家路由的 page… | [modules/games.md](modules/games.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R091／91 | Steam 限時免費看板以 steam_free_boards 保存每個 guild 的目前貼文… | [modules/steam.md](modules/steam.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R092／92 | tmp/ 是本機預覽產物目錄；需要納入版本控制的測試素材請放到 fixture 或 assets… | [file-inventory.md](file-inventory.md#檔案用途)：檔案用途 | 合併／移轉 |
| R093／93 | 文件或字串內容可使用繁體中文；程式碼命名與註解保持簡潔，避免不必要的大重構。 | [development.md](development.md#修改前後)：修改前後 | 合併／移轉 |
| R094／94 | AI 預覽與附件限制：由於 Discord API 限制對已發送的 Ephemeral 訊息在 … | [modules/ui.md](modules/ui.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R095／95 | AI 公告草稿標題限制：為防止 AI 產生的公告標題在圖片中過長被截斷，System Promp… | [modules/ai.md](modules/ai.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R096／96 | 公告圖片渲染排版：公告卷軸圖片需使用 smartWrap 函數進行中英文混合折行排版（中文/全角… | [modules/ui.md](modules/ui.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R097／97 | SVG 表情符號渲染優化：為防止 sharp / librsvg 因繼承粗體樣式而使黑白 Emo… | [modules/ui.md](modules/ui.md#不可破壞的規則)：不可破壞的規則 | 保留；修正「中中」重字 |
| R098／98 | 群暉 Docker 容器字型加載：本專案部署於 Synology Container Manag… | [modules/runtime.md](modules/runtime.md#不可破壞的規則)：不可破壞的規則 | 保留；修正 Dockerfile 錯字並依既有建置規則加入 --no-install-recommends；加註字型載入需驗證 |
| R099／99 | 快取與資源管理：模組級快取 Map 必須實施容量上限限制（如 100）與 FIFO 淘汰以防止記… | [modules/runtime.md](modules/runtime.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R100／100 | 資源與生命週期管理：所有定時排程應提供對應的 stop 函數以支援 Graceful Shutd… | [modules/runtime.md](modules/runtime.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R101／101 | 語音 XP 必須依實際在線毫秒累積，每滿 10 分鐘才結算一次，離線後保留未滿一個區塊的餘額；語… | [modules/community.md](modules/community.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R102／102 | 大檔案下載防禦：對於外部資源下載，優先使用 fetchWithLimit(url, fetchI… | [modules/ui.md](modules/ui.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R103／103 | 戰績圖片只下載允許清單內的 HTTPS 資產，拒絕 redirect，圖片與 metadata … | [modules/games.md](modules/games.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R104／104 | 提醒系統優化：reminders 表支援錯誤重試 (最大 5 次，重試間隔為 attempts … | [modules/community.md](modules/community.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R105／105 | 抽獎結果可靠性：抽出得主後先持久化 winner_ids 與 drawn_pending_not… | [modules/community.md](modules/community.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R106／106 | 抽獎反應使用者必須以每頁 100 人完整分頁並依 ID 去重後才抽出得主，不得只使用 react… | [modules/community.md](modules/community.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R107／107 | 鳴潮喚取授權：完整 URL、recordId、serverId、cardPoolId 只能存在單… | [modules/games.md](modules/games.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R108／108 | 鳴潮 URL 教學在私人首頁直接顯示 WuWa Tracker 官方固定 commit 的 Po… | [modules/games.md](modules/games.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R109／109 | /幫助 會將 esports 與 gacha 模組合併顯示為「遊戲查詢」分類，分類內分別提供 /… | [modules/community.md](modules/community.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R110／110 | Docker image 使用 Node.js 24 多階段建置，runtime 不保留編譯工具… | [modules/runtime.md](modules/runtime.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R111／111 | 音樂設定讀取 NAS 專用 MUSIC_API_BASE_URL、可選 MUSIC_FFMPEG… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R112／112 | YouTube 點播入口位於公開播放器／私人登入卡／私人曲庫，不需 NAS 登入；只接受固定 H… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R113／113 | CUE 分軌由月下樂藏後端建立虛擬曲目與獨立 UUID，bot 只保留 isCueTrack b… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R114／114 | NAS 曲名／專輯在月下樂藏網站與 Discord 同時亂碼時，先修正曲庫後端的 metadat… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R115／115 | 音樂面板使用原生文字／Section 縮圖、三首公開預覽、十首私人分頁，僅標示 YouTube … | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R116／116 | 音樂四畫面沿用王國金色容器；公開播放器資訊順序為品牌／語音頻道、歌曲／Section 縮圖、單一… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R117／117 | YouTube／NAS 私人點播成功提示顯示歌名與排隊位置，5 秒後刪除；點播失敗提示 30 秒… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R119／119 | 手動「停止並離開」在播放資源清理完成後刪除該 session 的公開播放器貼文；Presente… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R121／121 | 音樂每 guild 一個播放器、全域最多 2 個、佇列最多 100 首；空佇列／無真人均持續待命… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R122／122 | 播放器允許連續缺少 50 個 20ms 封包（約 1 秒），短暫供料恢復後繼續同一首。SDK I… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R126／126 | FFmpeg stdin 的 EPIPE／ERR_STREAM_PREMATURE_CLOSE … | [modules/music.md](modules/music.md#驗證方式)：驗證方式 | 保留 |
| R128／128 | Docker youtube-tool 由 scripts/install-ytdlp.mjs … | [modules/runtime.md](modules/runtime.md#驗證方式)：驗證方式 | 保留 |
| R130／130 | Discord Components V2 引用的封面可能不出現在 Message.attach… | [modules/music.md](modules/music.md#驗證方式)：驗證方式 | 保留 |
| R132／132 | 一般程式碼改動：跑 npm run check。 | [development.md](development.md#修改前後)：修改前後 | 合併／移轉 |
| R133／133 | 指令新增、移除、改名或 alias 變更：至少跑 npm run verify:commands… | [development.md](development.md#測試矩陣)：測試矩陣 | 部署另見 operations；非驗證或自動操作 |
| R134／134 | 資料庫 schema 或設定面板改動：跑 settings/database 相關測試，例如 t… | [modules/settings-database.md](modules/settings-database.md#驗證方式)：驗證方式 | 保留 |
| R135／135 | 圖片或卡片排版改動：跑相關 image tests，例如 tests/imageRenderin… | [modules/ui.md](modules/ui.md#驗證方式)：驗證方式 | 保留 |
| R136／136 | ANSI 或 Components V2 共用 helper 改動：跑 tests/compon… | [modules/ui.md](modules/ui.md#驗證方式)：驗證方式 | 保留 |
| R137／137 | 等級與排行榜卡片改動：跑 tests/levelingUi.test.js。 | [modules/community.md](modules/community.md#驗證方式)：驗證方式 | 保留 |
| R138／138 | NAS 音樂 API、登入、播放生命週期或 UI 改動：跑 tests/musicAccess.… | [modules/music.md](modules/music.md#驗證方式)：驗證方式 | 保留 |
| R139／139 | YouTube provider／音樂來源分流改動另跑 tests/musicYoutube.t… | [modules/music.md](modules/music.md#驗證方式)：驗證方式 | 保留 |
| R140／140 | 播放供料 regression 使用真正 @discordjs/voice 與合成 Opus，僅… | [modules/music.md](modules/music.md#驗證方式)：驗證方式 | 保留 |
| R141／141 | SDK 的 AudioPlayerError 不保留原始 stream error 的 code… | [modules/music.md](modules/music.md#驗證方式)：驗證方式 | 保留 |
| R142／142 | npm run verify:music 需要支援 libopus 的 FFmpeg，以合成 W… | [modules/music.md](modules/music.md#驗證方式)：驗證方式 | 保留 |
| R143／143 | M4A／MP4 使用私有暫存檔支援 seek（512MB、下載 60 秒上限），固定 MOV d… | [modules/music.md](modules/music.md#不可破壞的規則)：不可破壞的規則 | 保留 |
| R144／144 | 鳴潮綁定、匯入、合併、統計或圖片改動：跑 tests/wuwaGacha.test.js，並確認… | [modules/games.md](modules/games.md#驗證方式)：驗證方式 | 保留 |
| R145／145 | 文件-only 變更通常不需要跑完整測試；確認 diff 與內容可讀即可。 | [development.md](development.md#修改前後)：修改前後 | 合併／移轉 |
| R151／151 | 若新增、移除或改名功能、指令、資料表、環境變數、測試指令或部署流程，必須同步更新本文件。 | [../AGENTS.md](../AGENTS.md#文件維護)：文件維護 | 合併／移轉 |
| R152／152 | 若工作中發現反覆踩坑、重要慣例或能幫下一次新對話更快上手的資訊，可以補一條短規則。 | [../AGENTS.md](../AGENTS.md#文件維護)：文件維護 | 合併／移轉 |
| R153／153 | 更新時保持精簡，只記穩定且有用的專案知識。 | [../AGENTS.md](../AGENTS.md#文件維護)：文件維護 | 合併／移轉 |
| R154／154 | 不寫暫時性 debug 紀錄、個人猜測、密鑰、.env 實值或會快速過期的狀態。 | [../AGENTS.md](../AGENTS.md#文件維護)：文件維護 | 合併／移轉 |
| R155／155 | 若內容與實際程式碼衝突，以程式碼為準，並修正本文件。 | [../AGENTS.md](../AGENTS.md#文件維護)：文件維護 | 合併／移轉 |

## 非 bullet 段落

| 舊行／內容 | 目的地 |
|---|---|
| 1／文件標題 | [根 AGENTS](../AGENTS.md) |
| 23／專案技術與功能概述 | [README](../README.md) 與 [架構](architecture.md) |
| 25／新對話閱讀順序 | [根 AGENTS](../AGENTS.md)，與 R005 合併 |
| 36／「必要環境變數」分類 | [維運](operations.md)，改按實際必要性分級 |
| 45／不提交憑證與 ENV 實值 | [根 AGENTS](../AGENTS.md) 與 [維運](operations.md)；全域安全底線以根文件為準 |
| 149／AI 維護說明 | [根 AGENTS](../AGENTS.md)，與 R006–R008、R151–R155 合併 |

## 後續維護

本表是整理時的歷史稽核索引，不新增新的行號規則。新的穩定規則直接更新其模組文件及根路由；公開指令與測試清單、文件連結、模組歸屬由 `npm run verify:docs` 驗證。若規則目的地再搬移，同步更新本表連結，不複製整份舊 AGENTS。
