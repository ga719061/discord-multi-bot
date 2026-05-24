import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDb } from '../../utils/database.js';
import { COLORS, UI_COLORS, ansiBar, ansiBlock, fmt } from '../../utils/style.js';
import { v2Card, v2Payload } from '../../utils/componentsV2.js';

export const data = new SlashCommandBuilder()
    .setName('投票')
    .setDescription('📊 國是會議：發布一場讓全體子民參與表決的正式投票')
    .setDescriptionLocalizations({ 'zh-TW': '📊 國是會議：發布一場讓全體子民參與表決的正式投票' })
    .addStringOption((opt) =>
        opt.setName('問題').setDescription('投票問題').setDescriptionLocalizations({ 'zh-TW': '投票問題' }).setRequired(true))
    .addStringOption((opt) =>
        opt.setName('選項1').setDescription('選項 1').setDescriptionLocalizations({ 'zh-TW': '選項 1' }).setMaxLength(80).setRequired(true))
    .addStringOption((opt) =>
        opt.setName('選項2').setDescription('選項 2').setDescriptionLocalizations({ 'zh-TW': '選項 2' }).setMaxLength(80).setRequired(true))
    .addStringOption((opt) =>
        opt.setName('選項3').setDescription('選項 3').setDescriptionLocalizations({ 'zh-TW': '選項 3' }).setMaxLength(80).setRequired(false))
    .addStringOption((opt) =>
        opt.setName('選項4').setDescription('選項 4').setDescriptionLocalizations({ 'zh-TW': '選項 4' }).setMaxLength(80).setRequired(false))
    .addStringOption((opt) =>
        opt.setName('選項5').setDescription('選項 5').setDescriptionLocalizations({ 'zh-TW': '選項 5' }).setMaxLength(80).setRequired(false));

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

export function buildPollPayload({ question, options, votes, creatorId, creatorName, withResponse = false }) {
    const totalVotes = Object.values(votes).reduce((sum, entries) => sum + entries.length, 0);
    const pollLines = options.map((option, index) => {
        const count = votes[index]?.length || 0;
        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const bar = ansiBar(count, totalVotes || 1, COLORS.CYAN, 15);
        return `${fmt(COLORS.GOLD, EMOJIS[index])} **${option}**\n${bar} ${fmt(COLORS.WHITE, `${count} 票 (${percentage}%)`)}`;
    });
    const creator = creatorId ? `<@${creatorId}>` : (creatorName || '未知');
    const row = new ActionRowBuilder().addComponents(
        ...options.map((option, index) =>
            new ButtonBuilder()
                .setCustomId(`poll_${index}`)
                .setLabel(option)
                .setEmoji(EMOJIS[index])
                .setStyle(ButtonStyle.Secondary)
        )
    );

    return v2Payload([
        v2Card({
            title: `📊 國是會議：${question}`,
            description: ansiBlock(pollLines.join('\n\n')),
            accentColor: UI_COLORS.INFO,
            footer: `建立者：${creator} | 總計 ${totalVotes} 票`,
            actionRows: [row],
        }),
    ], { withResponse });
}

export async function execute(interaction) {
    const question = interaction.options.getString('問題');
    const options = [];
    for (let index = 1; index <= 5; index++) {
        const option = interaction.options.getString(`選項${index}`);
        if (option) options.push(option);
    }

    const votes = Object.fromEntries(options.map((_, index) => [index, []]));
    const sent = await interaction.reply(buildPollPayload({
        question,
        options,
        votes,
        creatorId: interaction.user.id,
        withResponse: true,
    }));
    const reply = sent.resource ? sent.resource.message : sent;

    const db = getDb();
    db.prepare(
        'INSERT INTO polls (guild_id, channel_id, message_id, creator_id, question, options, votes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
        interaction.guildId,
        interaction.channelId,
        reply.id,
        interaction.user.id,
        question,
        JSON.stringify(options),
        JSON.stringify(votes),
        Date.now()
    );
}
