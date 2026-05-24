import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getAiSettings, updateAiSetting } from '../../utils/database.js';
import { DEFAULT_AI_PROMPT } from '../../utils/aiChat.js';
import { DEFAULT_AI_MODEL } from '../../utils/aiConfig.js';
import { fmt, COLORS, UI_COLORS } from '../../utils/style.js';
import { embedsToV2Payload, v2Notice } from '../../utils/componentsV2.js';

export const data = new SlashCommandBuilder()
    .setName('智慧設定')
    .setDescription('🐕🤖 吉吉國王 AI 核心功能設定管理')
    .setDescriptionLocalizations({ 'zh-TW': '🐕🤖 吉吉國王 AI 核心功能設定管理' })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('角色設定')
            .setDescription('🎭 塑造國王的個性：修改 AI 的提示詞')
            .setDescriptionLocalizations({ 'zh-TW': '🎭 塑造國王的個性：修改 AI 的提示詞' })
            .addStringOption(opt =>
                opt.setName('說明')
                    .setDescription('例如：你是一個冷靜的中文助手。留空則恢復原廠設定。')
                    .setDescriptionLocalizations({ 'zh-TW': '例如：你是一個冷靜的中文助手。留空則恢復原廠設定。' })
                    .setRequired(false)
            )
    )
    .addSubcommand(sub =>
        sub.setName('白名單管理')
            .setDescription('👥受寵子民名冊：管理能無條件對話的白名單')
            .setDescriptionLocalizations({ 'zh-TW': '👥受寵子民名冊：管理能無條件對話的白名單' })
            .addStringOption(opt =>
                opt.setName('動作')
                    .setDescription('add 加入 / remove 移除')
                    .setDescriptionLocalizations({ 'zh-TW': 'add 加入 / remove 移除' })
                    .setRequired(true)
                    .addChoices(
                        { name: '加入 (add)', value: 'add' },
                        { name: '移除 (remove)', value: 'remove' }
                    )
            )
            .addUserOption(opt =>
                opt.setName('使用者')
                    .setDescription('要加入/移除的用戶')
                    .setDescriptionLocalizations({ 'zh-TW': '要加入/移除的用戶' })
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('模型切換')
            .setDescription('🧠 切換國王大腦：替換使用的 AI 模型版本')
            .setDescriptionLocalizations({ 'zh-TW': '🧠 切換國王大腦：替換使用的 AI 模型版本' })
            .addStringOption(opt =>
                opt.setName('模型名稱')
                    .setDescription('選擇要使用的模型')
                    .setDescriptionLocalizations({ 'zh-TW': '選擇要使用的模型' })
                    .setRequired(true)
                    .addChoices(
                        { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
                        { name: 'Gemini 2.5 Flash-Lite', value: 'gemini-2.5-flash-lite' },
                        { name: 'Gemini 3 Flash Preview (Experimental)', value: 'gemini-3-flash-preview' },
                        { name: 'Gemini 3.1 Pro Preview', value: 'gemini-3.1-pro-preview' },
                        { name: 'Gemini 3.1 Flash-Lite Preview', value: 'gemini-3.1-flash-lite-preview' }
                    )
            )
    )
    .addSubcommand(sub =>
        sub.setName('聯網檢索')
            .setDescription('🌐 天文地理能力：控制 AI 是否能夠即時上網查詢')
            .setDescriptionLocalizations({ 'zh-TW': '🌐 天文地理能力：控制 AI 是否能夠即時上網查詢' })
            .addStringOption(opt =>
                opt.setName('開關')
                    .setDescription('開啟或關閉聯網功能')
                    .setDescriptionLocalizations({ 'zh-TW': '開啟或關閉聯網功能' })
                    .setRequired(true)
                    .addChoices(
                        { name: '開啟 (enable)', value: 'enable' },
                        { name: '關閉 (disable)', value: 'disable' }
                    )
            )
    )
    .addSubcommand(sub =>
        sub.setName('狀態面板')
            .setDescription('📱 儀表板：監視目前 AI 的狀態與核心配置')
            .setDescriptionLocalizations({ 'zh-TW': '📱 儀表板：監視目前 AI 的狀態與核心配置' })
    )
    .addSubcommand(sub =>
        sub.setName('派對模式')
            .setDescription('🎉 解放全國：限時開放指定頻道讓所有人可 @國王 聊天')
            .setDescriptionLocalizations({ 'zh-TW': '🎉 解放全國：限時開放指定頻道讓所有人可 @國王 聊天' })
            .addChannelOption(opt =>
                opt.setName('目標頻道')
                    .setDescription('要開放的頻道')
                    .setDescriptionLocalizations({ 'zh-TW': '要開放的頻道' })
                    .setRequired(true)
            )
            .addIntegerOption(opt =>
                opt.setName('持續分鐘')
                    .setDescription('開放幾分鐘?')
                    .setDescriptionLocalizations({ 'zh-TW': '開放幾分鐘?' })
                    .setMinValue(1)
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('對話記憶')
            .setDescription('🧠 記憶體升級：控制 AI 是否要記住上下文對話紀錄')
            .setDescriptionLocalizations({ 'zh-TW': '🧠 記憶體升級：控制 AI 是否要記住上下文對話紀錄' })
            .addStringOption(opt =>
                opt.setName('開關')
                    .setDescription('開啟或關閉上下文記憶')
                    .setDescriptionLocalizations({ 'zh-TW': '開啟或關閉上下文記憶' })
                    .setRequired(true)
                    .addChoices(
                        { name: '開啟 (enable)', value: 'enable' },
                        { name: '關閉 (disable)', value: 'disable' }
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
        return interaction.reply(v2Notice('🔐 尚未驗證身份', '請先使用 `/智慧登入` 輸入密碼進行驗證。', UI_COLORS.DANGER));
    }

    if (sub === '角色設定') {
        const prompt = interaction.options.getString('說明');
        const finalPrompt = prompt || DEFAULT_AI_PROMPT;

        updateAiSetting(guildId, 'system_prompt', finalPrompt);

        await interaction.reply(embedsToV2Payload([new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🐕🎭 AI 角色設定完成！')
                .setDescription(prompt ? `汪！AI 現在會以以下方式回應：\n\n\`\`\`ansi\n${fmt(COLORS.CYAN, prompt)}\n\`\`\`` : `汪！AI 的個性已經恢復成**原廠預設的偉大吉吉國王模式**了！`)
            ], { ephemeral: true }));

    } else if (sub === '白名單管理') {
        const action = interaction.options.getString('動作');
        const target = interaction.options.getUser('使用者');
        const settings = getAiSettings(guildId);
        let list = settings.whitelist;

        const targetName = target.displayName ?? target.username;

        if (action === 'add') {
            if (list.includes(target.id)) {
                return interaction.reply(v2Notice('👥 白名單未變更', `🐕 ${targetName} 已經在白名單裡惹！`, UI_COLORS.WARNING));
            }
            list.push(target.id);
            updateAiSetting(guildId, 'whitelist', JSON.stringify(list));
            await interaction.reply(embedsToV2Payload([new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🐕✅ 白名單更新！')
                    .setDescription(`**${targetName}** 已加入白名單，現在他可以跟 AI 聊天了！汪！`)
                ], { ephemeral: true }));

        } else if (action === 'remove') {
            if (!list.includes(target.id)) {
                return interaction.reply(v2Notice('👥 白名單未變更', `🐕 ${targetName} 本來就不在白名單裡喔～`, UI_COLORS.WARNING));
            }
            list = list.filter(id => id !== target.id);
            updateAiSetting(guildId, 'whitelist', JSON.stringify(list));
            await interaction.reply(embedsToV2Payload([new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🐕❌ 白名單更新！')
                    .setDescription(`**${targetName}** 已從白名單移除。再見了，朋友。`)
                ], { ephemeral: true }));
        }

    } else if (sub === '模型切換') {
        const modelName = interaction.options.getString('模型名稱');
        updateAiSetting(guildId, 'model', modelName);
        await interaction.reply(embedsToV2Payload([new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🐕🤖 AI 模型已更新！')
                .setDescription(`汪！現在使用的模型是：\n**${modelName}**`)
            ], { ephemeral: true }));

    } else if (sub === '聯網檢索') {
        const switchValue = interaction.options.getString('開關');
        const isEnabled = switchValue === 'enable';
        updateAiSetting(guildId, 'search_enabled', isEnabled ? 1 : 0);

        await interaction.reply(embedsToV2Payload([new EmbedBuilder()
                .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
                .setTitle(isEnabled ? '🐕🌐 AI 聯網功能已開啟！' : '🐕💤 AI 聯網功能已關閉！')
                .setDescription(isEnabled
                    ? '汪！現在本王可以上網搜尋最新的資訊了！'
                    : '汪！本王決定專注於內在修養，不再上網了。')
            ], { ephemeral: true }));

    } else if (sub === '派對模式') {
        const targetChannel = interaction.options.getChannel('目標頻道');
        const minutes = interaction.options.getInteger('持續分鐘');
        const expiresAt = Date.now() + minutes * 60 * 1000;

        updateAiSetting(guildId, 'party_channel_id', targetChannel.id);
        updateAiSetting(guildId, 'party_expires_at', expiresAt);
        updateAiSetting(guildId, 'enabled', 1);

        await interaction.reply(embedsToV2Payload([new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🐕🎉 AI 狂歡派對設定成功！')
                .setDescription(`已在 <#${targetChannel.id}> 開放「提及聊天」特權！\n在這段時間內，任何人只需 **@本王**，國王就會親自回應！\n⏱️ 持續時間：**${minutes} 分鐘**`)
            ], { ephemeral: true }));

        // 傳送入場台詞到目標頻道
        await targetChannel.send(v2Notice(
            '🎉 御前圓桌會議開幕',
            '🛡️ **（號角長鳴）汪！諸位廷臣肅靜！本王已駕臨！**\n從此刻起，只要 `@` 本王，你們的每一句諫言，本王都將親自審度與回應。',
            UI_COLORS.ROYAL,
            { ephemeral: false }
        )).catch(() => { });

        // 派對到期由 partyManager 輪詢處理（重啟後依然有效）

    } else if (sub === '對話記憶') {
        const switchValue = interaction.options.getString('開關');
        const isEnabled = switchValue === 'enable';
        updateAiSetting(guildId, 'context_enabled', isEnabled ? 1 : 0);

        await interaction.reply(embedsToV2Payload([new EmbedBuilder()
                .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
                .setTitle(isEnabled ? '🐕🧠 AI 上下文記憶已開啟！' : '🐕🧠 AI 上下文記憶已關閉！')
                .setDescription(isEnabled
                    ? '汪！本王現在會參考之前的對話紀錄，回覆會更加連貫喔！'
                    : '汪！本王決定拋棄過去，只專注於你現在說的一言一語。')
            ], { ephemeral: true }));

    } else if (sub === '狀態面板') {
        const settings = getAiSettings(guildId);
        const whitelistText = settings.whitelist.length > 0
            ? settings.whitelist.map(id => `<@${id}>`).join(', ')
            : '（空空如也，沒人被王受寵）';
        const currentModel = settings.model || DEFAULT_AI_MODEL;
        const searchStatus = settings.search_enabled ? '✅ 已開啟 (可查最新時事)' : '❌ 已關閉 (無法聯網)';
        const contextStatus = settings.context_enabled !== false ? '✅ 已開啟 (回覆連貫)' : '❌ 已關閉 (不看前文)';

        const now = Date.now();
        const isPartyActive = settings.party_channel_id && settings.party_expires_at && now < settings.party_expires_at;
        const partyText = isPartyActive
            ? `🎉 進行中！頻道：<#${settings.party_channel_id}> (結束時間：<t:${Math.floor(settings.party_expires_at / 1000)}:R>)`
            : '💤 目前沒有舉辦派對';

        await interaction.reply(embedsToV2Payload([new EmbedBuilder()
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
            ], { ephemeral: true }));
    }
}
