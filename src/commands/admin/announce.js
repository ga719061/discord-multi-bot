import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('發布公告')
    .setDescription('📢 頒布聖旨：發布帶有精美排版與提及功能的官方國家級公告')
    .setDescriptionLocalizations({ 'zh-TW': '📢 頒布聖旨：發布帶有精美排版與提及功能的官方國家級公告' })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
        opt.setName('頻道')
            .setDescription('要發布公告的指定頻道')
            .setDescriptionLocalizations({ 'zh-TW': '要發布公告的指定頻道' })
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('提及範圍')
            .setDescription('是否要在發送時提及身分組？ (選填)')
            .setDescriptionLocalizations({ 'zh-TW': '是否要在發送時提及身分組？ (選填)' })
            .setRequired(false)
            .addChoices(
                { name: '提及 @everyone (所有人)', value: '@everyone' },
                { name: '提及 @here (在線上的人)', value: '@here' },
                { name: '不提及任何對象', value: 'none' }
            )
    )
    .addRoleOption(opt =>
        opt.setName('提及身分組')
            .setDescription('如果要提及特定身分組，請在此選擇 (選填)')
            .setDescriptionLocalizations({ 'zh-TW': '如果要提及特定身分組，請在此選擇 (選填)' })
            .setRequired(false)
    )
    .addAttachmentOption(opt => 
        opt.setName('圖片1')
            .setDescription('上傳第一張圖片 (作為主圖顯示)')
            .setRequired(false)
    )
    .addAttachmentOption(opt => 
        opt.setName('圖片2')
            .setDescription('上傳第二張圖片 (選填)')
            .setRequired(false)
    )
    .addAttachmentOption(opt => 
        opt.setName('圖片3')
            .setDescription('上傳第三張圖片 (選填)')
            .setRequired(false)
    );

// 存放暫存的公告設定，透過 UUID 對應
export const pendingAnnouncements = new Map();

export async function execute(interaction) {
    const channel = interaction.options.getChannel('頻道');
    const mention = interaction.options.getString('提及範圍');
    const mentionRole = interaction.options.getRole('提及身分組');
    const img1 = interaction.options.getAttachment('圖片1');
    const img2 = interaction.options.getAttachment('圖片2');
    const img3 = interaction.options.getAttachment('圖片3');

    let mentionText = 'none';
    if (mention && mention !== 'none') mentionText = mention;
    if (mentionRole) mentionText = `<@&${mentionRole.id}>`;

    // 蒐集上傳的圖片網址
    const imageUrls = [img1, img2, img3]
        .filter(img => img && img.contentType && img.contentType.startsWith('image/'))
        .map(img => img.url);

    // 產生唯一 ID 並將這些資訊暫存起來 (5 分鐘後自動清理)
    const uuid = crypto.randomUUID();
    pendingAnnouncements.set(uuid, {
        channelId: channel.id,
        mentionText: mentionText === 'none' ? null : mentionText,
        images: imageUrls,
        timestamp: Date.now()
    });

    // 5分鐘後清空該暫存避免記憶體洩漏
    setTimeout(() => {
        pendingAnnouncements.delete(uuid);
    }, 5 * 60 * 1000);

    // Custom ID 格式: announce_modal_{UUID}
    const customId = `announce_modal_${uuid}`;

    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle('👑 吉吉國王聖旨發布台');

    const titleInput = new TextInputBuilder()
        .setCustomId('announce_title')
        .setLabel('公告標題')
        .setPlaceholder('（必填）例如：伺服器維護通知')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(256);

    const contentInput = new TextInputBuilder()
        .setCustomId('announce_content')
        .setLabel('公告內容')
        .setPlaceholder('（必填）支援 Markdown 語法')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000);

    const footerInput = new TextInputBuilder()
        .setCustomId('announce_footer')
        .setLabel('頁腳文字 (選填)')
        .setPlaceholder('顯示在公告底端的小字')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(2048);

    const row1 = new ActionRowBuilder().addComponents(titleInput);
    const row2 = new ActionRowBuilder().addComponents(contentInput);
    const row3 = new ActionRowBuilder().addComponents(footerInput);

    modal.addComponents(row1, row2, row3);

    await interaction.showModal(modal);
}
