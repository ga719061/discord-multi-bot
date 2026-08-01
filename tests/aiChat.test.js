import test from 'node:test';
import assert from 'node:assert/strict';
import {
    AI_RESPONSE_TIMEOUT_MS,
    AiResponseTimeoutError,
    buildAiSystemPrompt,
    DEFAULT_AI_PROMPT,
    getAiResponse,
    SERVER_INFO_POLICY,
} from '../src/utils/aiChat.js';
import { generateAiDraft } from '../src/utils/aiDrafts.js';
import {
    AI_REQUEST_LIMITS,
    buildAiHistory,
    canReadAiHistory,
    register,
    resetAiRequestLimitsForTests,
    shouldTriggerAi,
    stopMessageCreate,
    tryAcquireAiRequest,
} from '../src/events/messageCreate.js';
import { loadEvents, stopLoadedEvents } from '../src/handlers/eventHandler.js';

test('Gemini requests preserve search, chat history, and image attachments', async () => {
    const originalKey = process.env.GOOGLE_AI_KEY;
    const originalFetch = globalThis.fetch;
    const requests = [];

    process.env.GOOGLE_AI_KEY = 'test-key';
    globalThis.fetch = async (url, options) => {
        if (String(url) === 'https://assets.example/image.png') {
            return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        }

        requests.push(JSON.parse(options.body));
        return new Response(JSON.stringify({
            candidates: [{ content: { role: 'model', parts: [{ text: '測試回覆' }] } }],
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    };

    try {
        const directReply = await getAiResponse(
            '直接問題',
            '系統提示',
            'gemini-3.5-flash',
            true,
            null,
            [],
            0
        );
        const chatReply = await getAiResponse(
            '圖片問題',
            '系統提示',
            'gemini-3.5-flash',
            false,
            [
                { role: 'user', parts: [{ text: '先前問題' }] },
                { role: 'model', parts: [{ text: '先前答案' }] },
            ],
            [{ url: 'https://assets.example/image.png', contentType: 'image/png' }],
            0
        );

        assert.equal(directReply, '測試回覆');
        assert.equal(chatReply, '測試回覆');
        assert.deepEqual(requests[0].tools, [{ googleSearch: {} }]);
        assert.equal(requests[0].systemInstruction.parts[0].text, '系統提示');
        assert.deepEqual(requests[1].contents.slice(0, 2), [
            { parts: [{ text: '先前問題' }], role: 'user' },
            { parts: [{ text: '先前答案' }], role: 'model' },
        ]);
        assert.deepEqual(requests[1].contents[2].parts[1], {
            inlineData: { data: 'AQID', mimeType: 'image/png' },
        });
    } finally {
        globalThis.fetch = originalFetch;
        if (originalKey === undefined) {
            delete process.env.GOOGLE_AI_KEY;
        } else {
            process.env.GOOGLE_AI_KEY = originalKey;
        }
    }
});

test('Gemini image attachments skip unsafe MIME types and oversized downloads', async () => {
    const originalKey = process.env.GOOGLE_AI_KEY;
    const originalFetch = globalThis.fetch;
    const fetchedUrls = [];
    let geminiRequest;

    process.env.GOOGLE_AI_KEY = 'test-key';
    globalThis.fetch = async (url, options = {}) => {
        const value = String(url);
        fetchedUrls.push(value);

        if (value === 'https://assets.example/not-image-response.png') {
            return new Response(new Uint8Array([1, 2, 3]), {
                status: 200,
                headers: { 'content-type': 'text/html' },
            });
        }
        if (value === 'https://assets.example/too-large.png') {
            return new Response(new Uint8Array([1, 2, 3]), {
                status: 200,
                headers: {
                    'content-type': 'image/png',
                    'content-length': String(6 * 1024 * 1024),
                },
            });
        }

        geminiRequest = JSON.parse(options.body);
        return new Response(JSON.stringify({
            candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] } }],
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    };

    try {
        const reply = await getAiResponse(
            '看圖',
            'system',
            'gemini-3.5-flash',
            false,
            null,
            [
                { url: 'https://assets.example/plain.txt', contentType: 'text/plain' },
                { url: 'https://assets.example/not-image-response.png', contentType: 'image/png' },
                { url: 'https://assets.example/too-large.png', contentType: 'image/png' },
            ],
            0
        );

        assert.equal(reply, 'ok');
        assert.equal(fetchedUrls.includes('https://assets.example/plain.txt'), false);
        assert.equal(geminiRequest.contents[0].parts.length, 1);
        assert.deepEqual(geminiRequest.contents[0].parts[0], { text: '看圖' });
    } finally {
        globalThis.fetch = originalFetch;
        if (originalKey === undefined) {
            delete process.env.GOOGLE_AI_KEY;
        } else {
            process.env.GOOGLE_AI_KEY = originalKey;
        }
    }
});

test('Gemini requests enforce one total response deadline', async () => {
    const originalKey = process.env.GOOGLE_AI_KEY;
    const originalFetch = globalThis.fetch;
    process.env.GOOGLE_AI_KEY = 'test-key';
    globalThis.fetch = async () => new Promise(() => {});

    try {
        assert.equal(AI_RESPONSE_TIMEOUT_MS, 45_000);
        await assert.rejects(
            getAiResponse('逾時測試', 'system', 'gemini-3.5-flash', false, null, [], 2, { timeoutMs: 20 }),
            (error) => error instanceof AiResponseTimeoutError && error.code === 'AI_TIMEOUT'
        );
    } finally {
        globalThis.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.GOOGLE_AI_KEY;
        else process.env.GOOGLE_AI_KEY = originalKey;
    }
});

test('AI prompt keeps the royal persona and safely permits supplied Discord server information', () => {
    assert.match(DEFAULT_AI_PROMPT, /吉吉國王/);
    assert.match(DEFAULT_AI_PROMPT, /繁體中文/);
    assert.match(SERVER_INFO_POLICY, /伺服器公開上下文/);
    assert.match(SERVER_INFO_POLICY, /不可信資料/);
    assert.match(SERVER_INFO_POLICY, /不得猜測/);
    assert.match(SERVER_INFO_POLICY, /管理設定/);
    assert.match(buildAiSystemPrompt('自訂人格', '安全上下文'), /自訂人格/);
    assert.match(buildAiSystemPrompt('自訂人格', '安全上下文'), /Discord 伺服器資料政策/);
    assert.match(buildAiSystemPrompt('自訂人格', '安全上下文'), /安全上下文/);
});

test('AI draft generator accepts valid JSON and rejects invalid JSON without partial drafts', async () => {
    const draft = await generateAiDraft({
        guildId: 'guild',
        userId: 'admin',
        type: 'announcement',
        brief: '週末維護，提醒大家備份資料',
        tone: 'formal',
        settings: { model: 'gemini-test' },
        aiResponder: async () => JSON.stringify({
            title: '週末維護通知',
            content: '本週末將進行系統維護，請大家提前備份重要資料。',
            footer: '感謝配合',
        }),
    });

    assert.equal(draft.type, 'announcement');
    assert.equal(draft.title, '週末維護通知');
    assert.equal(draft.content.includes('系統維護'), true);
    assert.equal(draft.footer, '感謝配合');
    assert.equal(draft.sourceBrief, '週末維護，提醒大家備份資料');

    await assert.rejects(
        generateAiDraft({
            guildId: 'guild',
            userId: 'admin',
            type: 'welcome',
            brief: '歡迎新成員',
            aiResponder: async () => '不是 JSON',
        }),
        /合法 JSON/
    );
});

test('AI trigger always respects global enabled and expiry state', () => {
    const base = {
        whitelist: ['user'],
        party_channel_id: 'party',
        party_expires_at: 2000,
        expires_at: null,
    };

    assert.equal(shouldTriggerAi({
        settings: { ...base, enabled: 0 },
        isMention: true,
        userId: 'user',
        channelId: 'other',
        now: 1000,
    }), false);
    assert.equal(shouldTriggerAi({
        settings: { ...base, enabled: 1, expires_at: 999 },
        isMention: true,
        userId: 'user',
        channelId: 'other',
        now: 1000,
    }), false);
    assert.equal(shouldTriggerAi({
        settings: { ...base, enabled: 1 },
        isMention: true,
        userId: 'user',
        channelId: 'other',
        now: 1000,
    }), true);
    assert.equal(shouldTriggerAi({
        settings: { ...base, enabled: 1, whitelist: [] },
        isMention: true,
        userId: 'user',
        channelId: 'party',
        now: 1000,
    }), true);
});

test('AI history requires requester permission and excludes non-conversation messages', () => {
    let checkedPermission;
    const member = { id: 'requester' };
    const message = {
        member,
        channel: {
            permissionsFor(value) {
                assert.equal(value, member);
                return {
                    has(permission) {
                        checkedPermission = permission;
                        return false;
                    },
                };
            },
        },
    };

    assert.equal(canReadAiHistory(message), false);
    assert.ok(checkedPermission);
    message.channel.permissionsFor = () => ({ has: () => true });
    assert.equal(canReadAiHistory(message), true);
    message.channel.permissionsFor = () => {
        throw new Error('partial channel');
    };
    assert.equal(canReadAiHistory(message), false);

    const messages = new Map([
        ['system', { system: true, content: '系統訊息', author: { id: 'system' } }],
        ['webhook', { webhookId: 'hook', content: 'Webhook 注入', author: { id: 'hook-user' } }],
        ['other-bot', { content: '第三方 bot 指令', author: { id: 'other-bot', bot: true } }],
        ['bot-reply', { content: '先前回答', author: { id: 'bot', bot: true } }],
        ['human', { content: '先前問題', author: { id: 'human', username: 'alice', bot: false } }],
    ]);

    assert.deepEqual(buildAiHistory(messages, 'bot'), [
        { role: 'user', parts: [{ text: '[alice]: 先前問題' }] },
        { role: 'model', parts: [{ text: '先前回答' }] },
    ]);
});

test('AI request limits enforce cooldown and guild/global in-flight caps with idempotent release', () => {
    resetAiRequestLimitsForTests();
    const first = tryAcquireAiRequest({ guildId: 'guild-1', userId: 'user-1', now: 1000 });
    assert.equal(first.ok, true);
    first.release();
    first.release();

    const cooldown = tryAcquireAiRequest({ guildId: 'guild-1', userId: 'user-1', now: 1001 });
    assert.equal(cooldown.ok, false);
    assert.equal(cooldown.reason, 'cooldown');
    assert.equal(cooldown.retryAfterMs, AI_REQUEST_LIMITS.userCooldownMs - 1);

    resetAiRequestLimitsForTests();
    const guildLeases = Array.from(
        { length: AI_REQUEST_LIMITS.maxGuildInFlight },
        (_, index) => tryAcquireAiRequest({
            guildId: 'guild-1',
            userId: `guild-user-${index}`,
            now: 1000,
        })
    );
    assert.equal(guildLeases.every((lease) => lease.ok), true);
    assert.equal(
        tryAcquireAiRequest({ guildId: 'guild-1', userId: 'guild-overflow', now: 1000 }).reason,
        'guild_busy'
    );
    guildLeases.forEach((lease) => lease.release());

    resetAiRequestLimitsForTests();
    const globalLeases = Array.from(
        { length: AI_REQUEST_LIMITS.maxGlobalInFlight },
        (_, index) => tryAcquireAiRequest({
            guildId: `global-guild-${index}`,
            userId: `global-user-${index}`,
            now: 1000,
        })
    );
    assert.equal(globalLeases.every((lease) => lease.ok), true);
    assert.equal(
        tryAcquireAiRequest({ guildId: 'global-overflow', userId: 'global-overflow', now: 1000 }).reason,
        'global_busy'
    );
    globalLeases.forEach((lease) => lease.release());
    resetAiRequestLimitsForTests();
});

test('messageCreate cleanup timer can be stopped idempotently', () => {
    stopMessageCreate();
    const listeners = [];
    register({
        on(eventName, listener) {
            listeners.push([eventName, listener]);
        },
    });

    assert.equal(listeners.length, 1);
    assert.equal(listeners[0][0], 'messageCreate');
    assert.equal(stopMessageCreate(), true);
    assert.equal(stopMessageCreate(), false);
});

test('event loader registers and runs event cleanup hooks', async () => {
    stopMessageCreate();
    await stopLoadedEvents();
    const listeners = [];
    await loadEvents({
        on(eventName, listener) {
            listeners.push([eventName, listener]);
        },
    });

    assert.ok(listeners.length > 0);
    assert.equal(await stopLoadedEvents(), 1);
    assert.equal(await stopLoadedEvents(), 0);
    assert.equal(stopMessageCreate(), false);
});
