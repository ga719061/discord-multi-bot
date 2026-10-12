# 開發與驗證

先讀根 [AGENTS.md](../AGENTS.md)，再依 [檔案歸屬](module-map.json) 讀必要模組。Node.js 版本與指令以 [package.json](../package.json) 為準；發布步驟見 [維運文件](operations.md)。

## 修改前後

1. 先檢查 `git status --short`、適用 instructions、README 與 package，閱讀相關程式、設定及測試。保留未提交修改，不以 HEAD 覆蓋工作樹。
2. 以模組文件找入口、資料流、不可破壞規則及共享依賴。先找既有 builder/helper，特別是 Components V2、settings、announcement preview、Steam detail 與 reaction role。
3. 採最小相容修改；不做無關格式化、依賴更新或重構。文件／字串可用繁體中文，命名與註解保持簡潔。
4. 執行任務測試與完整檢查，區分原有失敗、production／test／環境問題；不削弱 assertion、跳過測試或宣稱未執行結果。
5. 檢查是否需要更新 canonical 模組規則、路由、檔案歸屬與使用手冊，最後回報修改、驗證、限制。不要把暫時 debug 或猜測寫成長期規則。

## 子代理分派

- 初步速讀後先建立任務地圖；只有獨立調查或實作可能實質改變成果時才分派，不為了使用子代理而拆簡單任務。
- 適合獨立程式探索、影響分析、測試失敗調查、文件查核、互不重疊實作與完成後 review。
- 不分派範圍很小、頻繁共享中間狀態、同檔修改，或正式資料、密鑰、部署與不可逆操作。
- 每個檔案／模組有單一負責者；分派說明目標、範圍、背景、限制、預期產出與驗證方式，要求不得改範圍外或覆蓋既有修改。有依賴時依序執行。
- 要求回報檔案／位置、根因、風險、執行命令及結果。主代理審查、整合並親自驗證；結果衝突時以實際程式與測試為準。

## 指令與資料變更

新增／修改 command 要同步 `data.name`、`execute`、alias、幫助入口與操作手冊。只有 `/help` 可為英文正式指令，停用的 `volume`、`stop`、`shuffle` 不可重回 manifest；詳見 [runtime](modules/runtime.md)。

資料庫 schema／allowlist 的遷移規則只在 [settings/database](modules/settings-database.md) 維護。共享檔案的 `sharedWith` 決定要一起讀哪些模組；不能只按檔案所在目錄判斷影響範圍。

## 測試矩陣

| 修改內容 | 必要驗證入口 |
| --- | --- |
| 一般程式／驗證工具 | `npm run check` |
| 指令、alias、helpOnly 或 loader | `npm run verify:commands`，及 [runtime 測試](modules/runtime.md)；不自動 deploy |
| 設定／schema | [settings/database 測試](modules/settings-database.md)與所有受影響模組 |
| AI 聊天／歷史／actions | [AI 測試](modules/ai.md) |
| 音樂權限／帳號／播放／UI | [music 測試](modules/music.md)，設定連動另查 settings |
| Steam 查詢／看板 | [Steam 測試](modules/steam.md) |
| 戰績／鳴潮 | [games 測試](modules/games.md) |
| XP／提醒／投票／抽獎／身分組 | [community 測試](modules/community.md) |
| 共用 ANSI／Components V2／圖片 | [UI 測試](modules/ui.md)，以及使用該 helper 的模組 |
| Docker 排除／runtime | [dockerRuntime.test.js](../tests/dockerRuntime.test.js) |
| 純文件 | `npm run verify:docs`、diff 與人工語意查核；通常不必完整測試 |

第三方 API、爬蟲與資料來源使用 mock fixture；不以即時網路作回歸測試。會呼叫 `initDatabase()` 的測試使用 [temp DB helper](../tests/helpers/database.js)，不能寫真實 data/bot.db；舊 schema 遷移也只測 temp DB。正式素材放 assets，測試素材放 fixture；本機預覽放 tmp，不納入版控。

`npm run verify:music` 是額外合成音訊驗證，需可用且支援 libopus 的 FFmpeg，涵蓋與限制見 [音樂模組](modules/music.md)。它不登入真實 NAS／YouTube／Discord，不能證明 NAS 負載或公開影片一定可播。

## 文件檢查合約

`npm run verify:docs` 只掃根三份文件、docs，以及 src／tests／scripts 的檔名與程式；不讀憑證、正式資料或日誌。實際檢查 link／anchor、npm scripts、指令表、測試清單、歸屬與根 instructions 8 KiB 上限。Manifest 在隔離程序載入，logger 替換為 no-op；不呼叫 bot 入口、登入或資料庫初始化。

[module-map.json](module-map.json) 的 `modules` 記文件，`files` 記每個 JS／MJS 的 `owner` 與 `sharedWith`。新增檔案需同步登錄；測試 helpers 與 JS fixture 也有歸屬，只有 `*.test.js` 納入實際測試清單。新模組功能仍歸八類；不要增設同名重複規則入口。

手冊正式指令表由 `command-manifest:start`／`command-manifest:end` HTML markers 限定；驗證器共用正式 manifest，不另外硬編碼第三份指令清單。驗證器檢查結構，不保證文件語意符合程式，完成前仍須 trace 執行路徑。

規則調整在唯一 canonical 文件完成，其他文件只更新連結及必要使用說明；[舊規則對照](rule-migration.md) 用於本次遷移審核，不作新的重複規則庫。新增功能、指令、table、ENV、測試或部署流程時同步更新對應文件與根路由。
