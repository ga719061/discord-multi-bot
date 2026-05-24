import { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import {
    addReactionRole,
    getReactionRolesByGuild,
    deleteReactionRolesByMessage,
} from '../../utils/database.js';

export const data = new SlashCommandBuilder()
    .setName('反應身分組')
    .setDescription('🐕🏷️ 按鈕自助身分組建立系統 (管理員專屬)')
    .setDescriptionLocalizations({ 'zh-TW': '🐕🏷️ 按鈕自助身分組建立系統 (管理員專屬)' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
        sub
            .setName('建立設定')
            .setDescription('➕ 建立大廳：綁定表情符號與按鈕生成全新的身分組領取站')
            .setDescriptionLocalizations({ 'zh-TW': '➕ 建立大廳：綁定表情符號與按鈕生成全新的身分組領取站' })
            .addChannelOption((opt) =>
                opt.setName('頻道')
                    .setDescription('要發送身分組選單的頻道')
                    .setDescriptionLocalizations({ 'zh-TW': '要發送身分組選單的頻道' })
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
            .addStringOption((opt) =>
                opt.setName('配對')
                    .setDescription('emoji:身分組ID 格式，多組用逗號分隔 (如 🎮:123,🎵:456)')
                    .setDescriptionLocalizations({ 'zh-TW': 'emoji:身分組ID 格式，多組用逗號分隔 (如 🎮:123,🎵:456)' })
                    .setRequired(true)
            )
            .addStringOption((opt) =>
                opt.setName('標題')
                    .setDescription('自訂標題（選填）')
                    .setDescriptionLocalizations({ 'zh-TW': '自訂標題（選填）' })
                    .setRequired(false)
            )
    )
    .addSubcommand((sub) =>
        sub.setName('列表清單')
            .setDescription('📋 點名簿：列舉出目前這座城堡內所有的按鈕身分組')
            .setDescriptionLocalizations({ 'zh-TW': '📋 點名簿：列舉出現在城堡內所有的按鈕身分組' })
    )
    .addSubcommand((sub) =>
        sub
            .setName('刪除設定')
            .setDescription('🗑️ 拆除：利用訊息 ID 移除某個已經建立的按鈕反應站')
            .setDescriptionLocalizations({ 'zh-TW': '🗑️ 拆除：利用訊息 ID 移除某個已經建立的按鈕反應站' })
            .addStringOption((opt) =>
                opt.setName('訊息編號')
                    .setDescription('要刪除的反應身分組訊息 ID')
                    .setDescriptionLocalizations({ 'zh-TW': '要刪除的反應身分組訊息 ID' })
                    .setRequired(true)
            )
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === '建立設定') {
        const channel = interaction.options.getChannel('頻道');
        const pairsStr = interaction.options.getString('配對');
        const customTitle = interaction.options.getString('標題');
        await handleSetup(interaction, channel, pairsStr, customTitle);
    } else if (sub === '列表清單') {
        await handleList(interaction);
    } else if (sub === '刪除設定') {
        const messageId = interaction.options.getString('訊息編號');
        await handleDelete(interaction, messageId);
    }
}

async function handleSetup(interaction, channel, pairsStr, customTitle) {

    // 解析 emoji:roleId 配對
    const pairs = [];
    const parts = pairsStr.split(',').map((s) => s.trim());

    for (const part of parts) {
        const colonIndex = part.lastIndexOf(':');
        if (colonIndex === -1 || colonIndex === 0) {
            return interaction.reply({
                content: `🐕 汪！格式錯誤：\`${part}\`\n正確格式是 \`emoji:身分組ID\`，例如 \`🎮:123456789\``,
                flags: ['Ephemeral'],
            });
        }

        const emoji = part.slice(0, colonIndex).trim();
        const roleId = part.slice(colonIndex + 1).trim();

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            return interaction.reply({
                content: `🐕 汪！找不到身分組 ID \`${roleId}\`，請確認 ID 是否正確！`,
                flags: ['Ephemeral'],
            });
        }

        pairs.push({ emoji, roleId, roleName: role.name });
    }

    if (pairs.length === 0) {
        return interaction.reply({ content: '🐕 汪！至少要有一組 emoji 配對！', flags: ['Ephemeral'] });
    }

    if (pairs.length > 20) {
        return interaction.reply({ content: '🐕 汪！最多只能設定 20 組反應！', flags: ['Ephemeral'] });
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    // 建立 embed
    const description = pairs
        .map((p) => `${p.emoji} → **${p.roleName}**`)
        .join('\n');

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(customTitle || '🐕👑 吉吉國王的身分組分配！')
        .setDescription(
            `點擊下方反應來領取身分組，再點一次取消～汪！\n\n${description}`
        )
        .setFooter({ text: '🐕 本王會自動幫你處理身分組！汪！' });

    // 發送訊息
    const message = await channel.send({ embeds: [embed] });

    // 加上反應並存入資料庫
    for (const pair of pairs) {
        try {
            await message.react(pair.emoji);
        } catch {
            await interaction.editReply({
                content: `🐕 汪！無法加上反應 \`${pair.emoji}\`，請確認是否為有效的 emoji！`,
            });
            await message.delete().catch(() => { });
            return;
        }
        addReactionRole(interaction.guildId, channel.id, message.id, pair.emoji, pair.roleId);
    }

    await interaction.editReply({
        content: `🐕✅ 本王的身分組選單已在 ${channel} 就位！子民們去點反應吧～汪！\n訊息 ID：\`${message.id}\``,
    });
}

async function handleList(interaction) {
    const roles = getReactionRolesByGuild(interaction.guildId);

    if (roles.length === 0) {
        return interaction.reply({ content: '🐕 目前沒有設定任何反應身分組。', flags: ['Ephemeral'] });
    }

    // 按 message_id 分組
    const grouped = {};
    for (const r of roles) {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        grouped[r.message_id].push(r);
    }

    const lines = [];
    for (const [msgId, entries] of Object.entries(grouped)) {
        const channelMention = `<#${entries[0].channel_id}>`;
        const pairs = entries.map((e) => {
            const role = interaction.guild.roles.cache.get(e.role_id);
            return `  ${e.emoji} → ${role?.name || '已刪除的身分組'}`;
        }).join('\n');
        lines.push(`📌 頻道：${channelMention}\n訊息 ID：\`${msgId}\`\n${pairs}`);
    }

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🐕📋 反應身分組列表')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `🐕 共 ${Object.keys(grouped).length} 則訊息，${roles.length} 組配對` });

    await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
}

async function handleDelete(interaction, messageId) {
    const roles = getReactionRolesByGuild(interaction.guildId);
    const target = roles.find((r) => r.message_id === messageId);

    if (!target) {
        return interaction.reply({ content: '🐕 汪！找不到這個訊息 ID 的反應身分組設定！', flags: ['Ephemeral'] });
    }

    // 嘗試刪除原訊息
    try {
        const channel = await interaction.guild.channels.fetch(target.channel_id);
        const message = await channel.messages.fetch(messageId);
        await message.delete();
    } catch {
        // 訊息可能已被手動刪除
    }

    deleteReactionRolesByMessage(messageId);

    await interaction.reply({
        content: `🐕✅ 已刪除訊息 \`${messageId}\` 的反應身分組設定！汪！`,
        flags: ['Ephemeral'],
    });
}
