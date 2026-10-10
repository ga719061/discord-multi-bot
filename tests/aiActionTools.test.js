import assert from 'node:assert';
import test from 'node:test';
import { PermissionFlagsBits } from 'discord.js';
import {
    aiActionToolsTesting,
    getAiActionAuthorizationError,
    handleAiActionInteraction,
    parseAiActionTrigger,
    parseMentionedAiActionTrigger,
    prepareAiAction,
    stopAiActionTools,
} from '../src/utils/aiActionTools.js';
import { getDb, updateAiSetting } from '../src/utils/database.js';
import { cleanupTestDatabase, initTestDatabase } from './helpers/database.js';

test.afterEach(() => {
    stopAiActionTools();
    cleanupTestDatabase();
});

test('AI action parser only accepts anchored mention text prefixes with a colon', () => {
    assert.deepEqual(parseAiActionTrigger('提醒: 10 分鐘後喝水'), {
        tool: 'reminder',
        instruction: '10 分鐘後喝水',
    });
    assert.deepEqual(parseAiActionTrigger('投票：今晚玩什麼？'), {
        tool: 'poll',
        instruction: '今晚玩什麼？',
    });
    assert.deepEqual(parseAiActionTrigger('公告：   '), {
        tool: 'announcement',
        instruction: '',
    });
    assert.equal(parseAiActionTrigger('請幫我提醒: 喝水'), null);
    assert.equal(parseAiActionTrigger('我們聊聊投票：制度'), null);
    assert.equal(parseAiActionTrigger('提醒 喝水'), null);
});

test('AI action parser requires the tool prefix immediately after a leading bot mention', () => {
    assert.deepEqual(parseMentionedAiActionTrigger('<@123> 提醒：10 分鐘後喝水', '123'), {
        tool: 'reminder',
        instruction: '10 分鐘後喝水',
    });
    assert.deepEqual(parseMentionedAiActionTrigger('  <@!123>投票: A 或 B', '123'), {
        tool: 'poll',
        instruction: 'A 或 B',
    });
    assert.equal(parseMentionedAiActionTrigger('提醒：10 分鐘後喝水 <@123>', '123'), null);
    assert.equal(parseMentionedAiActionTrigger('先聊天 <@123> 公告：活動', '123'), null);
    assert.equal(parseMentionedAiActionTrigger('<@456> 提醒：喝水', '123'), null);
});

test('prepared action uses exactly one function proposal and public launcher hides draft content', async () => {
    let proposalInput;
    const result = await prepareAiAction({
        tool: 'poll',
        instruction: '今晚玩什麼？選 LoL 或 VALORANT',
        guildId: 'guild',
        channelId: 'channel',
        userId: 'user',
        sourceMessageId: 'source',
        settings: { model: 'gemini-3.8-flash' },
    }, {
        now: () => 1_000,
        aiProposer: async (input) => {
            proposalInput = input;
            return {
                name: 'prepare_poll',
                args: {
                    status: 'ready',
                    question: '今晚玩什麼？',
                    options: ['LoL', 'VALORANT'],
                },
            };
        },
    });

    assert.equal(result.needsInput, false);
    assert.equal(proposalInput.functionDeclaration.name, 'prepare_poll');
    assert.equal(proposalInput.modelName, 'gemini-3.8-flash');
    assert.equal('history' in proposalInput, false);
    assert.equal('imageAttachments' in proposalInput, false);
    assert.equal('useSearch' in proposalInput, false);
    const publicPayload = JSON.stringify(result.payload);
    assert.doesNotMatch(publicPayload, /今晚玩什麼|VALORANT/);
    assert.match(publicPayload, /開啟私人預覽/);
});

test('invalid or ambiguous proposals stay pending and ask for private completion', async () => {
    const result = await prepareAiAction({
        tool: 'reminder',
        instruction: '晚點提醒我',
        guildId: 'guild',
        channelId: 'channel',
        userId: 'user',
        sourceMessageId: 'source',
        settings: { model: 'gemini-3.5-flash-lite' },
    }, {
        now: () => 1_000,
        aiProposer: async () => ({
            name: 'prepare_reminder',
            args: { status: 'needs_input', content: '', timeText: '晚點' },
        }),
    });

    assert.equal(result.needsInput, true);
    assert.match(JSON.stringify(result.payload), /補齊資料/);
});

test('reminder proposals require an explicit Asia/Taipei offset', async () => {
    const baseContext = {
        tool: 'reminder',
        instruction: '明天下午三點提醒我開會',
        guildId: 'guild',
        channelId: 'channel',
        userId: 'user',
        settings: { model: 'gemini-3.8-flash' },
    };
    const withoutOffset = await prepareAiAction({
        ...baseContext,
        sourceMessageId: 'source-no-offset',
    }, {
        now: () => Date.parse('2026-08-09T12:00:00+08:00'),
        aiProposer: async () => ({
            name: 'prepare_reminder',
            args: {
                status: 'ready',
                content: '開會',
                timeText: '明天下午三點',
                targetTime: '2026-08-10T15:00:00',
            },
        }),
    });
    const withOffset = await prepareAiAction({
        ...baseContext,
        sourceMessageId: 'source-with-offset',
    }, {
        now: () => Date.parse('2026-08-09T12:00:00+08:00'),
        aiProposer: async () => ({
            name: 'prepare_reminder',
            args: {
                status: 'ready',
                content: '開會',
                timeText: '明天下午三點',
                targetTime: '2026-08-10T15:00:00+08:00',
            },
        }),
    });

    assert.equal(withoutOffset.needsInput, true);
    assert.equal(withOffset.needsInput, false);
});

test('action text sanitization neutralizes mentions, ANSI and code fences', () => {
    const sanitize = aiActionToolsTesting.sanitizeActionText;
    const sanitized = sanitize('\u001b[31m@everyone <@123> ```danger```', { multiline: true });
    assert.doesNotMatch(sanitized, /\u001b|@everyone|<@123>|```/);
    assert.match(sanitized, /@\u200beveryone/);
});

test('AI action authorization ignores party mode and requires stronger announcement access', () => {
    const base = {
        enabled: 1,
        expires_at: null,
        action_tools_enabled: true,
        whitelist: ['owner'],
        admin_ids: ['owner'],
        party_channel_id: 'party',
        party_expires_at: Date.now() + 60_000,
    };
    assert.match(getAiActionAuthorizationError({
        tool: 'poll', settings: { ...base, action_tools_enabled: false }, userId: 'owner',
    }), /關閉/);
    assert.match(getAiActionAuthorizationError({
        tool: 'poll', settings: base, userId: 'party-user',
    }), /白名單/);
    assert.match(getAiActionAuthorizationError({
        tool: 'announcement', settings: base, userId: 'owner', isAdministrator: false,
    }), /Administrator/);
    assert.match(getAiActionAuthorizationError({
        tool: 'announcement', settings: { ...base, admin_ids: [] }, userId: 'owner', isAdministrator: true,
    }), /管理解鎖/);
    assert.match(getAiActionAuthorizationError({
        tool: 'announcement', settings: base, userId: 'owner', isAdministrator: true, hasAttachments: true,
    }), /純文字/);
    assert.equal(getAiActionAuthorizationError({
        tool: 'announcement', settings: base, userId: 'owner', isAdministrator: true,
    }), null);
});

test('owner can open a private completion modal while other users are rejected', async () => {
    initTestDatabase('ai-action-owner');
    enableActions('guild', 'owner');
    const prepared = await prepareAiAction({
        tool: 'reminder',
        instruction: '',
        guildId: 'guild',
        channelId: 'channel',
        userId: 'owner',
        sourceMessageId: 'source',
        settings: { model: 'gemini-3.8-flash' },
    });

    let rejected;
    await handleAiActionInteraction({
        customId: `ai_action:${prepared.sessionId}:open`,
        user: { id: 'intruder' },
        guildId: 'guild',
        reply: async payload => { rejected = payload; },
    }, {});
    assert.match(JSON.stringify(rejected), /只有原提問者/);

    let modal;
    await handleAiActionInteraction({
        customId: `ai_action:${prepared.sessionId}:open`,
        user: { id: 'owner' },
        guildId: 'guild',
        channelId: 'channel',
        member: { permissions: { has: () => false } },
        message: { id: 'launcher' },
        showModal: async value => { modal = value; },
    }, {});
    assert.match(JSON.stringify(modal), /提醒時間/);
    assert.match(JSON.stringify(modal), /提醒內容/);

    await handleAiActionInteraction({
        customId: `ai_action:${prepared.sessionId}:open`,
        user: { id: 'owner' },
        guildId: 'guild',
        channelId: 'channel',
        member: { permissions: { has: () => false } },
        message: { id: 'ephemeral-retry' },
        showModal: async () => {},
    }, {});
    assert.equal(aiActionToolsTesting.pendingActions.get(prepared.sessionId).launcherMessageId, 'launcher');
});

test('poll confirmation is owner-bound, atomic, persisted and cannot publish twice', async () => {
    initTestDatabase('ai-action-poll');
    enableActions('guild', 'owner');
    const prepared = await prepareAiAction({
        tool: 'poll',
        instruction: '今晚玩什麼？LoL 或 VALORANT',
        guildId: 'guild',
        channelId: 'channel',
        userId: 'owner',
        sourceMessageId: 'source',
        settings: { model: 'gemini-3.8-flash' },
    }, {
        aiProposer: async () => ({
            name: 'prepare_poll',
            args: {
                status: 'ready',
                question: '今晚玩什麼？',
                options: ['LoL', 'VALORANT'],
            },
        }),
    });

    let sends = 0;
    const sentMessage = { id: 'poll-message', delete: async () => {} };
    const channel = {
        id: 'channel',
        isTextBased: () => true,
        permissionsFor: () => ({ has: () => true }),
        send: async () => { sends += 1; return sentMessage; },
        messages: { fetch: async () => null },
    };
    const client = { channels: { fetch: async () => channel } };
    let completion;
    const interaction = confirmationInteraction(prepared.sessionId, payload => { completion = payload; });

    await handleAiActionInteraction(interaction, client);
    assert.equal(sends, 1);
    assert.equal(getDb().prepare('SELECT COUNT(*) AS count FROM polls').get().count, 1);
    assert.match(JSON.stringify(completion), /投票已發布/);

    let expired;
    await handleAiActionInteraction({
        ...confirmationInteraction(prepared.sessionId, () => {}),
        reply: async payload => { expired = payload; },
    }, client);
    assert.equal(sends, 1);
    assert.match(JSON.stringify(expired), /已逾時/);
});

test('confirmation restores before execution but never after a successful action', async () => {
    initTestDatabase('ai-action-confirm-boundaries');
    enableActions('guild', 'owner');
    const makePrepared = sourceMessageId => prepareAiAction({
        tool: 'poll',
        instruction: 'A 或 B',
        guildId: 'guild',
        channelId: 'channel',
        userId: 'owner',
        sourceMessageId,
        settings: { model: 'gemini-3.8-flash' },
    }, {
        aiProposer: async () => ({
            name: 'prepare_poll',
            args: { status: 'ready', question: '選 A 或 B？', options: ['A', 'B'] },
        }),
    });
    const channel = {
        id: 'channel',
        isTextBased: () => true,
        permissionsFor: () => ({ has: () => true }),
        send: async () => ({ id: `poll-${Date.now()}`, delete: async () => {} }),
        messages: { fetch: async () => null },
    };
    const client = { channels: { fetch: async () => channel } };

    const beforeExecution = await makePrepared('before-execution');
    await assert.rejects(handleAiActionInteraction({
        ...confirmationInteraction(beforeExecution.sessionId, () => {}),
        deferUpdate: async () => { throw new Error('Discord unavailable'); },
    }, client));
    assert.equal(aiActionToolsTesting.pendingActions.has(beforeExecution.sessionId), true);
    assert.equal(getDb().prepare('SELECT COUNT(*) AS count FROM polls').get().count, 0);

    const afterExecution = await makePrepared('after-execution');
    await handleAiActionInteraction({
        ...confirmationInteraction(afterExecution.sessionId, () => {}),
        editReply: async () => { throw new Error('ack failed'); },
    }, client);
    assert.equal(aiActionToolsTesting.pendingActions.has(afterExecution.sessionId), false);
    assert.equal(getDb().prepare('SELECT COUNT(*) AS count FROM polls').get().count, 1);
});

test('modal acknowledgement failure always releases the AI request lease', async () => {
    initTestDatabase('ai-action-modal-lease');
    enableActions('guild', 'owner');
    const prepared = await prepareAiAction({
        tool: 'reminder',
        instruction: '',
        guildId: 'guild',
        channelId: 'channel',
        userId: 'owner',
        sourceMessageId: 'source',
        settings: { model: 'gemini-3.8-flash' },
    });
    let releases = 0;
    const fields = new Map([['time', '10m'], ['content', '喝水']]);
    await assert.rejects(handleAiActionInteraction({
        customId: `ai_action:${prepared.sessionId}:complete`,
        user: { id: 'owner' },
        guildId: 'guild',
        member: { permissions: { has: () => false } },
        fields: { getTextInputValue: key => fields.get(key) },
        deferReply: async () => { throw new Error('Discord unavailable'); },
        editReply: async () => { throw new Error('not deferred'); },
    }, {}, {
        acquireRequest: () => ({ ok: true, release: () => { releases += 1; } }),
    }));
    assert.equal(releases, 1);
});

test('expired sessions do not execute', async () => {
    initTestDatabase('ai-action-expired');
    enableActions('guild', 'owner');
    const prepared = await prepareAiAction({
        tool: 'poll',
        instruction: 'Q: A 或 B',
        guildId: 'guild',
        channelId: 'channel',
        userId: 'owner',
        sourceMessageId: 'source',
        settings: { model: 'gemini-3.8-flash' },
    }, {
        now: () => 10,
        aiProposer: async () => ({
            name: 'prepare_poll',
            args: { status: 'ready', question: 'Q', options: ['A', 'B'] },
        }),
    });
    let reply;
    await handleAiActionInteraction({
        ...confirmationInteraction(prepared.sessionId, () => {}),
        reply: async payload => { reply = payload; },
    }, {}, { now: () => 10 + 5 * 60_000 + 1 });
    assert.match(JSON.stringify(reply), /已逾時/);
    assert.equal(getDb().prepare('SELECT COUNT(*) AS count FROM polls').get().count, 0);
});

test('pending action sessions are bounded and replace the same source message', async () => {
    for (let index = 0; index <= 100; index += 1) {
        await prepareAiAction({
            tool: 'reminder',
            instruction: '',
            guildId: 'guild',
            channelId: 'channel',
            userId: 'owner',
            sourceMessageId: `source-${index}`,
            settings: { model: 'gemini-3.8-flash' },
        });
    }
    assert.equal(aiActionToolsTesting.pendingActions.size, 100);

    const before = aiActionToolsTesting.pendingActions.size;
    await prepareAiAction({
        tool: 'poll',
        instruction: '',
        guildId: 'guild',
        channelId: 'channel',
        userId: 'owner',
        sourceMessageId: 'source-100',
        settings: { model: 'gemini-3.8-flash' },
    });
    assert.equal(aiActionToolsTesting.pendingActions.size, before);
});

test('announcement confirmation stays private, strips mentions and publishes once to the source channel', async () => {
    initTestDatabase('ai-action-announcement');
    enableActions('guild', 'owner');
    updateAiSetting('guild', 'admin_ids', JSON.stringify(['owner']));
    const prepared = await prepareAiAction({
        tool: 'announcement',
        instruction: '提醒大家週末活動',
        guildId: 'guild',
        channelId: 'channel',
        userId: 'owner',
        sourceMessageId: 'source',
        settings: { model: 'gemini-3.8-flash' },
    }, {
        aiProposer: async () => ({
            name: 'prepare_announcement',
            args: {
                status: 'ready',
                title: '週末活動通知',
                content: '@everyone 歡迎 <@123> 參加週末活動。',
                footer: '吉吉王國',
            },
        }),
    });

    let privatePreview;
    await handleAiActionInteraction({
        customId: `ai_action:${prepared.sessionId}:open`,
        user: { id: 'owner' },
        guildId: 'guild',
        channelId: 'channel',
        member: { permissions: { has: permission => permission === PermissionFlagsBits.Administrator } },
        message: { id: 'launcher' },
        reply: async payload => { privatePreview = payload; },
    }, {});
    assert.equal((privatePreview.flags & 64) !== 0, true);
    assert.deepEqual(privatePreview.allowedMentions, { parse: [] });

    let published;
    const channel = {
        id: 'channel',
        isTextBased: () => true,
        isThread: () => false,
        permissionsFor: () => ({ has: () => true }),
        send: async payload => { published = payload; return { id: 'announcement' }; },
        messages: { fetch: async () => null },
    };
    const interaction = confirmationInteraction(prepared.sessionId, () => {});
    await handleAiActionInteraction(interaction, { channels: { fetch: async () => channel } });

    assert.deepEqual(published.allowedMentions, { parse: [] });
    assert.equal(published.content, undefined);
    assert.equal(published.files.length, 1);
});

function enableActions(guildId, userId) {
    updateAiSetting(guildId, 'enabled', 1);
    updateAiSetting(guildId, 'action_tools_enabled', 1);
    updateAiSetting(guildId, 'whitelist', JSON.stringify([userId]));
}

function confirmationInteraction(sessionId, captureEdit) {
    return {
        customId: `ai_action:${sessionId}:confirm`,
        user: { id: 'owner' },
        guildId: 'guild',
        channelId: 'channel',
        guild: { members: { me: { id: 'bot' } } },
        member: { permissions: { has: permission => permission === PermissionFlagsBits.Administrator } },
        deferUpdate: async () => {},
        editReply: async payload => { captureEdit(payload); },
        reply: async () => {},
    };
}
