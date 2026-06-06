import { getDueReminders, updateReminderStatus, updateReminderError } from './database.js';
import { EmbedBuilder } from 'discord.js';
import { logger } from './logger.js';
import { fmt, COLORS, UI_COLORS } from './style.js';
import { embedsToV2Payload } from './componentsV2.js';
import { createJobOverlapGuard } from './jobGuards.js';

let checkInterval = null;
const runCheckReminders = createJobOverlapGuard('ReminderManager', checkReminders, logger);

/**
 * 初始化提醒管理器
 * @param {import('discord.js').Client} client 
 */
export function initReminderManager(client) {
    if (checkInterval) return;

    logger.info('⏰ 提醒管理器已啟動');

    runCheckReminders(client);

    // 每 30 秒檢查一次
    checkInterval = setInterval(() => {
        runCheckReminders(client);
    }, 30_000);
}

/**
 * 停止提醒管理器
 */
export function stopReminderManager() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
        logger.info('⏰ 提醒管理器已停止');
    }
}

/**
 * 檢查並發送已到期的提醒
 * @param {import('discord.js').Client} client 
 */
async function checkReminders(client) {
    try {
        const dueReminders = getDueReminders();
        if (dueReminders.length === 0) return;

        for (const reminder of dueReminders) {
            try {
                const guild = await client.guilds.fetch(reminder.guild_id).catch(() => null);
                if (!guild) {
                    updateReminderStatus(reminder.id, 'failed_no_guild');
                    continue;
                }

                const channel = await guild.channels.fetch(reminder.channel_id).catch(() => null);
                if (!channel || !channel.isTextBased()) {
                    updateReminderStatus(reminder.id, 'failed_no_channel');
                    continue;
                }

                const reminderDesc = [
                    `汪！子民 <@${reminder.user_id}>，你設定的提醒時間到囉！`,
                    '```ansi',
                    `${fmt(COLORS.CYAN, '【提醒內容】')}`,
                    `${fmt(COLORS.WHITE, reminder.content)}`,
                    '```'
                ].join('\n');

                const embed = new EmbedBuilder()
                    .setColor(UI_COLORS.INFO)
                    .setTitle(`⏰ 皇家提醒時間到！`)
                    .setDescription(reminderDesc)
                    .setTimestamp()
                    .setFooter({ text: '🐕 吉吉國王溫馨提醒' });

                await channel.send(embedsToV2Payload([embed], {
                    allowedMentions: { parse: [], users: [reminder.user_id] },
                }));

                // 更新狀態為已完成
                updateReminderStatus(reminder.id, 'completed');
                logger.debug(`[Reminder] 已發送提醒 ID: ${reminder.id} 給 ${reminder.user_id}`);

            } catch (err) {
                logger.error(`[Reminder] 處理提醒 ID ${reminder.id} 失敗:`, err);
                const currentAttempts = (reminder.attempts || 0) + 1;
                if (currentAttempts >= 5) {
                    updateReminderStatus(reminder.id, 'failed');
                    logger.warn(`[Reminder] 提醒 ID ${reminder.id} 已達最大重試次數 (5)，標記為失敗`);
                } else {
                    const nextRetryAt = Date.now() + currentAttempts * 60 * 1000;
                    updateReminderError(reminder.id, err.message || String(err), nextRetryAt);
                }
            }
        }
    } catch (err) {
        logger.error('[Reminder] 檢查提醒流程出錯:', err);
    }
}

/**
 * 解析時間字串並回傳目標 Date 
 * 支援格式：
 * - 10m, 1h, 1d (相對時間)
 * - 16:00 (當天或隔天絕對時間)
 * @param {string} timeStr 
 * @returns {number|null} 目標毫秒數
 */
export function parseReminderTime(timeStr) {
    const now = Date.now();
    
    // 檢查相對時間 (如 10m, 1h, 1d)
    const relativeMatch = timeStr.toLowerCase().match(/^(\d+)([mhd])$/);
    if (relativeMatch) {
        const value = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2];
        const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 };
        return now + value * multipliers[unit];
    }

    // 檢查絕對時間 (如 16:00)
    const absoluteMatch = timeStr.match(/^(\d{1,2})[:：](\d{1,2})$/);
    if (absoluteMatch) {
        let hours = parseInt(absoluteMatch[1]);
        let minutes = parseInt(absoluteMatch[2]);
        
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

        // 取得當前的 UTC 時間
        const nowUtc = new Date();
        
        // 建立一個代表當前「台北時間」的 Date 物件 (UTC + 8)
        // 注意：這裡我們借用 Date 物件來做純粹的數值運算
        const target = new Date(nowUtc.getTime() + (8 * 60 * 60 * 1000));
        
        // 設定目標的小時與分鐘
        target.setUTCHours(hours, minutes, 0, 0);

        // 如果計算出來的 目標台北時間 <= 當前台北時間，代表預約的是明天
        if (target.getTime() <= (nowUtc.getTime() + (8 * 60 * 60 * 1000))) {
            target.setUTCDate(target.getUTCDate() + 1);
        }

        // 把目標台北時間「還原」回真正的 UTC 時間戳記，這樣給 setInterval 判斷才正確
        return target.getTime() - (8 * 60 * 60 * 1000);
    }

    return null;
}
