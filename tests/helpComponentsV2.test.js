import test from 'node:test';
import assert from 'node:assert/strict';
import { ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import { execute as executeHelp, helpViewTesting } from '../src/commands/general/help.js';
import { stopMusicPlayback } from '../src/commands/music/music.js';
import { ephemeralV2Payload } from '../src/utils/componentsV2.js';

function createCommand(name, label = name) {
    return {
        name,
        label,
        description: `${label}說明`,
        permission: null,
        options: [],
        subcommands: [],
        usage: `/${name}`,
        mention: `\`/${name}\``,
        examples: [`/${name}`],
    };
}

function createContext() {
    return {
        userId: 'viewer',
        canOpenSettings: true,
        catalog: [
            {
                id: 'general',
                label: '一般',
                emoji: '📘',
                description: '基礎工具。',
                group: 'public',
                commands: [createCommand('幫助', '指令大典')],
            },
        ],
    };
}

function countComponents(component) {
    return 1 + (component.components ?? []).reduce(
        (total, child) => total + countComponents(child),
        0
    );
}

function assertPrimaryButtonLimit(container) {
    const rows = container.components.filter((component) => component.type === ComponentType.ActionRow);
    assert.equal(rows.every((row) =>
        row.components.filter((component) => component.style === ButtonStyle.Primary).length <= 1
    ), true);
}

function collectText(component) {
    return [
        component.content,
        ...(component.components ?? []).map(collectText),
        component.accessory ? collectText(component.accessory) : null,
    ].filter(Boolean).join('\n');
}

function stripAnsi(text) {
    return text
        .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
        .replace(/```ansi\n?|```/g, '')
        .trim();
}

test('help home renders a concise Components V2 payload with category select and separate admin entry', () => {
    const view = helpViewTesting.renderHome(createContext());
    const payload = ephemeralV2Payload(view.components);
    const container = view.components[0].toJSON();
    const actionRows = container.components.filter((component) => component.type === ComponentType.ActionRow);
    const controls = actionRows.flatMap((row) => row.components);
    const buttons = controls.filter((component) => component.type === ComponentType.Button);
    const categorySelect = controls.find((component) => component.type === ComponentType.StringSelect);
    const settingsButton = actionRows
        .flatMap((row) => row.components)
        .find((button) => button.label === '進入皇家管理控制台');
    const customIds = buttons.map((button) => button.custom_id);
    const text = collectText(container);
    const readableText = stripAnsi(text);

    assert.equal(container.type, ComponentType.Container);
    assert.equal((payload.flags & MessageFlags.Ephemeral) !== 0, true);
    assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
    assert.equal('embeds' in payload, false);
    assert.equal('content' in payload, false);
    assert.equal(categorySelect.custom_id, 'help:viewer:category');
    assert.deepEqual(categorySelect.options.map((option) => option.value), ['general']);
    assert.equal(settingsButton.style, ButtonStyle.Primary);
    assert.match(text, /```ansi/);
    assert.match(text, /\[分類\]/);
    assert.match(text, /\[指令\]/);
    assert.match(text, /\[互動\]/);
    assert.match(readableText, /\[分類\] 1 個可瀏覽分類/);
    assert.match(readableText, /\[指令\] 1 個可使用指令/);
    assert.match(readableText, /\[互動\] 0 個直接入口/);
    assert.equal(new Set(customIds).size, customIds.length);
    assert.equal(countComponents(container) <= 40, true);
    assert.deepEqual(payload.allowedMentions, { parse: [] });
    assertPrimaryButtonLimit(container);
});

test('help custom ids preserve the existing wire format and owner checks', () => {
    const context = createContext();
    const detailId = helpViewTesting.makeCustomId(context, 'detail', 'general', 2, 1);

    assert.equal(helpViewTesting.makeCustomId(context, 'home'), 'help:viewer:home');
    assert.equal(helpViewTesting.makeCustomId(context, 'settings'), 'help:viewer:settings');
    assert.equal(helpViewTesting.makeCustomId(context, 'category'), 'help:viewer:category');
    assert.equal(helpViewTesting.makeCustomId(context, 'launch', 'steam'), 'help:viewer:launch:steam');
    assert.equal(detailId, 'help:viewer:detail:general:2:1');
    assert.deepEqual(helpViewTesting.parseHelpCustomId(detailId, context), ['detail', 'general', '2', '1']);
    assert.equal(helpViewTesting.parseHelpCustomId(detailId, { ...context, userId: 'other' }), null);
});

test('help category selection routes valid values and rejects foreign controls', () => {
    const context = createContext();
    const selected = helpViewTesting.routeCategorySelection('help:viewer:category', 'general', context);

    assert.match(JSON.stringify(selected.components[0].toJSON()), /一般功能/);
    assert.equal(helpViewTesting.routeCategorySelection('help:other:category', 'general', context), null);
});

test('help home omits management console shortcut for non-administrators', () => {
    const context = { ...createContext(), canOpenSettings: false };
    const text = JSON.stringify(helpViewTesting.renderHome(context).components[0].toJSON());
    assert.equal(text.includes('管理控制台'), false);
});

test('help category and detail pages serialize within the V2 component limit', () => {
    const context = createContext();
    const category = context.catalog[0];
    const categoryContainer = helpViewTesting.renderCategory(context, category, 0).components[0].toJSON();
    const detailContainer = helpViewTesting.renderDetail(context, category, 0, 0).components[0].toJSON();
    const categoryText = collectText(categoryContainer);
    const detailText = collectText(detailContainer);
    const readableCategoryText = stripAnsi(categoryText);
    const readableDetailText = stripAnsi(detailText);

    assert.equal(categoryContainer.type, ComponentType.Container);
    assert.equal(detailContainer.type, ComponentType.Container);
    assert.equal(countComponents(categoryContainer) <= 40, true);
    assert.equal(countComponents(detailContainer) <= 40, true);
    assert.match(categoryText, /```ansi/);
    assert.match(detailText, /```ansi/);
    assert.match(readableCategoryText, /\[分類\] 一般/);
    assert.match(readableCategoryText, /\[頁次\] 1 \/ 1/);
    assert.match(readableCategoryText, /\[指令\] 1 個/);
    assert.match(readableCategoryText, /\[互動\] 0 個入口/);
    assert.match(readableDetailText, /\[類型\] Slash 指令/);
    assert.match(readableDetailText, /\[分類\] 一般/);
    assert.match(readableDetailText, /\[權限\] 所有人可用/);
    assertPrimaryButtonLimit(categoryContainer);
    assertPrimaryButtonLimit(detailContainer);
});

test('interactive help pages offer direct launch buttons instead of command-entry guidance', () => {
    const context = {
        userId: 'viewer',
        canOpenSettings: false,
        catalog: [
            {
                id: 'steam',
                label: 'Steam',
                emoji: '🎮',
                description: '皇家採購。',
                group: 'public',
                commands: [createCommand('特價查詢', '皇家採購查詢')],
            },
            {
                id: 'esports',
                label: '遊戲查詢',
                emoji: '🎮',
                description: '遊戲資料查詢。',
                group: 'public',
                commands: [
                    createCommand('戰績', '皇家戰報查詢'),
                    createCommand('鳴潮抽卡', '皇家鳴潮喚取卷宗'),
                ],
            },
            {
                id: 'general',
                label: '一般',
                emoji: '📘',
                description: '皇家提醒。',
                group: 'public',
                commands: [createCommand('提醒', '提醒系統')],
            },
            {
                id: 'fun',
                label: '娛樂',
                emoji: '🎲',
                description: '皇家互動。',
                group: 'public',
                commands: [
                    { ...createCommand('占卜', '皇家占卜'), helpOnly: false },
                    { ...createCommand('投票', '正式投票'), helpOnly: true },
                    { ...createCommand('抽獎', '皇家抽獎'), helpOnly: true },
                ],
            },
        ],
    };

    for (const [category, expectedId, expectedLabel, categoryHint, detailHint] of [
        [context.catalog[0], 'help:viewer:launch:steam', '開啟皇家採購查詢', /點擊下方按鈕，立即開啟皇家互動介面/, /不必再輸入指令/],
        [context.catalog[1], 'help:viewer:launch:stats', '開啟皇家戰報查詢', /點擊下方按鈕，立即開啟皇家互動介面/, /不必再輸入指令/],
        [context.catalog[2], 'help:viewer:launch:reminder_create', '新增皇家提醒', /管理尚未送出的皇家傳喚/, /管理待發送項目/],
    ]) {
        const categoryText = JSON.stringify(helpViewTesting.renderCategory(context, category, 0).components[0].toJSON());
        const detail = helpViewTesting.renderDetail(context, category, 0, 0).components[0].toJSON();
        const detailText = JSON.stringify(detail);

        assert.match(categoryText, categoryHint);
        assert.match(detailText, detailHint);
        assert.match(detailText, new RegExp(expectedLabel));
        assert.match(detailText, new RegExp(expectedId));
        assert.equal(categoryText.includes(`\`/${category.commands[0].name}\``), false);
        assert.equal(detailText.includes(`/${category.commands[0].name}`), false);
        assert.equal(detailText.includes(`[指令] ${category.commands[0].name}`), false);
        assert.equal(countComponents(detail) <= 40, true);
    }

    const home = JSON.stringify(helpViewTesting.renderHome(context).components[0].toJSON());
    assert.match(home, /help:viewer:launch:steam/);
    assert.match(home, /help:viewer:category/);
    assert.match(home, /help:viewer:launch:stats/);
    assert.match(home, /help:viewer:launch:wuwa/);
    assert.match(home, /遊戲查詢/);

    const gameCategoryContainer = helpViewTesting.renderCategory(context, context.catalog[1], 0).components[0].toJSON();
    const gameCategory = JSON.stringify(gameCategoryContainer);
    assert.match(gameCategory, /help:viewer:launch:stats/);
    assert.match(gameCategory, /help:viewer:launch:wuwa/);
    assertPrimaryButtonLimit(gameCategoryContainer);

    const reminderDetail = JSON.stringify(helpViewTesting.renderDetail(context, context.catalog[2], 0, 0).components[0].toJSON());
    const reminderCategory = JSON.stringify(helpViewTesting.renderCategory(context, context.catalog[2], 0).components[0].toJSON());
    const funCategory = JSON.stringify(helpViewTesting.renderCategory(context, context.catalog[3], 0).components[0].toJSON());
    assert.match(reminderCategory, /管理尚未送出的皇家傳喚/);
    assert.match(reminderCategory, /help:viewer:launch:reminder_create/);
    assert.match(reminderDetail, /help:viewer:launch:reminder_manage/);
    assert.match(reminderDetail, /建立時所在頻道準時傳喚你/);
    assert.match(funCategory, /皇家互動入口/);
    assert.match(funCategory, /help:viewer:launch:poll/);
    assert.match(funCategory, /help:viewer:launch:giveaway/);
    assert.match(funCategory, /皇家占卜/);
    assert.equal(funCategory.includes('### 正式投票'), false);
    assert.equal(funCategory.includes('### 皇家抽獎'), false);
});

test('help home opens Steam directly and groups game queries into one category', () => {
    const context = {
        userId: 'viewer',
        canOpenSettings: false,
        catalog: [
            {
                id: 'general',
                label: '一般',
                emoji: '📘',
                description: '皇家提醒。',
                group: 'public',
                commands: [createCommand('提醒', '提醒系統')],
            },
            {
                id: 'steam',
                label: 'Steam',
                emoji: '🎮',
                description: '皇家採購。',
                group: 'public',
                commands: [createCommand('特價查詢', '皇家採購查詢')],
            },
            {
                id: 'esports',
                label: '遊戲查詢',
                emoji: '🎮',
                description: '遊戲資料查詢。',
                group: 'public',
                commands: [
                    createCommand('戰績', '皇家戰報查詢'),
                    createCommand('鳴潮抽卡', '皇家鳴潮喚取卷宗'),
                ],
            },
            {
                id: 'fun',
                label: '娛樂',
                emoji: '🎲',
                description: '皇家互動。',
                group: 'public',
                commands: [
                    { ...createCommand('投票', '正式投票'), helpOnly: true },
                    { ...createCommand('抽獎', '皇家抽獎'), helpOnly: true },
                ],
            },
        ],
    };

    const view = helpViewTesting.renderHome(context);
    const payload = ephemeralV2Payload(view.components);
    const container = view.components[0].toJSON();
    const rows = container.components.filter((component) => component.type === ComponentType.ActionRow);
    const launchButtons = rows
        .flatMap((row) => row.components)
        .filter((button) => button.custom_id?.startsWith('help:viewer:launch:'));
    const categorySelect = rows
        .flatMap((row) => row.components)
        .find((component) => component.type === ComponentType.StringSelect);

    assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
    assert.equal(rows.every((row) => row.components.length >= 1 && row.components.length <= 5), true);
    assert.equal(launchButtons.length, 3);
    assert.equal(categorySelect.custom_id, 'help:viewer:category');
    assert.deepEqual(categorySelect.options.map((option) => option.value), ['general', 'steam', 'esports', 'fun']);
    assert.match(JSON.stringify(container), /help:viewer:launch:steam/);
    assert.match(JSON.stringify(container), /help:viewer:launch:stats/);
    assert.match(JSON.stringify(container), /help:viewer:launch:wuwa/);
    assert.match(JSON.stringify(container), /遊戲查詢/);
    assert.equal(countComponents(container) <= 40, true);
    assertPrimaryButtonLimit(container);
});

test('help catalog merges esports and Wuthering Waves under game queries', () => {
    const merged = helpViewTesting.mergeGameQueryCategories([
        {
            id: 'esports',
            label: '戰績',
            emoji: '📊',
            description: '皇家戰報。',
            order: 45,
            group: 'public',
            commands: [createCommand('戰績', '皇家戰報查詢')],
        },
        {
            id: 'gacha',
            label: '鳴潮',
            emoji: '🌊',
            description: '鳴潮抽卡。',
            order: 47,
            group: 'public',
            commands: [createCommand('鳴潮抽卡', '皇家鳴潮喚取卷宗')],
        },
    ]);

    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, 'esports');
    assert.equal(merged[0].label, '遊戲查詢');
    assert.deepEqual(merged[0].commands.map((command) => command.name), ['戰績', '鳴潮抽卡']);
});

test('help expiration disables every interactive control and adds a V2 status notice', () => {
    const components = helpViewTesting.renderHome(createContext()).components;
    const closed = helpViewTesting.closeHelpBook(components)[0].toJSON();
    const actionControls = closed.components
        .filter((component) => component.type === ComponentType.ActionRow)
        .flatMap((row) => row.components);

    assert.equal(actionControls.every((component) => component.disabled), true);
    assert.match(JSON.stringify(closed), /大典已合上/);
});

test('help music entry appears beside all existing shortcuts and opens from category and detail', () => {
    const music = {
        id: 'music', label: '音樂', emoji: '🎵', description: '搜尋 NAS 曲庫。', group: 'public',
        commands: [createCommand('音樂', '皇家音樂播放器')],
    };
    const context = {
        ...createContext(),
        catalog: [
            ...createContext().catalog,
            { id: 'steam', label: 'Steam', emoji: '🎮', description: 'Steam 查詢。', commands: [createCommand('特價查詢')] },
            music,
            { id: 'esports', label: '遊戲查詢', emoji: '🎮', description: '遊戲查詢。', commands: [createCommand('戰績'), createCommand('鳴潮抽卡')] },
        ],
    };
    const home = helpViewTesting.renderHome(context).components[0].toJSON();
    for (const action of ['steam', 'music', 'stats', 'wuwa']) {
        assert.match(JSON.stringify(home), new RegExp(`help:viewer:launch:${action}`));
    }
    const select = home.components.flatMap(component => component.components ?? [])
        .find(component => component.type === ComponentType.StringSelect);
    assert.ok(select.options.some(option => option.value === 'music'));

    for (const view of [
        home,
        helpViewTesting.routeCategorySelection('help:viewer:category', 'music', context).components[0].toJSON(),
        helpViewTesting.renderDetail(context, music, 0, 0).components[0].toJSON(),
    ]) {
        assert.match(JSON.stringify(view), /help:viewer:launch:music/);
        assert.ok(countComponents(view) <= 40);
        assertPrimaryButtonLimit(view);
    }
    const category = helpViewTesting.renderCategory(context, music, 0).components[0].toJSON();
    assert.match(collectText(category), /先加入一般語音頻道/);
    assert.doesNotMatch(collectText(category), /用法：|\/音樂/);
});

test('help music button runs the real music entry without a registered slash command and rejects other viewers', async (t) => {
    const previousBaseUrl = process.env.MUSIC_API_BASE_URL;
    process.env.MUSIC_API_BASE_URL = 'http://music.example.test:8480';
    t.after(() => stopMusicPlayback());
    t.after(() => {
        if (previousBaseUrl === undefined) delete process.env.MUSIC_API_BASE_URL;
        else process.env.MUSIC_API_BASE_URL = previousBaseUrl;
    });
    t.mock.method(globalThis, 'fetch', async () => assert.fail('unconfigured music must not access the network'));
    const listeners = new Map();
    let helpPayload;
    const emptyCommands = { cache: new Map(), async fetch() { return new Map(); } };
    await executeHelp({
        user: { id: 'viewer' },
        member: { permissions: { has: () => false } },
        client: { application: { commands: emptyCommands } },
        guild: { commands: emptyCommands },
        async reply(payload) { helpPayload = payload; },
        async fetchReply() {
            return { createMessageComponentCollector() { return { on(event, callback) { listeners.set(event, callback); } }; } };
        },
    });
    assert.match(JSON.stringify(helpPayload), /help:viewer:launch:music/);
    const acknowledgements = [];
    const button = {
        guildId: '123456789012345678',
        user: { id: 'viewer' }, customId: 'help:viewer:launch:music',
        isStringSelectMenu: () => false, isChatInputCommand: () => false,
        async deferReply(payload) {
            this.deferred = true;
            this.ephemeral = Boolean(payload.flags & MessageFlags.Ephemeral);
            acknowledgements.push({ kind: 'deferReply', payload });
        },
        async editReply(payload) { acknowledgements.push({ kind: 'editReply', payload }); },
        async reply(payload) { acknowledgements.push({ kind: 'reply', payload }); },
    };
    await listeners.get('collect')({ ...button, user: { id: 'other' } });
    assert.deepEqual(acknowledgements.map(ack => ack.kind), ['reply']);
    assert.match(JSON.stringify(acknowledgements[0].payload), /這份大典不屬於你/);
    acknowledgements.length = 0;
    await listeners.get('collect')(button);
    assert.deepEqual(acknowledgements.map(ack => ack.kind), ['deferReply', 'editReply']);
    assert.ok(acknowledgements[0].payload.flags & MessageFlags.Ephemeral);
    assert.match(JSON.stringify(acknowledgements[1].payload), /登入音樂庫/);
    assert.match(JSON.stringify(acknowledgements[1].payload), /musicauth:[^:]+:login/);
});
