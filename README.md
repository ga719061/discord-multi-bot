# 🐕👑 吉吉王國 (Gigi Kingdom Bot)

![Kingdom Banner](https://img.shields.io/badge/Status-Royal_Monitoring-gold?style=for-the-badge&logo=discord)
![Node Version](https://img.shields.io/badge/Node-24%2B-blue?style=for-the-badge&logo=node.js)
![Database](https://img.shields.io/badge/Database-SQLite-lightgrey?style=for-the-badge&logo=sqlite)

「汪！歡迎來到吉吉王國。本王可以陪聊、記錄、提醒、查遊戲情報，也能替管理員巡視領地。」

吉吉王國是一隻以 **Discord.js v14** 打造的社群管理與娛樂 bot，結合 AI 對話、等級系統、日誌、Steam 情報、遊戲戰績、提醒與互動式管理面板。

---

## 🧠 AI 行為

- `src/knowledge/persona.js` 僅保留吉吉國王 persona 與回答風格。
- AI 會按提問提供目前使用者、明確提及成員、伺服器與所在頻道的公開摘要，例如回答「我是誰」。
- AI 不會取得完整成員名冊、不可見頻道、管理設定、權限診斷、稽核紀錄或憑證；未提供的資料不得猜測。
- Discord mention 安全規則仍會在每次回答時強制套用。

---

## 🌟 核心功能

### AI 聊天
- AI 核心啟用時，白名單成員或派對模式頻道中標記吉吉國王即可 AI 對話。
- 支援上下文記憶、Google Search grounding、圖片提問與多模型切換。
- 只有提問者具備讀取歷史訊息權限時才會提供上下文，並排除 system、webhook 與第三方 bot 訊息。
- AI 僅能標記提問訊息中已明確標記且被允許的對象；永遠阻擋 `@everyone` 與 `@here`。

### 公開互動
- `/幫助` 或 `/help`：開啟互動式指令大典。
- `/摸摸`、`/抱抱`、`/占卜`、`/每日一汪`、`/餵食`、`/汪汪`：日常互動。
- 關鍵字「摸摸國王」、「抱抱國王」、「占卜」、「每日一汪」也能觸發部分互動。

### 等級與提醒
- 有效發言每 60 秒獲得 15-25 XP，Server Booster 享 1.5 倍加成。
- 防洗版會排除過短、純表情/貼圖、重複內容。
- `/等級` 查看個人功勳，`/排行榜` 查看前十名。
- `/提醒` 開啟彈窗建立提醒，並可透過私人面板管理待發送項目。

### Steam 與戰績
- `/特價查詢` 私下查詢台灣 Steam 價格、折扣、評價與遊戲詳情，查詢者可單次發布到原頻道。
- `/戰績` 查詢 VALORANT 或 League of Legends 公開戰績，結果會標示資料來源與連結。
- `/鳴潮抽卡` 可綁定一個鳴潮 UID，透過喚取紀錄 URL 或 JSON 更新歷史，並生成指定卡池的抽卡分析圖片；私人首頁直接提供取得 URL 的 PowerShell 指令與腳本檢視連結。

### 管理控制台
- `/設定` 僅限 Administrator 使用。
- 可管理歡迎訊息、日誌、等級公告、自助身分組、按鈕身分組、Steam 推播、AI、公告、狀態與成員查詢。
- AI 頁需輸入 `AI_ADMIN_PASSWORD` 解鎖後，才能啟用或停用 AI 核心，並調整模型、白名單、個性、聯網、記憶與派對模式。

---

## 🤖 Gemini 模型備註

目前預設模型是 `gemini-3.5-flash`，適合一般聊天、圖片理解、功能問答與多數社群場景。

管理面板也保留 `gemini-3.1-flash-lite`、`gemini-3.1-pro-preview`、`gemini-2.5-flash`、`gemini-2.5-flash-lite` 等選項；實際可用性與狀態以 [Gemini API models](https://ai.google.dev/gemini-api/docs/models) 為準。

---

## 🚀 快速部署

### Docker

1. 複製 `.env.example` 為 `.env`。
2. 填入 `DISCORD_TOKEN`、`GOOGLE_AI_KEY`、`AI_ADMIN_PASSWORD`。
3. 啟動：

```bash
docker-compose up -d --build
```

Compose 會以 root 啟動 entrypoint，保留既有 `bot-data` volume，修正 `/app/data` 與 `/app/logs` 的擁有者及 owner 寫入權限後，先以 UID 1000 驗證 `bot.db` 可寫，再立即降權成 `node` 使用者執行 bot。若 volume 或 Synology ACL 仍阻擋寫入，entrypoint 會輸出明確錯誤並停止，避免 SQLite 反覆以模糊的 readonly 錯誤重啟。

### 手動啟動

```bash
npm install
npm start
```

### 指令同步

```bash
npm run deploy
```

正式部署請勿設定 `GUILD_ID`，讓指令同步作用於全域；開發預覽時才設定 `GUILD_ID`。

---

## 🛠️ 開發

- 語言：JavaScript (Node.js 24+)
- 框架：discord.js v14
- 資料庫：Better-SQLite3
- 檢查：`npm run check`

資料庫位於 `data/bot.db`，正式環境請定期備份。

[Github Repository](https://github.com/ga719061/discord-multi-bot)
