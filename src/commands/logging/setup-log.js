import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { updateGuildSetting, getGuildSettings } from '../../utils/database.js';
import { fmt, COLORS } from '../../utils/style.js';
import { parseJsonObject } from '../../utils/jsonUtils.js';

export const data = new SlashCommandBuilder()
    .setName('setup-log')
    .setNameLocalizations({ 'zh-TW': '設定紀錄' })
    .setDescription('📝 史官紀錄控制台：設定頻道或切換記錄類別')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
        opt.setName('channel')
            .setNameLocalizations({ 'zh-TW': '頻道' })
            .setDescription('設定日誌記錄的目標頻道（若不填則僅開啟控制面板）')
            .addChannelTypes(ChannelType.GuildText)
    );

export async function execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const settings = getGuildSettings(interaction.guildId);

    if (channel) {
        updateGuildSetting(interaction.guildId, 'log_channel', channel.id);
        return await interaction.reply({
            content: `🐕✅ **本王已將史官安置在 ${channel}！**\n` + '```ansi\n' + fmt(COLORS.CYAN, '從今以後，領地內的一舉一動都逃不過本王的法眼！汪！') + '\n```'
        });
    }

    // 發送控制面板
    const toggles = parseJsonObject(settings.log_toggles, { message: 1, member: 1, server: 1, voice: 1, thread: 1 });
    
    const categories = [
        { label: '💬 訊息紀錄', description: '監控訊息刪除與修改 (含刪除者偵測)', value: 'message' },
        { label: '👥 成員變動', description: '監控加入/離開、身分組、禁言與封鎖 (含推薦人追蹤)', value: 'member' },
        { label: '🏰 伺服器改動', description: '監控頻道、角色與 Emoji 的增刪改 (含執行者偵測)', value: 'server' },
        { label: '🎙️ 語音狀態', description: '監控成員加入或切換語音頻道', value: 'voice' },
        { label: '🧵 討論串監控', description: '監控 Thread 的創建、刪除與封存', value: 'thread' }
    ];

    const select = new StringSelectMenuBuilder()
        .setCustomId('log_toggle_select')
        .setPlaceholder('選擇要「開啟」的日誌類別...')
        .setMinValues(0)
        .setMaxValues(categories.length)
        .addOptions(
            categories.map(cat => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(cat.label)
                    .setDescription(cat.description)
                    .setValue(cat.value)
                    .setDefault(toggles[cat.value] === 1)
            )
        );

    const row = new ActionRowBuilder().addComponents(select);

    const statusList = categories.map(cat => {
        const isEnabled = toggles[cat.value] === 1;
        return `${isEnabled ? '✅' : '❌'} ${cat.label.split(' ')[1]}`;
    }).join(' | ');

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('📝 領地史官控制面板')
        .setDescription(
            '請從下方清單勾選您想要**開啟**的紀錄類別。\n未被選中的類別將會被自動關閉。汪！\n\n' +
            `**當前監控狀態：**\n> ${statusList}`
        )
        .addFields(
            { name: '📍 當前頻道', value: settings.log_channel ? `<#${settings.log_channel}>` : '❌ 尚未設定', inline: true },
            { name: '⚙️ 運作狀態', value: '正常監管中', inline: true }
        )
        .setFooter({ text: '🐕 汪！本王喜歡聽各種領地的八卦！' });

    await interaction.reply({ embeds: [embed], components: [row], flags: ['Ephemeral'] });
}
