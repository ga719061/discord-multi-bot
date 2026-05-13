import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    PermissionFlagsBits,
    ChannelType
} from 'discord.js';
import { getGuildSettings, updateGuildSetting } from '../../utils/database.js';
import { fmt, COLORS } from '../../utils/style.js';
import { parseJsonArray } from '../../utils/jsonUtils.js';

export const data = new SlashCommandBuilder()
    .setName('selfrole')
    .setNameLocalizations({ 'zh-TW': '自助身分組' })
    .setDescription('🐕🏷️ 下拉選單身分組佈告系統 (管理員專屬)')
    .setDescriptionLocalizations({ 'zh-TW': '🐕🏷️ 下拉選單身分組佈告系統 (管理員專屬)' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
        sub.setName('add')
            .setNameLocalizations({ 'zh-TW': '新增選項' })
            .setDescription('➕ 新增選項：將特定的身分組加入下拉清單，亦可設定門檻條件')
            .setDescriptionLocalizations({ 'zh-TW': '➕ 新增選項：將特定的身分組加入下拉清單，亦可設定門檻條件' })
            .addRoleOption(opt => 
                opt.setName('role')
                    .setNameLocalizations({ 'zh-TW': '身分組' })
                    .setDescription('要加入的身分組')
                    .setDescriptionLocalizations({ 'zh-TW': '要加入的身分組' })
                    .setRequired(true))
            .addRoleOption(opt => 
                opt.setName('requirement')
                    .setNameLocalizations({ 'zh-TW': '門檻' })
                    .setDescription('領取此身分組所需的先決身分組（選填）')
                    .setDescriptionLocalizations({ 'zh-TW': '領取此身分組所需的先決身分組（選填）' })
                    .setRequired(false))
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setNameLocalizations({ 'zh-TW': '刪除選項' })
            .setDescription('➖ 刪除選項：將身分組從未來的下拉清單選項中除名')
            .setDescriptionLocalizations({ 'zh-TW': '➖ 刪除選項：將身分組從未來的下拉清單選項中除名' })
            .addRoleOption(opt => 
                opt.setName('role')
                    .setNameLocalizations({ 'zh-TW': '身分組' })
                    .setDescription('要移除的身分組')
                    .setDescriptionLocalizations({ 'zh-TW': '要移除的身分組' })
                    .setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('list')
            .setNameLocalizations({ 'zh-TW': '列表總覽' })
            .setDescription('📋 清單總覽：檢視目前設定好，準備隨時發布出去的選單內容')
            .setDescriptionLocalizations({ 'zh-TW': '📋 清單總覽：檢視目前設定好，準備隨時發布出去的選單內容' })
    )
    .addSubcommand(sub =>
        sub.setName('send')
            .setNameLocalizations({ 'zh-TW': '發布選單' })
            .setDescription('🚀 發布選單：在指定頻道正式貼出讓子民選擇的精美下拉佈告')
            .setDescriptionLocalizations({ 'zh-TW': '🚀 發布選單：在指定頻道正式貼出讓子民選擇的精美下拉佈告' })
            .addChannelOption(opt =>
                opt.setName('channel')
                    .setNameLocalizations({ 'zh-TW': '頻道' })
                    .setDescription('發送訊息的頻道')
                    .setDescriptionLocalizations({ 'zh-TW': '發送訊息的頻道' })
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('description')
                    .setNameLocalizations({ 'zh-TW': '描述' })
                    .setDescription('選單訊息的描述文字（選填）')
                    .setDescriptionLocalizations({ 'zh-TW': '選單訊息的描述文字（選填）' })
                    .setRequired(false)
            )
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const settings = getGuildSettings(interaction.guildId);
    let roles = parseJsonArray(settings.selfrole_roles, []);

    // 向後相容處理：將舊的字串陣列轉為物件陣列
    if (roles.length > 0 && typeof roles[0] === 'string') {
        roles = roles.map(id => ({ id, requirement: null }));
    }

    if (sub === 'add') {
        const role = interaction.options.getRole('role');
        const requirement = interaction.options.getRole('requirement');

        // 安全性檢查：禁止具備管理權限的身分組
        const dangerousPermissions = [
            PermissionFlagsBits.Administrator,
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.BanMembers
        ];

        if (dangerousPermissions.some(perm => role.permissions.has(perm))) {
            return interaction.reply({ content: '🐕 ⚠️ 基於安全性考量，不能將具備管理權限的身分組加入自助領取清單！', flags: ['Ephemeral'] });
        }

        if (role.managed || role.id === interaction.guildId) {
            return interaction.reply({ content: '🐕 汪！不能添加機器人專用或所有人身分組！', flags: ['Ephemeral'] });
        }

        if (roles.some(r => r.id === role.id)) {
            return interaction.reply({ content: '🐕 汪！這個身分組已經在清單裡了！', flags: ['Ephemeral'] });
        }
        if (roles.length >= 25) {
            return interaction.reply({ content: '🐕 汪！下拉選單最多隻能容納 25 個身分組！', flags: ['Ephemeral'] });
        }

        roles.push({ id: role.id, requirement: requirement?.id || null });
        updateGuildSetting(interaction.guildId, 'selfrole_roles', JSON.stringify(roles));

        let msg = `🐕✅ 已將 ${role} 加入自助清單！`;
        if (requirement) msg += ` (需備有 ${requirement} 才能領取)`;
        await interaction.reply({ content: msg, flags: ['Ephemeral'] });

    } else if (sub === 'remove') {
        const role = interaction.options.getRole('role');
        if (!roles.some(r => r.id === role.id)) {
            return interaction.reply({ content: '🐕 汪！這個身分組不在清單裡！', flags: ['Ephemeral'] });
        }

        roles = roles.filter(r => r.id !== role.id);
        updateGuildSetting(interaction.guildId, 'selfrole_roles', JSON.stringify(roles));
        await interaction.reply({ content: `🐕✅ 已將 ${role} 從自助清單移除！`, flags: ['Ephemeral'] });

    } else if (sub === 'list') {
        if (roles.length === 0) {
            return interaction.reply({ content: '🐕 目前沒有設定任何自助身分組。', flags: ['Ephemeral'] });
        }

        const roleLines = roles.map(r => {
            const role = interaction.guild.roles.cache.get(r.id);
            if (!role) return null;
            let line = fmt(COLORS.BLUE, `@${role.name}`);
            if (r.requirement) {
                const reqRole = interaction.guild.roles.cache.get(r.requirement);
                if (reqRole) line += ` (門檻: ${fmt(COLORS.GRAY, reqRole.name)})`;
            }
            return line;
        }).filter(r => r !== null).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🐕📋 自助身分組清單')
            .setDescription('```ansi\n' + (roleLines || '尚無設定') + '\n```')
            .setFooter({ text: '🐕 使用 /selfrole send 發送到頻道供成員領取！' });

        await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });

    } else if (sub === 'send') {
        if (roles.length === 0) {
            return interaction.reply({ content: '🐕 汪！請先使用 `/selfrole add` 加入身分組！', flags: ['Ephemeral'] });
        }

        const channel = interaction.options.getChannel('channel');
        const description = interaction.options.getString('description') || '請在下方下拉選單挑選你想要的身分組，勾選後即可自動領取，點擊已領取的可以取消～汪！';

        const menuOptions = roles.map(r => {
            const role = interaction.guild.roles.cache.get(r.id);
            if (!role) return null;

            let desc = `領取或取消 ${role.name} 身分組`;
            if (r.requirement) {
                const reqRole = interaction.guild.roles.cache.get(r.requirement);
                if (reqRole) desc += ` (需備有 ${reqRole.name})`;
            }

            return {
                label: role.name,
                value: r.id,
                description: desc,
            };
        }).filter(opt => opt !== null);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('selfrole_select')
            .setPlaceholder('🐕 挑選你的身分組...')
            .setMinValues(0)
            .setMaxValues(menuOptions.length)
            .addOptions(menuOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🐕👑 吉吉國王的身分組分配！')
            .setDescription(description)
            .setFooter({ text: '吉吉國王會自動處理你的請求！汪！' });

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `🐕✅ 選單已發送到 ${channel}！`, flags: ['Ephemeral'] });
    }
}
