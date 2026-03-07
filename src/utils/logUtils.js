import { EmbedBuilder } from 'discord.js';
import { getGuildSettings } from './database.js';
import { logger } from './logger.js';

/**
 * 傳送日誌到指定頻道
 * @param {Guild} guild - Discord Guild 物件
 * @param {EmbedBuilder} embed - 要發送的 Embed
 */
export async function sendLog(guild, embed) {
    if (!guild) return;

    try {
        const settings = getGuildSettings(guild.id);
        if (!settings || !settings.log_channel) return;

        const channel = await guild.channels.fetch(settings.log_channel).catch(() => null);
        if (!channel) return;

        await channel.send({ embeds: [embed] }).catch(err => {
            logger.warn(`[Log] 無法發送日誌到 ${channel.name}: ${err.message}`);
        });
    } catch (error) {
        logger.error(`[Log] 發送日誌錯誤: ${error.message}`);
    }
}
