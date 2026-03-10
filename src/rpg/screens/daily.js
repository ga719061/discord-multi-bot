import { getCharacter, updateCharacter, addGold, addGems, getEquipmentList } from '../rpgDatabase.js';
import { rpgEmbed, backButton, broadcastRpgEvent, ansiText, safeReply, calculateTotalStats } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';

export async function showDaily(interaction, char) {
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);

    const today = new Date().toISOString().split('T')[0];

    if (char.last_daily_claim === today) {
        const embed = rpgEmbed(
            '🎁 每日簽到',
            '```ansi\n' + [
                ansiText('2;33', '勤奮的勇者啊，王國永遠為你敞開大門！'),
                '🐕 你今天已經簽到過了！',
                '',
                `🔥 連續簽到: **${char.daily_streak}** 天`,
                '',
                '明天再來吧！汪！',
            ].join('\n') + '\n```',
        ).setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });
        return safeReply(interaction, { embeds: [embed], components: [backButton()] });
    }

    // 計算連續簽到
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const streak = char.last_daily_claim === yesterday ? char.daily_streak + 1 : 1;

    // 計算獎勵
    let goldReward = 100;
    let gemReward = 0;
    let bonusText = '';
    let announcement = null;

    if (streak % 30 === 0) {
        goldReward = 2000; gemReward = 5;
        bonusText = '🎊 **月度獎勵！**';
        announcement = {
            title: '🏆 傳奇之光',
            description: `不可思議！騎士 ${fmt(COLORS.BLUE, interaction.member.displayName)} 已經\n${fmt(COLORS.GOLD, '連續 30 天')} 不間斷地向吉吉國王致意。\n真是王國的楷模。`,
            color: 0x00FFFF,
            type: 'milestone'
        };
    } else if (streak % 7 === 0) {
        goldReward = 500; gemReward = 1;
        bonusText = '🎉 **週獎勵！**';
        announcement = {
            title: '🌟 王國榮耀',
            description: `值得嘉許！騎士 ${fmt(COLORS.BLUE, interaction.member.displayName)} 達成了\n${fmt(COLORS.GREEN, '連續登入 7 天')} 的成就。`,
            color: 0x00FF00,
            type: 'milestone'
        };
    }

    if (streak === 100 || streak === 365) {
        // 百日與週年特別成就
        announcement = {
            title: '🌌 永恆之巔',
            description: `${fmt(COLORS.GOLD, '傳奇誕生！')} 騎士 ${fmt(COLORS.BLUE, interaction.member.displayName)} 達成了\n前所未見的 ${fmt(COLORS.MAGENTA, '連續 ' + streak + ' 天')} 登入不中斷。\n王國因為你而出更加繁榮！`,
            color: 0xFF00FF,
            type: 'milestone'
        };
    }

    if (announcement) {
        await broadcastRpgEvent(interaction.client, interaction.guildId, announcement);
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
        '🎁 簽到獎勵',
        '```ansi\n' + [
            fmt(COLORS.CYAN, ` 願聖光常駐。閣下的勤勉深受王國肯定。 `),
            '',
            `${fmt(COLORS.WHITE, '💰 獲得金幣:')} ${fmt(COLORS.GOLD + ';' + COLORS.BOLD, goldReward.toLocaleString())}`,
            gemReward > 0 ? `${fmt(COLORS.WHITE, '💎 獲得寶石:')} ${fmt(COLORS.CYAN + ';' + COLORS.BOLD, gemReward.toLocaleString())}` : '',
            `${fmt(COLORS.WHITE, '❤️ HP 回復:')} ${fmt(COLORS.GREEN + ';' + COLORS.BOLD, hpHeal.toLocaleString())}`,
            `${fmt(COLORS.WHITE, '💙 MP 回復:')} ${fmt(COLORS.BLUE + ';' + COLORS.BOLD, mpHeal.toLocaleString())}`,
            '',
            fmt(COLORS.GRAY, '🛡️ 持續致意，將獲得更高的獎賞。'),
        ].filter(Boolean).join('\n') + '\n```',
        0xF1C40F
    ).setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

    await safeReply(interaction, { embeds: [embed], components: [backButton()] });
}
