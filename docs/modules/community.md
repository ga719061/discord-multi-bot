# 社群、幫助、等級、提醒、抽獎與身分組

本文件是本模組的維護規則唯一來源。開始修改前先讀 [根 AGENTS](../../AGENTS.md) 與相關交叉連結；實際程式／測試與規則矛盾時先查明並同步修正文檔。

## 入口與資料流

- [help](../../src/commands/general/help.js) 以分類與直接 execute 提供功能入口；[fun commands](../../src/commands/fun/) 提供互動、投票與抽獎，[leveling](../../src/commands/leveling/) 查 XP／排行榜，[remind](../../src/commands/general/remind.js) 建立／管理私人提醒。
- [messageCreate](../../src/events/messageCreate.js) 結算文字 XP 並觸發日常互動，[voiceXpManager](../../src/utils/voiceXpManager.js) 累積語音在線時間；[reminderManager](../../src/utils/reminderManager.js)／[giveawayManager](../../src/utils/giveawayManager.js) 定期處理資料。
- [reactionRoleHandler](../../src/events/reactionRoleHandler.js)、[guildMemberAdd](../../src/events/guildMemberAdd.js)、[guildMemberUpdate](../../src/events/guildMemberUpdate.js) 與 [logging events](../../src/events/logging/) 處理身分組、歡迎與紀錄；按鈕身分組／投票 component 另由 [bot](../../src/bot.js) 分派。

## 不可破壞的規則

- 語音 XP 必須依實際在線毫秒累積，每滿 10 分鐘才結算一次，離線後保留未滿一個區塊的餘額；語音獎勵不得更新文字訊息 XP 的 `last_xp_time` cooldown。
- 提醒系統優化：`reminders` 表支援錯誤重試 (最大 5 次，重試間隔為 attempts 分鐘，使用 `attempts`、`next_retry_at` 與 `last_error` 欄位) 與跨伺服器隔離 (查詢/刪除時帶入 `guildId`)，特定永久性錯誤 (找不到 guild/channel) 應直接改為對應失敗狀態。
- 抽獎結果可靠性：抽出得主後先持久化 `winner_ids` 與 `drawn_pending_notify`；公開結果成功發送後才能標記 `completed`，通知失敗重試時不得重新抽獎。
- 抽獎反應使用者必須以每頁 100 人完整分頁並依 ID 去重後才抽出得主，不得只使用 `reaction.users.fetch()` 的第一頁。
- `/幫助` 會將 `esports` 與 `gacha` 模組合併顯示為「遊戲查詢」分類，分類內分別提供 `/戰績` 與 `/鳴潮抽卡` 的直接入口；不可在首頁拆成兩個獨立分類。首頁「音樂播放器」與「音樂」分類／詳情按鈕直接呼叫音樂 execute，不依賴 `/音樂` 註冊；必須維持私人回應、使用者 scope 與原有音樂權限檢查，首頁四個快捷入口不得互相擠掉。

## 修改影響

- 功能資料在 [database](../../src/utils/database.js)，修改 schema／設定時讀 [設定與資料庫](settings-database.md)，排程生命週期見 [啟動與維運](runtime.md)。
- AI 工具呼叫提醒／投票／公告時須遵循 [AI](ai.md) 授權；help 音樂入口須讀 [音樂](music.md)，不可把直接 execute 當成免權限入口。
- 等級與娛樂圖片／Components V2 builder 見 [共用 UI／圖片](ui.md)；command manifest／alias 慣例見 [開發流程](../development.md)。

## 驗證方式

- 執行 `node --test tests/helpComponentsV2.test.js tests/interactiveCommands.test.js tests/levelingUi.test.js tests/xpVoice.test.js tests/reminderOptimization.test.js tests/giveawayOptimization.test.js tests/pollOptimization.test.js tests/reactionRoleHandler.test.js`。
- [help](../../tests/helpComponentsV2.test.js)、[互動](../../tests/interactiveCommands.test.js)、[等級 UI](../../tests/levelingUi.test.js)、[語音 XP](../../tests/xpVoice.test.js)、[提醒](../../tests/reminderOptimization.test.js)、[抽獎](../../tests/giveawayOptimization.test.js)、[投票](../../tests/pollOptimization.test.js)、[身分組](../../tests/reactionRoleHandler.test.js) 驗證各流程。
- 覆蓋語音餘額與文字 cooldown 隔離、guild 隔離、永久失敗／五次重試、通知重試不重抽及反應完整分頁；使用 temp DB 與 mock Discord。

- 等級與排行榜卡片改動：跑 `tests/levelingUi.test.js`。
