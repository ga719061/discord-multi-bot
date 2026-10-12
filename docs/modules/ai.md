# AI 對話、上下文與操作工具

本文件是本模組的維護規則唯一來源。開始修改前先讀 [根 AGENTS](../../AGENTS.md) 與相關交叉連結；實際程式／測試與規則矛盾時先查明並同步修正文檔。

## 入口與資料流

- [messageCreate](../../src/events/messageCreate.js) 接收 Mention，檢查核心開關、白名單／派對模式與請求名額，再建立歷史、公開 guild context 與 mention policy。
- [aiChat](../../src/utils/aiChat.js) 組合 [persona](../../src/knowledge/persona.js)、請求 Gemini、處理圖片／重試；[aiConfig](../../src/utils/aiConfig.js) 定義模型與遷移。[aiGuildContext](../../src/utils/aiGuildContext.js) 與 [aiMentions](../../src/utils/aiMentions.js) 限制上下文與 Mention。
- [aiActionTools](../../src/utils/aiActionTools.js) 分派提醒／投票／公告；[aiDrafts](../../src/utils/aiDrafts.js) 產生私人設定 session 草稿。設定入口在 [管理中心](settings-database.md)。

## 不可破壞的規則

- AI 上下文：`src/knowledge/persona.js` 僅提供角色語氣；`src/utils/aiGuildContext.js` 按需提供提問者、明確提及成員與目前伺服器／頻道的公開摘要。不得注入完整名冊、不可見頻道、管理設定、權限診斷或憑證，Discord mention 安全規則仍須強制套用。
- AI 白名單與派對模式仍受 `ai_settings.enabled` 全域開關限制；AI 設定面板必須顯示並提供核心啟用／停用控制，重新啟用時清除舊的 `expires_at`。
- AI 操作工具由 `ai_settings.action_tools_enabled` 獨立總開關控制且預設關閉；只解析移除 bot Mention 後緊接於字串開頭的 `提醒:`／`提醒：`、`投票:`／`投票：`、`公告:`／`公告：`。工具只開放 AI 白名單，派對模式不得授予工具權；公告另須 Administrator 與 `admin_ids` 授權，並維持私人草稿預覽、原子 claim 與發布確認。
- AI 模型選單固定使用 Stable ID：預設 `gemini-3.8-flash` 與經濟型 `gemini-3.5-flash-lite`；舊 Flash／Pro 設定遷移到前者，舊 Flash-Lite 設定遷移到後者，未知值回退預設模型。
- AI 對話歷史只可在提問者具備 `ReadMessageHistory` 時讀取，只保留 30 分鐘內該提問者訊息與本 bot 直接 reference 它的完整 reply pair，並排除一般頻道發言、system、webhook 與第三方 bot；歷史須從最新完整 pair 往舊套用單則與總字元預算，再恢復時間順序。
- AI 請求維持每使用者 8 秒冷卻與單一 in-flight、每 guild 2 個及全域 6 個 in-flight 上限；整個圖片下載、Gemini 請求與重試流程共用 45 秒 deadline，逾時須中止 client request、typing timer 並釋放 slot。
- AI 一般回答固定限制 1,200 output tokens，Discord 最多發布 3 則、每則不超過 1,990 字；分段不得切斷 UTF-16 surrogate 或未閉合 Markdown code fence，截斷時要明確提示。
- AI 圖片每次最多 2 張，下載與處理後 payload 各自總計不超過 8 MB；只接受 Discord HTTPS CDN host、拒絕 redirect，並驗證 MIME、magic bytes 與實際 decode。輸入像素須有上限，送出前縮至最長邊 2,048 px 並重編碼 WebP；純圖片請求若沒有任何有效圖片不得呼叫 Gemini。
- `gemini-3.8-flash` 一般聊天使用 `low` thinking（不支援 `minimal`），`gemini-3.5-flash-lite` 使用 `minimal`；若未經 usage／latency／品質數據驗證，不要提高一般聊天的 thinking level。
- AI 回應只記錄模型、延遲、重試、token／thinking／cache 數、Search query 數與 finish reason，不得記錄 prompt、回覆、附件 URL 或 grounding query 內容；`citations_enabled` 預設關閉，且須與 `search_enabled` 獨立控制。只有前者開啟時，Search 回答才最多附 3 個經過清理的 HTTP(S) 來源。
- AI 草稿功能只使用私人設定面板 session 狀態；不得直接公開發文或直接修改設定，公告仍必須走 preview 與發布確認。
- AI 公告草稿標題限制：為防止 AI 產生的公告標題在圖片中過長被截斷，System Prompt 必須限制公告標題在 15 字以內（包含表情符號），確保其天然符合單行排版要求。
- AI 圖片 input 上限以 aiChat 的 `MAX_AI_IMAGE_INPUT_PIXELS`（16,000,000）與 `MAX_AI_IMAGE_INPUT_DIMENSION`（8,192）為準。角色語氣檔不代表完整專案知識庫。

## 修改影響

- 改歷史、請求預算與分段時，一起查 messageCreate 與 aiChat；改使用資格／模型時查 [設定與資料庫](settings-database.md)。
- 公告發布、附件與圖片規則以 [共用 UI／圖片](ui.md) 為準；提醒與投票持久化以 [社群功能](community.md) 為準。
- 不以 AI 白名單授予 NAS 權限；NAS 授權與撤權流程以 [音樂](music.md) 為準。

## 驗證方式

- 執行 `node --test tests/aiChat.test.js tests/aiPipelineOptimization.test.js tests/aiMentions.test.js tests/aiGuildContext.test.js tests/aiActionTools.test.js tests/aiActionDomains.test.js`。
- [對話](../../tests/aiChat.test.js)、[歷史／deadline／併發](../../tests/aiPipelineOptimization.test.js)、[Mention](../../tests/aiMentions.test.js)、[公開摘要](../../tests/aiGuildContext.test.js)、[操作工具](../../tests/aiActionTools.test.js)、[跨工具行為](../../tests/aiActionDomains.test.js) 使用合成輸入。
- 涉及面板另跑 [settingsPanel](../../tests/settingsPanel.test.js)；涉及模型設定遷移需舊 schema temp DB。不得以真實 Gemini 對話、Discord 歷史或憑證作 fixture。
