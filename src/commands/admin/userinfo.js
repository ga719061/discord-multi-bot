import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('userinfo')
    .setNameLocalizations({ 'zh-TW': '查身家' })
    .setDescription('🔍 身分調查：查看特定子民的詳細背景資料與入國註冊時間')
    .setDescriptionLocalizations({ 'zh-TW': '🔍 身分調查：查看特定子民的詳細背景資料與入國註冊時間' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((opt) => 
        opt.setName('user')
            .setNameLocalizations({ 'zh-TW': '使用者' })
            .setDescription('要調查的子民')
            .setDescriptionLocalizations({ 'zh-TW': '要調查的子民' })
            .setRequired(false)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id);

    const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => r.toString())
        .slice(0, 10)
        .join(', ') || '無';

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🐕👑 子民調查報告：${target.displayName}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .addFields(
            { name: '🏷️ 標籤', value: target.tag, inline: true },
            { name: '🆔 ID', value: target.id, inline: true },
            { name: '📅 帳號建立', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '📥 加入領地', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '未知', inline: true },
            { name: '🏷️ 身分組', value: roles.length > 1024 ? roles.slice(0, 1020) + '...' : roles }
        )
        .setFooter({ text: '🐕 本王對每位子民都瞭若指掌！' });

    await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
}
