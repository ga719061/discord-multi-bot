# 維運：設定、發布、備份與排障

本文件供維運者使用。程式限制與修改驗證的唯一規則位置是[啟動與維運模組](modules/runtime.md)、[音樂模組](modules/music.md)、[AI 模組](modules/ai.md)及[設定與資料庫模組](modules/settings-database.md)；成員操作見[導入手冊](../ChihuahuaKing_Manual.md)。

## 環境設定

bot 一般啟動由 dotenv 讀取專案根目錄的 `.env`。Docker Compose 用同一檔案注入環境。可由 [.env.example](../.env.example) 建立設定，但不得提交或在診斷輸出中印出實值。

| 類別 | 變數 | 用途 |
| --- | --- | --- |
| 啟動必要 | `DISCORD_TOKEN` | Discord bot token；需在 Developer Portal 啟用程式使用的 privileged intents |
| 功能必要：AI | `GOOGLE_AI_KEY` | Gemini 呼叫；未設定不授予或限制 NAS 資格 |
| 功能必要：管理中心 | `AI_ADMIN_PASSWORD` | `/設定` 的 AI／私人音樂解鎖；仍須 Discord Administrator |
| 功能必要：NAS | `MUSIC_API_BASE_URL` | 月下樂藏固定服務 origin；NAS 未設定或無效時仍可用 YouTube |
| 發布建議 | `CLIENT_ID` | Discord application ID；指令同步未提供時嘗試登入取得 |
| 選配 | `GUILD_ID` | 指令同步的開發 guild；未設定走全域及殘留 guild 清理流程 |
| 選配 | `PORT` | HTTP health port，預設 3000；Windows launcher 強制改成 3001 |
| 選配 | `MUSIC_FFMPEG_PATH` | FFmpeg 執行檔；預設從 PATH 找 `ffmpeg` |
| 選配 | `MUSIC_YTDLP_PATH` | 官方 yt-dlp standalone 執行檔；預設從 PATH 找 `yt-dlp` |

`NODE_OPTIONS=--dns-result-order=ipv4first` 由現有 Compose 設定。bot 也明確設定 IPv4 DNS 優先。NAS 帳密由各成員的私人登入介面輸入，不設 ENV 帳密；舊 `MUSIC_API_EMAIL`、`MUSIC_API_PASSWORD`、`MUSIC_ALLOWED_GUILD_IDS` 已不讀取。

### Windows 與手動啟動

需 Node.js 24+。先執行 `npm install`，一般手動啟動用 `npm start`，開發用 `npm run dev`。

[start-bot-windows.bat](../start-bot-windows.bat) 呼叫 [PowerShell launcher](../start-bot-windows.ps1)，從根目錄的 `BOT.env` 匯入程序環境，再直接啟動 bot；即使 `BOT.env` 有其他 PORT，launcher 仍強制使用 3001。launcher 目前不去除值的引號，請使用 `NAME=value`，不要套 shell 引號。bot 之後載入 `.env` 時不覆蓋已存在的程序環境；避免兩份設定互相矛盾。

`npm run deploy` 與一般 npm scripts 不會自動載入 `BOT.env`，它們讀取 `.env` 或既有程序環境。不要因為 launcher 能登入，就認為另一個 shell 已具備相同設定。

### NAS 音樂來源

只用 YouTube 可省略曲庫服務。使用 NAS 時由管理員設定：

```dotenv
MUSIC_API_BASE_URL=http://127.0.0.1:8480
```

此範例僅適用 bot 與月下樂藏部署在同一台 NAS、music 維持預設 port，且 bot 沿用 Compose 的 host network。本機 Windows 應填 NAS 區域網路服務位址；跨主機傳送帳密使用 HTTPS。只接受服務 origin，不含帳密、path、query 或 fragment，不接受成員輸入任意來源 URL。

月下樂藏使用已核准帳號各自登入，建議使用 listener 帳號。bot 不掛載原音樂檔、不修改館藏、不建立公開分享。NAS 白名單與 AI 白名單獨立；管理員在 `/設定` →「AI／私人音樂」→「NAS 私人音樂」管理使用資格，資格不代替本人 NAS 登入。

## Synology／Docker

現有 [Compose](../docker-compose.yml) 與 [Dockerfile](../Dockerfile) 使用 Node.js 24 多階段建置、host network 及 `bot-data:/app/data` named volume。先設定 `.env`，依現有發布作業明確執行：

```sh
docker compose up -d --build
```

舊版環境可使用既有的 `docker-compose` 命令。首次建置會下載 FFmpeg、CJK／Emoji 字型及必要系統依賴；`Get:226` 是下載序號，不是時間或百分比。日誌持續下載／解包表示仍在建置，完成後才確認容器健康。保留 build cache，程式更新通常不必重新下載系統套件。

entrypoint 以 root 修正 `/app/data` 與 `/app/logs` 擁有者及 owner 寫入權限，以 UID 1000 確認可寫，再用 gosu 降權成 node 執行。權限失敗應檢查 Synology ACL、read-only mount 與 volume 設定，不能刪除或重建既有 volume。現在 Compose 只掛載 data；logs 留在容器檔案層，重建前若需留存應另行備份，沒有持久化保證。

[.dockerignore](../.dockerignore) 排除整個 data、logs、tmp 及憑證，排除 build context 不會刪除檔案，也不會改 volume。不得將正式執行資料包進 image。

HTTP `/livez`（及相容 `/`）只確認伺服器存活；`/readyz` 同時檢查 Discord ready 與 SQLite 可查詢，Docker healthcheck 使用後者。預設查看 3000 port，Windows launcher 為 3001。healthy 不代表第三方網站、曲庫或 YouTube 都可用。

中文字型或 Emoji 出現方框時先確認 runtime 保有 CJK／Emoji 字型與 fontconfig。必要時依既有 Synology 維運配置掛載含相容字型的資料夾至容器字型目錄並更新字型快取，不以 bot UI 猜測字型問題；建置限制見[啟動與維運模組](modules/runtime.md)。

## 指令發布與備份

### 指令同步是外部寫入

先完成 `npm run check`，再由維運者在發布時明確執行 `npm run deploy`。有 `GUILD_ID` 時只同步指定開發 guild；正式環境移除它，走全域同步及已加入 guild 的殘留指令清理。同步程序會登入 Discord 並修改正式 slash commands，不是 dry run，不屬於一般測試，也不在每次 bot 啟動時自動執行。

更新指令名稱、alias 或描述後需同步，再依既有方式更新 bot。公開指令表見[手冊](../ChihuahuaKing_Manual.md)；manifest 與 helpOnly 規則見[開發文件](development.md)。

### SQLite 與其他資料

資料庫為 `data/bot.db`（容器內 `/app/data/bot.db`），named volume 必須保留。不能只複製仍在寫入的 `.db`：WAL 中可能仍有已提交資料；分別複製 live `.db`、`-wal`、`-shm` 也不能保證一致時間點。

維運預設備份流程是先正常停止 bot、確認程序已結束，再備份完整 data 目錄與必要設定，之後啟動原 volume。若必須不停機，使用 SQLite backup API／一致 snapshot 工具並另驗證還原，不用一般檔案複製替代。帳密設定應獨立安全保存，不放在公開壓縮包或版本控制。

還原前停止 bot、保留目前資料的可回復備份；先在隔離環境以備份副本驗證可開啟、資料完整及必要 schema，再安排還原。這些是維運流程說明，本次文件檢查不讀或備份正式 DB、日誌、憑證。

## 音樂排障與驗收

Docker runtime 內建支援 libopus 的 FFmpeg 與固定版本的官方 yt-dlp standalone；本機需安裝工具或用上述 path 變數指定。YouTube 缺工具只停用該入口；此版本不使用 cookies、帳號或 PO Token，遇到驗證、地區限制或 HTTP 403 可能無法播放。固定版本／checksum 與不得更換鏡像的限制見[音樂模組](modules/music.md)。

YouTube 工具建置每 5 秒顯示連線／下載進度。`CONNECT_TIMEOUT`／`ENOTFOUND` 檢查 NAS 到 GitHub release assets 的連線與 DNS；`DOWNLOAD_STALLED` 表示連續沒有下載資料，`DOWNLOAD_TIMEOUT` 表示未於總期限完成。不得跳過 checksum 或改用未核准鏡像；已執行的舊建置不會套用腳本更新，需取消後重新建置。

| 安全日誌或代碼 | 判讀與下一步 |
| --- | --- |
| `playback failed`，stage=prepare/audio，`MUSIC_STREAM_STALLED` | 尚未到檔尾但供料持續中斷；檢查連線與負載，手動下一首或重點播 |
| `MUSIC_FFMPEG` | 轉碼程序異常終止；檢查 FFmpeg 可用性與容器資源 |
| `operation failed`，`MUSIC_EXPIRED` | 舊 nonce／session 的面板操作失效；由 `/音樂` 或 `/幫助` 重開，不據此推定音訊故障 |
| `cover unavailable`，stage=upload，`DISCORD_MISSING_PERMISSIONS` | 檢查文字頻道「附加檔案」權限；文字播放器仍可使用 |
| `cover unavailable`，stage=download，`MUSIC_SIZE` | 封面超過大小限制；保留文字播放器，不影響音訊 |
| `MUSIC_PANEL_DELETE` | 播放器已停止，但公開貼文無法刪除；人工清除貼文 |

封面會公開到面板頻道；換歌時下載，刷新重用 Discord 附件。安全日誌只保留 stage、固定 code 及適用的 playedSeconds；不要為了排障加入帳密、曲目、NAS 路徑、原始 URL、stderr 或上游錯誤內容。

月下樂藏網站與 Discord 同時出現曲名／專輯亂碼時，先修後端 metadata 索引。既有部署的 `backend/app/metadata.py` 提供保守、可逆、冪等的標籤修復；更新 music 容器並重掃後，Discord 仍要重新搜尋與點播。該後端不在本 repo，處理前須確認實際部署版本，不能在 bot 猜測編碼或改音檔、CUE、ID。

CUE 由月下樂藏重掃建立虛擬分軌與獨立 ID，bot 只播放 API 已裁切單首 FLAC；改 CUE 不能只更新 bot。分軌首次快取可能等待較久。M4A／MP4 使用私有暫存支援檔尾索引，停止與換歌須完成程序／暫存清理；容器暫存空間按兩個播放器預留約 1GB。

使用 `npm run verify:music` 以合成 WAV、MP3、FLAC／CUE、M4A 及 mock YouTube WebM／M4A 驗證轉碼與取消，不登入實際館藏或 Discord。單元測試的範圍見[開發文件](development.md)。NAS 實際播放、網路／YouTube 可用性、兩播放器負載，以及 Discord 桌面／手機與深淺主題仍須發布環境人工驗收；Message.style 只能使用合成資料，不能輸入 token、帳密或正式 webhook。

待命播放器也占全域名額；若容量滿，請讓原頻道成員按「停止並離開」，不要透過刪除資料庫處理。關機及重啟清空記憶體登入與佇列，操作行為詳見導入手冊。
