import { getCharacter, updateCharacter, addGold, addGems, getEquipmentList } from '../rpgDatabase.js';
import { rpgEmbed, backButton, broadcastRpgEvent, ansiText, safeReply, calculateTotalStats } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';

export async function showDaily(interaction, char) {
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);

    const today = new Date().toISOString().split('T')[0];

    if (char.last_daily_claim === today) {
        const embed = rpgEmbed(
            '🎁 每日簽到',
            [
                ansiText('2;33', '勤奮的勇者啊，王國永遠為你敞開大門！'),
                '🐕 你今天已經簽到過了！',
                '',
                `🔥 連續簽到: **${char.daily_streak}** 天`,
                '',
                '明天再來吧！汪！',
            ].join('\n'),
        ).setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });
        return safeReply(interaction, { embeds: [embed], components: [backButton()] });
    }

    // 計算連續簽到
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const streak = char.last_daily_claim === yesterday ? char.daily_streak + 1 : 1;

    // 計算獎勵
    let goldReward = 100;
    let gemReward = 0;
    let bonusText = '';

    if (streak % 30 === 0) {
        goldReward = 2000; gemReward = 5;
        bonusText = '🎊 **月度獎勵！**';
        await broadcastRpgEvent(interaction.client, interaction.guildId, {
            title: '持之以恆：滿月慶典',
            description: `不可思議！冒險者 ${fmt(COLORS.BLUE, interaction.member.displayName)} 已經\n${fmt(COLORS.GOLD, '連續 30 天')} 不間斷地向吉吉國王請安了！\n真是王國的楷模！`,
            color: 0x00FFFF
        });
    } else if (streak % 7 === 0) {
        goldReward = 500; gemReward = 1;
        bonusText = '🎉 **週獎勵！**';
        await broadcastRpgEvent(interaction.client, interaction.guildId, {
            title: '持之以恆：週滿勤',
            description: `值得嘉許！冒險者 ${fmt(COLORS.BLUE, interaction.member.displayName)} 達成了\n${fmt(COLORS.GREEN, '連續登入 7 天')} 的成就！`,
            color: 0x00FF00
        });
    } else if (streak === 100 || streak === 365) {
        // 百日與週年特別成就
        await broadcastRpgEvent(interaction.client, interaction.guildId, {
            title: '傳奇忠誠',
            description: `${fmt(COLORS.GOLD, '傳奇誕生！')} 冒險者 ${fmt(COLORS.BLUE, interaction.member.displayName)} 達成了\n前所未見的 ${fmt(COLORS.MAGENTA, '連續 ' + streak + ' 天')} 登入不中斷！\n王國因為你而更加繁榮！`,
            color: 0xFF00FF
        });
    }

    // 回復 HP/MP
    const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
    const total = calculateTotalStats(char, eqList);
    const hpHeal = Math.floor(total.max_hp * 0.3);
    const mpHeal = Math.floor(total.max_mp * 0.3);

    addGold(interaction.guildId, interaction.user.id, goldReward);
    if (gemReward > 0) addGems(interaction.guildId, interaction.user.id, gemReward);
    updateCharacter(interaction.guildId, interaction.user.id, {
        last_daily_claim: today,
        daily_streak: streak,
        hp: Math.min(total.max_hp, char.hp + hpHeal),
        mp: Math.min(total.max_mp, char.mp + mpHeal),
    });

    const embed = rpgEmbed(
        '🎁 每日簽到成功！',
        '```ansi\n' + [
            fmt(COLORS.CYAN, '恭喜！領取了國王的賞賜，祝你今天冒險順利！'),
            bonusText ? fmt(COLORS.GOLD + ';' + COLORS.BOLD, bonusText) : '',
            `${fmt(COLORS.GOLD, '🔥 連續簽到:')} ${fmt(COLORS.WHITE + ';' + COLORS.BOLD, streak.toString())} 天`,
            '',
            `${fmt(COLORS.WHITE, '💰 金幣')} ${fmt(COLORS.GOLD, `+${goldReward}`)}`,
            gemReward > 0 ? `${fmt(COLORS.WHITE, '💎 寶石')} ${fmt(COLORS.CYAN, `+${gemReward}`)}` : '',
            `${fmt(COLORS.WHITE, '❤️ HP 回復')} ${fmt(COLORS.GREEN, `+${hpHeal}`)}`,
            `${fmt(COLORS.WHITE, '💙 MP 回復')} ${fmt(COLORS.BLUE, `+${mpHeal}`)}`,
            '',
            fmt(COLORS.GRAY, '🐕 明天也要來找本王簽到喔！汪！'),
        ].filter(Boolean).join('\n') + '\n```',
        0xF1C40F // Gold for daily
    ).setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });

    await safeReply(interaction, { embeds: [embed], components: [backButton()] });
}
