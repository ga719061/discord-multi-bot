import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags,
    SeparatorSpacingSize,
} from 'discord.js';
import {
    assertValidV2Components,
    countV2Components,
    v2Card,
    v2Divider,
    v2EditPayload,
    v2Notice,
    v2Payload,
    v2Text,
} from '../src/utils/componentsV2.js';
import { ANSI_TONES, ansiRows, COLORS, fmt, UI_COLORS } from '../src/utils/style.js';
import { buildPollPayload } from '../src/commands/fun/poll.js';
import {
    buildAnnouncementPayload,
    buildPrefilledAnnouncementPreview,
    claimPendingAnnouncement,
    openAnnouncementComposer,
    pendingAnnouncements,
    restorePendingAnnouncement,
} from '../src/utils/announcementTools.js';
import {
    announcementImageTesting,
    renderAnnouncementScrollImage,
} from '../src/utils/announcementImage.js';

const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==',
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

test('ANSI summary rows stay semantic, compact, and safe without relying on color', () => {
    const output = ansiRows([
        { label: '狀態', value: 0, tone: 'success' },
        { label: '玩家', value: '測試```\n\u001b[31m危險\u009b31m名稱', tone: 'info' },
        { label: '很長的標籤很長的標籤', value: '鳴'.repeat(80), tone: 'unknown' },
    ]);
    const plain = output
        .replace(/```ansi\n|\n```/g, '')
        .replace(/\u001b\[[0-9;]+m/g, '');

    assert.match(output, /```ansi/);
    assert.match(output, new RegExp(`\\u001b\\[${ANSI_TONES.success.replace(';', '\\;')}m`));
    assert.match(plain, /\[狀態\] 0/);
    assert.match(plain, /\[玩家\] 測試''' 危險31m名稱/);
    assert.equal(plain.includes('\u001b'), false);
    assert.equal(plain.includes('\u009b'), false);
    assert.equal(plain.split('\n').every((line) => [...line].length <= 56), true);
    assert.match(fmt(COLORS.CYAN, 0), /0/);
});

test('ANSI rows preserve exact legacy output unless labelTone is explicitly provided', () => {
    const rows = Object.entries(ANSI_TONES).map(([tone]) => ({ label: '狀態', value: '正常', tone }));
    const expected = '```ansi\n' + rows.map(({ tone }) => `\u001b[${ANSI_TONES[tone]}m[狀態] 正常\u001b[0m`).join('\n') + '\n```';
    assert.equal(ansiRows(rows), expected);
    assert.equal(ansiRows([{ label: '狀態', value: 0, tone: 'success', labelTone: undefined }]),
        '```ansi\n\u001b[32m[狀態] 0\u001b[0m\n```');
    assert.equal(ansiRows([]), '```ansi\n\u001b[37m[資訊] -\u001b[0m\n```');
});

test('ANSI rows reset and independently color labels and values using only own palette keys', () => {
    assert.equal(ansiRows([{ label: '狀態', value: '正常', tone: 'success', labelTone: 'neutral' }]),
        '```ansi\n\u001b[37m[狀態]\u001b[0m \u001b[32m正常\u001b[0m\n```');
    assert.equal(ansiRows([{ label: '狀態', value: '正常', tone: 'info', labelTone: 'royal' }]),
        '```ansi\n\u001b[33;1m[狀態]\u001b[0m \u001b[36m正常\u001b[0m\n```');
    for (const unknown of ['unknown', 'constructor', 'toString', '__proto__']) {
        assert.equal(ansiRows([{ label: '狀態', value: '正常', tone: unknown }]),
            '```ansi\n\u001b[37m[狀態] 正常\u001b[0m\n```');
        assert.equal(ansiRows([{ label: '狀態', value: '正常', tone: unknown, labelTone: unknown }]),
            '```ansi\n\u001b[37m[狀態]\u001b[0m \u001b[37m正常\u001b[0m\n```');
    }
});

test('ANSI summary sanitizes direction controls and escape injection while preserving joined emoji', () => {
    const directionControls = '\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069';
    const output = ansiRows([{
        label: `${directionControls}狀態\u001b[31m`,
        value: `${directionControls}正常\u001b[31m\u001b]0;unsafe\u0007\n\t\`\`\` 👩‍💻`,
        tone: 'success', labelTone: 'neutral',
    }], { maxWidth: 40 });
    const plain = output.replace(/^```ansi\n|\n```$/g, '').replace(/\u001b\[[0-9;]+m/g, '');
    assert.doesNotMatch(plain, /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069`]/);
    assert.ok(plain.includes('[狀態] 正常'));
    assert.ok(plain.includes('👩‍💻'), 'the zero-width joiner is required for composed emoji');
    assert.equal((output.match(/\u001b\[/g) ?? []).length, 4, 'only the two generated colors and their resets survive');
    const compact = ansiRows([{ label: '結果', value: '曲目'.repeat(30), tone: 'royal', labelTone: 'neutral' }], { maxWidth: 40 });
    const compactPlain = compact.replace(/^```ansi\n|\n```$/g, '').replace(/\u001b\[[0-9;]+m/g, '');
    const width = [...compactPlain].reduce((sum, character) => sum + (/[^\x00-\x7f]/.test(character) && character !== '…' ? 2 : 1), 0);
    assert.ok(width <= 40);
    assert.ok(compactPlain.endsWith('…'));
});

test('V2 cards can render one ANSI status summary before details', () => {
    const card = v2Card({
        title: '皇家情報',
        statusRows: [
            { label: '狀態', value: '正常', tone: 'success' },
            { label: '範圍', value: '私人', tone: 'royal' },
        ],
        fields: [{ name: '說明', value: '完整內容保留在一般文字。' }],
    }).toJSON();
    const texts = card.components.filter((component) => component.type === ComponentType.TextDisplay);

    assert.equal(texts.some((component) => component.content.includes('```ansi')), true);
    assert.equal(texts.some((component) => component.content.includes('[狀態]')), true);
    assert.equal(countV2Components([card]) <= 40, true);
});

test('V2 dividers and card images support richer display metadata', () => {
    const defaultDivider = v2Divider().toJSON();
    const spacedDivider = v2Divider(SeparatorSpacingSize.Large).toJSON();
    const card = v2Card({
        title: '皇家戰報',
        images: [
            'https://example.test/legacy.png',
            {
                url: 'https://example.test/detailed.png',
                description: '玩家 Gigi 的 VALORANT 戰績圖',
                spoiler: true,
            },
        ],
    }).toJSON();
    const gallery = card.components.find((component) => component.type === ComponentType.MediaGallery);

    assert.equal(defaultDivider.divider, true);
    assert.equal(spacedDivider.spacing, SeparatorSpacingSize.Large);
    assert.equal(gallery.items[0].media.url, 'https://example.test/legacy.png');
    assert.equal(gallery.items[0].description, '皇家戰報第 1 張圖片');
    assert.equal(gallery.items[1].description, '玩家 Gigi 的 VALORANT 戰績圖');
    assert.equal(gallery.items[1].spoiler, true);
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

test('announcement smart wrapping splits oversized ASCII and URL tokens without losing text', () => {
    const longAscii = 'A'.repeat(80);
    assert.deepEqual(announcementImageTesting.smartWrap(longAscii, 38, 3), [
        'A'.repeat(38),
        'A'.repeat(38),
        'A'.repeat(4),
    ]);

    const longUrl = `https://example.com/${'release-notes-'.repeat(6)}download`;
    const urlLines = announcementImageTesting.smartWrap(longUrl, 36, 10);
    assert.equal(urlLines.join(''), longUrl);
    assert.equal(urlLines.every((line) => line.length <= 36), true);
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
