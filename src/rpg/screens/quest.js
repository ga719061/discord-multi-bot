import { getCharacter, getQuestProgress } from '../rpgDatabase.js';
import { rpgEmbed, backButton, ansiText, safeReply, widePad } from '../rpgHelpers.js';
import { MAIN_QUESTS, DAILY_QUEST_POOL } from '../data/gameData.js';
import { fmt, COLORS } from '../../utils/style.js';

export async function showQuest(interaction, char) {
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);

    const currentQuest = MAIN_QUESTS.find(q => q.id === char.current_quest);
    let mainLines = [];
    if (currentQuest) {
        const progress = getQuestProgress(interaction.guildId, interaction.user.id, currentQuest.id);
        
        mainLines = [
            fmt(COLORS.WHITE + ';' + COLORS.BOLD, `${currentQuest.chapter}: ${currentQuest.name}`),
            ...currentQuest.objectives.map(obj => {
                const key = obj.monsterId ? `${obj.type}_${obj.monsterId}`
                    : obj.bossId ? `${obj.type}_${obj.bossId}`
                        : obj.areaId ? `${obj.type}_${obj.areaId}`
                            : obj.type;
                const done = progress.progress[key] || 0;
                const complete = done >= obj.count;
                const statusIcon = complete ? '✅' : '⬜';
                const descText = widePad(obj.desc, 24);
                const countText = `(${Math.min(done, obj.count)}/${obj.count})`;
                return `${statusIcon} ${descText} ${countText}`;
            }),
            '',
            `獎勵: ${fmt(COLORS.GOLD, `💰${currentQuest.rewards.gold}`)} ${currentQuest.rewards.gems ? fmt(COLORS.CYAN, `💎${currentQuest.rewards.gems}`) : ''} ${fmt(COLORS.GREEN, `⭐${currentQuest.rewards.xp} XP`)}`,
        ];
    } else {
        mainLines = [fmt(COLORS.GREEN, '🎉 恭喜！所有主線任務已通關！')];
    }

    const embed = rpgEmbed(
        '📜 任務面板',
        '```ansi\n' + [
            fmt(COLORS.CYAN, '在此檢視你的成名之路，每一份懸賞都是實力的證明！'),
            '',
            fmt(COLORS.GOLD + ';' + COLORS.BOLD, '📖【主線任務】'),
            ...mainLines,
            '',
            fmt(COLORS.GRAY, '📋【每日任務】'),
            fmt(COLORS.GRAY, '> （每日任務系統籌備中...）'),
        ].join('\n') + '\n```',
        0xE67E22 // Orange for quests
    ).setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });

    await safeReply(interaction, { embeds: [embed], components: [backButton()] });
}
