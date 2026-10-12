# 🐕👑 吉吉王國 (Gigi Kingdom Bot)

吉吉國王是 Discord 社群 bot，使用 Node.js 24+、Discord.js v14 與 SQLite/better-sqlite3，部署於 Synology DS920+ Container Manager。

功能包含 Gemini AI 對話、管理中心、等級與排行榜、提醒、投票與抽獎、身分組與日誌、Steam 情報、VALORANT／LoL 戰績、鳴潮抽卡分析，以及 NAS／YouTube 共用語音播放器。

AI 使用 persona 與提問相關的公開伺服器摘要；不提供完整名冊、不可見頻道、管理設定或憑證。一般成員與管理員的操作方式見[導入手冊](ChihuahuaKing_Manual.md)。

## 啟動

需 Node.js 24+；先參照[維運文件](docs/operations.md)設定環境與功能依賴，再執行：

```sh
npm install
npm start
```

一般啟動讀取 `.env`；Windows launcher 讀取 `BOT.env` 並固定使用 PORT 3001。Docker 的建置、volume、健康檢查與指令發布流程均見維運文件。`npm run deploy` 會修改 Discord 指令，不能當作一般驗證執行。

```sh
npm run check
```

完整檢查包含測試、command manifest 與文件一致性。個別驗證及 fixture／temp DB 規則見[開發文件](docs/development.md)。

## 文件入口

| 文件 | 用途 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | AI 必讀安全規則、閱讀順序與任務路由 |
| [導入手冊](ChihuahuaKing_Manual.md) | 成員與管理員的功能操作、正式指令表 |
| [架構](docs/architecture.md) | 啟動、事件、互動、資料與 shutdown 路徑 |
| [開發與驗證](docs/development.md) | 修改流程、測試矩陣與文件維護 |
| [維運](docs/operations.md) | Synology／Docker／Windows、設定、備份與排障 |
| [檔案用途清單](docs/file-inventory.md) | 原始碼、素材、fixture、執行資料與預覽產物 |
| [模組歸屬](docs/module-map.json) | source／test 的可驗證歸屬與共用依賴 |
| [規則搬移對照](docs/rule-migration.md) | 原 AGENTS 規則的唯一維護位置 |
| [導航驗收](docs/navigation-check.md) | 四種維護任務的查找與驗證演練 |

| 模組 | 維護範圍 |
| --- | --- |
| [AI](docs/modules/ai.md) | 對話、歷史、圖片與操作工具 |
| [音樂](docs/modules/music.md) | NAS／YouTube、登入授權、播放與面板 |
| [設定與資料庫](docs/modules/settings-database.md) | 管理中心、設定 allowlist 與 schema 遷移 |
| [Steam](docs/modules/steam.md) | 私人查詢、推播與限時免費看板 |
| [遊戲查詢](docs/modules/games.md) | VALORANT／LoL、鳴潮抽卡與幫助入口 |
| [社群功能](docs/modules/community.md) | 等級、提醒、活動、身分組與事件 |
| [共用 UI／圖片](docs/modules/ui.md) | Components V2、ANSI、公告與圖片渲染 |
| [啟動與維運](docs/modules/runtime.md) | loader、排程、健康檢查、Docker 與資源清理 |

[GitHub Repository](https://github.com/ga719061/discord-multi-bot)
