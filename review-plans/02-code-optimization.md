# 代碼優化執行清單

本文件整理可靠性、維護性、效能與測試流程改善項目。每個項目可獨立指定執行，例如：「執行 `CODE-01`」。

## 使用方式

- 狀態：`待執行`、`進行中`、`已完成`、`暫緩`
- 修改應保持集中，避免順便重構無關模組。
- 優化前後都要保留既有外部行為，並以 regression test 驗證。
- 涉及目前未提交變更的項目，實作前必須重新閱讀最新 diff。

## 建議順序

1. `CODE-01` 修正發布補償邊界
2. `CODE-02` 公告發布原子 claim
3. `CODE-03` 納入所有 regression tests
4. `CODE-04` 公告附件大小限制
5. `CODE-05` 排程與服務生命週期
6. `CODE-06` SQLite 高頻查詢索引
7. `CODE-07` 清理 diff 格式問題

---

## CODE-01 修正投票與抽獎發布補償邊界

- **狀態：** 已完成
- **優先級：** 高
- **問題：** 公開訊息與 DB 寫入成功後，私人成功回覆若失敗，catch 仍可能刪除已提交的公開訊息。
- **主要檔案：**
  - `src/commands/fun/poll.js`
  - `src/commands/fun/giveaway.js`
  - `tests/pollOptimization.test.js`
  - `tests/giveawayOptimization.test.js`
- **最小改善：**
  - 只在 DB 寫入失敗時刪除已發布訊息。
  - 將私人成功通知移出需要補償的 transaction 區段。
- **驗收標準：**
  - DB 寫入失敗時會刪除公開訊息。
  - DB 寫入成功但 `editReply()` 失敗時，公開訊息與 DB 紀錄都保留。
- **建議測試：**
  - 擴充 poll/giveaway optimization tests。
  - 執行 `npm run check`

## CODE-02 公告發布原子 Claim

- **狀態：** 已完成
- **優先級：** 高
- **問題：** 公告發布經過多個 async 操作後才刪除 draft，重複點擊可能發布兩次。
- **主要檔案：**
  - `src/bot.js`
  - `src/utils/announcementTools.js`
- **最小改善：**
  - 在第一個 `await` 前原子取得發布權。
  - 發布失敗時安全恢復 draft，成功時永久移除。
- **驗收標準：**
  - 並行觸發兩次發布時，`targetChannel.send()` 只執行一次。
  - 發布失敗後仍可重新嘗試。
- **建議測試：**
  - 新增並行發布 regression test。
  - 執行 `npm run check`

## CODE-03 納入所有 Regression Tests

- **狀態：** 已完成
- **優先級：** 高
- **問題：** `npm test` 使用固定清單，未執行新增的 optimization tests。
- **目前未納入：**
  - `tests/cacheOptimization.test.js`
  - `tests/giveawayOptimization.test.js`
  - `tests/pollOptimization.test.js`
  - `tests/reminderOptimization.test.js`
- **主要檔案：**
  - `package.json`
- **最小改善：**
  - 將新測試加入固定清單，或建立可控的測試清單產生方式。
  - 避免意外執行 fixture 或非測試 JavaScript。
- **驗收標準：**
  - 任一 optimization test 失敗時，`npm test` 與 `npm run check` 都會失敗。
  - 測試執行範圍清楚且可預測。
- **建議測試：**
  - 執行 `npm test`
  - 執行 `npm run check`

## CODE-04 公告附件大小限制

- **狀態：** 已完成
- **優先級：** 中高
- **問題：** 公告附件會完整載入記憶體，沒有單檔與總大小限制。
- **主要檔案：**
  - `src/utils/announcementTools.js`
  - `src/utils/aiChat.js`
- **最小改善：**
  - 抽出共用受限下載 helper。
  - 同時檢查 `content-length` 與實際下載 bytes。
  - 限制單檔大小、附件數量與合計大小。
- **驗收標準：**
  - 缺少 `content-length` 但實際超限的附件會被拒絕。
  - 多張附件合計超限時不會全部載入記憶體。
  - 錯誤訊息能讓使用者理解限制。
- **建議測試：**
  - 使用 mocked fetch fixture。
  - 執行 `npm run check`

## CODE-05 排程與服務生命週期

- **狀態：** 已完成
- **優先級：** 中高
- **問題：** Health server 與部分 interval 缺少停止控制與 graceful shutdown。
- **主要檔案：**
  - `src/utils/healthServer.js`
  - `src/utils/scheduledJobs.js`
  - `src/utils/voiceXpManager.js`
  - `src/bot.js`
- **最小改善：**
  - 所有 job initializer 回傳 stop function。
  - Scheduler 集中保存並停止 jobs。
  - 處理 `SIGTERM`、`SIGINT`、server error 與 DB close。
- **驗收標準：**
  - 啟動中途失敗時，已啟動的 jobs 會停止。
  - Shutdown 後沒有殘留 interval 或監聽 port。
  - `EADDRINUSE` 會被記錄並受控處理。
- **建議測試：**
  - 擴充 `tests/scheduledJobs.test.js`
  - 擴充 `tests/healthServer.test.js`
  - 執行 `npm run check`

## CODE-06 SQLite 高頻查詢索引

- **狀態：** 已完成
- **優先級：** 中
- **問題：** 高頻排程與 message lookup 查詢可能隨資料量增加而全表掃描。
- **主要檔案：**
  - `src/utils/database.js`
- **候選索引：**
  - reminders：`(status, target_time)`
  - giveaways：`(ended, status, end_time)`
  - polls：`(message_id)`
  - reaction_roles：`(message_id, role_id)`
- **最小改善：**
  - 先以 `EXPLAIN QUERY PLAN` 確認實際查詢。
  - 僅新增能被現有查詢使用的索引。
- **驗收標準：**
  - 關鍵查詢使用預期索引。
  - 新舊資料庫初始化與遷移均成功。
  - 不改變現有查詢結果。
- **建議測試：**
  - 新增 temp DB query plan 測試。
  - 執行 `npm run check`

## CODE-07 清理 Diff 格式問題

- **狀態：** 已完成
- **優先級：** 低
- **問題：** `git diff --check` 因 trailing whitespace 與檔尾空行失敗。
- **目前涉及檔案：**
  - `src/commands/esports/lib/cache.js`
  - `src/utils/announcementImage.js`
  - `src/utils/database.js`
- **最小改善：**
  - 僅移除已指出的多餘空白，不格式化整份檔案。
- **驗收標準：**
  - `git diff --check` 通過。
  - 功能 diff 沒有混入無關格式變更。
- **建議測試：**
  - 執行 `git diff --check`
