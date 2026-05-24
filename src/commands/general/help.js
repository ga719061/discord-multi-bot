import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ContainerBuilder,
    PermissionFlagsBits,
    SectionBuilder,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ansiBlock, COLORS, UI_COLORS } from '../../utils/style.js';
import { ephemeralV2Payload, v2Divider, v2Panel, v2Text } from '../../utils/componentsV2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMMANDS_PER_PAGE = 4;
const COLLECTOR_TIME = 300000;

const CATEGORY_META = {
    general: {
        label: '一般',
        emoji: '📘',
        description: '基礎工具、提醒與連線測試。',
        order: 10,
        group: 'public'
    },
    fun: {
        label: '娛樂',
        emoji: '🎲',
        description: '互動、小遊戲、投票與每日運勢。',
        order: 20,
        group: 'public'
    },
    leveling: {
        label: '等級',
        emoji: '🏅',
        description: '查看等級、排行榜與升級設定。',
        order: 30,
        group: 'public'
    },
    steam: {
        label: 'Steam',
        emoji: '🎮',
        description: '查詢遊戲情報與每日特價推播。',
        order: 40,
        group: 'public'
    },
    esports: {
        label: '戰績',
        emoji: '📊',
        description: '查詢特戰英豪與英雄聯盟公開賽季戰績。',
        order: 45,
        group: 'public'
    },
    welcome: {
        label: '歡迎',
        emoji: '🎺',
        description: '新成員歡迎訊息設定。',
        order: 50,
        group: 'public'
    },
    admin: {
        label: '管理',
        emoji: '🛡️',
        description: '公告、伺服器資訊與成員管理工具。',
        order: 60,
        group: 'admin',
        permission: PermissionFlagsBits.ManageGuild
    },
    ai: {
        label: 'AI',
        emoji: '🤖',
        description: 'AI 登入、模型、白名單與聊天設定。',
        order: 70,
        group: 'admin',
        permission: PermissionFlagsBits.Administrator
    },
    logging: {
        label: '日誌',
        emoji: '📝',
        description: '伺服器事件紀錄與日誌頻道設定。',
        order: 80,
        group: 'admin',
        permission: PermissionFlagsBits.ManageGuild
    },
    roles: {
        label: '身分組',
        emoji: '🏷️',
        description: '自助身分組與按鈕身分組設定。',
        order: 90,
        group: 'admin',
        permission: PermissionFlagsBits.ManageRoles
    }
};

const COMMAND_META = {
    幫助: { label: '指令大典', examples: ['/幫助'] },
    延遲: { label: '延遲測試', examples: ['/延遲'] },
    提醒: { label: '提醒系統', examples: ['/提醒 設定 時間:10m 內容:喝水', '/提醒 清單'] },
    每日一汪: { label: '每日一汪', examples: ['/每日一汪'] },
    餵食: { label: '餵食國王', examples: ['/餵食 食物:steak'] },
    占卜: { label: '皇家占卜', examples: ['/占卜 問題:今天適合開台嗎'] },
    抽獎: { label: '皇家抽獎', examples: ['/抽獎 獎品:禮物卡 時間:60 名額:1'] },
    抱抱: { label: '抱抱國王', examples: ['/抱抱', '/抱抱 對象:@朋友'] },
    摸摸: { label: '摸摸頭', examples: ['/摸摸'] },
    投票: { label: '正式投票', examples: ['/投票 問題:今晚玩什麼 選項1:Minecraft 選項2:Among Us'] },
    汪汪: { label: '陪王聊天', examples: ['/汪汪 內容:國王今天心情如何'] },
    等級: { label: '爵位查詢', examples: ['/等級', '/等級 使用者:@朋友'] },
    排行榜: { label: '排行榜', examples: ['/排行榜'] },
    設定等級系統: { label: '等級設定', examples: ['/設定等級系統 狀態:on'] },
    特價查詢: { label: '特價查詢', examples: ['/特價查詢 搜尋 遊戲名稱:Stardew Valley'] },
    設定特價推播: { label: '特價推播設定', examples: ['/設定特價推播 設定頻道 目標頻道:#steam-deals 時間:20:00', '/設定特價推播 特價列表', '/設定特價推播 狀態'] },
    戰績: { label: '公開戰績查詢', examples: ['/戰績 特戰英豪 玩家名稱:SEN TenZ 標籤:2906', '/戰績 英雄聯盟 玩家名稱:Hide on bush 標籤:KR1 區服:kr'] },
    發布公告: { label: '發布公告', examples: ['/發布公告 頻道:#公告'] },
    機器人狀態: { label: '機器人狀態', examples: ['/機器人狀態'] },
    伺服器資訊: { label: '伺服器資訊', examples: ['/伺服器資訊'] },
    查身家: { label: '使用者資訊', examples: ['/查身家 使用者:@朋友'] },
    智慧登入: { label: 'AI 登入', examples: ['/智慧登入 密碼:••••••'] },
    智慧設定: { label: 'AI 設定', examples: ['/智慧設定 狀態面板', '/智慧設定 模型切換 模型名稱:gemini-2.5-flash'] },
    設定紀錄: { label: '日誌設定', examples: ['/設定紀錄 頻道:#伺服器日誌'] },
    反應身分組: { label: '按鈕身分組', examples: ['/反應身分組 建立設定 頻道:#領身分組 配對:🎮:123,🎵:456'] },
    自助身分組: { label: '自助身分組', examples: ['/自助身分組 列表總覽', '/自助身分組 發布選單 頻道:#領身分組'] },
    設定歡迎: { label: '歡迎設定', examples: ['/設定歡迎 頻道:#歡迎 訊息:歡迎 {user} 加入 {server}'] }
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
    const context = {
        userId: interaction.user.id,
        catalog: await buildCatalog(interaction),
        currentComponents: []
    };

    const homePayload = renderHome(context);
    context.currentComponents = homePayload.components;

    await interaction.reply(ephemeralV2Payload(homePayload.components));

    const response = await interaction.fetchReply();
    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: COLLECTOR_TIME
    });

    collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== context.userId) {
            await buttonInteraction.reply(renderNotice(
                '🛡️ 這份大典不屬於你',
                '汪！請使用 `/幫助` 開啟屬於你自己的互動選單。'
            ));
            return;
        }

        const nextPayload = routeButton(buttonInteraction.customId, context);
        if (!nextPayload) {
            await buttonInteraction.reply(renderNotice(
                '⌛ 按鈕已失效',
                '請重新使用 `/幫助`，本王會替你翻開新的一本大典。'
            ));
            return;
        }

        context.currentComponents = nextPayload.components;
        await buttonInteraction.update({
            components: nextPayload.components
        });
    });

    collector.on('end', () => {
        interaction.editReply({
            components: closeHelpBook(context.currentComponents)
        }).catch(() => { });
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
            if (!hasRequiredPermission(interaction, commandJson.default_member_permissions)) continue;

            commands.push(normalizeCommand(commandJson, commandIds.get(commandJson.name), category));
        }

        if (commands.length === 0) continue;

        catalog.push({
            id: category,
            ...meta,
            commands: commands.sort((a, b) => a.name.localeCompare(b.name))
        });
    }

    return catalog.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
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

function normalizeCommand(commandJson, appCommandId, category) {
    const subcommands = commandJson.options?.filter((option) => option.type === 1) ?? [];
    const regularOptions = commandJson.options?.filter((option) => option.type !== 1 && option.type !== 2) ?? [];
    const meta = COMMAND_META[commandJson.name] ?? {};

    return {
        category,
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
    const parts = customId.split(':');
    if (parts[0] !== 'help' || parts[1] !== context.userId) return null;

    const view = parts[2];
    if (view === 'home') return renderHome(context);

    const category = context.catalog.find((item) => item.id === parts[3]);
    if (!category) return renderHome(context);

    const page = Number.parseInt(parts[4] ?? '0', 10) || 0;
    if (view === 'cat') return renderCategory(context, category, page);

    if (view === 'detail') {
        const commandIndex = Number.parseInt(parts[5] ?? '0', 10) || 0;
        return renderDetail(context, category, page, commandIndex);
    }

    return null;
}

function renderHome(context) {
    const publicCategories = context.catalog.filter((category) => category.group !== 'admin');
    const adminCategories = context.catalog.filter((category) => category.group === 'admin');
    const commandCount = context.catalog.reduce((total, category) => total + category.commands.length, 0);
    const viewMode = adminCategories.length > 0 ? '管理模式' : '一般模式';

    const panel = v2Panel(UI_COLORS.ROYAL)
        .addTextDisplayComponents(v2Text([
            '# 🐕👑 吉吉國王的指令大典',
            '汪！選一個分類，本王立刻翻到那一章給你看。',
        ].join('\n')))
        .addSeparatorComponents(v2Divider());

    const statusText = [
        '## 📊 目前視圖',
        ansiBlock([
            { color: adminCategories.length > 0 ? COLORS.GOLD : COLORS.CYAN, text: `[模式] ${viewMode}` },
            { color: COLORS.WHITE, text: `[分類] ${context.catalog.length} 個可瀏覽分類` },
            { color: COLORS.WHITE, text: `[指令] ${commandCount} 個可使用指令` },
            { color: COLORS.GRAY, text: `[操作] 按分類按鈕可翻頁、查看詳情、返回首頁` }
        ]),
    ].join('\n');
    const firstCategory = context.catalog[0];
    if (firstCategory) {
        panel.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(v2Text(statusText))
                .setButtonAccessory(
                    new ButtonBuilder()
                        .setCustomId(`${makeCustomId(context, 'cat', firstCategory.id, 0)}:featured`)
                        .setLabel('開始瀏覽')
                        .setEmoji('📖')
                        .setStyle(ButtonStyle.Primary)
                )
        );
    } else {
        panel.addTextDisplayComponents(v2Text(statusText));
    }

    if (publicCategories.length > 0) {
        panel
            .addSeparatorComponents(v2Divider())
            .addTextDisplayComponents(v2Text(`## 📘 一般功能\n${formatCategoryList(publicCategories)}`));
    }

    if (adminCategories.length > 0) {
        panel
            .addSeparatorComponents(v2Divider())
            .addTextDisplayComponents(v2Text([
                '## 🛡️ 管理工具',
                formatCategoryList(adminCategories),
                '',
                '-# 只顯示你目前具備權限的管理分類與指令。',
            ].join('\n')));
    }

    panel
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text('-# 只有你能操作這份 `/幫助` 選單，5 分鐘後按鈕會自動停用。'))
        .addActionRowComponents(...buildCategoryRows(context));

    return {
        components: [panel]
    };
}

function renderCategory(context, category, page) {
    const maxPage = getMaxPage(category);
    const safePage = clamp(page, 0, maxPage);
    const pageCommands = getPageCommands(category, safePage);

    const panel = v2Panel(UI_COLORS.ROYAL)
        .addTextDisplayComponents(v2Text([
            `# ${category.emoji} ${category.label}指令`,
            category.description,
        ].join('\n')))
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text([
            '## 📄 分類狀態',
            ansiBlock([
                { color: COLORS.GOLD, text: `[分類] ${category.label}` },
                { color: COLORS.CYAN, text: `[頁數] ${safePage + 1} / ${maxPage + 1}` },
                { color: COLORS.WHITE, text: `[指令] ${category.commands.length} 個可使用指令` }
            ]),
        ].join('\n')));

    for (const command of pageCommands) {
        panel
            .addSeparatorComponents(v2Divider())
            .addTextDisplayComponents(v2Text([
                `### ${command.mention} | ${command.label}`,
                command.description,
                `用法：\`${command.usage}\``,
                command.subcommands.length > 0 ? `子指令：${formatSubcommandMentions(command).join('、')}` : null
            ].filter(Boolean).join('\n')));
    }

    panel
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text('-# 藍色 slash command 可直接點擊；按「詳情」可看本頁第一個指令。'))
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

    const panel = v2Panel(UI_COLORS.ROYAL)
        .addTextDisplayComponents(v2Text([
            `# ${category.emoji} ${command.label}`,
            command.description,
        ].join('\n')))
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text([
            '## 📌 指令資訊',
            ansiBlock([
                { color: COLORS.GOLD, text: `[指令] ${command.name}` },
                { color: COLORS.CYAN, text: `[分類] ${category.label}` },
                { color: COLORS.WHITE, text: `[權限] ${formatPermission(command.permission)}` },
                { color: COLORS.WHITE, text: `[用法] ${command.usage}` }
            ]),
        ].join('\n')))
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text([
            '## 🔗 快速使用',
            command.mention,
            command.subcommands.length > 0 ? `子指令：${formatSubcommandMentions(command).join('、')}` : null
        ].filter(Boolean).join('\n')));

    const parameterLines = formatOptions(command.options);
    panel
        .addSeparatorComponents(v2Divider())
        .addTextDisplayComponents(v2Text([
            '## 🧾 參數',
            parameterLines.length > 0 ? parameterLines.join('\n') : '這個指令不需要額外參數。',
        ].join('\n')));

    if (command.subcommands.length > 0) {
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
            command.examples.map((example) => `\`${example}\``).join('\n'),
            '',
            `-# ${category.label}分類，第 ${safePage + 1} 頁中的第 ${safeCommandIndex + 1} 個指令。`,
        ].join('\n')))
        .addActionRowComponents(...buildDetailRows(context, category, safePage, pageCommands, safeCommandIndex));

    return {
        components: [panel]
    };
}

function formatCategoryList(categories) {
    return categories
        .map((category) => `${category.emoji} **${category.label}**：${category.description}`)
        .join('\n');
}

function buildCategoryRows(context) {
    const buttons = context.catalog.slice(0, 20).map((category) =>
        new ButtonBuilder()
            .setCustomId(makeCustomId(context, 'cat', category.id, 0))
            .setLabel(category.label)
            .setEmoji(category.emoji)
            .setStyle(category.group === 'admin' ? ButtonStyle.Secondary : ButtonStyle.Primary)
    );

    return chunk(buttons, 5).map((buttonChunk) =>
        new ActionRowBuilder().addComponents(buttonChunk)
    );
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

function buildDetailRows(context, category, page, pageCommands, activeIndex) {
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
    if (view === 'home') return `help:${context.userId}:home`;
    if (view === 'detail') return `help:${context.userId}:detail:${category}:${page}:${commandIndex}`;
    return `help:${context.userId}:cat:${category}:${page}`;
}

function getPageCommands(category, page) {
    const start = page * COMMANDS_PER_PAGE;
    return category.commands.slice(start, start + COMMANDS_PER_PAGE);
}

function getMaxPage(category) {
    return Math.max(Math.ceil(category.commands.length / COMMANDS_PER_PAGE) - 1, 0);
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
    disableComponents,
    closeHelpBook,
};
