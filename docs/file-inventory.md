# 檔案用途與維護導航

本文件分類檔案用途；完整 JS／MJS 歸屬在 [module-map.json](module-map.json)。主要歸屬為單一 owner；`sharedWith` 提醒跨模組查核，不需要把共用 helper 複製到每個功能。

## 八個模組

| 類別 | canonical 文件 | 檔案群／跨功能注意 |
| --- | --- | --- |
| AI | [ai](modules/ai.md) | ai* utils、persona、messageCreate 的聊天部分；共用 XP 與設定 |
| 音樂 | [music](modules/music.md) | music command/lib、event、music* utils；NAS whitelist 與管理頁在設定模組 |
| 設定與資料庫 | [settings/database](modules/settings-database.md) | settings command、database、guildDiagnostics、測試 DB helper；服務所有持久化功能 |
| Steam | [steam](modules/steam.md) | steam command、steam* utils；排程與設定連動 |
| 遊戲查詢 | [games](modules/games.md) | esports／gacha command、lib、tests、fixture；幫助合併入口 |
| 社群功能 | [community](modules/community.md) | fun／leveling、提醒、guild/logging events、roles、XP 與 giveaway managers |
| 共用 UI／圖片 | [ui](modules/ui.md) | Components V2、style、customIds、圖片下載／渲染、公告；幫助串接各模組 |
| 啟動與維運 | [runtime](modules/runtime.md) | bot、handlers、health、logger、scheduled jobs、部署與驗證 scripts |

## 檔案用途

| 類型 | 位置 | 管理方式 |
| --- | --- | --- |
| 程式與工具 | [src](../src/)、[scripts](../scripts/) | 版控；沿用目前執行位置，禁止整理時順手搬動 |
| 依賴版本 | [package.json](../package.json)、[lockfile](../package-lock.json) | 不因文件整理更新依賴；scripts 變更同步開發文件 |
| 正式素材 | [assets](../assets/) | 版控；圖片模組仍讀既有固定素材路徑 |
| 回歸測試 | [tests](../tests/)、[esports tests](../src/commands/esports/__tests__/) | 全部實際 test 必須登錄；保留兩種現有布局 |
| 測試資料 | [wuwa fixture](../tests/fixtures/wuwa-history.json)、[esports fixtures](../src/commands/esports/__tests__/fixtures/) | 合成或去識別資料；不能放正式憑證 |
| 執行資料 | data（包含 SQLite、WAL／SHM） | git 與 Docker context 排除；不讀、不搬、不刪；一致備份見 [維運](operations.md) |
| 日誌 | logs | git 與 Docker context 排除；安全日誌規則見 runtime／music；不作文件素材 |
| 本機預覽 | tmp | git 與 Docker context 排除；需要保存的測試素材移交 fixture／assets 時另行確認 |
| 憑證 | `.env`、`BOT.env` | 不讀實值、不入版控、不進 image；設定差異見 [維運](operations.md) |
| 設定範本 | [.env.example](../.env.example) | 只含範例與鍵名；必需程度以維運表為準 |
| 部署／launcher | [Dockerfile](../Dockerfile)、[Compose](../docker-compose.yml)、[entrypoint](../docker-entrypoint.sh)、[Windows launcher](../start-bot-windows.ps1) | 保留掛載、帳號與啟動行為 |
| 已追蹤、用途待確認 | [bot_dump.txt](../bot_dump.txt)、[assets/Thumbs.db](../assets/Thumbs.db) | 此次只登錄，不讀內容、不刪、不移動；不要把 dump 當最新程式或將縮圖快取當素材 |
| 本機依賴／工具偏好 | node_modules、[VS Code settings](../.vscode/settings.json) | node_modules 不入版控；本次不改工具偏好 |

## 新增與查找流程

新增檔案先決定八類中的主要 owner，再補使用模組 `sharedWith`、canonical 文件與測試。查找修改點先看入口，再 trace imports／呼叫者及資料流；檔名地圖只提供導航，不能取代閱讀程式。四個查找情境見 [導航驗收](navigation-check.md)。
