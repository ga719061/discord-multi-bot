import { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import {
    addReactionRole,
    getReactionRolesByGuild,
    deleteReactionRolesByMessage,
} from '../../utils/database.js';
import { embedsToV2Payload, ephemeralV2Payload, v2EditPayload, v2Notice, v2Panel, v2Text } from '../../utils/componentsV2.js';
import { UI_COLORS } from '../../utils/style.js';

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
            return interaction.reply(v2Notice('🏷️ 配對格式錯誤', `🐕 汪！格式錯誤：\`${part}\`\n正確格式是 \`emoji:身分組ID\`，例如 \`🎮:123456789\``, UI_COLORS.WARNING));
        }

        const emoji = part.slice(0, colonIndex).trim();
        const roleId = part.slice(colonIndex + 1).trim();

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            return interaction.reply(v2Notice('🏷️ 找不到身分組', `🐕 汪！找不到身分組 ID \`${roleId}\`，請確認 ID 是否正確！`, UI_COLORS.WARNING));
        }

        pairs.push({ emoji, roleId, roleName: role.name });
    }

    if (pairs.length === 0) {
        return interaction.reply(v2Notice('🏷️ 尚無配對', '🐕 汪！至少要有一組 emoji 配對！', UI_COLORS.WARNING));
    }

    if (pairs.length > 20) {
        return interaction.reply(v2Notice('🏷️ 配對過多', '🐕 汪！最多只能設定 20 組反應！', UI_COLORS.WARNING));
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
    const message = await channel.send(embedsToV2Payload([embed]));

    // 加上反應並存入資料庫
    for (const pair of pairs) {
        try {
            await message.react(pair.emoji);
        } catch {
            await interaction.editReply(v2EditPayload(v2Notice('🏷️ 無效反應', `🐕 汪！無法加上反應 \`${pair.emoji}\`，請確認是否為有效的 emoji！`, UI_COLORS.DANGER)));
            await message.delete().catch(() => { });
            return;
        }
        addReactionRole(interaction.guildId, channel.id, message.id, pair.emoji, pair.roleId);
    }

    await interaction.editReply(v2EditPayload(v2Notice('🏷️ 反應站已發布', `🐕✅ 本王的身分組選單已在 ${channel} 就位！子民們去點反應吧～汪！\n訊息 ID：\`${message.id}\``, UI_COLORS.SUCCESS)));
}

async function handleList(interaction) {
    const roles = getReactionRolesByGuild(interaction.guildId);

    if (roles.length === 0) {
        return interaction.reply(v2Notice('🏷️ 反應站清單空空如也', '🐕 目前沒有設定任何反應身分組。', UI_COLORS.MUTED));
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

    await interaction.reply(embedsToV2Payload([embed], { ephemeral: true }));
}

async function handleDelete(interaction, messageId) {
    const roles = getReactionRolesByGuild(interaction.guildId);
    const target = roles.find((r) => r.message_id === messageId);

    if (!target) {
        return interaction.reply(v2Notice('🏷️ 找不到反應站', '🐕 汪！找不到這個訊息 ID 的反應身分組設定！', UI_COLORS.WARNING));
    }

    const confirmId = `rr_delete:${interaction.user.id}:${messageId}:confirm`;
    const cancelId = `rr_delete:${interaction.user.id}:${messageId}:cancel`;
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(confirmId).setLabel('確認刪除').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(cancelId).setLabel('取消').setStyle(ButtonStyle.Secondary)
    );
    const prompt = ephemeralV2Payload([
        v2Panel(UI_COLORS.DANGER)
            .addTextDisplayComponents(v2Text(`## 🗑️ 確認拆除反應站\n即將刪除訊息 \`${messageId}\` 與其身分組配對，這項動作無法復原。`))
            .addActionRowComponents(buttons)
    ]);
    await interaction.reply(prompt);
    const response = await interaction.fetchReply();
    const choice = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 60_000,
        filter: (button) => button.user.id === interaction.user.id
            && (button.customId === confirmId || button.customId === cancelId),
    }).catch(() => null);

    if (!choice || choice.customId === cancelId) {
        const message = choice ? '已取消拆除，本王不會動這座反應站。' : '確認已逾時，反應站維持原狀。';
        const payload = v2Notice('🏷️ 拆除已取消', message, UI_COLORS.MUTED);
        if (choice) await choice.update({ components: payload.components });
        else await interaction.editReply(v2EditPayload(payload)).catch(() => {});
        return;
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

    const completed = v2Notice('🏷️ 反應站已拆除', `🐕✅ 已刪除訊息 \`${messageId}\` 的反應身分組設定！汪！`, UI_COLORS.SUCCESS);
    await choice.update({ components: completed.components });
}
