import crypto from 'node:crypto';
import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    FileUploadBuilder,
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { UI_COLORS } from './style.js';
import { ephemeralV2Payload, v2Card } from './componentsV2.js';
import { fetchWithTimeout, trimText } from './imageRendering.js';
import { renderAnnouncementScrollImage } from './announcementImage.js';

export const pendingAnnouncements = new Map();

export async function buildAnnouncementPayload(draft, { preview = false, actionRows = [], fetchImpl = fetch } = {}) {
    const scroll = await renderAnnouncementScrollImage({
        title: draft.title,
        content: draft.content,
        footer: draft.footer,
        mentionLabel: mentionLabelFor(draft.mentionText),
    });
    const attachedImages = await buildUploadedImageAttachments(draft.images, fetchImpl);
    const files = [scroll.attachment, ...attachedImages];

    if (!preview) {
        return {
            content: draft.mentionText || undefined,
            allowedMentions: draft.allowedMentions || { parse: [] },
            files,
        };
    }

    const panel = v2Card({
        title: '📜 聖旨預覽',
        description: [
            '此卷軸尚未發布，確認圖片內容後再按下發布。',
            draft.mentionText ? `通知範圍：${draft.mentionText}` : '通知範圍：不提及任何人',
        ].join('\n'),
        accentColor: UI_COLORS.ANNOUNCEMENT,
        actionRows,
    });
    return ephemeralV2Payload([panel], {
        allowedMentions: { parse: [] },
        files,
    });
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
                    .setMaxLength(80)
            ),
            new LabelBuilder().setLabel('公告內容').setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId('announce_content')
                    .setPlaceholder('內容會印在直式卷軸上，建議分段但避免過長')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(480)
            ),
            new LabelBuilder().setLabel('頁腳文字 (選填)').setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId('announce_footer')
                    .setPlaceholder('顯示在公告底端的小字')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(80)
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

async function buildUploadedImageAttachments(images = [], fetchImpl = fetch) {
    const records = images.map(normalizeUploadedImage).filter((image) => image.url);
    const attachments = [];

    for (const [index, image] of records.entries()) {
        const response = await fetchWithTimeout(image.url, fetchImpl, 5000);
        const contentType = response?.headers?.get?.('content-type') || image.contentType || '';
        if (!response?.ok || !contentType.startsWith('image/')) {
            throw new Error(`Unable to fetch announcement image ${index + 1}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        attachments.push(new AttachmentBuilder(buffer, {
            name: safeImageName(image.name, index, contentType),
        }));
    }

    return attachments;
}

function normalizeUploadedImage(image, index) {
    if (typeof image === 'string') {
        return {
            url: image,
            name: `announcement-image-${index + 1}.png`,
            contentType: 'image/png',
        };
    }
    return {
        url: image?.url,
        name: image?.name || `announcement-image-${index + 1}.png`,
        contentType: image?.contentType,
    };
}

function safeImageName(name, index, contentType) {
    const extension = extensionFor(contentType, name);
    const base = String(name || `announcement-image-${index + 1}`)
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9_-]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || `announcement-image-${index + 1}`;
    return `${base}${extension}`;
}

function extensionFor(contentType, name = '') {
    const existing = String(name).match(/\.(png|jpe?g|webp|gif)$/i)?.[0]?.toLowerCase();
    if (existing) return existing === '.jpeg' ? '.jpg' : existing;
    if (contentType.includes('jpeg')) return '.jpg';
    if (contentType.includes('webp')) return '.webp';
    if (contentType.includes('gif')) return '.gif';
    return '.png';
}

function mentionLabelFor(mentionText) {
    if (!mentionText) return null;
    return trimText(String(mentionText).replace(/\s+/g, ' ').trim(), 34);
}
