# 🐕👑 吉吉王國 (Gigi Kingdom Bot)

![Kingdom Banner](https://img.shields.io/badge/Status-Royal_Monitoring-gold?style=for-the-badge&logo=discord)
![Node Version](https://img.shields.io/badge/Node-18%2B-blue?style=for-the-badge&logo=node.js)
![Database](https://img.shields.io/badge/Database-SQLite-lightgrey?style=for-the-badge&logo=sqlite)

「汪！歡迎來到吉吉王國！本王親自統治的領地，不准隨便撒野！」
這是一個結合 **AI 互動**、**深度 RPG 冒險** 與 **全方位領地監控** 的多功能 Discord 機器人。

---

## 🌟 核心功能

### 🤖 皇家智庫 (AI 功能)
- **多模型切換**：整合 Gemini 2.0 / 1.5 旗艦模型，支援實時網絡搜尋。
- **上下文記憶**：具備長短期記憶，能跟隨話題深度聊天。
- **伺服器知識庫**：國王知道領地內的所有規則與功能細節。

### 📝 領地史官 (極致記錄)
- **「現行犯」抓取**：整合 Audit Log，主動告知是哪位管理員執行了國法（刪文、禁言、改頻道）。
- **邀請者追蹤**：新子民入城時，史官會告訴您他是誰邀請來的。
- **細分監控開關**：使用 `/setup-log` 喚出**圖形化控制面板**，自由勾選您感興趣的紀錄類別。
- **高級記錄**：包含討論串 (Threads)、訊息對比、圖片快取備份等。

### ⚔️ 王國冒險 (深度 RPG)
- **豐富職業與種族**：戰士、法師、聖騎士、獵人等，搭配人類、精靈、矮人、龍族等天賦。
- **裝備與強化**：具有隨機詞條的前綴/後綴裝備系統，以及高強度的皇家強化機制。
- **拍賣與交易**：子民可以在拍賣行自由流通珍惜寶物。
- **指令集**：`/adventure`, `/profile`, `/inventory`, `/auction` 等。

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
