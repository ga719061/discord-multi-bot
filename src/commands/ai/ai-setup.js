import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getAiSettings, updateAiSetting } from '../../utils/database.js';
import { DEFAULT_AI_PROMPT } from '../../utils/aiChat.js';
import { fmt, COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('ai-setup')
    .setNameLocalizations({ 'zh-TW': 'ai設定' })
    .setDescription('🐕🤖 吉吉國王 AI 核心功能設定管理')
    .setDescriptionLocalizations({ 'zh-TW': '🐕🤖 吉吉國王 AI 核心功能設定管理' })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('role')
            .setNameLocalizations({ 'zh-TW': '角色設定' })
            .setDescription('🎭 塑造國王的個性：修改 AI 的提示詞')
            .setDescriptionLocalizations({ 'zh-TW': '🎭 塑造國王的個性：修改 AI 的提示詞' })
            .addStringOption(opt =>
                opt.setName('description')
                    .setNameLocalizations({ 'zh-TW': '說明' })
                    .setDescription('例如：你是一個冷靜的中文助手。留空則恢復原廠設定。')
                    .setDescriptionLocalizations({ 'zh-TW': '例如：你是一個冷靜的中文助手。留空則恢復原廠設定。' })
                    .setRequired(false)
            )
    )
    .addSubcommand(sub =>
        sub.setName('whitelist')
            .setNameLocalizations({ 'zh-TW': '白名單管理' })
            .setDescription('👥受寵子民名冊：管理能無條件對話的白名單')
            .setDescriptionLocalizations({ 'zh-TW': '👥受寵子民名冊：管理能無條件對話的白名單' })
            .addStringOption(opt =>
                opt.setName('action')
                    .setNameLocalizations({ 'zh-TW': '動作' })
                    .setDescription('add 加入 / remove 移除')
                    .setDescriptionLocalizations({ 'zh-TW': 'add 加入 / remove 移除' })
                    .setRequired(true)
                    .addChoices(
                        { name: '加入 (add)', name_localizations: { 'zh-TW': '加入 (add)' }, value: 'add' },
                        { name: '移除 (remove)', name_localizations: { 'zh-TW': '移除 (remove)' }, value: 'remove' }
                    )
            )
            .addUserOption(opt =>
                opt.setName('user')
                    .setNameLocalizations({ 'zh-TW': '使用者' })
                    .setDescription('要加入/移除的用戶')
                    .setDescriptionLocalizations({ 'zh-TW': '要加入/移除的用戶' })
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('model')
            .setNameLocalizations({ 'zh-TW': '模型切換' })
            .setDescription('🧠 切換國王大腦：替換使用的 AI 模型版本')
            .setDescriptionLocalizations({ 'zh-TW': '🧠 切換國王大腦：替換使用的 AI 模型版本' })
            .addStringOption(opt =>
                opt.setName('name')
                    .setNameLocalizations({ 'zh-TW': '模型名稱' })
                    .setDescription('選擇要使用的模型')
                    .setDescriptionLocalizations({ 'zh-TW': '選擇要使用的模型' })
                    .setRequired(true)
                    .addChoices(
                        { name: 'Gemini 2.5 Flash', name_localizations: { 'zh-TW': 'Gemini 2.5 Flash' }, value: 'gemini-2.5-flash' },
                        { name: 'Gemini 2.5 Flash-Lite', name_localizations: { 'zh-TW': 'Gemini 2.5 Flash-Lite' }, value: 'gemini-2.5-flash-lite' },
                        { name: 'Gemini 3 Flash Preview (Experimental)', name_localizations: { 'zh-TW': 'Gemini 3 Flash Preview (實驗中)' }, value: 'gemini-3-flash-preview' },
                        { name: 'Gemini 3.1 Pro Preview', name_localizations: { 'zh-TW': 'Gemini 3.1 Pro Preview' }, value: 'gemini-3.1-pro-preview' },
                        { name: 'Gemini 3.1 Flash-Lite Preview', name_localizations: { 'zh-TW': 'Gemini 3.1 Flash-Lite Preview' }, value: 'gemini-3.1-flash-lite-preview' }
                    )
            )
    )
    .addSubcommand(sub =>
        sub.setName('search')
            .setNameLocalizations({ 'zh-TW': '聯網檢索' })
            .setDescription('🌐 天文地理能力：控制 AI 是否能夠即時上網查詢')
            .setDescriptionLocalizations({ 'zh-TW': '🌐 天文地理能力：控制 AI 是否能夠即時上網查詢' })
            .addStringOption(opt =>
                opt.setName('switch')
                    .setNameLocalizations({ 'zh-TW': '開關' })
                    .setDescription('開啟或關閉聯網功能')
                    .setDescriptionLocalizations({ 'zh-TW': '開啟或關閉聯網功能' })
                    .setRequired(true)
                    .addChoices(
                        { name: '開啟 (enable)', name_localizations: { 'zh-TW': '開啟 (enable)' }, value: 'enable' },
                        { name: '關閉 (disable)', name_localizations: { 'zh-TW': '關閉 (disable)' }, value: 'disable' }
                    )
            )
    )
    .addSubcommand(sub =>
        sub.setName('status')
            .setNameLocalizations({ 'zh-TW': '狀態面板' })
            .setDescription('📱 儀表板：監視目前 AI 的狀態與核心配置')
            .setDescriptionLocalizations({ 'zh-TW': '📱 儀表板：監視目前 AI 的狀態與核心配置' })
    )
    .addSubcommand(sub =>
        sub.setName('party')
            .setNameLocalizations({ 'zh-TW': '派對模式' })
            .setDescription('🎉 解放全國：開放全頻道限時免點名的聊天派對')
            .setDescriptionLocalizations({ 'zh-TW': '🎉 解放全國：開放全頻道限時免點名的聊天派對' })
            .addChannelOption(opt =>
                opt.setName('channel')
                    .setNameLocalizations({ 'zh-TW': '目標頻道' })
                    .setDescription('要開放的頻道')
                    .setDescriptionLocalizations({ 'zh-TW': '要開放的頻道' })
                    .setRequired(true)
            )
            .addIntegerOption(opt =>
                opt.setName('minutes')
                    .setNameLocalizations({ 'zh-TW': '持續分鐘' })
                    .setDescription('開放幾分鐘?')
                    .setDescriptionLocalizations({ 'zh-TW': '開放幾分鐘?' })
                    .setMinValue(1)
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('context')
            .setNameLocalizations({ 'zh-TW': '對話記憶' })
            .setDescription('🧠 記憶體升級：控制 AI 是否要記住上下文對話紀錄')
            .setDescriptionLocalizations({ 'zh-TW': '🧠 記憶體升級：控制 AI 是否要記住上下文對話紀錄' })
            .addStringOption(opt =>
                opt.setName('switch')
                    .setNameLocalizations({ 'zh-TW': '開關' })
                    .setDescription('開啟或關閉上下文記憶')
                    .setDescriptionLocalizations({ 'zh-TW': '開啟或關閉上下文記憶' })
                    .setRequired(true)
                    .addChoices(
                        { name: '開啟 (enable)', name_localizations: { 'zh-TW': '開啟 (enable)' }, value: 'enable' },
                        { name: '關閉 (disable)', name_localizations: { 'zh-TW': '關閉 (disable)' }, value: 'disable' }
                    )
            )
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // 🔒 檢查是否有登入
    const settings = getAiSettings(guildId);
    const adminIds = settings.admin_ids || [];

    if (!adminIds.includes(userId)) {
        return interaction.reply({
            content: '❌ 權限不足！請先使用 `/ai-login` 輸入密碼進行驗證。',
            flags: ['Ephemeral']
        });
    }

    if (sub === 'role') {
        const prompt = interaction.options.getString('description');
        const finalPrompt = prompt || DEFAULT_AI_PROMPT;

        updateAiSetting(guildId, 'system_prompt', finalPrompt);

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🐕🎭 AI 角色設定完成！')
                .setDescription(prompt ? `汪！AI 現在會以以下方式回應：\n\n\`\`\`ansi\n${fmt(COLORS.CYAN, prompt)}\n\`\`\`` : `汪！AI 的個性已經恢復成**原廠預設的偉大吉吉國王模式**了！`)
            ],
            flags: ['Ephemeral'],
        });

    } else if (sub === 'whitelist') {
        const action = interaction.options.getString('action');
        const target = interaction.options.getUser('user');
        const settings = getAiSettings(guildId);
        let list = settings.whitelist;

        const targetName = target.displayName ?? target.username;

        if (action === 'add') {
            if (list.includes(target.id)) {
                return interaction.reply({ content: `🐕 ${targetName} 已經在白名單裡惹！`, flags: ['Ephemeral'] });
            }
            list.push(target.id);
            updateAiSetting(guildId, 'whitelist', JSON.stringify(list));
            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🐕✅ 白名單更新！')
                    .setDescription(`**${targetName}** 已加入白名單，現在他可以跟 AI 聊天了！汪！`)
                ],
                flags: ['Ephemeral'],
            });

        } else if (action === 'remove') {
            if (!list.includes(target.id)) {
                return interaction.reply({ content: `🐕 ${targetName} 本來就不在白名單裡喔～`, flags: ['Ephemeral'] });
            }
            list = list.filter(id => id !== target.id);
            updateAiSetting(guildId, 'whitelist', JSON.stringify(list));
            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🐕❌ 白名單更新！')
                    .setDescription(`**${targetName}** 已從白名單移除。再見了，朋友。`)
                ],
                flags: ['Ephemeral'],
            });
        }

    } else if (sub === 'model') {
        const modelName = interaction.options.getString('name');
        updateAiSetting(guildId, 'model', modelName);
        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🐕🤖 AI 模型已更新！')
                .setDescription(`汪！現在使用的模型是：\n**${modelName}**`)
            ],
            flags: ['Ephemeral'],
        });

    } else if (sub === 'search') {
        const switchValue = interaction.options.getString('switch');
        const isEnabled = switchValue === 'enable';
        updateAiSetting(guildId, 'search_enabled', isEnabled ? 1 : 0);

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
                .setTitle(isEnabled ? '🐕🌐 AI 聯網功能已開啟！' : '🐕💤 AI 聯網功能已關閉！')
                .setDescription(isEnabled
                    ? '汪！現在本王可以上網搜尋最新的資訊了！'
                    : '汪！本王決定專注於內在修養，不再上網了。')
            ],
            flags: ['Ephemeral'],
        });

    } else if (sub === 'party') {
        const targetChannel = interaction.options.getChannel('channel');
        const minutes = interaction.options.getInteger('minutes');
        const expiresAt = Date.now() + minutes * 60 * 1000;

        updateAiSetting(guildId, 'party_channel_id', targetChannel.id);
        updateAiSetting(guildId, 'party_expires_at', expiresAt);
        updateAiSetting(guildId, 'enabled', 1);

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🐕🎉 AI 狂歡派對設定成功！')
                .setDescription(`已在 <#${targetChannel.id}> 開放「提及聊天」特權！\n在這段時間內，任何人只需 **@本王**，國王就會親自回應！\n⏱️ 持續時間：**${minutes} 分鐘**`)
            ],
            flags: ['Ephemeral'],
        });

        // 傳送入場台詞到目標頻道
        await targetChannel.send('🛡️ **（號角長鳴）汪！諸位廷臣肅靜！本王已駕臨『御前圓桌會議』！**\n從此刻起，卸下所有規矩，只要呼喚 (@) 本王，你們的每一句諫言，本王都將親自審度與回應。現在，開始你們的奏報吧！').catch(() => { });

        // 派對到期由 partyManager 輪詢處理（重啟後依然有效）

    } else if (sub === 'context') {
        const switchValue = interaction.options.getString('switch');
        const isEnabled = switchValue === 'enable';
        updateAiSetting(guildId, 'context_enabled', isEnabled ? 1 : 0);

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
                .setTitle(isEnabled ? '🐕🧠 AI 上下文記憶已開啟！' : '🐕🧠 AI 上下文記憶已關閉！')
                .setDescription(isEnabled
                    ? '汪！本王現在會參考之前的對話紀錄，回覆會更加連貫喔！'
                    : '汪！本王決定拋棄過去，只專注於你現在說的一言一語。')
            ],
            flags: ['Ephemeral'],
        });

    } else if (sub === 'status') {
        const settings = getAiSettings(guildId);
        const whitelistText = settings.whitelist.length > 0
            ? settings.whitelist.map(id => `<@${id}>`).join(', ')
            : '（空空如也，沒人被王受寵）';
        const currentModel = settings.model || 'gemini-2.5-flash-lite'; // Default fallback
        const searchStatus = settings.search_enabled ? '✅ 已開啟 (可查最新時事)' : '❌ 已關閉 (無法聯網)';
        const contextStatus = settings.context_enabled !== false ? '✅ 已開啟 (回覆連貫)' : '❌ 已關閉 (不看前文)';

        const now = Date.now();
        const isPartyActive = settings.party_channel_id && settings.party_expires_at && now < settings.party_expires_at;
        const partyText = isPartyActive
            ? `🎉 進行中！頻道：<#${settings.party_channel_id}> (結束時間：<t:${Math.floor(settings.party_expires_at / 1000)}:R>)`
            : '💤 目前沒有舉辦派對';

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🐕🤖 吉吉國王 AI 核心狀態面板')
                .setDescription('管理者，以下是國王目前的腦袋與靈魂狀態：')
                .addFields(
                    { name: '🔌 核心系統', value: '```ansi\n' + fmt(COLORS.GREEN, '✅ 預設開啟中 (常駐)') + '\n```', inline: true },
                    { name: '🧠 思考引擎', value: '```ansi\n' + fmt(COLORS.BLUE, currentModel) + '\n```', inline: true },
                    { name: '🌐 聯網能力', value: '```ansi\n' + (settings.search_enabled ? fmt(COLORS.GREEN, '✅ 已開啟') : fmt(COLORS.RED, '❌ 已關閉')) + '\n```', inline: true },
                    { name: '📚 記憶系統', value: '```ansi\n' + (settings.context_enabled !== false ? fmt(COLORS.GREEN, '✅ 已開啟') : fmt(COLORS.RED, '❌ 已關閉')) + '\n```', inline: true },
                    { name: '🎉 派對模式', value: '```ansi\n' + (isPartyActive ? fmt(COLORS.GOLD, '✅ 進行中') : fmt(COLORS.GRAY, '💤 休息中')) + '\n```', inline: true },
                    { name: '🎭 靈魂塑形 (個性設定)', value: '```ansi\n' + fmt(COLORS.CYAN, (settings.system_prompt || DEFAULT_AI_PROMPT).substring(0, 200) + '...') + '\n```' },
                    { name: `👥 御准白名單 (${settings.whitelist.length} 人)`, value: whitelistText }
                )
                .setFooter({ text: '💡 提示：白名單外的平民只能在「派對模式」期間與國王說話！' })
            ],
            flags: ['Ephemeral'],
        });
    }
}
