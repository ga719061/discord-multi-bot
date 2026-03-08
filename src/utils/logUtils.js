import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { getGuildSettings } from './database.js';
import { logger } from './logger.js';

/**
 * 從 Audit Log 中抓特執行者 (現行犯)
 * @param {Guild} guild 
 * @param {AuditLogEvent} type 
 * @param {string} targetId 
 * @returns {Promise<User|null>}
 */
export async function getAuditLogExecutor(guild, type, targetId) {
    try {
        // 等待 1.5 秒讓 Discord API 更新 Audit Log
        await new Promise(resolve => setTimeout(resolve, 1500));
        const auditLogs = await guild.fetchAuditLogs({ limit: 5, type }).catch(() => null);
        if (!auditLogs) return null;

        const entry = auditLogs.entries.find(e => 
            e.targetId === targetId && 
            (Date.now() - e.createdTimestamp) < 10000
        );
        return entry ? entry.executor : null;
    } catch (err) {
        return null;
    }
}

/**
 * 傳送日誌到指定頻道
 * @param {Guild} guild - Discord Guild 物件
 * @param {EmbedBuilder} embed - 要發送的 Embed
 * @param {string} category - 日誌類別 (message/member/server/voice/thread)
 */
export async function sendLog(guild, embed, category = null) {
    if (!guild) return;

    try {
        const settings = getGuildSettings(guild.id);
        if (!settings) {
            logger.debug(`[Log] 領地 ${guild.id} 找不到設定`);
            return;
        }
        if (!settings.log_channel) {
            logger.debug(`[Log] 領地 ${guild.id} 尚未設定 log_channel`);
            return;
        }

        logger.debug(`[Log] 正在嘗試發送日誌至頻道: ${settings.log_channel}, 類別: ${category}`);

        // 檢查細分開關
        if (category && settings.log_toggles) {
            try {
                const toggles = JSON.parse(settings.log_toggles);
                if (toggles[category] === 0) return; // 已關閉，不傳送
            } catch (e) {
                logger.warn(`[Log] 無法解析 log_toggles: ${e.message}`);
            }
        }

        const channel = await guild.channels.fetch(settings.log_channel).catch(() => null);
        if (!channel) return;

        await channel.send({ embeds: [embed] }).catch(err => {
            logger.warn(`[Log] 無法發送日誌到 ${channel.name}: ${err.message}`);
        });
    } catch (error) {
        logger.error(`[Log] 發送日誌錯誤: ${error.message}`);
    }
}
