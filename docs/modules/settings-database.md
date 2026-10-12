# 管理設定與 SQLite

本文件是本模組的維護規則唯一來源。開始修改前先讀 [根 AGENTS](../../AGENTS.md) 與相關交叉連結；實際程式／測試與規則矛盾時先查明並同步修正文檔。

## 入口與資料流

- [settings](../../src/commands/admin/settings.js) 建立私人管理 session、頁面、modal 與設定操作；[guildDiagnostics](../../src/utils/guildDiagnostics.js) 提供診斷，[roleSettings](../../src/utils/roleSettings.js) 驗證可指派角色。
- [database](../../src/utils/database.js) 負責 SQLite schema、簡易遷移、guild／AI settings、levels、reminders、giveaways、polls、reaction roles 與 wuwa accounts；JSON 解析由 [jsonUtils](../../src/utils/jsonUtils.js) 共用。
- 測試以 [temp DB helper](../../tests/helpers/database.js) 建立隔離資料庫；正式資料位置與備份見 [維運](../operations.md)。

## 不可破壞的規則

- 改資料庫欄位時，在 `initDatabase()` 補 `CREATE TABLE` 預設欄位，也補既有 DB 的 `ALTER TABLE` 遷移。
- 依賴新欄位的 SQLite 索引必須在既有資料庫完成 `ALTER TABLE` 遷移後建立，並以舊 schema temp DB 測試驗證。
- 改 guild 或 AI setting key 時，同步更新 allowlist，例如 `ALLOWED_GUILD_KEYS` 或 `ALLOWED_AI_KEYS`。
- `/設定` 的「AI／私人音樂」管理中心沿用 `AI_ADMIN_PASSWORD` 與 guild `admin_ids`，管理操作須同時具備 Administrator 與已解鎖資格。五頁為總覽、AI 核心、AI 使用權限、AI 草稿、NAS 私人音樂；切換頁面保留 session 草稿與既有 AI action ID，每頁最多一個 ANSI 摘要且完整 payload 不超過 40 元件。管理面板到期不可停止音樂。
- 會呼叫 `initDatabase()` 的測試要使用 temp DB helper，不要寫入真實 `data/bot.db`。

## 修改影響

- AI 開關、模型、白名單／派對模式與草稿合約見 [AI](ai.md)，NAS 資格、JSON 欄位預設／遷移／allowlist 與撤權見 [音樂](music.md)。兩份使用白名單不可互相授權。
- guild setting 影響歡迎／日誌／身分組／等級與 [Steam 看板](steam.md)，請依設定 key 追查其讀取者。
- 面板元件上限／ANSI／公告 preview 合約見 [共用 UI／圖片](ui.md)；新增欄位時一起查讀取、更新 allowlist、default 與舊 schema 遷移。

## 驗證方式

- 執行 `node --test tests/settingsPanel.test.js tests/guildDiagnostics.test.js tests/steamFreeBoardDatabase.test.js`；NAS 管理整合另跑 `tests/musicAccess.test.js` 與 `tests/musicCommand.test.js`。
- [settingsPanel](../../tests/settingsPanel.test.js) 驗管理 session／頁面，[guildDiagnostics](../../tests/guildDiagnostics.test.js) 驗設定資料，[Steam 舊資料庫](../../tests/steamFreeBoardDatabase.test.js) 驗遷移。新增任何持久化 key 需合成新 DB 與舊 schema 測試。

- 資料庫 schema 或設定面板改動：跑 settings/database 相關測試，例如 `tests/settingsPanel.test.js`、`tests/guildDiagnostics.test.js`。
