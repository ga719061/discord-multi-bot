# 啟動、載入器、資源生命週期與 Docker

本文件是本模組的維護規則唯一來源。開始修改前先讀 [根 AGENTS](../../AGENTS.md) 與相關交叉連結；實際程式／測試與規則矛盾時先查明並同步修正文檔。

## 入口與資料流

- [bot](../../src/bot.js) 建立 client／interaction handler、初始化 DB、載入 command／event、登入 Discord，啟動排程與 health server。
- [commandHandler](../../src/handlers/commandHandler.js) 掃分類目錄，[eventHandler](../../src/handlers/eventHandler.js) 遞迴註冊並於 shutdown 呼叫 event stop；[scheduledJobs](../../src/utils/scheduledJobs.js) 統一啟停五類排程。
- [healthServer](../../src/utils/healthServer.js) 提供 live／ready 探針，[logger](../../src/utils/logger.js) 管理日誌；SIGTERM／SIGINT 的 graceful shutdown 在 bot。
- [Dockerfile](../../Dockerfile)、[Compose](../../docker-compose.yml) 與 [entrypoint](../../docker-entrypoint.sh) 管建置、volume 權限及降權；[install-ytdlp](../../scripts/install-ytdlp.mjs) 裝固定工具。執行指令、ENV、備份與發布操作以 [維運](../operations.md) 為準。

## 不可破壞的規則

- 群暉 Docker 容器字型加載：本專案部署於 Synology Container Manager 環境。當圖片渲染模組（如公告卷軸、戰績卡）因為容器缺少系統字型而出現中文字型缺失或表情符號顯示為帶十六進位編碼的「豆腐塊」方框時，應在Dockerfile中以 `RUN apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk fonts-noto-color-emoji` 補齊 Linux 字型，或在群暉 Container Manager 介面中，將包含 `Noto Sans CJK` 和 `Segoe UI Emoji` 的本地字型資料夾掛載映射至容器內的 `/usr/share/fonts/truetype/` 目錄中，即可在不重建鏡像的情況下即時加載。
- 快取與資源管理：模組級快取 Map 必須實施容量上限限制（如 100）與 FIFO 淘汰以防止記憶體無界膨脹；每日產生的日誌檔案須實施保留天數清理（如 30 天）。
- 資源與生命週期管理：所有定時排程應提供對應的 `stop` 函數以支援 Graceful Shutdown，並在 `src/utils/scheduledJobs.js` 中統一經由 `stopScheduledJobs()` 關閉；健康檢查伺服器可由 `stopHealthServer()` 關閉。`/livez`（以及相容用 `/`）只檢查 HTTP 存活，`/readyz` 必須同時確認 Discord ready 與 SQLite 可查詢；Docker healthcheck 使用 `/readyz`。
- Docker image 使用 Node.js 24 多階段建置，runtime 不保留編譯工具；apt 安裝使用 `--no-install-recommends`，保留 FFmpeg、CJK／Emoji 字型、fontconfig 與 gosu 及其必要依賴。首次建置的 `Get:N` 是套件下載序號，不能當作時間或百分比。Compose 必須以 `user: "0:0"` 啟動 entrypoint，對掛載的 `/app/data` 與 `/app/logs` 執行 `chown node:node`、`chmod u+rwX` 並以 UID 1000 驗證可寫後，隨即透過 `gosu` 降權成 `node` 執行 bot。不得刪除或重建既有 volume 來處理 SQLite 權限問題。
- 字型掛載後仍須確認 fontconfig／程序載入結果；若未辨識，重新整理字型快取並依維運流程重啟驗證。既有 Dockerfile 已包含 CJK／Emoji 套件，不能把本段當成需要重複安裝的指令。

## 修改影響

- 新增排程須有 stop 並納入 scheduledJobs；新增 event 資源須由 event stop 清理。音樂異步程序樹／暫存／nonce 生命週期見 [音樂](music.md)，AI deadline／typing／slot 見 [AI](ai.md)。
- health ready 依賴 Discord 與 DB，資料庫 schema 見 [設定與資料庫](settings-database.md)；Docker 排除資料與預覽目錄不得改動既有掛載。
- 字型、FFmpeg、gosu 與固定 yt-dlp 是 runtime 契約；發生 SQLite 權限問題先查 entrypoint 與 volume 擁有權。

## 驗證方式

- 執行 `node --test tests/startupLoaders.test.js tests/scheduledJobs.test.js tests/healthServer.test.js tests/dockerRuntime.test.js tests/ytdlpBuild.test.js tests/cacheOptimization.test.js`。
- [載入器](../../tests/startupLoaders.test.js)、[排程](../../tests/scheduledJobs.test.js)、[health](../../tests/healthServer.test.js)、[Docker](../../tests/dockerRuntime.test.js)、[工具下載](../../tests/ytdlpBuild.test.js)、[快取](../../tests/cacheOptimization.test.js) 均使用合成／mock 資料。
- 安裝器測試不需下載正式工具，Docker 靜態測試不代表完成 Synology 容器建置；實際建置與部署屬另行授權發布操作。

- Docker `youtube-tool` 由 `scripts/install-ytdlp.mjs` 下載固定官方 standalone；每 5 秒顯示連線／下載進度，header 連線期限 30 秒、單次總期限 900 秒、下載連續 30 秒沒有資料即逾時、網路／HTTP 暫時失敗最多 3 次，串流上限 64MiB，SHA256 通過後原子安裝；逾時／失敗刪除部分下載，不能跳過 checksum 或使用未核准鏡像。改此流程跑 `tests/ytdlpBuild.test.js` 與 `tests/dockerRuntime.test.js`，以合成 HTTP 回應覆蓋停住、重試、hash／大小限制與清理，測試不依賴即時網路。
