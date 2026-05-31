import test from 'node:test';
import assert from 'node:assert/strict';
import { ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import { helpViewTesting } from '../src/commands/general/help.js';
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

test('help home renders a Components V2 payload with navigational admin styling', () => {
    const view = helpViewTesting.renderHome(createContext());
    const payload = ephemeralV2Payload(view.components);
    const container = view.components[0].toJSON();
    const actionRows = container.components.filter((component) => component.type === ComponentType.ActionRow);
    const sectionButtons = container.components
        .filter((component) => component.type === ComponentType.Section && component.accessory?.custom_id)
        .map((component) => component.accessory);
    const buttons = [
        ...sectionButtons,
        ...actionRows.flatMap((row) => row.components),
    ];
    const settingsButton = actionRows
        .flatMap((row) => row.components)
        .find((button) => button.label === '進入皇家管理控制台');
    const customIds = buttons.map((button) => button.custom_id);

    assert.equal(container.type, ComponentType.Container);
    assert.equal((payload.flags & MessageFlags.Ephemeral) !== 0, true);
    assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
    assert.equal('embeds' in payload, false);
    assert.equal('content' in payload, false);
    assert.equal(settingsButton.style, ButtonStyle.Primary);
    assert.equal(JSON.stringify(container).includes('智慧登入'), false);
    assert.equal(new Set(customIds).size, customIds.length);
    assert.equal(countComponents(container) <= 40, true);
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

    assert.equal(categoryContainer.type, ComponentType.Container);
    assert.equal(detailContainer.type, ComponentType.Container);
    assert.equal(countComponents(categoryContainer) <= 40, true);
    assert.equal(countComponents(detailContainer) <= 40, true);
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
                label: '戰績',
                emoji: '📊',
                description: '皇家戰報。',
                group: 'public',
                commands: [createCommand('戰績', '皇家戰報查詢')],
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
    assert.match(home, /help:viewer:launch:stats/);
    assert.equal(home.includes('help:viewer:cat:steam'), false);
    assert.equal(home.includes('help:viewer:cat:esports'), false);

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

test('help home opens Steam and stats directly while other features stay categorized', () => {
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
                label: '戰績',
                emoji: '📊',
                description: '皇家戰報。',
                group: 'public',
                commands: [createCommand('戰績', '皇家戰報查詢')],
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
    const categoryButtons = rows
        .flatMap((row) => row.components)
        .filter((button) => button.custom_id?.startsWith('help:viewer:cat:'));

    assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
    assert.equal(rows.every((row) => row.components.length >= 1 && row.components.length <= 5), true);
    assert.equal(launchButtons.length, 2);
    assert.equal(categoryButtons.length, 2);
    assert.match(JSON.stringify(container), /help:viewer:cat:general/);
    assert.match(JSON.stringify(container), /help:viewer:launch:steam/);
    assert.match(JSON.stringify(container), /help:viewer:launch:stats/);
    assert.equal(JSON.stringify(container).includes('help:viewer:cat:steam'), false);
    assert.equal(JSON.stringify(container).includes('help:viewer:cat:esports'), false);
    assert.equal(countComponents(container) <= 40, true);
});

test('help expiration disables every interactive control and adds a V2 status notice', () => {
    const components = helpViewTesting.renderHome(createContext()).components;
    const closed = helpViewTesting.closeHelpBook(components)[0].toJSON();
    const actionButtons = closed.components
        .filter((component) => component.type === ComponentType.ActionRow)
        .flatMap((row) => row.components);
    const section = closed.components.find((component) => component.type === ComponentType.Section);

    assert.equal(actionButtons.every((button) => button.disabled), true);
    assert.equal(section.accessory.disabled, true);
    assert.match(JSON.stringify(closed), /大典已合上/);
});
