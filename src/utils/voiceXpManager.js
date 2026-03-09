import { logger } from './logger.js';
import { addXp, getGuildSettings } from './database.js';

const SCAN_INTERVAL = 10 * 60 * 1000; // 10 分鐘
const BASE_XP = 10;
const BOOST_MULTIPLIER = 1.5;

/**
 * 初始化語音經驗值管理員
 * @param {import('discord.js').Client} client 
 */
export function initVoiceXpManager(client) {
    logger.info('[VoiceXP] 語音經驗值系統已啟動，掃描間隔：10 分鐘。');

    setInterval(async () => {
        try {
            await scanVoiceChannels(client);
        } catch (error) {
            logger.error('[VoiceXP] 掃描語音頻道時發生錯誤:', error);
        }
    }, SCAN_INTERVAL);
}

/**
 * 掃描所有伺服器的語音頻道並發放經驗值
 * @param {import('discord.js').Client} client 
 */
async function scanVoiceChannels(client) {
    let totalRewarded = 0;

    for (const guild of client.guilds.cache.values()) {
        const voiceStates = guild.voiceStates.cache;
        if (voiceStates.size === 0) continue;

        for (const state of voiceStates.values()) {
            // 排除：機器人、不在頻道中、或自己靜音 (可視情況調整是否排除靜音)
            if (state.member.user.bot || !state.channelId) continue;
            
            // 排除掛機頻道 (AFK Channel)
            if (state.channelId === guild.afkChannelId) continue;

            const userId = state.id;
            const guildId = guild.id;

            // 計算加成
            const isBooster = state.member.premiumSince !== null;
            const amount = isBooster ? Math.floor(BASE_XP * BOOST_MULTIPLIER) : BASE_XP;

            try {
                const result = addXp(guildId, userId, amount, { source: 'voice' });
                totalRewarded++;

                if (result.leveledUp) {
                    const settings = getGuildSettings(guildId);
                    if (settings.level_up_announcement_enabled !== 0) {
                        const channel = guild.systemChannel || state.channel;
                        if (channel && channel.isTextBased()) {
                            await channel.send(`🐕👑 **汪汪！** 恭喜 ${state.member} 在語音頻道修行有成，晉升為 **等級 ${result.newLevel}**！🎉`).catch(() => {});
                        }
                    }
                }
            } catch (err) {
                logger.error(`[VoiceXP] 無法為用戶 ${userId} 發放經驗值:`, err);
            }
        }
    }

    if (totalRewarded > 0) {
        logger.debug(`[VoiceXP] 週期性檢查完成，共為 ${totalRewarded} 位成員發放了經驗值。`);
    }
}
