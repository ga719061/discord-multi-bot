import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { randomUUID } from 'node:crypto';
import { addReminder, deleteReminder, getUserReminders } from '../../utils/database.js';
import { parseReminderTime } from '../../utils/reminderManager.js';
import { UI_COLORS } from '../../utils/style.js';
import { ephemeralV2Payload, v2EditPayload, v2Panel, v2Text } from '../../utils/componentsV2.js';

const PANEL_TIMEOUT = 5 * 60_000;

export const data = new SlashCommandBuilder()
    .setName('提醒')
    .setDescription('⏰ 皇家提醒系統：開啟彈窗，讓本王替你記住重要的大事')
    .setDescriptionLocalizations({ 'zh-TW': '⏰ 皇家提醒系統：開啟彈窗，讓本王替你記住重要的大事' });

export async function execute(interaction) {
    return openReminderComposer(interaction);
}

export async function openReminderComposer(interaction) {
    const sessionId = randomUUID();
    await interaction.showModal(buildReminderModal(sessionId));
    const submit = await interaction.awaitModalSubmit({
        filter: (modalSubmit) => modalSubmit.customId === reminderId(sessionId, 'submit') && modalSubmit.user.id === interaction.user.id,
        time: PANEL_TIMEOUT,
    }).catch(() => null);
    if (!submit) return;

    const timeText = submit.fields.getTextInputValue('time').trim();
    const content = submit.fields.getTextInputValue('content').trim();
    const targetTime = parseReminderTime(timeText);
    if (!targetTime || targetTime <= Date.now()) {
        await submit.reply(buildReminderErrorPayload(sessionId));
        await attachReminderControls(submit, interaction.user.id, sessionId, (disabled = false) => buildReminderErrorPayload(sessionId, disabled), {
            allowDelete: false,
        });
        return;
    }

    addReminder(submit.guildId, submit.channelId, interaction.user.id, content, targetTime);
    await submit.reply(buildReminderSuccessPayload(sessionId, content, targetTime));
    await attachReminderControls(submit, interaction.user.id, sessionId, (disabled = false) =>
        buildReminderSuccessPayload(sessionId, content, targetTime, disabled), { allowDelete: false });
}

export async function openReminderManager(interaction) {
    const sessionId = randomUUID();
    const guildId = interaction.guildId;
    await interaction.reply(buildReminderManagerPayload(sessionId, getUserReminders(interaction.user.id, guildId)));
    await attachReminderControls(interaction, interaction.user.id, sessionId, (disabled = false) =>
        buildReminderManagerPayload(sessionId, getUserReminders(interaction.user.id, guildId), disabled));
}

export function buildReminderModal(sessionId) {
    return new ModalBuilder()
        .setCustomId(reminderId(sessionId, 'submit'))
        .setTitle('皇家提醒 | 新增委託')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('time')
                    .setLabel('提醒時間')
                    .setPlaceholder('10m、1h、1d 或 16:00')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(20)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('content')
                    .setLabel('要提醒的內容')
                    .setPlaceholder('例如：起身喝水')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(500)
                    .setRequired(true)
            )
        );
}

export function buildReminderSuccessPayload(sessionId, content, targetTime, disabled = false) {
    return ephemeralV2Payload([
        v2Panel(UI_COLORS.SUCCESS)
            .addTextDisplayComponents(v2Text([
                '# ⏰ 皇家提醒已登記',
                '🐕✅ 遵命！本王已把這件事塞進小小皇冠底下，時間到會在這個頻道提醒你。',
                `**內容：** ${content}`,
                `**時間：** ${formatReminderDate(targetTime)}`,
                disabled ? '\n## ⌛ 此提醒頁已逾時\n請重新使用 `/提醒` 開啟新的操作頁。' : '',
            ].join('\n')))
            .addActionRowComponents(buildReminderButtonRow(sessionId, disabled)),
    ]);
}

export function buildReminderErrorPayload(sessionId, disabled = false) {
    return ephemeralV2Payload([
        v2Panel(UI_COLORS.WARNING)
            .addTextDisplayComponents(v2Text([
                '# ⏰ 提醒時間不成立',
                '本王看了一下懷錶，這個時間不太成立。請使用 `10m`、`1h`、`1d` 或 `16:00` 這類未來時間格式。',
                disabled ? '\n## ⌛ 此操作頁已逾時\n請重新使用 `/提醒`。' : '',
            ].join('\n')))
            .addActionRowComponents(buildReminderButtonRow(sessionId, disabled)),
    ]);
}

export function buildReminderManagerPayload(sessionId, reminders, disabled = false) {
    const rows = [buildReminderButtonRow(sessionId, disabled)];
    if (reminders.length > 0) {
        rows.unshift(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(reminderId(sessionId, 'delete'))
                .setPlaceholder('挑選要刪除的皇家提醒')
                .setDisabled(disabled)
                .addOptions(reminders.map((reminder) => ({
                    label: truncate(`提醒 #${reminder.id} | ${reminder.content}`, 100),
                    description: truncate(formatReminderDate(reminder.target_time), 100),
                    value: String(reminder.id),
                })))
        ));
    }
    const details = reminders.length === 0
        ? '目前沒有待發送的提醒。按下方按鈕，讓本王替你記下一件事。汪！'
        : reminders.map((reminder) =>
            `**#${reminder.id}** ${formatReminderDate(reminder.target_time)}\n${reminder.content}`
        ).join('\n\n');
    return ephemeralV2Payload([
        v2Panel(UI_COLORS.ROYAL)
            .addTextDisplayComponents(v2Text([
                '# 📜 我的皇家提醒',
                '本王替你保管中的待辦都在這裡。',
                details,
                disabled ? '\n## ⌛ 管理頁已逾時\n請從 `/幫助` 再次開啟提醒管理。' : '',
            ].join('\n')))
            .addActionRowComponents(...rows),
    ]);
}

async function attachReminderControls(rootInteraction, userId, sessionId, renderCurrent, options = {}) {
    const response = await rootInteraction.fetchReply();
    const collector = response.createMessageComponentCollector({ time: PANEL_TIMEOUT });
    let currentRenderer = renderCurrent;
    let canDelete = options.allowDelete !== false;
    const guildId = rootInteraction.guildId;
    collector.on('collect', async (component) => {
        if (component.user.id !== userId) {
            return component.reply(ephemeralV2Payload([
                v2Panel(UI_COLORS.WARNING).addTextDisplayComponents(v2Text(
                    '# 🛡️ 這份提醒簿不屬於你\n請使用 `/提醒` 開啟自己的皇家提醒。'
                )),
            ]));
        }
        if (component.customId === reminderId(sessionId, 'create')) {
            return openReminderComposer(component);
        }
        if (component.customId === reminderId(sessionId, 'manage')) {
            currentRenderer = (disabled = false) => buildReminderManagerPayload(sessionId, getUserReminders(userId, guildId), disabled);
            canDelete = true;
            return component.update({
                components: buildReminderManagerPayload(sessionId, getUserReminders(userId, guildId)).components,
            });
        }
        if (canDelete && component.customId === reminderId(sessionId, 'delete')) {
            deleteReminder(Number(component.values[0]), userId, guildId);
            return component.update({
                components: buildReminderManagerPayload(sessionId, getUserReminders(userId, guildId)).components,
            });
        }
    });
    collector.on('end', () => {
        rootInteraction.editReply(v2EditPayload(currentRenderer(true))).catch(() => {});
    });
}

function buildReminderButtonRow(sessionId, disabled) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(reminderId(sessionId, 'create'))
            .setLabel('新增提醒')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(reminderId(sessionId, 'manage'))
            .setLabel('管理我的提醒')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    );
}

function reminderId(sessionId, action) {
    return `reminder:${sessionId}:${action}`;
}

function formatReminderDate(timestamp) {
    return new Date(timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

function truncate(text, length) {
    const value = String(text || '-');
    return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}
