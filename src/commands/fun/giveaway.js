import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { addGiveaway } from '../../utils/database.js';
import { fmt, COLORS, ansiBlock } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('抽獎')
    .setDescription('🎉 皇家賞賜：由國王親自主持並抽出幸運子民的福利活動')
    .setDescriptionLocalizations({ 'zh-TW': '🎉 皇家賞賜：由國王親自主持並抽出幸運子民的福利活動' })
    .addStringOption(option =>
        option.setName('獎品')
            .setDescription('要抽出的獎品')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('時間')
            .setDescription('抽獎持續時間 (分鐘)')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('名額')
            .setDescription('中獎人數')
            .setRequired(true));

export async function execute(interaction) {
    const prize = interaction.options.getString('獎品');
    const duration = interaction.options.getInteger('時間');
    const winnersCount = interaction.options.getInteger('名額');

    if (duration <= 0 || winnersCount <= 0) {
        return interaction.reply({ content: '🐕 汪！時間和名額都要大於 0 喔！', flags: ['Ephemeral'] });
    }

    const endTime = Date.now() + duration * 60 * 1000;
    const stampAttachment = new AttachmentBuilder('./assets/stamp.png', { name: 'stamp.png' });

    const giveawayAnsi = ansiBlock([
        { color: COLORS.GOLD + ';' + COLORS.BOLD, text: '✨ 【皇家賞賜：限時抽獎活動】' },
        { color: COLORS.CYAN, text: '━━━━━━━━━━━━━━━━━━━━' },
        { color: COLORS.WHITE, text: `🎁 獎品內容：${prize}` },
        { color: COLORS.WHITE, text: `👥 預計名額：${winnersCount} 位` },
        { color: COLORS.GOLD, text: `⏰ 活動時長：${duration} 分鐘` },
        { color: COLORS.CYAN, text: '━━━━━━━━━━━━━━━━━━━━' },
        { color: COLORS.RESET, text: '點擊下方的 🎉 反應即可參加活動！' }
    ]);

    const embed = new EmbedBuilder()
        .setTitle('🐕🎉 吉吉國王的皇家大抽獎！')
        .setDescription(giveawayAnsi)
        .setColor(0xFFD700)
        .setThumbnail('attachment://stamp.png')
        .setFooter({ text: '抽獎倒數中...' })
        .setTimestamp(endTime);

    const message = await interaction.reply({ 
        embeds: [embed], 
        files: [stampAttachment],
        fetchReply: true 
    });

    await message.react('🎉');

    // 存入資料庫以供後續開獎
    addGiveaway(
        interaction.guild.id,
        interaction.channel.id,
        message.id,
        prize,
        winnersCount,
        endTime
    );
}
