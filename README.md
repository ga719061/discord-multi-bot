# 🐕👑 吉吉王國 (Gigi Kingdom Bot)

![Kingdom Banner](https://img.shields.io/badge/Status-Royal_Monitoring-gold?style=for-the-badge&logo=discord)
![Node Version](https://img.shields.io/badge/Node-20%2B-blue?style=for-the-badge&logo=node.js)
![Database](https://img.shields.io/badge/Database-SQLite-lightgrey?style=for-the-badge&logo=sqlite)

「汪！歡迎來到吉吉王國。本王可以陪聊、記錄、提醒、查遊戲情報，也能替管理員巡視領地。」

吉吉王國是一隻以 **Discord.js v14** 打造的社群管理與娛樂 bot，結合 AI 對話、等級系統、日誌、Steam 情報、遊戲戰績、提醒與互動式管理面板。

---

## 🧠 AI 知識庫架構

AI 知識已拆成模組化來源，避免功能更新後 prompt 與文件不同步：

- `src/knowledge/persona.js`：吉吉國王 persona、回答風格與安全邊界。
- `src/knowledge/features.js`：公開功能、管理員功能與 Gemini 模型備註。
- `src/knowledge/commands.js`：目前部署的 slash command 清單。
- `src/knowledge/permissions.js`：一般成員、Administrator 與 AI 標記限制。
- `src/knowledge/lore.js`：牛排、小狗禁忌、本王口吻等角色設定。
- `src/utils/serverKnowledge.js`：依使用者權限組裝 AI 可讀的伺服器知識。

`DEFAULT_AI_PROMPT` 只保留穩定 persona；功能事實由知識庫模組注入。這讓吉吉國王保留個性，但回答功能問題時會優先準確、清楚。

---

## 🌟 核心功能

### AI 聊天
- 白名單成員或派對模式頻道中，標記吉吉國王即可 AI 對話。
- 支援上下文記憶、Google Search grounding、圖片提問與多模型切換。
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

### 管理控制台
- `/設定` 僅限 Administrator 使用。
- 可管理歡迎訊息、日誌、等級公告、自助身分組、按鈕身分組、Steam 推播、AI、公告、狀態與成員查詢。
- AI 頁需輸入 `AI_ADMIN_PASSWORD` 解鎖後，才能調整模型、白名單、個性、聯網、記憶與派對模式。

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

- 語言：JavaScript (Node.js 20+)
- 框架：discord.js v14
- 資料庫：Better-SQLite3
- 檢查：`npm run check`

資料庫位於 `data/bot.db`，正式環境請定期備份。

[Github Repository](https://github.com/ga719061/discord-multi-bot)
