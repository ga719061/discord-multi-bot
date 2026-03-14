import { ActionRowBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getCharacter, getExpedition, startExpedition, claimExpedition, deleteExpedition } from '../rpgDatabase.js';
import { rpgEmbed, rpgButton, backButton, safeReply, isOwner, notOwnerReply } from '../rpgHelpers.js';
import { AREAS, getItemDisplayName } from '../data/gameData.js';
import { fmt, COLORS, ansiBar, ansiBlock } from '../../utils/style.js';

export async function renderExpedition(interaction, userId) {
    const guildId = interaction.guildId;
    const char = getCharacter(guildId, userId);
    if (!char) return safeReply(interaction, '🐕 請先建立角色！');

    const exp = getExpedition(guildId, userId);

    if (exp) {
        return renderActiveExpedition(interaction, char, exp);
    } else {
        return renderExpeditionSetup(interaction, char);
    }
}

async function renderActiveExpedition(interaction, char, exp) {
    const now = Date.now();
    const elapsedMs = now - exp.start_time;
    const plannedMs = exp.planned_duration;
    const isCompleted = elapsedMs >= plannedMs;
    
    const area = AREAS.find(a => a.id === exp.area_id) || { name: '未知區域', emoji: '❓' };
    const progress = Math.min(100, Math.floor((elapsedMs / plannedMs) * 100));
    
    const elapsedHours = Math.floor(elapsedMs / 3600000);
    const totalHours = Math.floor(plannedMs / 3600000);
    const remainingMins = Math.ceil((plannedMs - elapsedMs) / 60000);
    
    const header = ansiBlock([
        { color: COLORS.CYAN + ';' + COLORS.BOLD, text: ` 🛰️ 【 遠 征 監 控 指 令 表 】 🛰️ ` },
        { color: COLORS.GRAY, text: ` 正在掃描 ${area.name} 區域之量子活動... ` }
    ]);

    const statusContent = [
        `📍 任務地點: ${fmt(COLORS.WHITE, area.name)}`,
        `📊 探索進度: ${fmt(COLORS.CYAN, progress + '%')}`,
        `${ansiBar(elapsedMs, plannedMs, COLORS.CYAN, 20)}`,
        '',
        `⏰ 持續時長: ${fmt(COLORS.GOLD, elapsedHours)} / ${totalHours} ${fmt(COLORS.GRAY, '小時')}`,
        isCompleted 
            ? `${fmt(COLORS.GREEN + ';' + COLORS.BOLD, '✨ 任務完成！可以進行結算。')}` 
            : `⏳ 剩餘能量: ${fmt(COLORS.WHITE, remainingMins)} ${fmt(COLORS.GRAY, '分鐘')}`,
        '',
        `${fmt(COLORS.GRAY, '───────────────────')}`,
        `${fmt(COLORS.PURPLE, '🛡️  守護領地，直至最後一刻。')}`
    ].join('\n');

    const embed = rpgEmbed(
        `${area.emoji} 遠征傳報：${area.name}`,
        header + '\n' + '```ansi\n' + statusContent + '\n```'
    );

    const rows = [
        new ActionRowBuilder().addComponents(
             rpgButton(`rpg_exp_claim_${char.user_id}`, '領取獎獎勵', ButtonStyle.Success, '🎁', elapsedHours < 1),
             rpgButton(`rpg_exp_stop_${char.user_id}`, '停止並結算', ButtonStyle.Danger, '🛑', isCompleted)
        ),
        backButton()
    ];

    return safeReply(interaction, { embeds: [embed], components: rows });
}

async function renderExpeditionSetup(interaction, char) {
    const setupHeader = ansiBlock([
        { color: COLORS.GOLD + ';' + COLORS.BOLD, text: ` ⚔️ 【 遠 征 派 遣 營 地 】 ⚔️ ` },
        { color: COLORS.CYAN, text: ` 選定你的英雄前往未知疆域，獲取資源。 ` }
    ]);

    const descContent = [
        `⚠️ ${fmt(COLORS.RED, '掛機期間無法進行主動戰鬥。')}`,
        `⌛ ${fmt(COLORS.WHITE, '按「小時」結算，不滿一小時無收益。')}`,
        `📈 ${fmt(COLORS.GREEN, '每一小時額外獲得 2% 效率補正。')}`,
        '',
        `${fmt(COLORS.GRAY, '請選擇欲前往的區域並決定派遣時長：')}`
    ].join('\n');

    const embed = rpgEmbed(
        '⚔️ 遠征派遣中心',
        setupHeader + '\n' + '```ansi\n' + descContent + '\n```'
    );

    // 區域選擇 (分頁顯示)
    const availableAreas = AREAS.filter(a => char.level >= a.levelReq);
    
    // 這裡我們簡化處理，直接顯示區域與時長的組合按鈕
    // 或者先選區域，再選時長。為了 UI 簡潔，我們用兩排：一排選區，一排選時長
    
    // 儲存目前選擇的區域 (模擬狀態，通常在 CustomId 中傳遞)
    // 為了開發速度，我們直接提供一個組合選單或預設值
    
    const rows = [];
    
    // 區域選擇按鈕 (前 4 個可到達的最高級區域)
    const areaRow = new ActionRowBuilder();
    availableAreas.slice(-4).forEach(a => {
        areaRow.addComponents(rpgButton(`rpg_exp_sel_area_${a.id}_${char.user_id}`, a.name, ButtonStyle.Primary, a.emoji));
    });
    rows.push(areaRow);

    rows.push(backButton());

    return safeReply(interaction, { embeds: [embed], components: rows });
}

// 選擇時長畫面
export async function renderDurationSetup(interaction, userId, areaId) {
    const area = AREAS.find(a => a.id === areaId);
    const embed = rpgEmbed(
        `${area.emoji} 準備前往：${area.name}`,
        `請選擇遠征派遣的時長：\n時長越久，獲得的連鎖加成越高！`
    );

    const durations = [
        { label: '1 小時', value: 1, ms: 3600000 },
        { label: '4 小時', value: 4, ms: 14400000 },
        { label: '8 小時', value: 8, ms: 28800000 },
        { label: '12 小時', value: 12, ms: 43200000 },
        { label: '24 小時', value: 24, ms: 86400000 }
    ];

    const row = new ActionRowBuilder();
    durations.forEach(d => {
        row.addComponents(rpgButton(`rpg_exp_start_${areaId}_${d.ms}_${userId}`, d.label, ButtonStyle.Secondary, '⏲️'));
    });

    const backRow = new ActionRowBuilder().addComponents(
        rpgButton(`rpg_exp_back_${userId}`, '返回選擇區域', ButtonStyle.Secondary, '🔙')
    );

    return safeReply(interaction, { embeds: [embed], components: [row, backRow] });
}

export async function handleExpeditionInteractions(interaction) {
    const id = interaction.customId;
    const parts = id.split('_');
    const action = parts[2]; // exp_ACTION_...
    const userId = parts[parts.length - 1];

    if (!isOwner(interaction, userId)) return notOwnerReply(interaction);

    if (id.startsWith('rpg_exp_sel_area_')) {
        const areaId = id.replace('rpg_exp_sel_area_', '').replace(`_${userId}`, '');
        return renderDurationSetup(interaction, userId, areaId);
    }

    if (id.startsWith('rpg_exp_start_')) {
        // ID 格式: rpg_exp_start_AREAID_DURATIONMS_USERID
        const remaining = id.replace('rpg_exp_start_', '');
        const segments = remaining.split('_');
        const userIdFromId = segments.pop();
        const durationMs = parseInt(segments.pop());
        const areaId = segments.join('_');
        
        startExpedition(interaction.guildId, userId, areaId, durationMs);
        return renderExpedition(interaction, userId);
    }

    if (id.startsWith('rpg_exp_claim_') || id.startsWith('rpg_exp_stop_')) {
        const reward = claimExpedition(interaction.guildId, userId);
        
        if (!reward) {
            // 如果提前停止且不夠一小時
            if (id.includes('_stop_')) {
                deleteExpedition(interaction.guildId, userId);
                return renderExpedition(interaction, userId);
            }
            return safeReply(interaction, { content: '🐕 遠征時間不足 1 小時，無法領取收益！提前停止將損失進度。', flags: ['Ephemeral'] });
        }

        if (reward.levelsGained > 0) {
            const oldLevel = reward.newLevel - reward.levelsGained;
            for (let l = oldLevel + 1; l <= reward.newLevel; l++) {
                if ([30, 60, 90, 99].includes(l)) {
                    const { broadcastRpgEvent, getJobTitle } = await import('../rpgHelpers.js');
                    const newTitle = getJobTitle({ class: char.class, level: l });
                    const vName = interaction.member?.displayName || interaction.user.username;
                    await broadcastRpgEvent(interaction.client, interaction.guildId, {
                        title: '位階突破！',
                        description: `太驚人了！冒險者 ${fmt(COLORS.BLUE, vName)} 在遠征歸來後\n晉升為 ${fmt(COLORS.GOLD, newTitle)}！\n達到了 ${fmt(COLORS.GREEN, 'Lv.' + l)} 的全新境界！`,
                        color: l >= 60 ? 0xFFAA00 : 0x00FF00,
                        type: 'milestone'
                    });
                }
            }
        }

        // 處理極品掉落廣播
        if (reward.drops?.length > 0) {
            for (const d of reward.drops) {
                if (['epic', 'mythic', 'legendary'].includes(d.quality)) {
                    const { broadcastRpgEvent } = await import('../rpgHelpers.js');
                    const vName = interaction.member?.displayName || interaction.user.username;
                    const qColor = d.quality === 'epic' ? 0x9b59b6 : d.quality === 'mythic' ? 0xe74c3c : 0xe67e22;
                    const qEmoji = d.quality === 'epic' ? '🟣' : d.quality === 'mythic' ? '🔴' : '🟠';
                    const qLabel = d.quality === 'epic' ? '史詩' : d.quality === 'mythic' ? '神話' : '傳說';
                    const typeLabel = d.isBook ? '技能書' : '裝備';

                    await broadcastRpgEvent(interaction.client, interaction.guildId, {
                        title: '遠征奇蹟！極品現世',
                        description: `冒險者 ${fmt(COLORS.BLUE, vName)} 在長時間遠征歸來後\n帶回了 ${qEmoji} ${fmt(COLORS.WHITE, qLabel + typeLabel)}：\n「${fmt(COLORS.WHITE, getItemDisplayName(d.id))}」！`,
                        color: qColor,
                        type: 'rare_drop'
                    });
                }
            }
        }

        const dropMsg = reward.drops.length > 0 ? reward.drops.map(d => `${getItemDisplayName(d.id)} x${d.qty}`).join('\n') : '無額外掉落';
        const levelUpMsg = reward.levelsGained > 0 ? `\n🎉 **升級！** Lv.${reward.newLevel - reward.levelsGained} → Lv.${reward.newLevel} (+${reward.levelsGained * 5} 自由點數)` : '';
        const embed = rpgEmbed(
            '🎊 遠征大成功！',
            `本次遠征共持續了 **${reward.hours}** 小時。\n\n` +
            `💰 獲得金幣：**${reward.gold}**\n` +
            `✨ 獲得經驗：**${reward.xp}**${levelUpMsg}\n` +
            `📦 獲得道具：\n${dropMsg}`
        );

        return safeReply(interaction, { embeds: [embed], components: [backButton()] });
    }

    if (id === `rpg_exp_back_${userId}`) {
        return renderExpedition(interaction, userId);
    }
}
