# 架構與執行路徑

閱讀入口是根 [AGENTS.md](../AGENTS.md)。功能規則以 [模組文件](file-inventory.md) 為準；本文件只描述目前執行路徑，不新增架構層。

## 啟動與清理

[bot.js](../src/bot.js) 載入 `.env`、建立 Discord client 與 interaction listener，依序初始化 SQLite、載入 commands、註冊 events、登入 Discord、啟動 scheduled jobs 與 health server。不要在驗證工具中 import 此入口，它會啟動 bot。

[commandHandler.js](../src/handlers/commandHandler.js) 只掃描 command 分類目錄直接下一層的 `.js`；[eventHandler.js](../src/handlers/eventHandler.js) 遞迴掃描 events 並呼叫 `register(client)`。載入失敗彙整為 AggregateError，不能以跳過錯誤掩蓋缺少功能。

SIGINT／SIGTERM 經 `cleanupBot()` 依序停止 events、排程、HTTP、AI action tools、SQLite，最後 destroy Discord client。事件 `stop()` 由 loader 反序呼叫；音樂停止、帳號、提示與 presenter 清理由 [音樂事件](../src/events/music.js) 接入。功能生命週期限制見 [runtime](modules/runtime.md) 與 [music](modules/music.md)。

## 指令與互動

- Command export `data`／`execute`，`aliases` 補正式入口；`helpOnly` 仍可由幫助頁直接呼叫，但不註冊成 slash command。
- [manifest builder](../scripts/command-manifest.js) 供 [import 驗證](../scripts/verify-import.js) 與 [指令部署](../scripts/deploy-commands.js) 共用；部署才會向 Discord 寫入。
- 一般 slash command 由 bot listener 呼叫 `execute()`；投票、身分組、公告等部分互動仍由 bot listener 處理。
- [幫助頁](../src/commands/general/help.js) 同時透過檔案分類及直接 import 組織功能入口；新增功能須檢查正式 manifest 與 UI 入口，兩者不能混為一談。
- [設定面板](../src/commands/admin/settings.js) 包含管理 session、設定草稿與跨功能控制。音樂按鈕／modal／voice state 另由 [music event](../src/events/music.js) 送往 [music command](../src/commands/music/music.js)。

## 功能資料流

| 功能 | 實際路徑 | 持久／暫存位置 | 規則 |
| --- | --- | --- | --- |
| AI 聊天 | messageCreate → aiGuildContext／aiMentions → aiChat → Discord reply | AI settings 在 SQLite；request slots、cooldown 在記憶體 | [AI](modules/ai.md) |
| AI 操作 | messageCreate → aiActionTools → 提醒／投票／公告 composer → 確認 | 私人 action／preview session 在記憶體；已建立提醒／投票在 SQLite | [AI](modules/ai.md)、[UI](modules/ui.md) |
| NAS／YouTube | command／event → access／accounts → provider → playback → panel | NAS credentials、nonce、player、queue 在記憶體；白名單在 SQLite；音訊暫存在 OS tmp | [音樂](modules/music.md) |
| Steam | command 或 scheduled job → steamDeals／steamFreeBoard → Discord | guild schedule、看板 message ID／snapshot 在 SQLite | [Steam](modules/steam.md) |
| 戰績／鳴潮 | command → provider／history／statistics → image／reply | 戰績快取在記憶體；鳴潮 UID／版本化歷史在 SQLite | [遊戲](modules/games.md) |
| 社群 | commands／events → XP／reminder／giveaway／role 等處理 → Discord | SQLite 為主，臨時快取與排程在記憶體 | [社群](modules/community.md) |

## 共享依賴與資料庫

[database.js](../src/utils/database.js) 同時負責 schema、舊資料庫遷移與多功能查詢，目前沒有獨立 repository 層。部分互動直接經 `getDb()` 使用 SQL；不可假設所有寫入都有專用 helper。資料庫位置由模組相對路徑決定，搬動檔案可能改變預設 data 位置，因此本次不搬程式。

settings／database、UI helpers、logger、下載限制與生命週期是共享依賴。各檔的單一主要歸屬與其他使用模組記於 [module-map.json](module-map.json)；`sharedWith` 表示需查核其他模組文件，不表示修改一定安全，也不是完整執行圖。AI 與 XP 共用 messageCreate，音樂與 AI 共用設定表，幫助與設定會直接開啟其他功能，均須跨模組驗證。

## 後續重構順序

依序為設定面板、AI 訊息流程、音樂模組集中。每一項先另立行為保持的重構企劃，以現有 interface、權限、customId、資料位置及測試為依據；本次文件整理不先建立空的抽象層。
