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
import {
    buildAnnouncementPayload,
    buildPrefilledAnnouncementPreview,
    claimPendingAnnouncement,
    openAnnouncementComposer,
    pendingAnnouncements,
    restorePendingAnnouncement,
} from '../src/utils/announcementTools.js';
import { renderAnnouncementScrollImage } from '../src/utils/announcementImage.js';

const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
);

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
    assert.equal(v2EditPayload(payload).withComponents, true);

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

test('new poll and announcement renders keep controlled mentions', async () => {
    const poll = buildPollPayload({
        question: '今天吃什麼？',
        options: ['牛排', '雞肉'],
        votes: { 0: ['1'], 1: [] },
        creatorId: '123',
    });
    const announcement = await buildAnnouncementPayload({
        title: '維護通知',
        content: '今晚暫停服務。',
        footer: '請留意',
        images: [{ url: 'https://example.test/notice.png', name: 'notice.png', contentType: 'image/png' }],
        mentionText: '<@&456>',
        allowedMentions: { parse: [], roles: ['456'] },
    }, {
        fetchImpl: successfulImageFetch,
    });

    assert.equal((poll.flags & MessageFlags.IsComponentsV2) !== 0, true);
    assert.match(JSON.stringify(poll.components[0].toJSON()), /建立者：<@123>/);
    assert.equal('embeds' in announcement, false);
    assert.equal('components' in announcement, false);
    assert.equal(announcement.content, '<@&456>');
    assert.deepEqual(announcement.allowedMentions, { parse: [], roles: ['456'] });
    assert.equal(announcement.files[0].name, 'announcement-scroll.png');
    assert.equal(announcement.files[1].name, 'notice.png');
});

test('announcement preview is ephemeral V2 with scroll image and buttons', async () => {
    const row = buildAnnouncementPreviewButtonsForTest();
    const preview = await buildAnnouncementPayload({
        title: '活動公告',
        content: '本週末舉辦活動，請大家準時集合。',
        mentionText: '@here',
        allowedMentions: { parse: ['everyone'] },
    }, {
        preview: true,
        actionRows: [row],
    });

    assert.equal((preview.flags & MessageFlags.IsComponentsV2) !== 0, true);
    assert.equal((preview.flags & MessageFlags.Ephemeral) !== 0, true);
    assert.deepEqual(preview.allowedMentions, { parse: [] });
    assert.equal(preview.files[0].name, 'announcement-scroll.png');
    assert.match(JSON.stringify(preview.components[0].toJSON()), /發布公告/);
});

test('announcement scroll renderer returns a non-empty PNG and tolerates missing background', async () => {
    const card = await renderAnnouncementScrollImage({
        title: '超長公告標題測試超長公告標題測試超長公告標題測試',
        content: '這是一段會被印在直式卷軸上的公告內容。'.repeat(20),
        footer: '請大家留意後續更新',
        mentionLabel: '@here',
        backgroundPath: 'assets/missing-scroll-background.png',
    });

    assert.equal(card.filename, 'announcement-scroll.png');
    assert.equal(card.attachment.name, 'announcement-scroll.png');
    assert.equal(Buffer.isBuffer(card.buffer), true);
    assert.equal(card.buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(card.buffer.length > 1000, true);
});

test('announcement composer opens a modal with file upload', async () => {
    let modal;
    const interaction = {
        user: { id: 'admin' },
        showModal: async (nextModal) => { modal = nextModal.toJSON(); },
    };

    await openAnnouncementComposer(interaction, { channelId: 'channel' });

    assert.match(JSON.stringify(modal), /announce_images/);
    assert.match(JSON.stringify(modal), /480/);
});

test('prefilled announcement preview stores a private pending draft with safe mentions', async () => {
    const before = pendingAnnouncements.size;
    const preview = await buildPrefilledAnnouncementPreview({
        channelId: 'channel',
        userId: 'admin',
        title: '維護通知',
        content: '今晚維護，請大家留意。',
        footer: '謝謝配合',
        mentionText: '@here',
        allowedMentions: { parse: ['everyone'] },
    });

    assert.equal((preview.flags & MessageFlags.IsComponentsV2) !== 0, true);
    assert.equal((preview.flags & MessageFlags.Ephemeral) !== 0, true);
    assert.deepEqual(preview.allowedMentions, { parse: [] });
    assert.equal(pendingAnnouncements.size, before + 1);
    const draft = [...pendingAnnouncements.values()].find((entry) => entry.title === '維護通知');
    assert.deepEqual(draft.allowedMentions, { parse: ['everyone'] });
    assert.match(JSON.stringify(preview.components[0].toJSON()), /發布公告/);
});

test('announcement draft claim is atomic and can be restored after publish failure', () => {
    const uuid = 'claim-test';
    const draft = { channelId: 'channel', userId: 'admin', timestamp: Date.now() };
    pendingAnnouncements.set(uuid, draft);

    assert.equal(claimPendingAnnouncement(uuid), draft);
    assert.equal(claimPendingAnnouncement(uuid), null);
    assert.equal(pendingAnnouncements.has(uuid), false);

    assert.equal(restorePendingAnnouncement(uuid, draft), true);
    assert.equal(restorePendingAnnouncement(uuid, draft), false);
    assert.equal(pendingAnnouncements.get(uuid), draft);
    pendingAnnouncements.delete(uuid);
});

function successfulImageFetch() {
    return new Response(tinyPng, {
        status: 200,
        headers: { 'content-type': 'image/png' },
    });
}

function buildAnnouncementPreviewButtonsForTest() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('announce_preview:test:publish')
            .setLabel('發布公告')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('announce_preview:test:cancel')
            .setLabel('取消')
            .setStyle(ButtonStyle.Secondary)
    );
}
