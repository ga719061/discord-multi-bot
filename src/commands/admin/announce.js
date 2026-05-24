import crypto from 'node:crypto';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    FileUploadBuilder,
    LabelBuilder,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { UI_COLORS } from '../../utils/style.js';
import { ephemeralV2Payload, v2Card, v2Payload } from '../../utils/componentsV2.js';

export const data = new SlashCommandBuilder()
    .setName('發布公告')
    .setDescription('📢 頒布聖旨：發布帶有精美排版與提及功能的官方國家級公告')
    .setDescriptionLocalizations({ 'zh-TW': '📢 頒布聖旨：發布帶有精美排版與提及功能的官方國家級公告' })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
        opt.setName('頻道')
            .setDescription('要發布公告的指定頻道')
            .setDescriptionLocalizations({ 'zh-TW': '要發布公告的指定頻道' })
            .setRequired(true))
    .addStringOption((opt) =>
        opt.setName('提及範圍')
            .setDescription('是否要在發送時提及對象？ (選填)')
            .setDescriptionLocalizations({ 'zh-TW': '是否要在發送時提及對象？ (選填)' })
            .setRequired(false)
            .addChoices(
                { name: '提及 @everyone (所有人)', value: '@everyone' },
                { name: '提及 @here (在線上的人)', value: '@here' },
                { name: '不提及任何對象', value: 'none' }
            ))
    .addRoleOption((opt) =>
        opt.setName('提及身分組')
            .setDescription('如果要提及特定身分組，請在此選擇 (選填)')
            .setDescriptionLocalizations({ 'zh-TW': '如果要提及特定身分組，請在此選擇 (選填)' })
            .setRequired(false));

export const pendingAnnouncements = new Map();

export function buildAnnouncementPayload(draft, { preview = false, actionRows = [], files = [] } = {}) {
    const heading = preview ? '## 預覽模式\n此卡片尚未發布，確認內容後再按下發布。' : null;
    const mention = draft.mentionText ? `${draft.mentionText}\n\n` : '';
    const panel = v2Card({
        title: preview ? '📜 聖旨預覽' : '📜 【致全境子民：國王御旨】',
        description: [heading, `**${draft.title}**\n\n${mention}${draft.content}`].filter(Boolean).join('\n\n'),
        accentColor: UI_COLORS.DANGER,
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

export async function execute(interaction) {
    const channel = interaction.options.getChannel('頻道');
    const mention = interaction.options.getString('提及範圍');
    const mentionRole = interaction.options.getRole('提及身分組');
    let mentionText = null;
    let allowedMentions = { parse: [] };

    if (mentionRole) {
        mentionText = `<@&${mentionRole.id}>`;
        allowedMentions = { parse: [], roles: [mentionRole.id] };
    } else if (mention === '@everyone' || mention === '@here') {
        mentionText = mention;
        allowedMentions = { parse: ['everyone'] };
    }

    const uuid = crypto.randomUUID();
    pendingAnnouncements.set(uuid, {
        channelId: channel.id,
        userId: interaction.user.id,
        mentionText,
        allowedMentions,
        timestamp: Date.now(),
    });
    const cleanupTimer = setTimeout(() => pendingAnnouncements.delete(uuid), 5 * 60 * 1000);
    cleanupTimer.unref?.();

    const modal = new ModalBuilder()
        .setCustomId(`announce_modal_${uuid}`)
        .setTitle('👑 吉吉國王聖旨發布台')
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
