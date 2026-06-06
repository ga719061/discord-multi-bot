# 功能性優化執行清單

本文件整理現有功能的正確性、可靠性與使用者體驗改善項目。每個項目可獨立指定執行，例如：「執行 `FUNC-01`」。

## 使用方式

- 狀態：`待執行`、`進行中`、`已完成`、`暫緩`
- 執行前先確認相關未提交變更，避免覆蓋既有工作。
- 完成後執行該項目的針對性測試，再執行 `npm run check`。
- 涉及資料庫 schema 時，必須同時處理新資料庫預設 schema 與既有資料庫遷移。

## 建議順序

1. `FUNC-01` 提醒失敗重試
2. `FUNC-02` 抽獎結果可靠通知
3. `FUNC-03` Interaction 錯誤回覆
4. `FUNC-04` 文字互動非同步錯誤處理
5. `FUNC-05` AI 啟用狀態一致化
6. `FUNC-06` 自助身分組相依性驗證
7. `FUNC-07` 提醒依 guild 隔離

---

## FUNC-01 提醒失敗重試

- **狀態：** 已完成
- **優先級：** 高
- **問題：** 提醒傳送遇到暫時性錯誤後會標記為 `error`，後續排程不再重試。
- **影響：** Discord 限流、短暫網路錯誤可能造成提醒永久遺失。
- **主要檔案：**
  - `src/utils/reminderManager.js`
  - `src/utils/database.js`
  - `tests/reminderOptimization.test.js`
- **實作方向：**
  - 新增 `attempts`、`next_retry_at`、`last_error` 欄位與遷移。
  - 暫時性傳送錯誤使用退避重試。
  - guild 或 channel 永久不存在時直接標記永久失敗。
  - 超過重試上限後停止重試並保留錯誤原因。
- **驗收標準：**
  - 前兩次傳送失敗、第三次成功時，提醒只成功發送一次並標記 `completed`。
  - 永久錯誤不會無限重試。
  - Bot 重啟後仍能繼續尚未完成的重試。
- **建議測試：**
  - 擴充 `tests/reminderOptimization.test.js`
  - 執行 `npm run check`

## FUNC-02 抽獎結果可靠通知

- **狀態：** 已完成
- **優先級：** 高
- **問題：** 抽獎在結果通知成功前便結案；通知失敗後無法可靠補發，得主也未持久化。
- **影響：** 已抽出得主但頻道沒有公開結果，排程也不會恢復。
- **主要檔案：**
  - `src/utils/giveawayManager.js`
  - `src/utils/database.js`
  - `tests/giveawayOptimization.test.js`
- **實作方向：**
  - 將抽獎與通知拆成 `drawing`、`drawn_pending_notify`、`completed` 等狀態。
  - 使用 transaction 持久化得主與通知狀態。
  - 通知失敗時重試相同結果，不重新抽獎。
- **驗收標準：**
  - 結果通知第一次失敗、第二次成功時使用相同得主。
  - 不會產生重複結果訊息。
  - Bot 重啟後可繼續補發結果。
- **建議測試：**
  - 擴充 `tests/giveawayOptimization.test.js`
  - 執行 `npm run check`

## FUNC-03 Interaction 錯誤回覆

- **狀態：** 已完成
- **優先級：** 高
- **問題：** 按鈕、選單與 modal 發生例外時，多數流程只寫入 log，使用者會看到互動失敗或無回應。
- **主要檔案：**
  - `src/bot.js`
  - `src/utils/componentsV2.js`
- **實作方向：**
  - 建立共用 interaction error responder。
  - 依 `interaction.replied`、`interaction.deferred` 選擇 `reply`、`editReply` 或 `followUp`。
  - 所有外層 interaction catch 統一使用安全的 ephemeral 錯誤訊息。
- **驗收標準：**
  - 按鈕、選單、modal 在 defer 前後拋錯時，使用者都能收到私人錯誤提示。
  - 錯誤回覆失敗不會形成第二個未處理例外。
- **建議測試：**
  - 新增 interaction error responder 測試。
  - 執行 `npm run check`

## FUNC-04 文字互動非同步錯誤處理

- **狀態：** 已完成
- **優先級：** 高
- **問題：** 一般文字互動的部分 `message.reply()` 沒有等待或捕捉失敗。
- **影響：** 權限或 Discord API 錯誤可能形成未處理 Promise rejection。
- **主要檔案：**
  - `src/events/messageCreate.js`
- **實作方向：**
  - 將文字互動 handler 改為完整 async 流程。
  - 所有 Discord 寫入操作使用 `await` 並統一記錄錯誤。
- **驗收標準：**
  - 模擬 `message.reply()` reject 時不會觸發 `unhandledRejection`。
  - 正常互動行為與回覆內容維持不變。
- **建議測試：**
  - 擴充 message interaction 測試。
  - 執行 `npm run check`

## FUNC-05 AI 啟用狀態一致化

- **狀態：** 已完成
- **優先級：** 中高
- **問題：** AI 的 `enabled`、`expires_at` 與派對狀態未完整套用到實際訊息入口。
- **主要檔案：**
  - `src/events/messageCreate.js`
  - `src/utils/database.js`
  - `src/utils/partyManager.js`
- **實作方向：**
  - 明確定義全域 AI、白名單與派對模式的優先規則。
  - 建立單一 `isAiEnabled()` 判斷入口。
  - 移除或修正無實際效果的狀態欄位。
- **驗收標準：**
  - 已停用、已過期、白名單與有效派對案例均符合定義。
  - 停用狀態不會意外呼叫 Gemini。
- **建議測試：**
  - 擴充 `tests/aiChat.test.js`
  - 執行 `npm run check`

## FUNC-06 自助身分組相依性驗證

- **狀態：** 已完成
- **優先級：** 中
- **問題：** 使用者可能移除資格身分組，卻保留依賴該資格的身分組。
- **主要檔案：**
  - `src/bot.js`
  - `src/utils/roleSettings.js`
- **實作方向：**
  - 依操作完成後的預期角色集合驗證 requirement。
  - 移除 prerequisite 時，選擇拒絕操作或同步移除依賴角色。
- **驗收標準：**
  - 角色 B 需要角色 A 時，使用者無法只保留 B。
  - 錯誤提示清楚說明缺少的資格。
- **建議測試：**
  - 擴充 self-role settings 測試。
  - 執行 `npm run check`

## FUNC-07 提醒依 Guild 隔離

- **狀態：** 已完成
- **優先級：** 中
- **問題：** 使用者可在目前 guild 看見或刪除其他 guild 建立的提醒。
- **主要檔案：**
  - `src/utils/database.js`
  - `src/commands/general/remind.js`
- **實作方向：**
  - `getUserReminders()` 與 `deleteReminder()` 加入 `guild_id` 條件。
  - 若保留跨 guild 管理，必須清楚標示來源並加入確認。
- **驗收標準：**
  - 同一使用者在兩個 guild 建立提醒時，各管理頁只顯示對應資料。
  - 無法從另一個 guild 刪除提醒。
- **建議測試：**
  - 新增跨 guild 隔離測試。
  - 執行 `npm run check`
