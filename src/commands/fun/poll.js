import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDb } from '../../utils/database.js';
import { COLORS, ansiBar, ansiBlock, fmt } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('poll')
    .setNameLocalizations({ 'zh-TW': '投票' })
    .setDescription('📊 國是會議：發布一場讓全體子民參與表決的正式投票')
    .setDescriptionLocalizations({ 'zh-TW': '📊 國是會議：發布一場讓全體子民參與表決的正式投票' })
    .addStringOption((opt) =>
        opt.setName('question')
            .setNameLocalizations({ 'zh-TW': '問題' })
            .setDescription('投票問題')
            .setDescriptionLocalizations({ 'zh-TW': '投票問題' })
            .setRequired(true))
    .addStringOption((opt) =>
        opt.setName('option1')
            .setNameLocalizations({ 'zh-TW': '選項1' })
            .setDescription('選項 1')
            .setDescriptionLocalizations({ 'zh-TW': '選項 1' })
            .setRequired(true))
    .addStringOption((opt) =>
        opt.setName('option2')
            .setNameLocalizations({ 'zh-TW': '選項2' })
            .setDescription('選項 2')
            .setDescriptionLocalizations({ 'zh-TW': '選項 2' })
            .setRequired(true))
    .addStringOption((opt) =>
        opt.setName('option3')
            .setNameLocalizations({ 'zh-TW': '選項3' })
            .setDescription('選項 3')
            .setDescriptionLocalizations({ 'zh-TW': '選項 3' })
            .setRequired(false))
    .addStringOption((opt) =>
        opt.setName('option4')
            .setNameLocalizations({ 'zh-TW': '選項4' })
            .setDescription('選項 4')
            .setDescriptionLocalizations({ 'zh-TW': '選項 4' })
            .setRequired(false))
    .addStringOption((opt) =>
        opt.setName('option5')
            .setNameLocalizations({ 'zh-TW': '選項5' })
            .setDescription('選項 5')
            .setDescriptionLocalizations({ 'zh-TW': '選項 5' })
            .setRequired(false));

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

export async function execute(interaction) {
    const question = interaction.options.getString('question');
    const options = [];
    for (let i = 1; i <= 5; i++) {
        const opt = interaction.options.getString(`option${i}`);
        if (opt) options.push(opt);
    }

    const votes = {};
    options.forEach((_, i) => (votes[i] = []));

    const pollLines = options.map((opt, i) => {
        const bar = ansiBar(0, 1, COLORS.CYAN, 15);
        return `${fmt(COLORS.GOLD, EMOJIS[i])} **${opt}**\n${bar} ${fmt(COLORS.WHITE, '0 票 (0%)')}`;
    });

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 國是會議：${question}`)
        .setDescription(ansiBlock(pollLines.join('\n\n')))
        .setFooter({ text: `建立者：${interaction.user.displayName} | 共 0 人投票` })
        .setTimestamp();

    const buttons = options.map((opt, i) =>
        new ButtonBuilder().setCustomId(`poll_${i}`).setLabel(opt).setEmoji(EMOJIS[i]).setStyle(ButtonStyle.Secondary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);
    const sent = await interaction.reply({ embeds: [embed], components: [row], withResponse: true });
    // In discord.js v15/v14 withResponse: true returns an object containing the response
    const reply = sent.resource ? sent.resource.message : sent;

    // 存入資料庫
    const db = getDb();
    db.prepare(
        'INSERT INTO polls (guild_id, channel_id, message_id, question, options, votes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(interaction.guildId, interaction.channelId, reply.id, question, JSON.stringify(options), JSON.stringify(votes), Date.now());

    // 💡 註記：按鈕收集邏輯已移轉至 bot.js 全局事件 (interactionCreate) 以支援持久化投票。
}
