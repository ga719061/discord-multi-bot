FROM node:20-slim

# better-sqlite3 編譯工具與 LiveKit 依存
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先複製 package 檔案，利用 Docker layer cache
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# 複製原始碼
COPY . .

# 建立 data 目錄（SQLite 資料庫用）
RUN mkdir -p /app/data

# 註冊斜線指令 + 啟動 bot
CMD ["sh", "-c", "node scripts/deploy-commands.js && node src/bot.js"]
