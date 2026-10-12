# Steam 查詢、推播與限時免費看板

本文件是本模組的維護規則唯一來源。開始修改前先讀 [根 AGENTS](../../AGENTS.md) 與相關交叉連結；實際程式／測試與規則矛盾時先查明並同步修正文檔。

## 入口與資料流

- [steam command](../../src/commands/steam/steam.js) 開私人搜尋／詳情，[steamDeals](../../src/utils/steamDeals.js) 讀取搜尋頁與 Store Browse 資料，公開互動由 [bot](../../src/bot.js) 接收。
- [steamDealManager](../../src/utils/steamDealManager.js) 排程每日推播，[steamFreeBoard](../../src/utils/steamFreeBoard.js) 比較 guild snapshot 並發送／編輯／替換看板；[database](../../src/utils/database.js) 保存 `steam_free_boards`。
- [settings](../../src/commands/admin/settings.js) 設頻道、時間、開關並可立即刷新；排程 stop 由 [scheduledJobs](../../src/utils/scheduledJobs.js) 統一管理。

## 不可破壞的規則

- Steam 限時免費看板以 `steam_free_boards` 保存每個 guild 的目前貼文與完整 snapshot；只有新增 app ID 時建立新貼文，成功發布後刪除舊帖，只移除項目或截止時間變動時編輯原貼文。截止時間使用 Steam Store Browse `free_to_keep_ends` 並轉成台灣時間；Browse 暫時失敗、漏項或驗證欄位不完整時保留已通過搜尋頁 100% 折扣檢查的候選、標示永久入庫待複核、將截止時間標為未提供並記錄 warning，不得因此整批停止發布。搜尋頁回報非零結果卻完全無法解析時必須視為資料錯誤並保留原看板。測試必須 mock Steam 回應。

## 修改影響

- 新增 Steam 回應欄位要檢查 parsing、candidate fallback、台灣時間與完整 snapshot；Browse 不完整不等於搜尋頁沒有候選。
- 儲存／遷移見 [設定與資料庫](settings-database.md)，Components V2 公開／私人 payload 見 [共用 UI／圖片](ui.md)，排程與 stop 見 [啟動與維運](runtime.md)。

## 驗證方式

- 執行 `node --test tests/steamDeals.test.js tests/steamSearch.test.js tests/steamFreeBoard.test.js tests/steamFreeBoardDatabase.test.js`。
- [搜尋／詳情](../../tests/steamDeals.test.js)、[搜尋解析](../../tests/steamSearch.test.js)、[看板](../../tests/steamFreeBoard.test.js)、[schema](../../tests/steamFreeBoardDatabase.test.js) 均 mock 回應；覆蓋新增 app、只刪項、截止變動、Browse 暫時失敗／缺欄位、非零結果解析全敗與發送失敗保留原看板。
