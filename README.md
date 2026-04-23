# 🐕👑 吉吉王國 (Gigi Kingdom Bot)

![Kingdom Banner](https://img.shields.io/badge/Status-Royal_Monitoring-gold?style=for-the-badge&logo=discord)
![Node Version](https://img.shields.io/badge/Node-18%2B-blue?style=for-the-badge&logo=node.js)
![Database](https://img.shields.io/badge/Database-SQLite-lightgrey?style=for-the-badge&logo=sqlite)

「汪！歡迎來到吉吉王國！本王親自統治的領地，不准隨便撒野！」
這不只是一隻會汪汪叫的機器狗，而是結合了 **AI 智慧聊天**、**皇家階級系統**、**實用伺服器管理** 以及 **趣味互動** 的全方位社群總管。

---

## 🌟 核心功能

### 🤖 皇家智庫 (AI 功能)
- **多模型切換**：整合 Gemini 3.0 / 3.1 旗艦模型，支援實時網絡搜尋。
- **上下文記憶**：具備長短期記憶，能跟隨話題深度聊天。
- **伺服器知識庫**：國王知道領地內的所有規則與功能細節。

### 📝 領地史官 (極致記錄)
- **「現行犯」抓取**：整合 Audit Log，主動告知是哪位管理員執行了國法（刪文、禁言、改頻道）。
- **邀請者追蹤**：新子民入城時，史官會告訴您他是誰邀請來的。
- **細分監控開關**：使用 `/setup-log` 喚出**圖形化控制面板**，自由勾選您感興趣的紀錄類別。
- **高級記錄**：包含討論串 (Threads)、訊息對比、圖片快取備份等。



### 📊 皇家爵位 (等級系統)
- **爵位晉升**：根據活躍度獲得頭銜，從「平民」一路攀升至「大公爵」。
- **勳章牆**：首個 Commit、忠誠子民等特殊榮譽顯示。
- **視覺升級**：所有 Rank 與 Leaderboard 皆採用高品質 **ANSI 數據區塊** 呈現。

### 🛒 皇家採購 & 實用
- **Steam 指令**：`/steam search` (搜尋價格), `/steam sales` (特價列表)。
- **智能提醒**：`/remind` 定時提醒功能。
- **自定義歡迎**：`/setup-welcome` 溫馨入城饗宴。

---

## 🚀 快速部署

### 🐳 使用 Docker (推薦)
1. **設定變數**：複製 `.env.example` -> `.env` 並填入 `DISCORD_TOKEN`。
2. **啟動**：
   ```bash
   docker-compose up -d --build
   ```

### 💻 手動啟動
1. 安裝依賴：`npm install`
2. 啟動機器人：`npm start`

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
