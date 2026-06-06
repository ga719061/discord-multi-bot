FROM node:20-slim

# better-sqlite3 編譯工具、CJK 字型與 Emoji 字型（圖片渲染用）
RUN apt-get update && apt-get install -y \
    build-essential \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fontconfig \
    python3 \
    && fc-cache -fv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先複製 package 檔案，利用 Docker layer cache
COPY package*.json ./
RUN npm ci --omit=dev

# 複製原始碼
COPY . .

# 建立 data 目錄（SQLite 資料庫用）
RUN mkdir -p /app/data

# Slash commands are deployed explicitly during releases. Do not block bot
# startup on a Discord API synchronization request during every restart.
CMD ["node", "src/bot.js"]
