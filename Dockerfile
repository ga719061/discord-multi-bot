FROM node:24-slim AS dependencies

# better-sqlite3 原生模組建置工具
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-slim

# CJK 與 Emoji 字型（圖片渲染用）
RUN apt-get update && apt-get install -y \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fontconfig \
    gosu \
    && fc-cache -fv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

# SQLite 與日誌目錄必須可由非 root 使用者寫入
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs

COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint \
    && chmod 0755 /usr/local/bin/docker-entrypoint

# Slash commands are deployed explicitly during releases. Do not block bot
# startup on a Discord API synchronization request during every restart.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/readyz').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]

ENTRYPOINT ["docker-entrypoint"]
CMD ["node", "src/bot.js"]
