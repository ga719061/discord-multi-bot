import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { randomUUID } from 'node:crypto';
import { addGiveaway } from '../../utils/database.js';
import { COLORS, ansiBlock, UI_COLORS } from '../../utils/style.js';
import { embedsToV2Payload, ephemeralV2Payload, v2EditPayload, v2Panel, v2Text } from '../../utils/componentsV2.js';

const COMPOSER_TIMEOUT = 5 * 60_000;

export const data = new SlashCommandBuilder()
    .setName('抽獎')
    .setDescription('🎉 皇家賞賜：開啟彈窗並頒布一場限時抽獎')
    .setDescriptionLocalizations({ 'zh-TW': '🎉 皇家賞賜：開啟彈窗並頒布一場限時抽獎' });
export const helpOnly = true;

export async function execute(interaction) {
    return openGiveawayComposer(interaction);
}

export async function openGiveawayComposer(interaction) {
    const sessionId = randomUUID();
    await interaction.showModal(buildGiveawayModal(sessionId));
    const submit = await interaction.awaitModalSubmit({
        filter: (modalSubmit) => modalSubmit.customId === giveawayId(sessionId, 'submit') && modalSubmit.user.id === interaction.user.id,
        time: COMPOSER_TIMEOUT,
    }).catch(() => null);
    if (!submit) return;

    const prize = submit.fields.getTextInputValue('prize').trim();
    const durationText = submit.fields.getTextInputValue('duration').trim();
    const winnersText = submit.fields.getTextInputValue('winners').trim();
    const duration = Number(durationText);
    const winnersCount = Number(winnersText);
    if (!isPositiveInteger(durationText, duration) || !isPositiveInteger(winnersText, winnersCount)) {
        await submit.reply(buildGiveawayErrorPayload(sessionId));
        const response = await submit.fetchReply();
        const collector = response.createMessageComponentCollector({ time: COMPOSER_TIMEOUT });
        collector.on('collect', async (component) => {
            if (component.user.id !== interaction.user.id || component.customId !== giveawayId(sessionId, 'retry')) return;
            collector.stop('retry');
            await openGiveawayComposer(component);
        });
        collector.on('end', (_, reason) => {
            if (reason === 'retry') return;
            submit.editReply(v2EditPayload(buildGiveawayErrorPayload(sessionId, true))).catch(() => {});
        });
        return;
    }

    const endTime = Date.now() + duration * 60 * 1000;
    await submit.deferReply({ flags: MessageFlags.Ephemeral });
    const message = await submit.channel.send(buildGiveawayPayload(prize, duration, winnersCount, endTime));
    await message.react('🎉');
    addGiveaway(submit.guildId, submit.channelId, message.id, prize, winnersCount, endTime);
    await submit.editReply(v2EditPayload(ephemeralV2Payload([
        v2Panel(UI_COLORS.SUCCESS).addTextDisplayComponents(v2Text(
            '# 🎉 皇家抽獎已頒布\n本王已將賞賜張貼於目前頻道，請子民以 🎉 反應參加。'
        )),
    ])));
}

export function buildGiveawayModal(sessionId) {
    return new ModalBuilder()
        .setCustomId(giveawayId(sessionId, 'submit'))
        .setTitle('皇家賞賜 | 建立抽獎')
        .addComponents(
            inputRow('prize', '賞賜內容', '例如：Steam 禮物卡', TextInputStyle.Short, 100),
            inputRow('duration', '持續時間（分鐘）', '例如：60', TextInputStyle.Short, 8),
            inputRow('winners', '得獎名額', '例如：1', TextInputStyle.Short, 4)
        );
}

export function buildGiveawayPayload(prize, duration, winnersCount, endTime) {
    const stampAttachment = new AttachmentBuilder('./assets/stamp.png', { name: 'stamp.png' });
    const giveawayAnsi = ansiBlock([
        { color: COLORS.GOLD + ';' + COLORS.BOLD, text: '✨ 【皇家賞賜：限時抽獎活動】' },
        { color: COLORS.CYAN, text: '━━━━━━━━━━━━━━━━━━━━' },
        { color: COLORS.WHITE, text: `🎁 獎品內容：${prize}` },
        { color: COLORS.WHITE, text: `👥 預計名額：${winnersCount} 位` },
        { color: COLORS.GOLD, text: `⏰ 活動時長：${duration} 分鐘` },
        { color: COLORS.CYAN, text: '━━━━━━━━━━━━━━━━━━━━' },
        { color: COLORS.RESET, text: '點擊下方的 🎉 反應即可參加活動！' },
    ]);
    const embed = new EmbedBuilder()
        .setTitle('🐕🎉 吉吉國王的皇家大抽獎！')
        .setDescription(giveawayAnsi)
        .setColor(0xFFD700)
        .setThumbnail('attachment://stamp.png')
        .setFooter({ text: '抽獎倒數中...' })
        .setTimestamp(endTime);
    return embedsToV2Payload([embed], { files: [stampAttachment] });
}

export function buildGiveawayErrorPayload(sessionId, disabled = false) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(giveawayId(sessionId, 'retry'))
            .setLabel('重新建立抽獎')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );
    return ephemeralV2Payload([
        v2Panel(UI_COLORS.WARNING)
            .addTextDisplayComponents(v2Text(
                '# 🎁 賞賜設定不成立\n時間與名額必須輸入大於 0 的整數，請重新建立抽獎。'
            ))
            .addActionRowComponents(row),
    ]);
}

function inputRow(id, label, placeholder, style, maxLength) {
    return new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId(id)
            .setLabel(label)
            .setPlaceholder(placeholder)
            .setStyle(style)
            .setMaxLength(maxLength)
            .setRequired(true)
    );
}

function giveawayId(sessionId, action) {
    return `giveaway:${sessionId}:${action}`;
}

function isPositiveInteger(text, value) {
    return /^\d+$/.test(text) && Number.isSafeInteger(value) && value > 0;
}
