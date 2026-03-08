import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isRpgEnabled } from '../../rpg/rpgDatabase.js';
import { ansi, fmt, COLORS } from '../../utils/style.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const data = new SlashCommandBuilder()
    .setName('help')
    .setNameLocalizations({ 'zh-TW': '幫助' })
    .setDescription('📖 指令大典：由本王親自為你解說所有的皇家指令機制')
    .setDescriptionLocalizations({ 'zh-TW': '📖 指令大典：由本王親自為你解說所有的皇家指令機制' });

export async function execute(interaction) {
    let appCommands = interaction.client.application.commands.cache;
    if (appCommands.size === 0) {
        appCommands = await interaction.client.application.commands.fetch().catch(() => new Map());
    }

    const commandsDir = path.join(__dirname, '..');
    const categories = fs.readdirSync(commandsDir).filter(file => fs.statSync(path.join(commandsDir, file)).isDirectory());

    const categoryEmojis = {
        'admin': '🛡️ 管理員',
        'ai': '🤖 AI 功能',
        'fun': '🎉 娛樂',
        'general': '🐕 一般',
        'leveling': '⭐ 等級',
        'logging': '📝 史官紀錄',
        'roles': '🏷️ 身分組',
        'steam': '🎮 Steam 遊戲特價',
        'welcome': '👋 歡迎',
        'rpg': '⚔️ RPG 冒險',
    };

    const isAdmin = interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
    const rpgEnabled = isRpgEnabled(interaction.guildId);
    const visibleCategories = categories.filter(cat => {
        if ((cat === 'admin' || cat === 'ai' || cat === 'logging' || cat === 'roles') && !isAdmin) return false;
        if (cat === 'rpg' && !rpgEnabled && !isAdmin) return false;
        return true;
    });

    const options = visibleCategories.map(cat => ({
        label: categoryEmojis[cat] || cat.charAt(0).toUpperCase() + cat.slice(1),
        description: `查看 ${cat} 類別的指令`,
        value: cat,
        emoji: (categoryEmojis[cat] || '📁').split(' ')[0]
    }));

    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('help_category_select')
                .setPlaceholder('🐕 選擇指令類別，本王為你導覽～')
                .addOptions(options)
        );

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🐕👑 吉吉國王的指令大典')
        .setDescription('汪！歡迎來到本王的指令大典！\n從下方選單選擇類別，本王親自為你解說～')
        .addFields(
            { name: '📜 指令統計', value: '```ansi\n' + `總數: ${fmt(COLORS.GREEN, String(interaction.client.commands.size))}\n` + `類別: ${fmt(COLORS.CYAN, String(visibleCategories.length))}\n` + '```', inline: false },
            {
                name: '🐕💬 跟國王互動（不用斜線指令！）', value: [
                    '> 🐾 **摸摸國王** — 摸摸本王（本王心情隨機喔）',
                    '> 🤗 **抱抱國王** — 抱抱本王（好溫暖～）',
                    '> 🔮 **占卜** / **運勢** — 請本王占卜今日運勢',
                    '> 📜 **每日一汪** — 領取本王的每日金句',
                    '> 💬 **@本王** 或提到「**國王**」「**吉吉**」— 跟本王聊天！',
                    '',
                ].join('\n')
            },
        )
        .addFields({ name: '💡 提示', value: '```ansi\n' + fmt(COLORS.GOLD, '也可以用「吉吉」或「吉娃娃」代替「國王」喔！') + '\n```' })
        .setFooter({ text: '🐕 本王隨時待命！使用 /help 召喚本王' });

    if (interaction.member?.permissions.has(PermissionFlagsBits.Administrator)) {
        embed.addFields(
            {
                name: '👑 國王特權（管理員專屬）', value: [
                    '以下高級功能請到各類別選單查詢詳細斜線指令：',
                    '> 📢 `/announce` — 發布精美的王國聖旨公告',
                    '> 📝 `/setup-log` — 安置領地史官與配置監控開關',
                    '> 📈 `/setup-leveling` — 設定皇家等級公告開關',
                    '> 🤖 `/ai-setup` — 管理 AI 模型、搜尋與上下文設定',
                    '> 🏷️ `/reactionrole` — 建立點擊按鈕的自助身分組',
                    '> 🏷️ `/selfrole` — 建立下拉式選單的自助身分組',
                ].join('\n')
            }
        );
    }

    await interaction.reply({ embeds: [embed], components: [row], flags: ['Ephemeral'] });
    const response = await interaction.fetchReply();

    const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: '🐕 汪！這是本王為別人準備的選單，不是你的喔～', flags: ['Ephemeral'] });
        }

        await i.deferUpdate();

        const selectedCategory = i.values[0];
        const categoryPath = path.join(commandsDir, selectedCategory);
        const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));

        const categoryName = categoryEmojis[selectedCategory] || selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
        const categoryEmbed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`${categoryName} 指令`)
            .setDescription(`🐕👑 以下是 **${selectedCategory}** 類別的指令，本王為你一一介紹：`);

        let visibleCommands = 0;
        for (const file of commandFiles) {
            const filePath = `file://${path.join(categoryPath, file).replace(/\\/g, '/')}`;
            const command = await import(filePath);

            if (command.data) {
                if (command.data.default_member_permissions) {
                    const requiredPerms = BigInt(command.data.default_member_permissions);
                    if (!i.member.permissions.has(requiredPerms)) continue;
                }

                const appCmd = appCommands.find(c => c.name === command.data.name);
                const cmdId = appCmd ? appCmd.id : null;

                const subcommands = command.data.options?.filter(o => o.type === 1) || [];

                if (subcommands.length > 0) {
                    for (const sub of subcommands) {
                        const subName = sub.name_localizations?.['zh-TW'] || sub.name;
                        const subDesc = sub.description_localizations?.['zh-TW'] || sub.description;
                        const clickableName = cmdId ? `</${command.data.name} ${sub.name}:${cmdId}>` : `/${command.data.name} ${sub.name}`;
                        
                        let usage = `/${command.data.name} ${sub.name}`;
                        if (sub.options?.length > 0) {
                            usage += sub.options.map(opt => {
                                const optName = opt.name_localizations?.['zh-TW'] || opt.name;
                                return opt.required ? ` <${optName}>` : ` [${optName}]`;
                            }).join('');
                        }

                        categoryEmbed.addFields({
                            name: `🔹 ${subName}`,
                            value: `${subDesc}\n> **指令**: ${clickableName}\n> **參數**: \`${usage}\``,
                            inline: false
                        });
                        visibleCommands++;
                    }
                } else {
                    const cmdName = command.data.name_localizations?.['zh-TW'] || command.data.name;
                    const cmdDesc = command.data.description_localizations?.['zh-TW'] || command.data.description;
                    const clickableName = cmdId ? `</${command.data.name}:${cmdId}>` : `/${command.data.name}`;
                    
                    let usage = `/${command.data.name}`;
                    if (command.data.options?.length > 0) {
                        usage += command.data.options.map(opt => {
                            const optName = opt.name_localizations?.['zh-TW'] || opt.name;
                            return opt.required ? ` <${optName}>` : ` [${optName}]`;
                        }).join('');
                    }

                    categoryEmbed.addFields({
                        name: `🔸 ${cmdName}`,
                        value: `${cmdDesc}\n> **指令**: ${clickableName}\n> **參數**: \`${usage}\``,
                        inline: false
                    });
                    visibleCommands++;
                }
            }
        }

        if (visibleCommands === 0) {
            categoryEmbed.setDescription(`🐕 汪！你沒有權限查看此類別的任何指令喔！`);
        }

        await i.editReply({ embeds: [categoryEmbed], components: [row] });
    });

    collector.on('end', () => {
        const disabledRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_category_select_disabled')
                    .setPlaceholder('🐕 本王累了，選單已過期～')
                    .setDisabled(true)
                    .addOptions([{ label: 'Expired', value: 'expired' }])
            );
        interaction.editReply({ components: [disabledRow] }).catch(() => { });
    });
}
