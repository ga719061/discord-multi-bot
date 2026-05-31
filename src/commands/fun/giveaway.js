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
    const message = await submit.channel.send(buildGiveawayPayload(prize, duration, winnersCount, endTime, {
        creatorId: interaction.user.id,
        creatorName: getInteractionDisplayName(interaction),
    }));
    await message.react('🎉');
    addGiveaway(submit.guildId, submit.channelId, message.id, prize, winnersCount, endTime);
    await submit.editReply(v2EditPayload(ephemeralV2Payload([
        v2Panel(UI_COLORS.SUCCESS).addTextDisplayComponents(v2Text([
            '# 🎉 皇家抽獎已頒布',
            '汪汪！本王已把賞賜張貼到目前頻道，子民們可以用 🎉 反應排隊領好運了。',
            '-# 開獎時間到時，本王會自動公布幸運得主。',
        ].join('\n'))),
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

export function buildGiveawayPayload(prize, duration, winnersCount, endTime, options = {}) {
    const stampAttachment = new AttachmentBuilder('./assets/stamp.png', { name: 'stamp.png' });
    const creatorName = options.creatorName || options.creatorId || '未知子民';
    const giveawayAnsi = ansiBlock([
        { color: COLORS.GOLD + ';' + COLORS.BOLD, text: '✨ 【皇家賞賜：限時抽獎活動】' },
        { color: COLORS.CYAN, text: '━━━━━━━━━━━━━━━━━━━━' },
        { color: COLORS.WHITE, text: `🎁 獎品內容：${prize}` },
        { color: COLORS.WHITE, text: `👥 預計名額：${winnersCount} 位` },
        { color: COLORS.GOLD, text: `⏰ 活動時長：${duration} 分鐘` },
        { color: COLORS.CYAN, text: `👑 發起子民：${creatorName}` },
        { color: COLORS.CYAN, text: '━━━━━━━━━━━━━━━━━━━━' },
        { color: COLORS.RESET, text: '快點擊下方的 🎉 反應，本王要把你的名字放進幸運名冊！' },
    ]);
    const embed = new EmbedBuilder()
        .setTitle('🐕🎉 吉吉國王的皇家大抽獎！')
        .setDescription(`汪！今日王國開宴，本王要把寶物賞給幸運子民！\n\n${giveawayAnsi}`)
        .setColor(UI_COLORS.ROYAL)
        .setThumbnail('attachment://stamp.png')
        .setFooter({ text: `🐕👑 皇家賞賜倒數中 | 發起：${creatorName}` })
        .setTimestamp(endTime);
    return embedsToV2Payload([embed], {
        files: [stampAttachment],
        allowedMentions: { parse: [] },
    });
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
                [
                    '# 🎁 賞賜設定不成立',
                    '時間與名額必須輸入大於 0 的整數，請重新建立抽獎。',
                    disabled ? '\n## ⌛ 建立流程已逾時\n請從 `/幫助` 再開一次皇家抽獎。' : '',
                ].join('\n')
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

function getInteractionDisplayName(interaction) {
    return interaction.member?.displayName
        || interaction.user?.globalName
        || interaction.user?.username
        || interaction.user?.tag
        || '未知子民';
}

function isPositiveInteger(text, value) {
    return /^\d+$/.test(text) && Number.isSafeInteger(value) && value > 0;
}
