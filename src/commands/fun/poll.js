import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { COLORS, UI_COLORS, ansiBar, ansiBlock, fmt } from '../../utils/style.js';
import { ephemeralV2Payload, v2Card, v2EditPayload, v2Notice, v2Panel, v2Text, v2Payload } from '../../utils/componentsV2.js';

const COMPOSER_TIMEOUT = 5 * 60_000;
const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

export const data = new SlashCommandBuilder()
    .setName('投票')
    .setDescription('📊 國是會議：開啟皇家投票彈窗並發布正式表決')
    .setDescriptionLocalizations({ 'zh-TW': '📊 國是會議：開啟皇家投票彈窗並發布正式表決' });
export const helpOnly = true;

export async function execute(interaction) {
    return openPollComposer(interaction);
}

export async function openPollComposer(interaction) {
    const sessionId = randomUUID();
    const questionModal = buildPollQuestionModal(sessionId);
    await interaction.showModal(questionModal);

    const questionSubmit = await interaction.awaitModalSubmit({
        filter: (submit) => submit.customId === pollId(sessionId, 'question') && submit.user.id === interaction.user.id,
        time: COMPOSER_TIMEOUT,
    }).catch(() => null);
    if (!questionSubmit) return;

    const question = questionSubmit.fields.getTextInputValue('question').trim();
    await questionSubmit.reply(buildPollOptionCountPayload(sessionId, question));
    const response = await questionSubmit.fetchReply();
    const collector = response.createMessageComponentCollector({ time: COMPOSER_TIMEOUT });
    let publicationState = 'draft';

    collector.on('collect', async (component) => {
        if (component.user.id !== interaction.user.id) {
            return component.reply(v2Notice('🛡️ 這份國是會議不屬於你', '請從 `/幫助` 開啟自己的皇家投票建立流程。', UI_COLORS.WARNING));
        }

        const match = component.customId.match(new RegExp(`^${pollId(sessionId, 'count')}:(2|3|4|5)$`));
        if (!match) return;
        if (publicationState !== 'draft') {
            return component.reply(v2Notice(
                '📊 國是會議已頒布',
                '這場投票已公布於目前頻道，不會重複發布。',
                UI_COLORS.WARNING
            ));
        }

        const count = Number(match[1]);
        const attemptId = randomUUID();
        await component.showModal(buildPollOptionsModal(sessionId, count, attemptId));
        const optionsSubmit = await component.awaitModalSubmit({
            filter: (submit) => submit.customId === pollId(sessionId, `options:${count}:${attemptId}`) && submit.user.id === interaction.user.id,
            time: COMPOSER_TIMEOUT,
        }).catch(() => null);
        if (!optionsSubmit) return;
        if (publicationState !== 'draft') {
            return optionsSubmit.reply(v2Notice(
                '📊 國是會議已頒布',
                '這場投票已完成發布，請從 `/幫助` 建立新的皇家投票。',
                UI_COLORS.WARNING
            ));
        }

        const options = Array.from({ length: count }, (_, index) =>
            optionsSubmit.fields.getTextInputValue(`option_${index + 1}`).trim()
        );
        const votes = Object.fromEntries(options.map((_, index) => [index, []]));

        publicationState = 'publishing';
        await optionsSubmit.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const message = await optionsSubmit.channel.send(buildPollPayload({
                question,
                options,
                votes,
                creatorId: interaction.user.id,
            }));
            getDb().prepare(
                'INSERT INTO polls (guild_id, channel_id, message_id, creator_id, question, options, votes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).run(
                optionsSubmit.guildId,
                optionsSubmit.channelId,
                message.id,
                interaction.user.id,
                question,
                JSON.stringify(options),
                JSON.stringify(votes),
                Date.now()
            );

            publicationState = 'published';
            collector.stop('published');
            await optionsSubmit.editReply(v2EditPayload(v2Notice(
                '📊 國是會議已頒布',
                '本王已將投票公布於目前頻道，子民們可以開始排隊表決了，汪！',
                UI_COLORS.SUCCESS
            )));
        } catch (error) {
            publicationState = 'draft';
            logger.warn(`[Poll] 發布失敗 guild=${optionsSubmit.guildId}: ${error.message}`);
            await optionsSubmit.editReply(v2EditPayload(v2Notice(
                '📊 國是會議頒布失敗',
                '本王暫時無法將投票張貼到目前頻道，請稍後重新嘗試。',
                UI_COLORS.DANGER
            )));
        }
    });

    collector.on('end', (_, reason) => {
        if (reason === 'published') return;
        questionSubmit.editReply(v2EditPayload(buildPollOptionCountPayload(sessionId, question, true))).catch(() => {});
    });
}

export function buildPollQuestionModal(sessionId) {
    return new ModalBuilder()
        .setCustomId(pollId(sessionId, 'question'))
        .setTitle('皇家國是會議 | 建立投票')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('question')
                    .setLabel('要讓子民表決的問題')
                    .setPlaceholder('例如：今晚要一起玩什麼？')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(150)
                    .setRequired(true)
            )
        );
}

export function buildPollOptionCountPayload(sessionId, question, disabled = false) {
    const row = new ActionRowBuilder().addComponents(
        ...[2, 3, 4, 5].map((count) =>
            new ButtonBuilder()
                .setCustomId(`${pollId(sessionId, 'count')}:${count}`)
                .setLabel(`${count} 個選項`)
                .setStyle(count === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(disabled)
        )
    );
    const panel = v2Panel(disabled ? UI_COLORS.MUTED : UI_COLORS.ROYAL)
        .addTextDisplayComponents(v2Text([
            '# 📊 皇家國是會議',
            `議題：**${question}**`,
            disabled
                ? '## ⌛ 建立流程已逾時\n請從 `/幫助` 重新開啟新的皇家投票。'
                : '請選擇這場投票要提供幾個選項；本王會接著開啟選項填寫卷軸。',
        ].join('\n')))
        .addActionRowComponents(row);
    return ephemeralV2Payload([panel]);
}

export function buildPollOptionsModal(sessionId, count, attemptId = 'initial') {
    const modal = new ModalBuilder()
        .setCustomId(pollId(sessionId, `options:${count}:${attemptId}`))
        .setTitle(`皇家國是會議 | ${count} 個選項`);
    for (let index = 1; index <= count; index++) {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(`option_${index}`)
                    .setLabel(`選項 ${index}`)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(80)
                    .setRequired(true)
            )
        );
    }
    return modal;
}

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
            title: `📊 皇家國是會議：${question}`,
            description: [
                '汪！請選擇你的立場，本王會把每一票都記進王國會議簿。',
                ansiBlock(pollLines.join('\n\n')),
            ].join('\n\n'),
            accentColor: UI_COLORS.ROYAL,
            footer: `建立者：${creator} | 總計 ${totalVotes} 票 | 吉吉國王御前表決`,
            actionRows: [row],
        }),
    ], { withResponse });
}

function pollId(sessionId, action) {
    return `poll:${sessionId}:${action}`;
}
