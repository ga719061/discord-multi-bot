# AGENTS.md

## 接手與安全

- 使用繁體中文溝通。先讀本文件、[README](README.md)、[package.json](package.json)，檢查 `git status --short`，再依下表讀必要模組、實作與測試。
- 本專案是 Node.js 24+／Discord.js v14／SQLite 的吉吉國王 bot，部署於 Synology Docker；目前保留 commands／events／utils 結構，不因整理文件搬動程式。
- 保留所有未提交修改；不 revert、覆蓋、刪除或格式化無關檔案，不用 reset --hard。採最小相容修改，不做無關重構或依賴更新。
- 不讀取或輸出 `.env`／`BOT.env` 實值、正式 data 或 logs；憑證與真實個資不得出現在文件、fixture、log 或提交。操作規則與備份見 [維運](docs/operations.md)。
- 正式 write、資料刪除、破壞性檔案操作需明確授權；除非使用者明確要求，不 commit、push、PR、deploy 或發布。`npm run deploy` 會修改 Discord 指令，不是一般驗證。
- 遇到 latest／current／版本差異或高風險資訊，查核最新官方／第一手來源；不猜 API、設定或測試結果。
- 先 trace 實際執行路徑與共享依賴，修根因；不以空 catch、靜默 fallback、削弱 assertion、跳測試等方式掩蓋問題。

## 任務路由（必讀）

依任務讀完整 canonical 規則；觸及共享檔案時一併讀 [module-map.json](docs/module-map.json) 的 owner 與 sharedWith 文件。不能只按目錄判斷歸屬。

| 任務 | 必讀文件 | 入口／必要驗證 |
| --- | --- | --- |
| AI 聊天、歷史、圖片、模型、操作工具 | [AI](docs/modules/ai.md) | [messageCreate](src/events/messageCreate.js)、[aiChat](src/utils/aiChat.js)；AI 測試矩陣。messageCreate 另有 XP |
| NAS／YouTube、授權、登入、播放、封面、音樂 UI | [音樂](docs/modules/music.md) | [music command](src/commands/music/music.js)、[music event](src/events/music.js)、[access](src/utils/musicAccess.js) 與其餘 music utils；音樂矩陣，設定連動加 settings |
| 管理面板、資料表、settings／allowlist | [設定與資料庫](docs/modules/settings-database.md) | [settings](src/commands/admin/settings.js)、[database](src/utils/database.js)；settings／database 及受影響功能測試。NAS 資格必讀音樂 |
| Steam 查詢、免費看板、排程 | [Steam](docs/modules/steam.md) | [steamDeals](src/utils/steamDeals.js)、[steamFreeBoard](src/utils/steamFreeBoard.js)；mock fixture 與看板 DB |
| 戰績、鳴潮、遊戲幫助入口 | [遊戲](docs/modules/games.md) | [戰績](src/commands/esports/stats.js)、[鳴潮](src/commands/gacha/wuwa.js)；games 測試與圖卡 |
| XP、提醒、抽獎、投票、身分組、日誌、趣味 | [社群](docs/modules/community.md) | [messageCreate](src/events/messageCreate.js)、相關 commands／events／managers；community 矩陣 |
| Components V2、ANSI、圖片、公告、幫助 | [UI／圖片](docs/modules/ui.md) | [componentsV2](src/utils/componentsV2.js)、[style](src/utils/style.js)、[help](src/commands/general/help.js)；UI 矩陣及呼叫模組 |
| bot 啟動、loader、排程、health、Docker、驗證工具 | [啟動與維運模組](docs/modules/runtime.md)、[維運](docs/operations.md) | [bot](src/bot.js)、[scheduledJobs](src/utils/scheduledJobs.js)、[healthServer](src/utils/healthServer.js)；runtime 矩陣 |

音樂規則同時適用 `src/commands/music`、`src/events/music.js`、`src/utils/music*.js` 與 settings 的 NAS 操作。AI 與 XP、幫助與功能入口、資料庫與各模組亦須跨檔追蹤。

## 開發與驗收

- [架構與資料流](docs/architecture.md)、[開發與子代理流程](docs/development.md)、[檔案用途](docs/file-inventory.md)、[四個導航情境](docs/navigation-check.md)。
- 初步速讀後先建立任務地圖，僅對獨立且有實質價值的工作分派子代理，每檔單一負責者；主代理審查整合並親自驗證，不直接採信代理宣稱。詳細限制見開發文件。
- 一般改動跑 `npm run check`；純文件至少 `npm run verify:docs` 與 diff／語意查核。指令另查 `npm run verify:commands`；需要合成音訊時按音樂文件跑 `npm run verify:music`。
- 測試 DB 使用 [temp DB helper](tests/helpers/database.js)，第三方資料使用 mock fixture；不可寫正式 DB、登入真實服務或讓測試依賴即時網路。
- 修改新功能、指令、table、ENV、測試或部署流程時同步更新對應文件與歸屬；所有來源／測試／工具 JS／MJS 必須列入地圖，所有實際 test 必須列入測試清單。

## 文件維護

- 規則只有一個 canonical 位置，跨模組以連結引用。更新功能細節到模組文件，操作到手冊，部署到維運；不要再將長篇細節加回根文件。
- 根文件 UTF-8 上限 **8 KiB**，由文件檢查強制驗證。[舊規則對照](docs/rule-migration.md) 保留此次移轉位置，不作重複規則庫。
- 新對話與完成實作／review／修 bug 前，做一次是否需更新 instructions 的檢查；若內容與程式衝突，查明原因並修文件。只記穩定規則，不寫暫時 debug、猜測或密鑰。
- 完成前確認原始需求、必要測試／主要流程、無混入無關變更或背景程序，清楚回報證據、限制與剩餘風險；有更新本文件時在 final 簡短指出。
