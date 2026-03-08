import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { rpgEmbed, rpgButton, backButton, qualityLabel, ansiText } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';
import { getCharacter, getAvailableMercenaries, getPersonalMercenaryHistory } from '../rpgDatabase.js';

// 記憶體中暫存玩家目前的傭兵組合
// Map<userId, Array<mercenaryUserId>>
export const activeMercenaries = new Map();

/**
 * 傭兵公會主畫面
 */
export async function showMercenaryHub(interaction, char = null) {
    await interaction.deferUpdate().catch(() => { });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    if (!char) char = getCharacter(guildId, userId);

    let hired = activeMercenaries.get(userId) || [];

    // 過濾掉無效的傭兵 (離開伺服器或關閉助戰)
    const validHired = [];
    for (const mId of hired) {
        const mChar = getCharacter(guildId, mId);
        if (mChar && mChar.allow_mercenary === 1) {
            validHired.push(mId);
        }
    }
    if (hired.length !== validHired.length) {
        activeMercenaries.set(userId, validHired);
        hired = validHired;
    }

    // 批量抓取成員資訊以提升效能
    const hiredInfos = await Promise.all(hired.map(async (mId) => {
        const mChar = getCharacter(guildId, mId);
        const member = await interaction.guild.members.fetch(mId).catch(() => null);
        const name = member ? member.displayName : mId;
        return `> ⚔️ Lv ${mChar.level} ${name}`;
    }));

    const embed = rpgEmbed(
        '🛡️ 吉吉傭兵公會',
        '```ansi\n' + [
            fmt(COLORS.CYAN, '歡迎來到傭兵公會！在此締結無畏的契約，尋找最可靠的戰友！'),
            '',
            fmt(COLORS.WHITE, '你可以僱用其他冒險者作為傭兵。他們會在戰鬥中由系統 AI 操控提供支援。'),
            '',
            fmt(COLORS.YELLOW + ';' + COLORS.BOLD, '【你目前的傭兵小隊】 (最多 3 人)'),
            hiredInfos.length > 0 ? hiredInfos.join('\n') : fmt(COLORS.GRAY, '> 尚無傭兵，快去招募吧！'),
            '',
            fmt(COLORS.GRAY, '💡 出發去冒險時，這些傭兵就會自動跟著你上陣囉！')
        ].join('\n') + '\n```',
        0x3498DB // Blue
    ).setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${userId}` });

    const row = new ActionRowBuilder().addComponents(
        rpgButton('rpg_merc_hire', '🔍 尋找傭兵', 1, '🔍', hired.length >= 3),
        rpgButton('rpg_merc_clear', '🗑️ 解散隊伍', 4, '👋', hired.length === 0),
        rpgButton('rpg_merc_history', '📜 助戰紀錄', 2, '📜')
    );

    const backRow = backButton();

    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.update({ embeds: [embed], components: [row, backRow] });
        } else {
            await interaction.editReply({ embeds: [embed], components: [row, backRow] });
        }
    } catch (e) { }
}

/**
 * 顯示可招募的傭兵列表 (Select Menu)
 */
export async function showHireMenu(interaction) {
    await interaction.deferUpdate().catch(() => { });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    // 取出等級相近的玩家 (例如玩家等級 -50)
    const char = getCharacter(guildId, userId);
    const minLevel = Math.max(1, char.level - 50);

    const available = getAvailableMercenaries(guildId, minLevel, userId, 25);
    const hired = activeMercenaries.get(userId) || [];

    // 過濾掉已經雇用的
    const candidates = available.filter(c => !hired.includes(c.user_id));

    if (candidates.length === 0) {
        return interaction.editReply({ content: '🐕 汪嗚...目前沒有合適且開放助戰的傭兵可以招募！', components: [] });
    }

    const options = await Promise.all(candidates.map(async (c) => {
        const member = await interaction.guild.members.fetch(c.user_id).catch(() => null);
        const name = member ? member.displayName : c.user_id;
        return {
            label: `Lv ${c.level} | ${name}`,
            description: `戰鬥力: ${c.str * 2 + c.int * 2} | 總出勤: ${c.mercenary_count || 0}回`,
            value: c.user_id,
            emoji: '🦸'
        };
    }));

    const select = new StringSelectMenuBuilder()
        .setCustomId('rpg_merc_hire_select')
        .setPlaceholder('請選擇要招募的傭兵')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    const navRow = backButton(); // Reuse back button component

    const embed = rpgEmbed(
        '🦸 招募傭兵',
        '請選擇你想招募的勇者加入你的冒險小隊：\n*(系統僅顯示等級相近且願意參加助戰的玩家)*',
        0x3498DB
    );

    return interaction.editReply({
        embeds: [embed],
        components: [row, navRow]
    });
}

/**
 * 處理傭兵選擇
 */
export async function handleHireSelect(interaction) {
    const userId = interaction.user.id;
    const hiredId = interaction.values[0];

    let hired = activeMercenaries.get(userId) || [];
    if (hired.length >= 3) {
        return interaction.reply({ content: '🐕 你的隊伍已經滿了 (最多 3 人)！', flags: ['Ephemeral'] });
    }

    if (!hired.includes(hiredId)) {
        hired.push(hiredId);
        activeMercenaries.set(userId, hired);
    }

    // 重新載入主畫面
    return showMercenaryHub(interaction);
}

/**
 * 檢視個人助戰紀錄
 */
export async function showMercenaryHistory(interaction) {
    await interaction.deferUpdate().catch(() => { });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const history = getPersonalMercenaryHistory(guildId, userId, 20);

    if (history.length === 0) {
        const emptyEmbed = rpgEmbed('📜 我的助戰紀錄', '你目前沒有任何出勤的助戰紀錄！開啟助戰功能讓別人僱用你賺取獎勵吧！').setFooter({ text: `uid:${userId}` });
        const row = new ActionRowBuilder().addComponents(rpgButton('rpg_merc_hub', '返回傭兵公會', 2, '🔙'));
        return interaction.editReply({ embeds: [emptyEmbed], components: [row] });
    }

    const lines = [];

    const userIdsToFetch = [...new Set(history.map(h => h.employer_id))];
    const userNamesCache = {};
    await Promise.all(userIdsToFetch.map(async id => {
        const member = await interaction.guild.members.fetch(id).catch(() => null);
        userNamesCache[id] = member?.displayName || id;
    }));

    for (const h of history) {
        const timeStr = new Date(h.fought_at * 1).toLocaleString('zh-TW', { hour12: false, month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        const employerName = widePad(userNamesCache[h.employer_id], 12);

        lines.push(`${fmt(COLORS.GRAY, timeStr)} 協助 ${fmt(COLORS.CYAN, employerName)} 擊敗 ${fmt(COLORS.RED, h.monster_name)}`);
        lines.push(`  ↳ 獲得 ${fmt(COLORS.GOLD, `💰${h.reward_gold} G`)} XP ${fmt(COLORS.GREEN, `⭐${h.reward_xp}`)}`);
        lines.push('');
    }

    const embed = rpgEmbed(
        '📜 我的助戰紀錄 (最近 20 筆)',
        '```ansi\n' + lines.join('\n') + '\n```',
        0x1ABC9C // Turquoise
    ).setFooter({ text: `uid:${userId}` });

    const navRow = new ActionRowBuilder().addComponents(rpgButton('rpg_merc_hub', '返回傭兵公會', 2, '🔙'));

    await interaction.editReply({ embeds: [embed], components: [navRow] });
}

/**
 * 處理傭兵公會內的各種按鈕點擊
 */
export async function handleMercenaryAction(interaction) {
    const id = interaction.customId;

    if (id === 'rpg_merc_hub') {
        return showMercenaryHub(interaction);
    }
    if (id === 'rpg_merc_hire') {
        return showHireMenu(interaction);
    }
    if (id === 'rpg_merc_clear') {
        activeMercenaries.delete(interaction.user.id);
        return showMercenaryHub(interaction);
    }
    if (id === 'rpg_merc_history') {
        return showMercenaryHistory(interaction);
    }
}
