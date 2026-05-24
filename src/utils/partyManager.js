import { getDb } from './database.js';
import { logger } from './logger.js';
import { v2Notice } from './componentsV2.js';
import { UI_COLORS } from './style.js';

let client;
let checkInterval;

/**
 * 初始化派對管理器 — 輪詢 DB 中已過期的派對並清理
 * @param {import('discord.js').Client} discordClient 
 */
export function initPartyManager(discordClient) {
    client = discordClient;
    // 每 30 秒巡邏一次
    checkInterval = setInterval(() => checkExpiredParties(), 30_000);
    // 啟動時立刻檢查一次（處理重啟期間過期的派對）
    checkExpiredParties();
    logger.info('[PartyManager] 派對到期巡邏已啟動！汪！');
}

async function checkExpiredParties() {
    try {
        const db = getDb();
        const now = Date.now();

        // 找出所有已過期的派對 (party_expires_at 不為 null 且 < now)
        const expired = db.prepare(`
            SELECT guild_id, party_channel_id, party_expires_at 
            FROM ai_settings 
            WHERE party_channel_id IS NOT NULL 
              AND party_expires_at IS NOT NULL 
              AND party_expires_at <= ?
        `).all(now);

        for (const row of expired) {
            await endParty(row);
        }
    } catch (err) {
        logger.error('[PartyManager] 巡邏時出錯:', err);
    }
}

async function endParty(row) {
    try {
        const db = getDb();

        // 清除 DB 中的派對資料
        db.prepare('UPDATE ai_settings SET party_channel_id = NULL, party_expires_at = NULL WHERE guild_id = ?')
            .run(row.guild_id);

        // 嘗試發送離場台詞
        const guild = await client.guilds.fetch(row.guild_id).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(row.party_channel_id).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        await channel.send(v2Notice(
            '👑 御前圓桌會議閉幕',
            '🛑 **（敲擊權杖）汪！時間已到，今日的御前會議到此為止！**\n本王乏了，所有的諫言本王都已聽見，諸臣退朝！',
            UI_COLORS.SPECIAL,
            { ephemeral: false }
        )).catch(() => { });

        logger.info(`[PartyManager] 領地 ${guild.name} 的派對已結束。`);
    } catch (err) {
        logger.error(`[PartyManager] 結束派對失敗 (guild: ${row.guild_id}):`, err);
    }
}
