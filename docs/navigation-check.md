# 任務導航驗收

本次整理的驗收是「能找到入口、規則、影響與測試」，不以搬動程式或連線正式服務驗收。每列都對照現行程式與測試檔；自動檢查負責連結／歸屬，語意仍人工追蹤。

| 任務 | 必讀規則 | 入口／修改影響 | 驗證 |
| --- | --- | --- | --- |
| 修改 NAS 權限 | [music](modules/music.md)、[settings/database](modules/settings-database.md) | [musicAccess](../src/utils/musicAccess.js) 判資格；[settings](../src/commands/admin/settings.js) whitelist→revoke bridge；[music command](../src/commands/music/music.js) 序列化清理→accounts／playback／views；白名單存 database。不能把 whitelist bool 當 Administrator，也不能清掉其他人或 YouTube | [access](../tests/musicAccess.test.js)、[accounts](../tests/musicAccounts.test.js)、[command](../tests/musicCommand.test.js)、[playback](../tests/musicPlayback.test.js)、[settings](../tests/settingsPanel.test.js)；另按 music 完整矩陣 |
| 調整 AI 歷史 | [AI](modules/ai.md)、[community](modules/community.md) | [messageCreate](../src/events/messageCreate.js) 的 canReadAiHistory／buildAiHistory 與實際AI呼叫；[aiChat](../src/utils/aiChat.js) 接收 history。事件也處理 XP，改事件不能漏 community 回歸 | [AI pipeline](../tests/aiPipelineOptimization.test.js)、[AI chat](../tests/aiChat.test.js)、[mentions](../tests/aiMentions.test.js)、[voice XP](../tests/xpVoice.test.js)；檢查無 ReadMessageHistory、完整 reply pair、時間與字元預算 |
| 修改 Steam 看板 | [Steam](modules/steam.md)、[settings/database](modules/settings-database.md) | [steamFreeBoard](../src/utils/steamFreeBoard.js)→[steamDeals](../src/utils/steamDeals.js)；[manager](../src/utils/steamDealManager.js) 排程；database保存snapshot；settings可手動refresh。新增／移除／截止更新與上游異常不能混同 | [看板](../tests/steamFreeBoard.test.js)、[看板DB](../tests/steamFreeBoardDatabase.test.js)、[deals](../tests/steamDeals.test.js)、[settings](../tests/settingsPanel.test.js)；網路fixture含Browse降級及搜尋資料錯誤 |
| 新增指令 | [runtime](modules/runtime.md)、[UI](modules/ui.md)、新功能所屬模組 | [command loader](../src/handlers/commandHandler.js)、[manifest](../scripts/command-manifest.js)、[幫助](../src/commands/general/help.js)、[手冊](../ChihuahuaKing_Manual.md)、[檔案map](module-map.json)。分類直接子層、data／execute／aliases／helpOnly、scope與私人回覆都要對照 | `npm run verify:docs`、`npm run verify:commands`、[manifest](../tests/commandManifest.test.js)、[loaders](../tests/startupLoaders.test.js)、[help](../tests/helpComponentsV2.test.js)，最後 `npm run check`；指令同步只在獲准發布時執行 |

## 演練結果

四個情境的入口、跨模組呼叫與相應測試均由現行程式追蹤確認，沒有新建或修改正式NAS資格、歷史、看板與Discord指令。之後每次改導航，重新以同四題查找；自動檢查成功不能代替實際播放／Discord 客戶端驗收。
