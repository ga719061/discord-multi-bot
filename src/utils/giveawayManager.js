import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { getDb, markGiveawayEnded } from './database.js';
import { fmt, COLORS, ansiBlock } from './style.js';
import { logger } from './logger.js';

let client;
let checkInterval;

/**
 * 初始化抽獎管理器
 * @param {import('discord.js').Client} discordClient 
 */
export function initGiveawayManager(discordClient) {
    client = discordClient;
    startPolling();
    logger.info('[GiveawayManager] 抽獎管理器已啟動巡邏！汪！');
}

function startPolling() {
    if (checkInterval) clearInterval(checkInterval);
    // 每 30 秒巡邏一次
    checkInterval = setInterval(() => checkGiveaways(), 30_000);
}

async function checkGiveaways() {
    try {
        const db = getDb();
        const now = Date.now();
        
        // 找出所有還沒結束且時間已到的抽獎
        const dueGiveaways = db.prepare(`
            SELECT * FROM giveaways 
            WHERE ended = 0 AND end_time <= ?
        `).all(now);

        for (const giveaway of dueGiveaways) {
            await endGiveaway(giveaway);
        }
    } catch (err) {
        logger.error('[GiveawayManager] 巡邏時出錯:', err);
    }
}

/**
 * 結束抽獎並開獎
 * @param {object} giveaway 
 */
export async function endGiveaway(giveaway) {
    try {
        const guild = await client.guilds.fetch(giveaway.guild_id).catch(() => null);
        if (!guild) {
            markGiveawayEnded(giveaway.id);
            return;
        }

        const channel = await guild.channels.fetch(giveaway.channel_id).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            markGiveawayEnded(giveaway.id);
            return;
        }

        const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
        if (!message) {
            markGiveawayEnded(giveaway.id);
            return;
        }

        // 獲取反應
        const reaction = message.reactions.cache.get('🎉');
        if (!reaction) {
            await announceNoParticipants(channel, giveaway);
            markGiveawayEnded(giveaway.id);
            return;
        }

        // 強制抓取所有使用者確保清單正確
        const users = await reaction.users.fetch();
        const participants = users.filter(u => !u.bot);

        if (participants.size === 0) {
            await announceNoParticipants(channel, giveaway);
            markGiveawayEnded(giveaway.id);
            return;
        }

        // 抽取贏家
        const winners = participants.random(Math.min(participants.size, giveaway.winners));
        const winnersArray = Array.isArray(winners) ? winners : [winners];
        
        // 取得成員清單以顯示暱稱
        const winnerNames = [];
        const winnerMentions = [];
        
        for (const user of winnersArray) {
            const member = await guild.members.fetch(user.id).catch(() => null);
            winnerNames.push(member ? member.displayName : user.username);
            winnerMentions.push(user.toString());
        }

        const winnerNameList = winnerNames.join(', ');
        const winnerMentionList = winnerMentions.join(', ');

        const stampAttachment = new AttachmentBuilder('./assets/stamp.png', { name: 'stamp.png' });
        
        const resultAnsi = ansiBlock([
            { color: COLORS.GOLD + ';' + COLORS.BOLD, text: '🎊 【皇家賞賜：抽獎結果公告】' },
            { color: COLORS.CYAN, text: '━━━━━━━━━━━━━━━━━━━━' },
            { color: COLORS.GOLD, text: `獎品：${giveaway.prize}` },
            { color: COLORS.WHITE, text: `中獎子民：${winnerNameList}` },
            { color: COLORS.CYAN, text: '━━━━━━━━━━━━━━━━━━━━' }
        ]);

        const resultEmbed = new EmbedBuilder()
            .setTitle('🐕🎊 本王欽點的幸運兒出爐了！')
            .setDescription(resultAnsi)
            .setColor(0x00FF00)
            .setThumbnail('attachment://stamp.png')
            .setFooter({ text: '🐕 吉吉國王官方認證抽獎' })
            .setTimestamp();

        await channel.send({
            content: `🐕🎉 汪汪！恭喜 ${winnerMentionList} 獲得了 **${giveaway.prize}**！快來領賞！`,
            embeds: [resultEmbed],
            files: [stampAttachment]
        });

        // 標記結束
        markGiveawayEnded(giveaway.id);

        // 更新原訊息表示已結束
        const endedEmbed = EmbedBuilder.from(message.embeds[0])
            .setTitle('🐕🎉 抽獎活動 (已結束)')
            .setColor(0x99AAB5);
        await message.edit({ embeds: [endedEmbed] }).catch(() => {});

    } catch (err) {
        logger.error(`[GiveawayManager] 開獎失敗 (ID: ${giveaway.id}):`, err);
    }
}

async function announceNoParticipants(channel, giveaway) {
    await channel.send(`🐕 汪嗚...沒有人參加獎品 **${giveaway.prize}** 的抽獎，本王決定把獎品自己啃掉！汪！`);
}
