import { getCharacter, getEquipmentList } from '../rpgDatabase.js';
import { rpgEmbed, charSummary, hpBar, mpBar, xpBar, hpBarBare, mpBarBare, mainMenuRows, ansiText, calculateTotalStats, getStatusFields, safeReply } from '../rpgHelpers.js';
import { getXpForLevel, MAIN_QUESTS } from '../data/gameData.js';

export async function showHub(interaction, char, method = 'update') {
    if (method === 'update' && !interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);
    const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
    const total = calculateTotalStats(char, eqList);
    const xpNeeded = getXpForLevel(char.level + 1);

    const currentQuest = MAIN_QUESTS.find(q => q.id === char.quest_id) || MAIN_QUESTS[0];
    const questText = currentQuest ? currentQuest.name : '冒險的開端';

    const embed = rpgEmbed(
        '🐕👑 吉吉王國騎士團總部',
        [
            '```ansi\n' + ansiText('2;36', `願聖光指引你的道路。騎士 ${interaction.user.displayName}，吉吉三世正注視著你的英姿。`) + '\n```',
            '**📊【個人當前狀態】**',
            '```ansi\n' + [
                charSummary(char),
                hpBarBare(char.hp, total.max_hp),
                mpBarBare(char.mp, total.max_mp)
            ].join('\n') + '\n```',
            '',
            `📜 **當前主線**: ${questText}`,
        ].join('\n'),
    )
        .addFields(getStatusFields(char, total, { showResources: true, showCombat: true, xpNeeded }))
        .setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

    let payload = { embeds: [embed], components: mainMenuRows() };
    if (method === 'reply') payload.ephemeral = true;

    await safeReply(interaction, payload);
}
