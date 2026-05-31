import crypto from 'node:crypto';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    FileUploadBuilder,
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { UI_COLORS } from './style.js';
import { ephemeralV2Payload, v2Card, v2Payload } from './componentsV2.js';

export const pendingAnnouncements = new Map();

export function buildAnnouncementPayload(draft, { preview = false, actionRows = [], files = [] } = {}) {
    const heading = preview ? '## 預覽模式\n此卡片尚未發布，確認內容後再按下發布。' : null;
    const mention = draft.mentionText ? `${draft.mentionText}\n\n` : '';
    const panel = v2Card({
        title: preview ? '📜 聖旨預覽' : '📜 【致全境子民：國王御旨】',
        description: [heading, `**${draft.title}**\n\n${mention}${draft.content}`].filter(Boolean).join('\n\n'),
        accentColor: UI_COLORS.ANNOUNCEMENT,
        thumbnail: preview ? undefined : 'attachment://stamp.png',
        images: draft.images || [],
        footer: `${draft.footer ? `${draft.footer} | ` : ''}🔱 王國正版授權印記`,
        actionRows,
    });
    const options = preview ? { allowedMentions: { parse: [] } } : { allowedMentions: draft.allowedMentions, files };
    return preview ? ephemeralV2Payload([panel]) : v2Payload([panel], options);
}

export function buildAnnouncementPreviewButtons(uuid) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`announce_preview:${uuid}:publish`)
            .setLabel('發布公告')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`announce_preview:${uuid}:cancel`)
            .setLabel('取消')
            .setStyle(ButtonStyle.Secondary)
    );
}

export async function openAnnouncementComposer(interaction, {
    channelId,
    mentionText = null,
    allowedMentions = { parse: [] },
} = {}) {
    const uuid = crypto.randomUUID();
    pendingAnnouncements.set(uuid, {
        channelId,
        userId: interaction.user.id,
        mentionText,
        allowedMentions,
        timestamp: Date.now(),
    });
    const cleanupTimer = setTimeout(() => pendingAnnouncements.delete(uuid), 5 * 60 * 1000);
    cleanupTimer.unref?.();

    const modal = new ModalBuilder()
        .setCustomId(`announce_modal_${uuid}`)
        .setTitle('吉吉國王公告發布台')
        .addLabelComponents(
            new LabelBuilder().setLabel('公告標題').setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId('announce_title')
                    .setPlaceholder('例如：伺服器維護通知')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(256)
            ),
            new LabelBuilder().setLabel('公告內容').setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId('announce_content')
                    .setPlaceholder('支援 Markdown 語法')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(3500)
            ),
            new LabelBuilder().setLabel('頁腳文字 (選填)').setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId('announce_footer')
                    .setPlaceholder('顯示在公告底端的小字')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(256)
            ),
            new LabelBuilder().setLabel('圖片附件 (選填，最多 3 張)').setFileUploadComponent(
                new FileUploadBuilder()
                    .setCustomId('announce_images')
                    .setMinValues(0)
                    .setMaxValues(3)
                    .setRequired(false)
            )
        );

    await interaction.showModal(modal);
}
