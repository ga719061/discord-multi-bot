# 🐕👑 吉吉王國 (Gigi Kingdom Bot)

![Kingdom Banner](https://img.shields.io/badge/Status-Royal_Monitoring-gold?style=for-the-badge&logo=discord)
![Node Version](https://img.shields.io/badge/Node-24%2B-blue?style=for-the-badge&logo=node.js)
![Database](https://img.shields.io/badge/Database-SQLite-lightgrey?style=for-the-badge&logo=sqlite)

「汪！歡迎來到吉吉王國。本王可以陪聊、記錄、提醒、查遊戲情報，也能替管理員巡視領地。」

吉吉王國是一隻以 **Discord.js v14** 打造的社群管理與娛樂 bot，結合 AI 對話、等級系統、日誌、Steam 情報、遊戲戰績、提醒與互動式管理面板。

---

## 🧠 AI 行為

- `src/knowledge/persona.js` 僅保留吉吉國王 persona 與回答風格。
- AI 會按提問提供目前使用者、明確提及成員、伺服器與所在頻道的公開摘要，例如回答「我是誰」。
- AI 不會取得完整成員名冊、不可見頻道、管理設定、權限診斷、稽核紀錄或憑證；未提供的資料不得猜測。
- Discord mention 安全規則仍會在每次回答時強制套用。

---

## 🌟 核心功能

### AI 聊天
- AI 核心啟用時，白名單成員或派對模式頻道中標記吉吉國王即可 AI 對話。
- 支援上下文記憶、Google Search grounding、圖片提問與多模型切換。
- 只有提問者具備讀取歷史訊息權限時才會提供上下文；歷史僅保留提問者與吉吉國王的回覆鏈，並排除 system、webhook 與第三方 bot 訊息。
- 一般回答最多產生 1,200 個 output tokens，Discord 最多發布 3 則訊息；過長內容會明確標示截斷。
- 圖片提問最多 2 張、每次總計 8 MB，只下載 Discord HTTPS CDN 附件；圖片會先完整解碼驗證並縮至最長邊 2,048 px。
- Google Search grounding 一次提問可能執行多次計費查詢；參考來源預設隱藏，管理員可獨立開啟，開啟後回答最多附 3 個可驗證來源。
- AI 僅能標記提問訊息中已明確標記且被允許的對象；永遠阻擋 `@everyone` 與 `@here`。
- AI 操作工具預設停用；管理員開啟後，只接受緊接在 `@吉吉國王` 後、以 `提醒:`／`提醒：`、`投票:`／`投票：` 或 `公告:`／`公告：` 開頭的明確操作。
- 操作工具只開放 AI 白名單成員，派對模式不會授予工具權限；公告還要求發話者具備 Administrator 並已完成 AI 管理解鎖，發布前仍會先建立私人草稿預覽並要求確認。

### 公開互動
- `/幫助` 或 `/help`：開啟互動式指令大典。
- `/摸摸`、`/抱抱`、`/占卜`、`/每日一汪`、`/餵食`、`/汪汪`：日常互動。
- 關鍵字「摸摸國王」、「抱抱國王」、「占卜」、「每日一汪」也能觸發部分互動。

### 等級與提醒
- 有效發言每 60 秒獲得 15-25 XP，Server Booster 享 1.5 倍加成。
- 防洗版會排除過短、純表情/貼圖、重複內容。
- `/等級` 查看個人功勳，`/排行榜` 查看前十名。
- `/提醒` 開啟彈窗建立提醒，並可透過私人面板管理待發送項目。

### Steam 與戰績
- `/特價查詢` 私下查詢台灣 Steam 價格、折扣、評價與遊戲詳情，查詢者可單次發布到原頻道。
- Steam 限時免費情報會顯示台灣時間截止日期；出現新遊戲時建立新版並刪除舊帖，否則更新現有情報。
- `/戰績` 查詢 VALORANT 或 League of Legends 公開戰績，結果會標示資料來源與連結。
- `/鳴潮抽卡` 可綁定一個鳴潮 UID，透過喚取紀錄 URL 或 JSON 更新歷史，並生成指定卡池的抽卡分析圖片；私人首頁直接提供取得 URL 的 PowerShell 指令與腳本檢視連結。

### 管理控制台
- `/設定` 僅限 Administrator 使用。
- 可管理歡迎訊息、日誌、等級公告、自助身分組、按鈕身分組、Steam 推播、AI、公告、狀態與成員查詢。
- AI 頁需輸入 `AI_ADMIN_PASSWORD` 解鎖後，才能啟用或停用 AI 核心與預設關閉的操作工具，並調整模型、白名單、個性、聯網、參考來源、記憶與派對模式。

### NAS／YouTube 音樂播放器
- 加入一般語音頻道後，在 `/幫助` 首頁點「音樂播放器」，或選「音樂」分類點「開啟音樂播放器」；也可使用 `/音樂`。以私人曲庫搜尋歌名、歌手或專輯，選曲後加入公開播放器的待播佇列。幫助按鈕直接開啟功能，不依賴 `/音樂` 已完成 slash command 同步，但仍需要更新 bot 並設定曲庫。
- 播放面板提供暫停／繼續、下一首、單曲／佇列循環、隨機排序、佇列分頁與停止離開；聽眾以 Discord 個人音量設定調整音量，播放控制只允許同一語音頻道的成員操作。Docker 使用的 FFmpeg 必須支援 `libopus` 編碼。
- 登入卡、私人曲庫與公開播放器皆提供「YouTube 點播」。貼上一般影片、Shorts 或 YouTube Music 單曲連結即可加入同一佇列，不需要 NAS 登入；可與 NAS 歌曲混排，面板與佇列標示來源。每支最多 2 小時，含播放清單參數時只點播該支影片，從頭播放；不支援整份清單、直播或文字搜尋。一般聊天貼連結不會自動點播。
- YouTube 解析或播放失敗會顯示提示並保留其他待播曲目；播放失敗後請手動按「下一首」，不會循環重播失敗歌曲。停止或關機會取消未完成的解析及下載，不保留永久音訊快取。
- 音樂介面採王國金色樣式，公開播放器依序顯示品牌與語音頻道、大標題歌名／歌手／專輯或 YouTube 頻道及封面、單一彩色摘要、接下來三首與操作。摘要以中性色標籤搭配彩色內容：播放／待命金色、暫停黃色、連線／載入青色、失敗紅色，進度與時間青色，循環開啟紫色／關閉中性色。12 格文字進度約每 15 秒更新，不能拖曳跳轉，未知時長顯示已播時間與「未知時長」。容器強調色與摘要文字色分開控制；暫停容器仍為柔金色，停止用灰色容器與一般結束文字、不顯示摘要。
- 公開操作分三列：暫停／繼續與下一首；點歌、YouTube 點播與查看佇列；循環、隨機排序與停止並離開。按「點歌」開啟私人曲庫，選曲後私人回報目前待播位置。私人曲庫每首分兩行呈現歌名與歌手／專輯／時長／CUE 分軌，搜尋及分頁與帳號／YouTube 入口分列；完整佇列顯示來源、歌手與時長，兩者每頁十首，以青色頁碼、金色結果數／待播數顯示短摘要。登入卡以綠色／黃色摘要表示登入及 NAS／YouTube 可用狀態，將 NAS 帳號操作與 YouTube 點播分列；搜尋排序、單首點播與權限維持既有行為。
- 樣式使用原生 Components V2 容器強調色、Markdown、縮圖與按鈕 emoji，每畫面最多一個由既有 `ansiRows()` 產生的受控 ANSI 摘要（寬度 40），不新增字型、圖片渲染或套件。ANSI 色盤僅用於摘要；歌名等外來資料仍清理控制碼，不能任意指定字色。可用 [Message.style](https://message.style/features/components-v2) 搭配合成資料預覽排版；不保證各客戶端的顏色、底色與字寬完全相同，實際桌面／手機及深淺主題仍需在 Discord 驗收。預覽器不得輸入 Token、NAS 帳密或正式 webhook。
- NAS 封面以點歌者帳號讀取固定 API；YouTube 縮圖只由影片 ID 讀取固定 `i.ytimg.com` 網址，再上傳至公開面板，頻道成員可看見。僅換歌時下載，最多 2MB／5 秒，PNG、JPEG、WebP 經驗證後縮至最長邊 512px；進度更新保留原附件 ID，並沿用 Discord 回傳的 CDN 圖片網址，不重傳封面。缺少或讀取／上傳失敗時使用文字面板，不影響音樂；跳歌、停止及 shutdown 取消舊封面，NAS 登出僅取消自己的 NAS 封面，不影響 YouTube。
- 封面失敗時，日誌只記錄 `[Music] cover unavailable stage=download或upload code=安全代碼`。`upload`／`DISCORD_MISSING_PERMISSIONS` 表示需檢查 bot 在播放器文字頻道的「附加檔案」權限；`download`／`MUSIC_SIZE` 表示封面超過 2MB。Components V2 引用的附件 ID 由縮圖回應取得，不依賴傳統附檔清單。
- NAS 音樂來源為「月下樂藏」已索引的館藏 API；搜尋每次最多 100 首，搜尋關鍵字可找到其餘館藏。bot 不直接掛載音樂檔、不修改館藏、不建立公開分享。未設定或無效的 `MUSIC_API_BASE_URL` 只停用 NAS 功能，YouTube 仍可使用。
- 每個 guild 共用一個播放器，全域最多 2 個；待播佇列最多 100 首。佇列播放完畢、無人點播或語音頻道沒有真人時，都持續連線待命，不自動離開；使用面板「停止並離開」或手動中斷 bot 語音連線結束。待命播放器也占用全域名額，需手動離開才釋放；連線故障或 bot 關機仍會清理資源，重啟不保留待播佇列。
- 音訊供料短暫停頓時保留播放，連續約 1 秒沒有封包才中斷並保留其餘待播歌曲，可按「下一首」接續。日誌 `[Music] playback failed stage=prepare或audio code=安全代碼 playedSeconds=已播秒數` 中，`MUSIC_STREAM_STALLED` 表示尚未到檔尾就缺少音訊資料，`MUSIC_FFMPEG` 表示轉碼程序異常終止；這些訊息不包含曲目、NAS 路徑、URL 或原始錯誤。
- 音樂操作面板沒有固定時間期限；播放器與登入仍有效時，私人曲庫的搜尋、分頁與點播可持續使用。停止或重建播放器後，該播放器的舊曲庫與控制按鈕會失效；登出或帳號更換後，舊帳號操作會失效。登入卡重新開啟會替換舊卡，各類私人面板全域最多保留 100 份，超過時淘汰最舊項目。`[Music] operation failed code=MUSIC_EXPIRED` 表示使用了已失效的操作或舊播放器按鈕；可從目前播放器重新點「點歌」，播放器已結束時從 `/幫助` 重新開啟。該訊息本身不會停止播放，也不是音訊中斷的診斷結果。

使用 NAS 時，在 bot 的 `.env`（Windows launcher 使用 `BOT.env`）設定曲庫服務位址；只使用 YouTube 可省略。帳密與伺服器 ID 不需要 ENV：

```dotenv
MUSIC_API_BASE_URL=http://127.0.0.1:8480
```

`127.0.0.1:8480` 僅適用於 bot 與月下樂藏部署在同一台 NAS、music 維持預設 port，且 bot 使用現有 Compose 的 host network。本機 Windows 測試應改為 NAS 在區域網路的服務位址；跨主機傳送帳密請使用 HTTPS。服務位址仍由管理員設定，不接受成員輸入任意 URL。

從 `/幫助` 點「音樂播放器」或使用 `/音樂`，在私人登入卡點「登入音樂庫」，輸入月下樂藏已核准帳號。每人在每個 Discord 伺服器各自登入，只使用自己的帳號搜尋及點播；建議使用 `listener` 帳號。Discord 原生輸入框不支援密碼遮罩，輸入時避免共享畫面；bot 不回填帳密、不公開顯示或寫入日誌／資料庫。登入資料只保存在記憶體，重啟或 30 分鐘未使用後失效（正在播放或待播仍視為使用中）；全域最多保存 100 個登入、同時處理 6 個登入，同一人登入嘗試間隔 8 秒。

曲庫底部「帳號／登出」可登出。登出會清除該登入的帳密與 cookie、撤銷舊曲庫面板，移除自己尚未播放的 NAS 歌曲；若正在播放自己的 NAS 歌，也會停止該首並接續其餘歌曲。自己點播的 YouTube 歌曲不受 NAS 登出影響。歌名與選定歌曲的音訊仍會在共用播放器及語音頻道公開，其他同頻道成員可以控制播放。舊 `MUSIC_API_EMAIL`、`MUSIC_API_PASSWORD`、`MUSIC_ALLOWED_GUILD_IDS` 設定已不再讀取，可自行移除。

Docker runtime 已安裝 FFmpeg；手動啟動時需自行安裝，或用 `MUSIC_FFMPEG_PATH` 指定執行檔。`npm run verify:music` 使用合成音訊驗證轉碼與 Opus 編碼，不登入音樂庫或 Discord。新增 `/音樂` 後需要自行執行 `npm run deploy` 同步指令，再依既有方式更新 bot。

YouTube 使用官方 yt-dlp standalone，Docker 固定 `2026.08.19` Linux x86_64 版本並驗證 SHA256 `58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a`，內含 EJS 並沿用 Node.js 24 解題，不新增 Python／Deno runtime、npm 編碼器或自動更新程序。本機需安裝官方 standalone，可用 `MUSIC_YTDLP_PATH` 指定執行檔，預設從 PATH 尋找；缺失時只停用 YouTube 入口。此版本不使用 cookies、YouTube 帳號或 PO Token 服務，遇到影片驗證或 HTTP 403 時可能無法播放；不能保證所有公開影片可播，需另外在 NAS 驗收實際播放及兩個播放器的負載。[官方安裝說明](https://github.com/yt-dlp/yt-dlp)、[EJS 文件](https://github.com/yt-dlp/yt-dlp/wiki/EJS)、[PO Token 限制](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)

Docker 的 `youtube-tool` 建置階段會下載約 40MB 的官方工具。`scripts/install-ytdlp.mjs` 每 5 秒輸出連線／下載進度，連線期限 30 秒、每次完整下載期限 15 分鐘，30 秒未收到下載資料即逾時，網路或暫時性 HTTP 錯誤最多嘗試 3 次；下載串流上限 64MiB，成功核對 SHA256 後才安裝。`CONNECT_TIMEOUT`／`ENOTFOUND` 表示需檢查 NAS 到 GitHub release assets 的連線／DNS，`DOWNLOAD_STALLED` 表示下載連續 30 秒沒有資料，`DOWNLOAD_TIMEOUT` 表示下載未於總期限內完成；不會跳過驗證或改走第三方鏡像。已在執行中的舊建置不會套用檔案更新，需取消該次建置後重新建置。

一般音訊直接串流播放；M4A／MP4 為支援檔尾索引，先下載至私有暫存檔再播放，最多 512MB、下載逾時 60 秒，停止或換曲後等待程序結束並刪除。容器暫存空間需容納最多兩份音訊（約 1GB）。`npm run verify:music` 驗證合成 WAV、MP3、CUE 單首 FLAC、檔尾索引 M4A，以及 mock YouTube WebM／M4A 的共用轉碼與取消清理；其他特殊格式仍取決於 FFmpeg 支援。

月下樂藏也支援 CUE 虛擬分軌：保留整張原音檔，在音樂庫放入正確指向它的 CUE，更新月下樂藏並重新掃描後，每首會有獨立 ID、歌名與時長，Discord 可分別搜尋與點播。bot 只讀取 API 已裁切的單首 FLAC，首次分軌快取準備允許等待最多 60 秒；一般 API／音訊連線仍為 8 秒。`npm run verify:music` 另驗證合成 CUE 單首 FLAC 的 Opus pipeline。

---

## 🤖 Gemini 模型備註

目前預設模型是 `gemini-3.8-flash`，適合一般聊天、圖片理解、功能問答與較複雜的提問。

管理面板僅提供兩個固定 Stable/GA 模型：品質優先的 `gemini-3.8-flash`，以及低成本、高吞吐的 `gemini-3.5-flash-lite`。實際可用性與狀態以 [Gemini API models](https://ai.google.dev/gemini-api/docs/models) 為準。

---

## 🚀 快速部署

### Docker

1. 複製 `.env.example` 為 `.env`。
2. 填入 `DISCORD_TOKEN`、`GOOGLE_AI_KEY`、`AI_ADMIN_PASSWORD`。
3. 啟動：

```bash
docker-compose up -d --build
```

首次建置會下載 FFmpeg、中文字型及必要系統依賴，日誌中的 `Get:226` 是套件下載序號，不是秒數或百分比。只要下載／解包日誌持續更新就仍在建置；完成後再確認容器狀態及 `/readyz`。Dockerfile 使用 `--no-install-recommends` 減少額外推薦套件，必要依賴仍會安裝；保留建置快取可避免後續只改程式碼時重新下載。

Compose 會以 root 啟動 entrypoint，保留既有 `bot-data` volume，修正 `/app/data` 與 `/app/logs` 的擁有者及 owner 寫入權限後，先以 UID 1000 驗證 `bot.db` 可寫，再立即降權成 `node` 使用者執行 bot。若 volume 或 Synology ACL 仍阻擋寫入，entrypoint 會輸出明確錯誤並停止，避免 SQLite 反覆以模糊的 readonly 錯誤重啟。

### 手動啟動

```bash
npm install
npm start
```

### 指令同步

```bash
npm run deploy
```

正式部署請勿設定 `GUILD_ID`，讓指令同步作用於全域；開發預覽時才設定 `GUILD_ID`。

---

## 🛠️ 開發

- 語言：JavaScript (Node.js 24+)
- 框架：discord.js v14
- 資料庫：Better-SQLite3
- 檢查：`npm run check`

資料庫位於 `data/bot.db`，正式環境請定期備份。

[Github Repository](https://github.com/ga719061/discord-multi-bot)
