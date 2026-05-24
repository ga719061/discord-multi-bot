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
        catalog: [
            {
                id: 'general',
                label: '一般',
                emoji: '📘',
                description: '基礎工具。',
                group: 'public',
                commands: [createCommand('幫助', '指令大典')],
            },
            {
                id: 'admin',
                label: '管理',
                emoji: '🛡️',
                description: '管理工具。',
                group: 'admin',
                commands: [createCommand('發布公告')],
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
    const adminButton = actionRows
        .flatMap((row) => row.components)
        .find((button) => button.label === '管理');
    const customIds = buttons.map((button) => button.custom_id);

    assert.equal(container.type, ComponentType.Container);
    assert.equal((payload.flags & MessageFlags.Ephemeral) !== 0, true);
    assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
    assert.equal('embeds' in payload, false);
    assert.equal('content' in payload, false);
    assert.equal(adminButton.style, ButtonStyle.Secondary);
    assert.equal(new Set(customIds).size, customIds.length);
    assert.equal(countComponents(container) <= 40, true);
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
