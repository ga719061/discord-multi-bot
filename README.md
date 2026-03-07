# 👑 吉吉國王機器人 (Chihuahua King Bot)

這是一個由吉吉國王統治的多功能 Discord 機器人！汪！🐕
結合了管理、娛樂、音樂、Steam 查詢與全方位日誌記錄功能。

## ✨ 特色功能

### 🛡️ 管理與監控 (Admin & Logs)
- **📋 全方位日誌** (`/setup-log`)：
  - **訊息**：刪除、編輯（含內容對比與圖片備份）。
  - **成員**：加入、離開、改名、身分組變更、禁言/解禁、封鎖/解封。
  - **語音**：加入、離開、切換頻道。
  - **伺服器**：頻道/身分組/表情符號的增刪修。
  - *以上日誌皆以吉吉國王風格報告！*
- ** 👋 歡迎系統** (`/setup-welcome`)：自訂歡迎頻道與訊息。
- **📊 伺服器資訊**：
  - `/serverinfo`：查看本領地的詳細資訊。
  - `/userinfo`：調查子民的底細。
  - `/botstatus`：查看國王的健康狀態。
  - *注意：所有管理指令皆為隱藏回應 (Ephemeral)，這有下指令的人看得到！*

### 🎮 娛樂與實用 (Games & Utilities)
- **🛍️ Steam 優惠查詢 & 限免推播**：
  - `/steam search <遊戲>`：查詢遊戲價格與歷史折扣。
  - `/steam sales`：列出 Steam 目前最火熱的特價遊戲 (Top Specials)。
  - `/setup-freegames`：設定 Steam 100% 限時免費遊戲自動推播頻道。
- **🎭 身分組管理** (`/reactionrole`)：
  - 設定讓成員點擊 Emoji 自動領取身分組。
  - 支援多組設定與自訂訊息。
- **🎵 音樂系統**：
  - 支援 YouTube 連結與關鍵字搜尋。
  - 指令：`/play`, `/skip`, `/stop`, `/queue`, `/nowplaying` 等。
- **📈 等級系統**：
  - 聊天自動獲得經驗值 (XP)。
  - `/rank` 查看等級卡片，`/leaderboard` 查看排行榜。
- **🗳️ 投票與抽獎**：
  - `/poll` 發起投票。
  - `/giveaway`舉辦抽獎活動。
- **🐕 國王互動**：
  - 在聊天中輸入 **「摸摸國王」**、**「抱抱國王」** 或 **@機器人**，國王會理你喔！
  - `/8ball` (占卜), `/roll` (擲骰子) 等小工具。

---

## 🚀 快速部署 (Docker)

本專案建議使用 **Docker Compose** 進行部署，方便快速且環境隔離。

### 1. 環境準備
- 確保已安裝 [Docker](https://www.docker.com/) 與 [Docker Compose](https://docs.docker.com/compose/install/)。
- 準備 Discord Bot Token (在 [Developer Portal](https://discord.com/developers/applications) 取得)。

### 2. 設定環境變數
將專案中的 `.env.example` 複製為 `.env`，並填入：

```env
DISCORD_TOKEN=你的Bot_Token
CLIENT_ID=你的應用程式ID (Application ID)
# GUILD_ID (選填，若填寫則指令只會在該伺服器生效，適合開發測試)
```

### 3. 啟動機器人
在專案根目錄執行：

```bash
# 啟動並在背景執行
sudo docker-compose up -d --build

# 查看日誌
sudo docker-compose logs -f
```

### 4. 更新機器人
若有程式碼更新，請執行：

```bash
sudo git pull
sudo docker-compose up -d --build
```
(Docker 會自動重建映像檔並重啟容器)

---

## 🛠️ 開發者指南 (非 Docker)

若不使用 Docker，請確保安裝 **Node.js 18+**。

1. 安裝依賴：`npm install`
2. 註冊指令：`npm run deploy`
3. 啟動：`npm start`

---

## ⚠️ 注意事項
- **資料庫**：使用 SQLite，資料儲存在 `data/bot.db`。**請勿刪除此檔案**，否則設定與等級資料會遺失。
- **權限**：請確保 Bot 擁有 `Administrator` 權限，或至少擁有 `Manage Channels`, `Manage Roles`, `Manage Messages`, `View Audit Log` 等權限以正常運作。

---
🐕 **吉吉國王** 祝你使用愉快！汪！
