import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setRpgEnabled, isRpgEnabled } from '../../rpg/rpgDatabase.js';
import { updateGuildSetting } from '../../utils/database.js';
import { broadcastRpgEvent } from '../../rpg/rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('setup-rpg')
    .setNameLocalizations({ 'zh-TW': '設定rpg' })
    .setDescription('🎮 管理 RPG 系統開關')
    .setDescriptionLocalizations({ 'zh-TW': '🎮 管理 RPG 系統開關' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
        sub.setName('enable')
            .setNameLocalizations({ 'zh-TW': '啟用' })
            .setDescription('✅ 啟用 RPG 系統')
            .setDescriptionLocalizations({ 'zh-TW': '✅ 啟用 RPG 系統' })
    )
    .addSubcommand(sub =>
        sub.setName('disable')
            .setNameLocalizations({ 'zh-TW': '關閉' })
            .setDescription('❌ 停用 RPG 系統（資料保留）')
            .setDescriptionLocalizations({ 'zh-TW': '❌ 停用 RPG 系統（資料保留）' })
    )
    .addSubcommand(sub =>
        sub.setName('set-broadcast')
            .setNameLocalizations({ 'zh-TW': '設定廣播頻道' })
            .setDescription('📢 設定「王國歷代記」全域廣播頻道（里程碑等級、首殺、傳說寶物）')
            .setDescriptionLocalizations({ 'zh-TW': '📢 設定「王國歷代記」全域廣播頻道（里程碑等級、首殺、傳說寶物）' })
            .addChannelOption(opt =>
                opt.setName('channel')
                    .setNameLocalizations({ 'zh-TW': '頻道' })
                    .setDescription('要發送廣播的頻道 (留空則關閉廣播)')
                    .setDescriptionLocalizations({ 'zh-TW': '要發送廣播的頻道 (留空則關閉廣播)' })
                    .setRequired(false)
            )
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'enable') {
        setRpgEnabled(guildId, true);
        await interaction.reply({ content: '🐕👑 汪！吉吉王國 RPG 系統已**啟用**！\n子民們現在可以使用 `/rpg` 開始冒險了！', flags: ['Ephemeral'] });
    } else if (sub === 'disable') {
        setRpgEnabled(guildId, false);
        await interaction.reply({ content: '🐕 汪...RPG 系統已**停用**。\n角色資料會保留，隨時可以重新啟用！', flags: ['Ephemeral'] });
    } else if (sub === 'set-broadcast') {
        const channel = interaction.options.getChannel('channel');
        if (channel) {
            updateGuildSetting(guildId, 'rpg_broadcast_channel', channel.id);
            await interaction.reply({
                content: `📢 已將「王國歷代記」 RPG 廣播頻道綁定至 <#${channel.id}>！\n本王已經發送了慶賀公告，請前往查看！汪！`,
                flags: ['Ephemeral']
            });

            // 發送開張公告
            await broadcastRpgEvent(interaction.client, guildId, {
                title: '🏰 王國歷代記：史詩篇章正式開啟！',
                description: [
                    `${fmt(COLORS.GOLD, '━━━━━━━【 冒險者公會公告 】━━━━━━━')}`,
                    '',
                    `親愛的子民們，${fmt(COLORS.CYAN, '吉吉王國')} 的史官已在此就位！`,
                    `這座頻道將永久記載這片大陸上發生的所有${fmt(COLORS.MAGENTA, '傳奇事件')}。`,
                    '',
                    `${fmt(COLORS.WHITE, '⚔️ [ 記載範圍 ]')}`,
                    ` • ${fmt(COLORS.GREEN, '位階突破')}: 勇者達成 Lv.30/60/90 等級里程碑`,
                    ` • ${fmt(COLORS.GOLD, '稀世珍寶')}: 獲得史詩、神話或傳說品質裝備`,
                    ` • ${fmt(COLORS.RED, '世界首殺')}: 全伺服器首次擊敗區域強大首領`,
                    ` • ${fmt(COLORS.GRAY, '英雄隕落')}: 記載每一場壯烈的犧牲與連敗`,
                    '',
                    `${fmt(COLORS.GOLD, '✨ [ 如何開始 ]')}`,
                    `輸入 ${fmt(COLORS.BLUE, '/rpg')} 即可踏上征途、領取裝備並開始冒險！`,
                    '',
                    `${fmt(COLORS.GOLD, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`,
                    `${fmt(COLORS.GOLD, '「願太陽神守護每一位勇往直前的靈魂。」')}`,
                    `${fmt(COLORS.GRAY, '— 吉吉國王 🐕👑')}`
                ].join('\n'),
                color: 0xFFD700
            });
        } else {
            updateGuildSetting(guildId, 'rpg_broadcast_channel', null);
            await interaction.reply({
                content: `🔇 已**關閉** RPG 廣播功能。國王將不會再全服通報各位冒險者的豐功偉業。`,
                flags: ['Ephemeral']
            });
        }
    }
}
