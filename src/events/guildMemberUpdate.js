import { EmbedBuilder } from 'discord.js';

export function register(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        // 檢查是否剛剛開始加成伺服器 (Server Boost)
        const oldStatus = oldMember.premiumSince;
        const newStatus = newMember.premiumSince;

        // 如果 newStatus 存在，且與舊狀態不同 (或者 oldMember 是 partial 而導致 oldStatus 為空)
        // 我們進一步檢查這個加成是不是最近 5 分鐘內發生的，避免因為快取重建導致重複公告
        if (!oldStatus && newStatus) {
            const isRecentBoost = (Date.now() - newMember.premiumSinceTimestamp) < 5 * 60 * 1000;
            if (!isRecentBoost) return;
            const guild = newMember.guild;
            // 嘗試尋找系統頻道或第一個能發言的文字頻道
            const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'));

            if (!channel) return;

            const embed = new EmbedBuilder()
                .setColor(0xF47FFF) // Nitro Boost 粉紫色
                .setTitle('🚀 皇家贊助者降臨！')
                .setDescription(`🐕👑 汪汪！全體廷臣肅靜！\n\n本王看見了 **${newMember}** 對王國的偉大貢獻！\n你竟然使用了珍貴的 **Server Boost** 來強化我們的領地！\n\n為了表揚你的無私奉獻，本王特別賜予你 **「皇家贊助者」** 的標記！\n🎉 **從現在起，你在本王領地內的每次發言，都將獲得 1.5 倍的經驗值加成！**\n這就是國王的恩賜！汪！`)
                .setThumbnail(newMember.user.displayAvatarURL({ size: 128 }))
                .setFooter({ text: '🐕 感謝你支持吉吉國王的統治！' });

            await channel.send({ content: `${newMember}`, embeds: [embed] }).catch(() => { });
        }
    });
}
