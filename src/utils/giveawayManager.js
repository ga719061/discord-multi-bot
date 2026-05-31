import { EmbedBuilder } from 'discord.js';
import { getDb, markGiveawayEnded } from './database.js';
import { fmt, COLORS, ansiBlock } from './style.js';
import { logger } from './logger.js';
import { embedsToV2Payload, isV2Message, v2Notice } from './componentsV2.js';
import { UI_COLORS } from './style.js';

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
    checkGiveaways();
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

        const resultAnsi = ansiBlock([
            { color: COLORS.GOLD + ';' + COLORS.BOLD, text: '🎊 【皇家賞賜：抽獎結果公告】' },
            { color: COLORS.CYAN, text: '━━━━━━━━━━━━━━━━━━━━' },
            { color: COLORS.GOLD, text: `獎品：${giveaway.prize}` },
            { color: COLORS.WHITE, text: `中獎子民：${winnerNameList}` },
            { color: COLORS.CYAN, text: '━━━━━━━━━━━━━━━━━━━━' }
        ]);

        const resultEmbed = new EmbedBuilder()
            .setTitle('🐕🎊 本王欽點的幸運兒出爐了！')
            .setDescription(`恭喜 ${winnerMentionList} 領受本王賞賜！快來王座前領獎，汪！\n\n${resultAnsi}`)
            .setColor(UI_COLORS.SUCCESS)
            .setFooter({ text: '🐕👑 吉吉國王官方認證抽獎' })
            .setTimestamp();

        await channel.send(embedsToV2Payload([resultEmbed], {
            allowedMentions: { parse: [], users: winnersArray.map((user) => user.id) },
        }));

        // 標記結束
        markGiveawayEnded(giveaway.id);

        // 舊公開訊息保留 Embed 更新方式；新發布訊息以 V2 結束卡重繪。
        if (isV2Message(message)) {
            const endedEmbed = new EmbedBuilder()
                .setTitle('🐕🎉 抽獎活動 (已結束)')
                .setDescription(`本次賞賜已揭曉：**${giveaway.prize}**\n得主：${winnerNameList}`)
                .setColor(UI_COLORS.MUTED)
                .setFooter({ text: '🐕 謝謝所有參與的子民！下次宴會也要來喔！' });
            const endedPayload = embedsToV2Payload([endedEmbed]);
            await message.edit({ components: endedPayload.components }).catch(() => {});
        } else if (message.embeds[0]) {
            const endedEmbed = EmbedBuilder.from(message.embeds[0])
                .setTitle('🐕🎉 抽獎活動 (已結束)')
                .setColor(UI_COLORS.MUTED)
                .setThumbnail('attachment://stamp.png')
                .setImage(null);
            await message.edit({ embeds: [endedEmbed] }).catch(() => {});
        }

    } catch (err) {
        logger.error(`[GiveawayManager] 開獎失敗 (ID: ${giveaway.id}):`, err);
    }
}

async function announceNoParticipants(channel, giveaway) {
    await channel.send(v2Notice(
        '🎁 皇家抽獎無人領賞',
        `🐕 汪嗚...沒有人參加獎品 **${giveaway.prize}** 的抽獎，本王決定收回賞賜！`,
        UI_COLORS.MUTED,
        { ephemeral: false }
    ));
}
