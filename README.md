# 🐕👑 吉吉王國 (Gigi Kingdom Bot)

![Kingdom Banner](https://img.shields.io/badge/Status-Royal_Monitoring-gold?style=for-the-badge&logo=discord)
![Node Version](https://img.shields.io/badge/Node-18%2B-blue?style=for-the-badge&logo=node.js)
![Database](https://img.shields.io/badge/Database-SQLite-lightgrey?style=for-the-badge&logo=sqlite)

「汪！歡迎來到吉吉王國！本王親自統治的領地，不准隨便撒野！」
這不只是一隻會汪汪叫的機器狗，而是結合了 **AI 智慧聊天**、**皇家階級系統**、**實用伺服器管理** 以及 **趣味互動** 的全方位社群總管。

---

## 🌟 核心功能

### 🤖 皇家智庫 (AI 功能)
- **管理驗證**：Administrator 可在 `/設定` 的 AI 頁輸入管理密碼，解鎖 AI 管理功能。
- **多模型切換**：支援從管理設定選擇 Gemini 模型，並可開啟即時網路搜尋。
- **上下文記憶**：具備長短期記憶，能跟隨話題深度聊天。
- **伺服器知識庫**：國王知道領地內的所有規則與功能細節。
- **受控標記通知**：在 AI 提問中同時標記使用者，國王可在答覆中通知該使用者；管理員亦可標記身分組。AI 不會標記未指定目標或 `@everyone` / `@here`。

### 📝 領地史官 (極致記錄)
- **「現行犯」抓取**：整合 Audit Log，主動告知是哪位管理員執行了國法（刪文、禁言、改頻道）。
- **邀請者追蹤**：新子民入城時，史官會告訴您他是誰邀請來的。
- **皇家管理控制台**：Administrator 可從 `/幫助` 首頁進入皇家管理控制台，或直接使用 `/設定`，先巡視領地健康總覽，再管理迎賓佈告、史官日誌、爵位、Steam 採購、自助身分領取、AI、聖旨、狀態與子民查詢。
- **高級記錄**：包含討論串 (Threads)、訊息修改對比與伺服器變動紀錄。



### 📊 皇家爵位 (等級系統)
- **爵位晉升**：根據活躍度獲得頭銜，從「平民」一路攀升至「大公爵」。
- **視覺升級**：所有 Rank 與 Leaderboard 皆採用高品質 **ANSI 數據區塊** 呈現。

### 🛒 皇家採購 & 實用
- **Steam 指令**：使用 `/特價查詢` 直接開啟皇家採購彈窗，輸入名稱後從候選清單選定正確 Steam 遊戲；結果先私下呈報，可由查詢者單次頒布到原頻道。Administrator 可在 `/設定` 面板管理每日推播與確認後手動投放特價榜單。
- **遊戲戰績**：使用 `/戰績` 直接開啟皇家戰報彈窗，在同一頁選擇特戰英豪或英雄聯盟並填入 Riot ID；結果先私下呈報，可單次頒布到原頻道。VALORANT 優先讀取 OP.GG 當前 Act 的 **All Modes** 公開輸出、命中、特務、武器與地圖表現，OP.GG 未公開資料時會嘗試 ValoCheck 備援；英雄聯盟讀取 OP.GG 的當前賽季 KDA、勝率與常用英雄表現。全程不需 API Key，結果卡片會標示實際來源並提供連結。
- **皇家互動發布**：從 `/幫助` 按下「建立皇家投票」可用彈窗建立 2 至 5 個選項的國是會議；按下「建立皇家抽獎」則可填寫賞賜、時限與名額後立即頒布活動。
- **智能提醒**：`/提醒` 直接開啟新增彈窗，建立完成後可透過私人按鈕查看或刪除自己的待發送提醒。
- **自定義歡迎**：透過 `/設定` 面板設定新人報到頻道與歡迎詞。

---

## 🚀 快速部署

### 🐳 使用 Docker (推薦)
1. **設定變數**：複製 `.env.example` -> `.env`，填入 `DISCORD_TOKEN`、`GOOGLE_AI_KEY` 與 `AI_ADMIN_PASSWORD`。
2. **啟動**：
   ```bash
   docker-compose up -d --build
   ```

### 💻 手動啟動
1. 安裝依賴：`npm install`
2. 複製 `.env.example` -> `.env` 並填入必要設定
3. 啟動機器人：`npm start`

### 🔄 指令同步
- 正式部署請勿設定 `GUILD_ID`，在需要更新指令時先執行 `npm run deploy`：此步驟會同步全域指令，並清除各伺服器殘留的舊指令，例如 `/volume`、`/stop`、`/shuffle`。
- 容器啟動只啟動 Bot，不會因 Discord 指令同步暫時失敗而阻擋上線。
- 只在開發預覽時設定 `GUILD_ID` 後執行 `npm run deploy`：同步只會作用於該測試伺服器，不會發布或清除全域指令。

---

## 🛠️ 開發架構
- **語言**: JavaScript (Node.js)
- **框架**: discord.js v14
- **資料庫**: Better-SQLite3
- **渲染**: ANSI Standard Styling for Discord

---

## ⚠️ 皇家備註
- 資料庫儲存於 `data/bot.db`，請務必妥善備份，那是王國的命根子。
- 機器人需要 `Administrator` 權限方可發揮百分之百的威嚴。

🐕 **吉吉國王** 祝你在領地內玩得開心！汪！
 [Github Repository](https://github.com/ga719061/discord-multi-bot)
