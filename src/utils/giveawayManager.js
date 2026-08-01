import { Collection, EmbedBuilder } from 'discord.js';
import { getDb, markGiveawayEnded, updateGiveawayError, updateGiveawayState } from './database.js';
import { fmt, COLORS, ansiBlock } from './style.js';
import { logger } from './logger.js';
import { embedsToV2Payload, isV2Message, v2Notice } from './componentsV2.js';
import { UI_COLORS } from './style.js';
import { createJobOverlapGuard } from './jobGuards.js';

let client;
let checkInterval;
const runCheckGiveaways = createJobOverlapGuard('GiveawayManager', checkGiveaways, logger);

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
    runCheckGiveaways();
    // 每 30 秒巡邏一次
    checkInterval = setInterval(() => runCheckGiveaways(), 30_000);
}

export function stopPolling() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
}

async function checkGiveaways() {
    try {
        const db = getDb();
        const now = Date.now();
        
        // 找出到期抽獎，以及已抽出得主但通知尚未成功的抽獎。
        const dueGiveaways = db.prepare(`
            SELECT * FROM giveaways 
            WHERE (ended = 0 AND status = 'pending' AND end_time <= ?)
               OR (ended = 0 AND status = 'drawn_pending_notify' AND attempts < 5)
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
            markGiveawayEnded(giveaway.id, 'failed_no_guild');
            return;
        }

        const channel = await guild.channels.fetch(giveaway.channel_id).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            markGiveawayEnded(giveaway.id, 'failed_no_channel');
            return;
        }

        const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
        if (!message) {
            markGiveawayEnded(giveaway.id, 'failed_no_message');
            return;
        }

        let winnersArray = [];
        const winnerIds = giveaway.winner_ids;
        if (winnerIds) {
            try {
                const parsedIds = JSON.parse(winnerIds);
                if (Array.isArray(parsedIds) && parsedIds.length > 0) {
                    for (const uid of parsedIds) {
                        const user = await client.users.fetch(uid).catch(() => null);
                        winnersArray.push(user || {
                            id: uid,
                            username: uid,
                            toString: () => `<@${uid}>`,
                        });
                    }
                }
            } catch (err) {
                logger.error(`[GiveawayManager] 解析 winner_ids 失敗 (ID: ${giveaway.id}):`, err);
            }
        }

        if (winnersArray.length === 0) {
            // 獲取反應
            const reaction = message.reactions.cache.get('🎉');
            if (!reaction) {
                await announceNoParticipants(channel, giveaway);
                markGiveawayEnded(giveaway.id, 'completed_no_participants');
                return;
            }

            // Discord 每頁最多回傳 100 位反應使用者，必須完整分頁後再抽獎。
            const participants = await fetchReactionParticipants(reaction);

            if (participants.size === 0) {
                await announceNoParticipants(channel, giveaway);
                markGiveawayEnded(giveaway.id, 'completed_no_participants');
                return;
            }

            // 抽取贏家
            const winners = participants.random(Math.min(participants.size, giveaway.winners));
            winnersArray = Array.isArray(winners) ? winners : [winners];

            // 先持久化得主與待通知狀態，重啟後會沿用同一批得主。
            const winnerIdsStr = JSON.stringify(winnersArray.map(u => u.id));
            updateGiveawayState(giveaway.id, {
                ended: 0,
                status: 'drawn_pending_notify',
                winnerIds: winnerIdsStr,
            });
        }

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

        try {
            // 發送開獎結果
            await channel.send(embedsToV2Payload([resultEmbed], {
                allowedMentions: { parse: [], users: winnersArray.map((user) => user.id) },
            }));

            // 公開結果成功後才結案，避免重啟後漏發通知。
            markGiveawayEnded(giveaway.id, 'completed');

            // 舊公開訊息保留 Embed 更新方式；新發布訊息以 V2 結束卡重繪。
            if (isV2Message(message)) {
                const endedEmbed = new EmbedBuilder()
                    .setTitle('🐕🎉 抽獎活動 (已結束)')
                    .setDescription(`本次賞賜已揭曉：**${giveaway.prize}**\n得主：${winnerNameList}`)
                    .setColor(UI_COLORS.MUTED)
                    .setFooter({ text: '🐕 謝謝所有參與的子民！下次宴會也要來喔！' });
                const endedPayload = embedsToV2Payload([endedEmbed]);
                await message.edit({ components: endedPayload.components }).catch(() => {});
            } else if (message.embeds?.[0]) {
                const endedEmbed = EmbedBuilder.from(message.embeds[0])
                    .setTitle('🐕🎉 抽獎活動 (已結束)')
                    .setColor(UI_COLORS.MUTED)
                    .setThumbnail('attachment://stamp.png')
                    .setImage(null);
                await message.edit({ embeds: [endedEmbed] }).catch(() => {});
            }
        } catch (sendErr) {
            logger.error(`[GiveawayManager] 發送開獎結果或更新訊息失敗 (ID: ${giveaway.id}):`, sendErr);
            const attempts = (giveaway.attempts || 0) + 1;
            if (attempts >= 5) {
                markGiveawayEnded(giveaway.id, 'failed');
            } else {
                updateGiveawayState(giveaway.id, { ended: 0, status: 'drawn_pending_notify' });
            }
            updateGiveawayError(giveaway.id, sendErr.message);
        }

    } catch (err) {
        logger.error(`[GiveawayManager] 開獎失敗 (ID: ${giveaway.id}):`, err);
        const attempts = (giveaway.attempts || 0) + 1;
        if (attempts >= 5) {
            logger.error(`[GiveawayManager] 抽獎已達最大重試次數，標記為失敗 (ID: ${giveaway.id})`);
            markGiveawayEnded(giveaway.id, 'failed');
            updateGiveawayError(giveaway.id, err.message);
        } else {
            updateGiveawayError(giveaway.id, err.message);
        }
    }
}

async function fetchReactionParticipants(reaction) {
    const participants = new Collection();
    const seenCursors = new Set();
    let after;

    while (true) {
        const page = await reaction.users.fetch({
            limit: 100,
            ...(after ? { after } : {}),
        });

        // 保留既有測試／替代實作的單頁 collection 相容性。
        if (!page || typeof page.values !== 'function') {
            return page.filter(user => !user.bot);
        }

        for (const user of page.values()) {
            if (!user.bot) participants.set(user.id, user);
        }

        if (page.size < 100) return participants;

        const pageUsers = [...page.values()];
        const nextAfter = pageUsers.at(-1)?.id;
        if (!nextAfter || seenCursors.has(nextAfter)) {
            throw new Error('Reaction user pagination did not advance');
        }

        seenCursors.add(nextAfter);
        after = nextAfter;
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
