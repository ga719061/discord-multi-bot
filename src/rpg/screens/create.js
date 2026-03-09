// ===== 角色建立畫面 =====
import { ActionRowBuilder } from 'discord.js';
import { RACES, CLASSES, calculateInitialStats } from '../data/gameData.js';
import { createCharacter, getCharacter, addEquipment, updateCharacter, learnSkill, getEquipmentList } from '../rpgDatabase.js';
import { rpgEmbed, rpgButton, charSummary, getActualStats, calculateTotalStats, safeReply, widePad } from '../rpgHelpers.js';
import { showHub } from './hub.js';
import { fmt, COLORS } from '../../utils/style.js';

export async function showCreate(interaction, method = 'reply') {
    const embed = rpgEmbed(
        '🏮 吉吉王國騎士登記處',
        '```ansi\n' + [
            fmt(COLORS.CYAN, '騎士，歡迎踏入吉吉王國的疆土。本王需在此登記你的誓約身份。'),
            '',
            fmt(COLORS.YELLOW + ';' + COLORS.BOLD, '📋 第一步：選擇你的種族'),
            '',
            ...Object.values(RACES).map(r => `${r.emoji} ${fmt(COLORS.WHITE, widePad(r.name, 8))} ${fmt(COLORS.GRAY, r.desc)}`),
        ].join('\n') + '\n```',
    ).setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

    const row = new ActionRowBuilder().addComponents(
        ...Object.values(RACES).map(r =>
            rpgButton(`rpg_create_race_${r.id}`, r.name, undefined, r.emoji)
        ),
    );

    let payload = { embeds: [embed], components: [row] };
    if (method === 'reply') payload.ephemeral = true;

    await safeReply(interaction, payload);
}

export async function handleCreate(interaction) {
    const id = interaction.customId;

    // 進入建立角色流程 (被 rpg_menu 觸發且無角色時)
    if (id === 'rpg_menu' && !getCharacter(interaction.guildId, interaction.user.id)) {
        return showCreate(interaction, 'update');
    }

    // 選擇種族
    if (id.startsWith('rpg_create_race_')) {
        const raceId = id.replace('rpg_create_race_', '');
        const race = RACES[raceId];
        if (!race) return;

        const embed = rpgEmbed(
            '🏮 吉吉王國騎士登記處',
            '```ansi\n' + [
                `${fmt(COLORS.WHITE, '已選種族：')}${race.emoji} ${fmt(COLORS.CYAN, race.name)}`,
                '',
                fmt(COLORS.YELLOW + ';' + COLORS.BOLD, '📋 第二步：選擇你的戰鬥天命 (職業)'),
                '',
                ...Object.values(CLASSES).map(c => `${c.emoji} ${fmt(COLORS.WHITE, widePad(c.name, 8))} ${fmt(COLORS.GRAY, c.desc)}`),
            ].join('\n') + '\n```',
        ).setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

        const row = new ActionRowBuilder().addComponents(
            ...Object.values(CLASSES).map(c =>
                rpgButton(`rpg_create_class_${raceId}:${c.id}`, c.name, undefined, c.emoji)
            ),
        );

        await safeReply(interaction, { embeds: [embed], components: [row] });
    }

    // 選擇職業 → 完成建角
    if (id.startsWith('rpg_create_class_')) {
        const payload = id.replace('rpg_create_class_', '');
        // 使用冒號分割，避免種族或職業 ID 內含底線造成的解析錯誤
        const [raceId, classId] = payload.split(':');
        const race = RACES[raceId];
        const cls = CLASSES[classId];
        if (!race || !cls) return;

        // 防止重複建角
        if (getCharacter(interaction.guildId, interaction.user.id)) {
            const char = getCharacter(interaction.guildId, interaction.user.id);
            return showHub(interaction, char, 'update');
        }

        const stats = calculateInitialStats(raceId, classId);
        const char = createCharacter(interaction.guildId, interaction.user.id, {
            race: raceId, class: classId, ...stats,
        });

        // 給起始武器，不再手動疊加數值到 DB
        const weaponId = cls.weapon;
        const eqId = addEquipment(interaction.guildId, interaction.user.id, weaponId, 'common');
        updateCharacter(interaction.guildId, interaction.user.id, { main_hand_id: eqId });

        // 給予初始技能
        if (cls.initialSkill) {
            learnSkill(interaction.guildId, interaction.user.id, cls.initialSkill);
        }

        // 追蹤任務進度：建立角色
        const { trackQuestProgress } = await import('../engine/questEngine.js');
        trackQuestProgress(interaction.guildId, interaction.user.id, 'create_character');

        // 顯示主選單前，確保血魔是滿的 (因為裝備可能會增加 MaxHP/MP)
        const freshChar = getCharacter(interaction.guildId, interaction.user.id);
        const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
        const total = calculateTotalStats(freshChar, eqList);

        updateCharacter(interaction.guildId, interaction.user.id, {
            hp: total.max_hp,
            mp: total.max_mp
        });

        const finalChar = getCharacter(interaction.guildId, interaction.user.id);
        await showHub(interaction, finalChar, 'update');
    }
}
