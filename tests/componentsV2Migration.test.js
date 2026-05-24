import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import {
    assertValidV2Components,
    countV2Components,
    v2Card,
    v2EditPayload,
    v2Notice,
    v2Payload,
    v2Text,
} from '../src/utils/componentsV2.js';
import { UI_COLORS } from '../src/utils/style.js';
import { buildPollPayload } from '../src/commands/fun/poll.js';
import { buildAnnouncementPayload, execute as executeAnnouncement } from '../src/commands/admin/announce.js';

test('V2 payloads set flags, default to safe mentions, and reject duplicate ids', () => {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('unique').setLabel('確定').setStyle(ButtonStyle.Primary)
    );
    const payload = v2Payload([v2Card({ title: '測試', actionRows: [row] })]);

    assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
    assert.deepEqual(payload.allowedMentions, { parse: [] });
    assert.equal('embeds' in payload, false);
    assert.equal('content' in payload, false);
    assert.equal(v2EditPayload(payload).flags, MessageFlags.IsComponentsV2);

    const duplicateRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('same').setLabel('一').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('same').setLabel('二').setStyle(ButtonStyle.Secondary)
    );
    assert.throws(() => v2Payload([v2Card({ title: '重複', actionRows: [duplicateRow] })]), /custom_id/);
});

test('V2 text and component guards constrain oversized output', () => {
    assert.equal(v2Text('a'.repeat(5000)).toJSON().content.length, 4000);
    const panels = Array.from({ length: 41 }, (_, index) => v2Notice(`卡片 ${index}`, '內容', UI_COLORS.INFO).components[0]);
    assert.equal(countV2Components(panels) > 40, true);
    assert.throws(() => assertValidV2Components(panels), /40/);
});

test('new poll and announcement renders are V2-only with controlled mentions', () => {
    const poll = buildPollPayload({
        question: '今天吃什麼？',
        options: ['牛排', '雞肉'],
        votes: { 0: ['1'], 1: [] },
        creatorId: '123',
    });
    const announcement = buildAnnouncementPayload({
        title: '維護通知',
        content: '今晚暫停服務。',
        footer: '請留意',
        images: ['https://example.test/notice.png'],
        mentionText: '<@&456>',
        allowedMentions: { parse: [], roles: ['456'] },
    });

    assert.equal((poll.flags & MessageFlags.IsComponentsV2) !== 0, true);
    assert.match(JSON.stringify(poll.components[0].toJSON()), /建立者：<@123>/);
    assert.equal('embeds' in announcement, false);
    assert.deepEqual(announcement.allowedMentions, { parse: [], roles: ['456'] });
    assert.match(JSON.stringify(announcement.components[0].toJSON()), /維護通知/);
});

test('announcement command opens a modal with file upload rather than slash image options', async () => {
    let modal;
    const commandJson = (await import('../src/commands/admin/announce.js')).data.toJSON();
    const interaction = {
        user: { id: 'admin' },
        options: {
            getChannel: () => ({ id: 'channel' }),
            getString: () => 'none',
            getRole: () => null,
        },
        showModal: async (nextModal) => { modal = nextModal.toJSON(); },
    };

    await executeAnnouncement(interaction);

    assert.equal(commandJson.options.some((option) => option.name.startsWith('圖片')), false);
    assert.match(JSON.stringify(modal), /announce_images/);
});
