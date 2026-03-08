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

    // 找目前主線任務名
    const quest = MAIN_QUESTS.find(q => q.id === char.current_quest);
    const questText = quest ? `📜主線任務: ${quest.name}` : '📜 主線已通關！';

    const embed = rpgEmbed(
        '🐕👑 吉吉王國冒險者公會',
        [
            ansiText('2;36', `歡迎回到公會大廳！勇者 ${interaction.user.displayName}，本王在此為你祈福～`),
            '**📊【勇者當前狀態】**',
            '```ansi\n' + [
                charSummary(char),
                hpBarBare(char.hp, total.max_hp),
                mpBarBare(char.mp, total.max_mp)
            ].join('\n') + '\n```',
            '',
            `📜 **當前主線**: ${questText.replace('📜主線任務: ', '')}`,
        ].join('\n'),
    )
        .addFields(getStatusFields(char, total, { showResources: true, showCombat: true, xpNeeded }))
        .setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });

    let payload = { embeds: [embed], components: mainMenuRows() };
    if (method === 'reply') payload.ephemeral = true;

    await safeReply(interaction, payload);
}
