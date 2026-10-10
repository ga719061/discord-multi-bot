import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    PermissionFlagsBits,
    SectionBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ansiRows, UI_COLORS } from '../../utils/style.js';
import { ephemeralV2Payload, v2Divider, v2EditPayload, v2Panel, v2Text } from '../../utils/componentsV2.js';
import { parseScopedCustomId, scopedCustomId } from '../../utils/customIds.js';
import { openSettingsPanelFromHelp } from '../admin/settings.js';
import { execute as openSteamSearch } from '../steam/steam.js';
import { execute as openStatsSearch } from '../esports/stats.js';
import { execute as openWuwaSearch } from '../gacha/wuwa.js';
import { execute as openMusicPlayer } from '../music/music.js';
import { openPollComposer } from '../fun/poll.js';
import { openGiveawayComposer } from '../fun/giveaway.js';
import { openReminderComposer, openReminderManager } from './remind.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMMANDS_PER_PAGE = 4;
const COLLECTOR_TIME = 300000;
const GAME_QUERY_COMMAND_ORDER = new Map([
    ['戰績', 10],
    ['鳴潮抽卡', 20],
]);
const DIRECT_QUERY_ACTIONS = {
    特價查詢: { action: 'steam', label: '開啟皇家採購查詢', style: ButtonStyle.Primary },
    戰績: { action: 'stats', label: '開啟皇家戰報查詢', style: ButtonStyle.Primary },
    鳴潮抽卡: { action: 'wuwa', label: '開啟鳴潮喚取卷宗', style: ButtonStyle.Primary },
    音樂: { action: 'music', label: '開啟音樂播放器', style: ButtonStyle.Primary },
    投票: { action: 'poll', label: '建立皇家投票', style: ButtonStyle.Primary },
    抽獎: { action: 'giveaway', label: '建立皇家抽獎', style: ButtonStyle.Primary },
    提醒: { action: 'reminder_create', label: '新增皇家提醒', style: ButtonStyle.Primary },
};
const EXTRA_DIRECT_ACTIONS = {
    提醒: [{ action: 'reminder_manage', label: '管理我的提醒', style: ButtonStyle.Secondary }],
};
const TEXTLESS_HELP_COMMANDS = new Set(['特價查詢', '戰績', '鳴潮抽卡', '提醒', '音樂']);

const CATEGORY_META = {
    general: {
        label: '一般',
        emoji: '📘',
        description: '御前基礎工具、提醒委託與連線測試。',
        order: 10,
        group: 'public'
    },
    fun: {
        label: '娛樂',
        emoji: '🎲',
        description: '陪伴本王互動、小遊戲、每日運勢與皇家活動。',
        order: 20,
        group: 'public'
    },
    leveling: {
        label: '等級',
        emoji: '🏅',
        description: '查看子民爵位與王國排行榜。',
        order: 30,
        group: 'public'
    },
    steam: {
        label: 'Steam',
        emoji: '🎮',
        description: '開啟皇家採購簿，私下查詢 Steam 情報。',
        order: 40,
        group: 'public'
    },
    music: {
        label: '音樂',
        emoji: '🎵',
        description: '搜尋 NAS 曲庫或貼上 YouTube 連結，在語音頻道點播並控制共用佇列。',
        order: 42,
        group: 'public'
    },
    esports: {
        label: '遊戲查詢',
        emoji: '🎮',
        description: '查詢公開賽季戰績，或管理鳴潮喚取紀錄與抽卡分析。',
        order: 45,
        group: 'public'
    },
    gacha: {
        label: '鳴潮',
        emoji: '🌊',
        description: '綁定 UID、更新喚取紀錄並生成抽卡分析圖片。',
        order: 47,
        group: 'public'
    },
    welcome: {
        label: '歡迎',
        emoji: '🎺',
        description: '皇家迎賓佈告與新成員禮遇設定。',
        order: 50,
        group: 'public'
    },
    admin: {
        label: '管理',
        emoji: '🛡️',
        description: '皇家設定、頒布聖旨、領地視察與子民名冊工具。',
        order: 60,
        group: 'admin',
        permission: PermissionFlagsBits.ManageGuild
    },
    logging: {
        label: '日誌',
        emoji: '📝',
        description: '史官事件紀錄與日誌頻道設定。',
        order: 80,
        group: 'admin',
        permission: PermissionFlagsBits.ManageGuild
    },
    roles: {
        label: '身分組',
        emoji: '🏷️',
        description: '皇家自助身分領取與按鈕身分站設定。',
        order: 90,
        group: 'admin',
        permission: PermissionFlagsBits.ManageRoles
    }
};

const COMMAND_META = {
    幫助: { label: '指令大典', examples: ['/幫助'] },
    延遲: { label: '延遲測試', examples: ['/延遲'] },
    提醒: { label: '提醒系統', examples: ['/提醒（彈窗新增，完成卡可管理清單）'] },
    每日一汪: { label: '每日一汪', examples: ['/每日一汪'] },
    餵食: { label: '餵食國王', examples: ['/餵食 食物:steak'] },
    占卜: { label: '皇家占卜', examples: ['/占卜 問題:今天適合開台嗎'] },
    抽獎: { label: '皇家抽獎', examples: ['從 `/幫助` 點擊「建立皇家抽獎」'] },
    抱抱: { label: '抱抱國王', examples: ['/抱抱', '/抱抱 對象:@朋友'] },
    摸摸: { label: '摸摸頭', examples: ['/摸摸'] },
    投票: { label: '正式投票', examples: ['從 `/幫助` 點擊「建立皇家投票」'] },
    汪汪: { label: '陪王聊天', examples: ['/汪汪 內容:國王今天心情如何'] },
    等級: { label: '爵位查詢', examples: ['/等級', '/等級 使用者:@朋友'] },
    排行榜: { label: '排行榜', examples: ['/排行榜'] },
    特價查詢: { label: '皇家採購查詢', examples: ['/特價查詢（輸入名稱後選取正確 Steam 遊戲）'] },
    戰績: { label: '皇家戰報查詢', examples: ['/戰績（彈窗內選擇遊戲並輸入 Riot ID）'] },
    鳴潮抽卡: { label: '皇家鳴潮喚取卷宗', examples: ['/鳴潮抽卡（綁定 UID、更新或查詢指定卡池）'] },
    音樂: { label: '皇家音樂播放器', examples: ['/音樂（先加入語音頻道，搜尋 NAS 或貼上 YouTube 連結點播）'] },
    設定: { label: '皇家管理控制台', examples: ['/設定'] },
};

const OPTION_TYPE_NAMES = {
    1: '子指令',
    2: '子指令群組',
    3: '文字',
    4: '整數',
    5: '開關',
    6: '使用者',
    7: '頻道',
    8: '身分組',
    9: '可提及對象',
    10: '數字',
    11: '附件'
};

const PERMISSION_LABELS = [
    [PermissionFlagsBits.Administrator, '系統管理員'],
    [PermissionFlagsBits.ManageGuild, '管理伺服器'],
    [PermissionFlagsBits.ManageRoles, '管理身分組'],
    [PermissionFlagsBits.ManageChannels, '管理頻道'],
    [PermissionFlagsBits.ManageMessages, '管理訊息']
];

export const data = new SlashCommandBuilder()
    .setName('幫助')
    .setDescription('📖 指令大典：用互動式按鈕瀏覽吉吉國王的所有指令');

export const aliases = [
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('📖 指令大典：開啟中文互動式指令說明')
];

export async function execute(interaction) {
    return openHelpPanel(interaction, false);
}

export async function openHelpHomeFromSettings(interaction) {
    return openHelpPanel(interaction, true);
}

async function openHelpPanel(interaction, replaceMessage) {
    const context = {
        userId: interaction.user.id,
        catalog: await buildCatalog(interaction),
        canOpenSettings: hasRequiredPermission(interaction, PermissionFlagsBits.Administrator),
        currentComponents: []
    };

    const homePayload = renderHome(context);
    context.currentComponents = homePayload.components;

    if (replaceMessage) {
        await interaction.update({ components: homePayload.components });
    } else {
        await interaction.reply(ephemeralV2Payload(homePayload.components));
    }

    const response = replaceMessage ? interaction.message : await interaction.fetchReply();
    const collector = response.createMessageComponentCollector({ time: COLLECTOR_TIME });

    collector.on('collect', async (componentInteraction) => {
        if (componentInteraction.user.id !== context.userId) {
            await componentInteraction.reply(renderNotice(
                '🛡️ 這份大典不屬於你',
                '汪！請使用 `/幫助` 開啟屬於你自己的互動選單。'
            ));
            return;
        }

        if (componentInteraction.customId === makeCustomId(context, 'settings')) {
            collector.stop('settings');
            await openSettingsPanelFromHelp(componentInteraction, openHelpHomeFromSettings);
            return;
        }
        if (componentInteraction.customId === makeCustomId(context, 'launch', 'steam')) {
            await openSteamSearch(componentInteraction);
            return;
        }
        if (componentInteraction.customId === makeCustomId(context, 'launch', 'stats')) {
            await openStatsSearch(componentInteraction);
            return;
        }
        if (componentInteraction.customId === makeCustomId(context, 'launch', 'wuwa')) {
            await openWuwaSearch(componentInteraction);
            return;
        }
        if (componentInteraction.customId === makeCustomId(context, 'launch', 'music')) {
            await openMusicPlayer(componentInteraction);
            return;
        }
        if (componentInteraction.customId === makeCustomId(context, 'launch', 'poll')) {
            await openPollComposer(componentInteraction);
            return;
        }
        if (componentInteraction.customId === makeCustomId(context, 'launch', 'giveaway')) {
            await openGiveawayComposer(componentInteraction);
            return;
        }
        if (componentInteraction.customId === makeCustomId(context, 'launch', 'reminder_create')) {
            await openReminderComposer(componentInteraction);
            return;
        }
        if (componentInteraction.customId === makeCustomId(context, 'launch', 'reminder_manage')) {
            await openReminderManager(componentInteraction);
            return;
        }

        const nextPayload = componentInteraction.isStringSelectMenu()
            ? routeCategorySelection(componentInteraction.customId, componentInteraction.values[0], context)
            : routeButton(componentInteraction.customId, context);
        if (!nextPayload) {
            await componentInteraction.reply(renderNotice(
                '⌛ 按鈕已失效',
                '請重新使用 `/幫助`，本王會替你翻開新的一本大典。'
            ));
            return;
        }

        context.currentComponents = nextPayload.components;
        await componentInteraction.update({
            components: nextPayload.components
        });
    });

    collector.on('end', (_, reason) => {
        if (reason === 'settings') return;
        interaction.editReply(v2EditPayload(ephemeralV2Payload(
            closeHelpBook(context.currentComponents)
        ))).catch(() => { });
    });
}

async function buildCatalog(interaction) {
    const commandIds = await getApplicationCommandIds(interaction);
    const commandsDir = path.join(__dirname, '..');
    const categories = fs.readdirSync(commandsDir)
        .filter((file) => fs.statSync(path.join(commandsDir, file)).isDirectory())
        .filter((category) => category !== 'game');

    const catalog = [];
    for (const category of categories) {
        const meta = CATEGORY_META[category] ?? {
            label: titleCase(category),
            emoji: '📁',
            description: `${category} 類別指令。`,
            order: 999,
            group: 'public'
        };

        if (!hasRequiredPermission(interaction, meta.permission)) continue;

        const categoryPath = path.join(commandsDir, category);
        const commandFiles = fs.readdirSync(categoryPath)
            .filter((file) => file.endsWith('.js'))
            .sort((a, b) => a.localeCompare(b));

        const commands = [];
        for (const file of commandFiles) {
            const commandModule = await import(pathToFileURL(path.join(categoryPath, file)).href);
            if (!commandModule.data) continue;

            const commandJson = commandModule.data.toJSON();
            if (commandJson.name === '設定') continue;
            if (!hasRequiredPermission(interaction, commandJson.default_member_permissions)) continue;

            commands.push(normalizeCommand(commandJson, commandIds.get(commandJson.name), category, commandModule.helpOnly === true));
        }

        if (commands.length === 0) continue;

        catalog.push({
            id: category,
            ...meta,
            commands: commands.sort((a, b) => a.name.localeCompare(b.name))
        });
    }

    return mergeGameQueryCategories(catalog)
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

function mergeGameQueryCategories(catalog) {
    const gameCategories = catalog.filter((category) =>
        category.id === 'esports' || category.id === 'gacha'
    );
    if (gameCategories.length === 0) return catalog;

    const gameCategory = {
        id: 'esports',
        ...CATEGORY_META.esports,
        commands: gameCategories
            .flatMap((category) => category.commands)
            .sort((a, b) =>
                (GAME_QUERY_COMMAND_ORDER.get(a.name) ?? 999)
                - (GAME_QUERY_COMMAND_ORDER.get(b.name) ?? 999)
                || a.name.localeCompare(b.name)
            ),
    };
    const insertAt = Math.min(...gameCategories.map((category) => catalog.indexOf(category)));

    return [
        ...catalog.filter((category, index) =>
            index < insertAt && category.id !== 'esports' && category.id !== 'gacha'
        ),
        gameCategory,
        ...catalog.filter((category, index) =>
            index > insertAt && category.id !== 'esports' && category.id !== 'gacha'
        ),
    ];
}

async function getApplicationCommandIds(interaction) {
    const commandIds = new Map();

    addCommandIds(commandIds, interaction.client.application.commands.cache);

    const globalCommands = await interaction.client.application.commands.fetch().catch(() => null);
    addCommandIds(commandIds, globalCommands);

    if (interaction.guild) {
        const guildCommands = await interaction.guild.commands.fetch().catch(() => null);
        addCommandIds(commandIds, guildCommands);
    }

    return commandIds;
}

function addCommandIds(commandIds, commands) {
    if (!commands?.values) return;
    for (const command of commands.values()) {
        commandIds.set(command.name, command.id);
    }
}

function normalizeCommand(commandJson, appCommandId, category, helpOnly = false) {
    const subcommands = commandJson.options?.filter((option) => option.type === 1) ?? [];
    const regularOptions = commandJson.options?.filter((option) => option.type !== 1 && option.type !== 2) ?? [];
    const meta = COMMAND_META[commandJson.name] ?? {};

    return {
        category,
        helpOnly,
        appCommandId,
        name: commandJson.name,
        label: meta.label ?? commandJson.name,
        description: getDescription(commandJson),
        permission: commandJson.default_member_permissions,
        options: regularOptions,
        subcommands,
        usage: buildUsage(commandJson.name, regularOptions),
        mention: buildMention(commandJson.name, appCommandId),
        examples: meta.examples ?? [buildUsage(commandJson.name, regularOptions)]
    };
}

function routeButton(customId, context) {
    const parts = parseHelpCustomId(customId, context);
    if (!parts) return null;

    const view = parts[0];
    if (view === 'home') return renderHome(context);

    const category = context.catalog.find((item) => item.id === parts[1]);
    if (!category) return renderHome(context);

    const page = Number.parseInt(parts[2] ?? '0', 10) || 0;
    if (view === 'cat') return renderCategory(context, category, page);

    if (view === 'detail') {
        const commandIndex = Number.parseInt(parts[3] ?? '0', 10) || 0;
        return renderDetail(context, category, page, commandIndex);
    }

    return null;
}

function routeCategorySelection(customId, categoryId, context) {
    if (customId !== makeCustomId(context, 'category')) return null;
    const category = context.catalog.find((item) => item.id === categoryId);
    return category ? renderCategory(context, category, 0) : renderHome(context);
}

function renderHome(context) {
    const commandCount = context.catalog.reduce((total, category) => total + category.commands.filter((command) => !command.helpOnly).length, 0);
    const interactiveCount = context.catalog.reduce((total, category) => total + category.commands.filter((command) => command.helpOnly).length, 0);

    const panel = v2Panel(UI_COLORS.ROYAL)
        .addTextDisplayComponents(v2Text([
            '# 🐕👑 吉吉國王的指令大典',
            '選擇分類查看詳情，或直接開啟常用功能。',
        ].join('\n')))
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text([
            '## ✨ 御前速覽',
            ansiRows([
                { label: '分類', value: `${context.catalog.length} 個可瀏覽分類`, tone: 'royal' },
                { label: '指令', value: `${commandCount} 個可使用指令`, tone: 'info' },
                { label: '互動', value: `${interactiveCount} 個直接入口`, tone: interactiveCount > 0 ? 'special' : 'neutral' },
            ]),
        ].join('\n')));

    const categoryRow = buildCategorySelectRow(context);
    if (categoryRow) {
        panel
            .addSeparatorComponents(v2Divider())
            .addTextDisplayComponents(v2Text('## 📚 分類導覽\n從選單挑選一章，即可瀏覽指令與使用方式。'))
            .addActionRowComponents(categoryRow);
    }

    const quickRows = buildHomeQuickRows(context);
    if (quickRows.length > 0) {
        panel
            .addSeparatorComponents(v2Divider())
            .addTextDisplayComponents(v2Text('## 🚪 常用入口'))
            .addActionRowComponents(...quickRows);
    }

    if (context.canOpenSettings) {
        panel
            .addSeparatorComponents(v2Divider())
            .addTextDisplayComponents(v2Text([
                '## 🛡️ 皇家管理控制台',
                '管理伺服器設定、健康狀態與公告工具。',
            ].join('\n')))
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(makeCustomId(context, 'settings')).setLabel('進入皇家管理控制台').setStyle(ButtonStyle.Primary)
                )
            );
    }

    panel
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text('-# 只有你能操作這份 `/幫助` 選單，5 分鐘後會自動停用。'));

    return {
        components: [panel]
    };
}

function renderCategory(context, category, page) {
    const maxPage = getMaxPage(category);
    const safePage = clamp(page, 0, maxPage);
    const pageCommands = getPageCommands(category, safePage);
    const interactiveCommands = category.commands.filter((command) => command.helpOnly);
    const commandCount = category.commands.length - interactiveCommands.length;

    const panel = v2Panel(UI_COLORS.ROYAL)
        .addTextDisplayComponents(v2Text([
            `# ${category.emoji} ${category.label}功能`,
            category.description,
        ].join('\n')))
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text([
            '## 📄 皇家分類卷宗',
            ansiRows([
                { label: '分類', value: category.label, tone: 'royal' },
                { label: '頁次', value: `${safePage + 1} / ${maxPage + 1}`, tone: 'info' },
                { label: '指令', value: `${commandCount} 個`, tone: 'success' },
                { label: '互動', value: `${interactiveCommands.length} 個入口`, tone: interactiveCommands.length > 0 ? 'special' : 'neutral' },
            ]),
        ].join('\n')));

    if (interactiveCommands.length > 0) {
        panel
            .addSeparatorComponents(v2Divider())
            .addTextDisplayComponents(v2Text([
                '## 👑 皇家互動入口',
                '投票與抽獎使用下方按鈕建立，依彈窗填寫後即可在頻道頒布。',
            ].join('\n')))
            .addActionRowComponents(...buildDirectQueryRows(context, interactiveCommands));
    }

    for (const command of pageCommands) {
        panel
            .addSeparatorComponents(v2Divider())
            .addTextDisplayComponents(v2Text([
                getCategoryCommandHeading(command),
                command.description,
                getCategoryUsageText(command),
                !shouldHideCommandText(command) && command.subcommands.length > 0 ? `子指令：${formatSubcommandMentions(command).join('、')}` : null
            ].filter(Boolean).join('\n')));

        if (command.name === '提醒') {
            panel.addActionRowComponents(...buildDirectQueryRows(context, [command]));
        }
    }

    const directRows = buildDirectQueryRows(
        context,
        pageCommands.filter((command) => command.name !== '提醒')
    );
    if (directRows.length > 0) {
        panel
            .addSeparatorComponents(v2Divider())
            .addTextDisplayComponents(v2Text('## 🚪 直接開啟\n不必重新輸入指令，點擊即可開始皇家互動流程。'))
            .addActionRowComponents(...directRows);
    }

    panel
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text('-# 可用按鈕直接操作；按「詳情」可看本頁第一個項目。'))
        .addActionRowComponents(...buildCategoryNavigationRows(context, category, safePage, pageCommands));

    return {
        components: [panel]
    };
}

function renderDetail(context, category, page, commandIndex) {
    const maxPage = getMaxPage(category);
    const safePage = clamp(page, 0, maxPage);
    const pageCommands = getPageCommands(category, safePage);
    const safeCommandIndex = clamp(commandIndex, 0, Math.max(pageCommands.length - 1, 0));
    const command = pageCommands[safeCommandIndex];

    if (!command) return renderCategory(context, category, safePage);
    const hideCommandText = shouldHideCommandText(command);

    const panel = v2Panel(UI_COLORS.ROYAL)
        .addTextDisplayComponents(v2Text([
            `# ${category.emoji} ${command.label}`,
            command.description,
        ].join('\n')))
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text([
            command.helpOnly || hideCommandText ? '## 📌 御前互動資訊' : '## 📌 御前指令資訊',
            ansiRows([
                { label: '類型', value: command.helpOnly || hideCommandText ? '互動按鈕' : 'Slash 指令', tone: 'royal' },
                { label: '分類', value: category.label, tone: 'info' },
                { label: '權限', value: formatPermission(command.permission), tone: command.permission ? 'warning' : 'success' },
            ]),
        ].join('\n')))
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text([
            DIRECT_QUERY_ACTIONS[command.name] ? '## 🚪 直接開始' : '## 🔗 快速使用',
            getDetailLaunchText(command),
            !hideCommandText && command.subcommands.length > 0 ? `子指令：${formatSubcommandMentions(command).join('、')}` : null
        ].filter(Boolean).join('\n')));

    const parameterLines = formatOptions(command.options);
    panel
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text([
            '## 🧾 參數',
            command.name === '提醒'
                ? '點擊「新增皇家提醒」後，在彈窗填入時間與提醒內容。'
                : parameterLines.length > 0 ? parameterLines.join('\n') : '這個指令不需要額外參數。',
        ].join('\n')));

    if (!hideCommandText && command.subcommands.length > 0) {
        panel
            .addSeparatorComponents(v2Divider())
            .addTextDisplayComponents(v2Text([
                '## 🧩 子指令',
                command.subcommands.map((subcommand) => {
                const usage = buildUsage(command.name, subcommand.options ?? [], subcommand.name);
                const mention = buildMention(command.name, command.appCommandId, subcommand.name);
                return `${mention}\n${getDescription(subcommand)}\n用法：\`${usage}\``;
                }).join('\n\n'),
            ].join('\n')));
    }

    panel
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text([
            '## 💡 範例',
            command.name === '提醒'
                ? '新增提醒後，本王會在建立時所在頻道準時傳喚你；也可由「管理我的提醒」查看或刪除待發送項目。'
                : DIRECT_QUERY_ACTIONS[command.name]
                ? '點擊下方按鈕，依互動介面完成操作。'
                : command.examples.map((example) => `\`${example}\``).join('\n'),
            '',
            `-# ${category.label}分類，第 ${safePage + 1} 頁中的第 ${safeCommandIndex + 1} 個指令。`,
        ].join('\n')))
        .addActionRowComponents(...buildDetailRows(context, category, safePage, pageCommands, safeCommandIndex, command));

    return {
        components: [panel]
    };
}

function buildCategorySelectRow(context) {
    if (context.catalog.length === 0) return null;
    const select = new StringSelectMenuBuilder()
        .setCustomId(makeCustomId(context, 'category'))
        .setPlaceholder('選擇功能分類')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(...context.catalog.slice(0, 25).map((category) => ({
            label: category.label,
            value: category.id,
            description: category.description.slice(0, 100),
            emoji: category.emoji,
        })));
    return new ActionRowBuilder().addComponents(select);
}

function buildHomeQuickRows(context) {
    const quickLabels = new Map([
        ['特價查詢', 'Steam 特價'],
        ['戰績', '戰績查詢'],
        ['鳴潮抽卡', '鳴潮抽卡'],
        ['音樂', '音樂播放器'],
    ]);
    const buttons = context.catalog
        .flatMap((category) => category.commands)
        .filter((command) => quickLabels.has(command.name))
        .slice(0, 4)
        .map((command) => new ButtonBuilder()
            .setCustomId(makeCustomId(context, 'launch', DIRECT_QUERY_ACTIONS[command.name].action))
            .setLabel(quickLabels.get(command.name))
            .setStyle(ButtonStyle.Secondary));
    return buttons.length > 0 ? [new ActionRowBuilder().addComponents(buttons)] : [];
}

function buildCategoryNavigationRows(context, category, page, pageCommands) {
    const maxPage = getMaxPage(category);
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(makeCustomId(context, 'cat', category.id, page - 1))
                .setLabel('上一頁')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page <= 0),
            new ButtonBuilder()
                .setCustomId(makeCustomId(context, 'cat', category.id, page + 1))
                .setLabel('下一頁')
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= maxPage),
            new ButtonBuilder()
                .setCustomId(makeCustomId(context, 'detail', category.id, page, 0))
                .setLabel('詳情')
                .setEmoji('🔎')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(pageCommands.length === 0),
            new ButtonBuilder()
                .setCustomId(makeCustomId(context, 'home'))
                .setLabel('首頁')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        )
    ];
}

function buildDetailRows(context, category, page, pageCommands, activeIndex, command) {
    const commandButtons = pageCommands.map((command, index) =>
        new ButtonBuilder()
            .setCustomId(makeCustomId(context, 'detail', category.id, page, index))
            .setLabel(String(index + 1))
            .setEmoji(index === activeIndex ? '📌' : '📄')
            .setStyle(index === activeIndex ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    const rows = [];
    if (commandButtons.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(commandButtons));
    }

    const directActions = getDirectActions(command?.name);
    if (directActions.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(
            ...directActions.map((action) => new ButtonBuilder()
                .setCustomId(makeCustomId(context, 'launch', action.action))
                .setLabel(action.label)
                .setStyle(action.style))
        ));
    }

    rows.push(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(makeCustomId(context, 'cat', category.id, page))
                .setLabel('返回分類')
                .setEmoji('↩️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(makeCustomId(context, 'home'))
                .setLabel('首頁')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        )
    );

    return rows;
}

function buildDirectQueryRows(context, commands) {
    const actions = commands.flatMap((command) => getDirectActions(command.name));
    return chunk(actions, 5).map((actionChunk) => {
        const hasPeerPrimaryActions = actionChunk.filter((action) => action.style === ButtonStyle.Primary).length > 1;
        return new ActionRowBuilder().addComponents(...actionChunk.map((action) => new ButtonBuilder()
            .setCustomId(makeCustomId(context, 'launch', action.action))
            .setLabel(action.label)
            .setStyle(hasPeerPrimaryActions && action.style === ButtonStyle.Primary
                ? ButtonStyle.Secondary
                : action.style)));
    });
}

function getDirectActions(commandName) {
    const primary = DIRECT_QUERY_ACTIONS[commandName];
    return [
        ...(primary ? [primary] : []),
        ...(EXTRA_DIRECT_ACTIONS[commandName] ?? []),
    ];
}

function getCategoryUsageText(command) {
    if (command.name === '音樂') {
        return '操作：先加入一般語音頻道，再點擊「開啟音樂播放器」搜尋 NAS 曲庫或按「YouTube 點播」貼上單曲連結；YouTube 不需 NAS 登入。';
    }
    if (command.name === '提醒') {
        return '操作：使用下方按鈕新增提醒，或管理尚未送出的皇家傳喚。';
    }
    if (DIRECT_QUERY_ACTIONS[command.name]) {
        return '操作：點擊下方按鈕，立即開啟皇家互動介面。';
    }
    return `用法：\`${command.usage}\``;
}

function getDetailLaunchText(command) {
    if (command.name === '音樂') {
        return '先加入一般語音頻道，再按下方按鈕開啟音樂介面；NAS 需各自登入，YouTube 可直接貼上影片或單曲連結（最多 2 小時）。';
    }
    if (command.name === '提醒') {
        return '按下方按鈕新增提醒或管理待發送項目。';
    }
    return DIRECT_QUERY_ACTIONS[command.name]
        ? '按下方按鈕即可開啟互動介面，不必再輸入指令。'
        : command.mention;
}

function getCategoryCommandHeading(command) {
    return shouldHideCommandText(command)
        ? `### ${command.label}`
        : `### ${command.mention} | ${command.label}`;
}

function shouldHideCommandText(command) {
    return TEXTLESS_HELP_COMMANDS.has(command?.name);
}

function disableComponents(components) {
    for (const component of components) {
        if (!(component instanceof ContainerBuilder)) continue;
        for (const child of component.components) {
            if (child instanceof ActionRowBuilder) {
                child.components.forEach((button) => button.setDisabled(true));
            }
            if (child instanceof SectionBuilder && child.accessory instanceof ButtonBuilder) {
                child.accessory.setDisabled(true);
            }
        }
    }
    return components;
}

function closeHelpBook(components) {
    const disabledComponents = disableComponents(components);
    const panel = disabledComponents.find((component) => component instanceof ContainerBuilder);
    panel?.addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text('## ⌛ 大典已合上\n請重新使用 `/幫助` 開啟新的互動選單。'));
    return disabledComponents;
}

function renderNotice(title, message) {
    return ephemeralV2Payload([
        v2Panel(UI_COLORS.WARNING)
            .addTextDisplayComponents(v2Text(`## ${title}\n${message}`))
    ]);
}

function makeCustomId(context, view, category = 'home', page = 0, commandIndex = 0) {
    if (view === 'home') return scopedCustomId('help', context.userId, 'home');
    if (view === 'settings') return scopedCustomId('help', context.userId, 'settings');
    if (view === 'category') return scopedCustomId('help', context.userId, 'category');
    if (view === 'launch') return scopedCustomId('help', context.userId, 'launch', category);
    if (view === 'detail') return scopedCustomId('help', context.userId, 'detail', category, page, commandIndex);
    return scopedCustomId('help', context.userId, 'cat', category, page);
}

function parseHelpCustomId(customId, context) {
    return parseScopedCustomId(customId, 'help', context.userId);
}

function getPageCommands(category, page) {
    const start = page * COMMANDS_PER_PAGE;
    return category.commands
        .filter((command) => !command.helpOnly)
        .slice(start, start + COMMANDS_PER_PAGE);
}

function getMaxPage(category) {
    const commandCount = category.commands.filter((command) => !command.helpOnly).length;
    return Math.max(Math.ceil(commandCount / COMMANDS_PER_PAGE) - 1, 0);
}

function buildUsage(commandName, options = [], subcommandName = null) {
    const optionUsage = options.map((option) => {
        return option.required ? `<${option.name}>` : `[${option.name}]`;
    });
    return [`/${commandName}`, subcommandName, ...optionUsage].filter(Boolean).join(' ');
}

function buildMention(commandName, appCommandId, subcommandName = null) {
    const plainCommand = `/${commandName}${subcommandName ? ` ${subcommandName}` : ''}`;
    if (!appCommandId) return `\`${plainCommand}\``;
    return subcommandName
        ? `</${commandName} ${subcommandName}:${appCommandId}>`
        : `</${commandName}:${appCommandId}>`;
}

function formatSubcommandMentions(command) {
    return command.subcommands.map((subcommand) =>
        buildMention(command.name, command.appCommandId, subcommand.name)
    );
}

function formatOptions(options = []) {
    return options.map((option) => {
        const required = option.required ? '必填' : '選填';
        const type = OPTION_TYPE_NAMES[option.type] ?? '未知';
        return `\`${option.name}\` (${required} / ${type})：${getDescription(option)}`;
    });
}

function formatPermission(permissionValue) {
    if (!permissionValue) return '所有人可用';

    const permission = BigInt(permissionValue);
    const matched = PERMISSION_LABELS
        .filter(([flag]) => (permission & flag) === flag)
        .map(([, label]) => label);

    return matched.length > 0 ? matched.join('、') : `權限值 ${permissionValue}`;
}

function hasRequiredPermission(interaction, permissionValue) {
    if (!permissionValue) return true;
    const permissions = interaction.member?.permissions;
    if (!permissions?.has) return false;
    return permissions.has(BigInt(permissionValue));
}

function getDescription(source) {
    return source.description_localizations?.['zh-TW'] ?? source.description ?? '尚未提供說明。';
}

function chunk(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export const helpViewTesting = {
    renderHome,
    renderCategory,
    renderDetail,
    routeButton,
    routeCategorySelection,
    mergeGameQueryCategories,
    makeCustomId,
    parseHelpCustomId,
    disableComponents,
    closeHelpBook,
};
