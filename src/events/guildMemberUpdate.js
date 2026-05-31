import { EmbedBuilder } from 'discord.js';
import { embedsToV2Payload } from '../utils/componentsV2.js';
import { UI_COLORS } from '../utils/style.js';

export function register(client) {
    // === 方案一：偵測系統訊息 (每次 boost 都會觸發，包含重複加成) ===
    client.on('messageCreate', async (message) => {
        // 8 = GuildBoost, 9/10/11 = GuildBoostTier1/2/3
        if (![8, 9, 10, 11].includes(message.type)) return;

        const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
        if (!member) return;

        const channel = message.channel;

        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.BOOST)
            .setTitle('🚀 皇家贊助者降臨！')
            .setDescription(`🐕👑 汪汪！全體廷臣肅靜！\n\n本王看見了 **${member}** 對王國的偉大貢獻！\n你竟然使用了珍貴的 **Server Boost** 來強化我們的領地！\n\n為了表揚你的無私奉獻，本王特別賜予你 **「皇家贊助者」** 的標記！\n🎉 **從現在起，你在本王領地內的每次發言，都將獲得 1.5 倍的經驗值加成！**\n這就是國王的恩賜！汪！`)
            .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
            .setFooter({ text: '🐕 感謝你支持吉吉國王的統治！' });

        await channel.send(embedsToV2Payload([embed], {
            allowedMentions: { parse: [], users: [member.id] },
        })).catch(() => { });
    });
}
