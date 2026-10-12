# 遊戲查詢：戰績與鳴潮抽卡

本文件是本模組的維護規則唯一來源。開始修改前先讀 [根 AGENTS](../../AGENTS.md) 與相關交叉連結；實際程式／測試與規則矛盾時先查明並同步修正文檔。

## 入口與資料流

- [stats](../../src/commands/esports/stats.js) 分派 [VALORANT](../../src/commands/esports/lib/providers/valorant.js)／[LoL](../../src/commands/esports/lib/providers/lol.js) 公開戰績，經 [embed](../../src/commands/esports/lib/embed.js) 與 [statsImage](../../src/commands/esports/lib/statsImage.js) 呈現。
- [wuwa](../../src/commands/gacha/wuwa.js) 負責綁定、更新、查詢與解除綁定；[provider](../../src/commands/gacha/lib/provider.js)、[importer](../../src/commands/gacha/lib/importer.js)、[history](../../src/commands/gacha/lib/history.js)、[statistics](../../src/commands/gacha/lib/statistics.js) 依序取得、解析、合併及統計歷史。
- [itemAssets](../../src/commands/gacha/lib/itemAssets.js) 取角色／武器素材，[image](../../src/commands/gacha/lib/image.js) 與 [reply](../../src/commands/gacha/lib/reply.js) 生成 1600×900 卡片與文字摘要；使用 [點陣底圖](../../assets/wuwa/card-background-v3.png)。

## 不可破壞的規則

- VALORANT 的 OP.GG action discovery 必須選取玩家路由的 `page-*.js`，不能取第一個含 `valorant/profile` 的腳本（可能是 `not-found-*.js`）；測試須涵蓋錯誤頁腳本在前、action 位於玩家頁 dependency chunk 的情況。
- 戰績圖片只下載允許清單內的 HTTPS 資產，拒絕 redirect，圖片與 metadata 上限皆為 5MB；不得重新接受上游 HTML 提供的任意 host。VALORANT 地圖縮圖依序使用 `listViewIcon`、`displayIcon`、`splash`，避免為小縮圖下載超過 5MB 的 splash；資產索引需支援本地化名稱回退，圖片或 metadata 暫時失敗不得永久快取 `null`。
- 鳴潮喚取授權：完整 URL、`recordId`、`serverId`、`cardPoolId` 只能存在單次記憶體流程，不得寫入資料庫或 log；`wuwa_accounts` 只保存 Discord user、UID 與版本化歷史。更新紀錄要以有序序列合併，不能用時間作唯一鍵。
- 鳴潮 URL 教學在私人首頁直接顯示 WuWa Tracker 官方固定 commit 的 PowerShell 指令，並附腳本檢視與遠端執行警告；若更新 commit 必須先核對官方 repo。圖片 renderer 必須載入直接生成的點陣底圖 `assets/wuwa/card-background-v3.png`，不得以 SVG 轉檔替代；最近五星頭像依實際筆數動態置中。角色／武器 catalog 快取須有 TTL 並依 fetch implementation 隔離；頭像只允許固定 HTTPS host、拒絕 redirect，類型文字無法辨識時須以資產 ID 在角色與武器目錄間回退。

## 修改影響

- 兩功能在 help 共用「遊戲查詢」分類，入口合約見 [社群功能](community.md)。
- 外部 API／爬蟲測試依 [開發流程](../development.md) mock fixture；下載安全／圖片摘要見 [共用 UI／圖片](ui.md)。
- 鳴潮版本化歷史持久化在 [database](../../src/utils/database.js)，schema 規則見 [設定與資料庫](settings-database.md)；不得把單次授權搬進 DB 或 log。

## 驗證方式

- 執行 `node --test src/commands/esports/__tests__/providers.test.js src/commands/esports/__tests__/embed.test.js tests/wuwaGacha.test.js`。
- [providers](../../src/commands/esports/__tests__/providers.test.js) 使用 [戰績 fixtures](../../src/commands/esports/__tests__/fixtures/valorant-opgg-page.html)，[embed](../../src/commands/esports/__tests__/embed.test.js) 檢查輸出；[鳴潮](../../tests/wuwaGacha.test.js) 使用 [合成歷史](../../tests/fixtures/wuwa-history.json)。
- 驗證錯誤頁 script 在前／dependency chunk action、資產 host／redirect／5MB、同時間多筆合併與授權不持久化；不連真實戰績來源或使用正式喚取授權。

- 鳴潮綁定、匯入、合併、統計或圖片改動：跑 `tests/wuwaGacha.test.js`，並確認不會輸出完整授權欄位。
