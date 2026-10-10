import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
    AI_RESPONSE_TIMEOUT_MS,
    AiResponseTimeoutError,
    buildAiSystemPrompt,
    DEFAULT_AI_PROMPT,
    getAiResponse,
    SERVER_INFO_POLICY,
} from '../src/utils/aiChat.js';
import { DEFAULT_AI_MODEL } from '../src/utils/aiConfig.js';
import { generateAiDraft } from '../src/utils/aiDrafts.js';
import {
    AI_HISTORY_LIMITS,
    AI_REPLY_LIMITS,
    AI_REQUEST_LIMITS,
    buildAiHistory,
    canReadAiHistory,
    normalizeAiResult,
    register,
    resetAiRequestLimitsForTests,
    shouldTriggerAi,
    splitAiReply,
    startAiTyping,
    stopMessageCreate,
    tryAcquireAiRequest,
} from '../src/events/messageCreate.js';
import { loadEvents, stopLoadedEvents } from '../src/handlers/eventHandler.js';

test('Gemini requests preserve search, chat history, and image attachments', async () => {
    const originalKey = process.env.GOOGLE_AI_KEY;
    const originalFetch = globalThis.fetch;
    const requests = [];
    const pngFixture = await sharp({
        create: {
            width: 1,
            height: 1,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 1 },
        },
    }).png().toBuffer();

    process.env.GOOGLE_AI_KEY = 'test-key';
    globalThis.fetch = async (url, options) => {
        if (String(url) === 'https://cdn.discordapp.com/attachments/123/456/image.png') {
            return new Response(pngFixture, {
                status: 200,
                headers: { 'content-type': 'image/png' },
            });
        }

        requests.push({
            url: String(url),
            body: JSON.parse(options.body),
        });
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
            DEFAULT_AI_MODEL,
            true,
            null,
            [],
            0
        );
        const chatReply = await getAiResponse(
            '圖片問題',
            '系統提示',
            DEFAULT_AI_MODEL,
            false,
            [
                { role: 'user', parts: [{ text: '先前問題' }] },
                { role: 'model', parts: [{ text: '先前答案' }] },
            ],
            [{ url: 'https://cdn.discordapp.com/attachments/123/456/image.png', contentType: 'image/png' }],
            0
        );

        assert.equal(directReply, '測試回覆');
        assert.equal(chatReply, '測試回覆');
        assert.equal(requests[0].url.includes(`models/${DEFAULT_AI_MODEL}`), true);
        assert.equal(requests[1].url.includes(`models/${DEFAULT_AI_MODEL}`), true);
        assert.deepEqual(requests[0].body.tools, [{ googleSearch: {} }]);
        assert.equal(requests[0].body.systemInstruction.parts[0].text, '系統提示');
        assert.deepEqual(requests[1].body.contents.slice(0, 2), [
            { parts: [{ text: '先前問題' }], role: 'user' },
            { parts: [{ text: '先前答案' }], role: 'model' },
        ]);
        const inlineData = requests[1].body.contents[2].parts[1].inlineData;
        assert.equal(inlineData.mimeType, 'image/webp');
        const convertedImage = Buffer.from(inlineData.data, 'base64');
        assert.ok(convertedImage.length > 0);
        const metadata = await sharp(convertedImage).metadata();
        assert.equal(metadata.format, 'webp');
        assert.equal(metadata.width, 1);
        assert.equal(metadata.height, 1);
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

        if (value === 'https://media.discordapp.net/attachments/123/456/not-image-response.png') {
            return new Response(new Uint8Array([1, 2, 3]), {
                status: 200,
                headers: { 'content-type': 'text/html' },
            });
        }
        if (value === 'https://cdn.discordapp.com/attachments/123/456/too-large.png') {
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
            DEFAULT_AI_MODEL,
            false,
            null,
            [
                { url: 'https://assets.example/plain.txt', contentType: 'text/plain' },
                { url: 'https://media.discordapp.net/attachments/123/456/not-image-response.png', contentType: 'image/png' },
                { url: 'https://cdn.discordapp.com/attachments/123/456/too-large.png', contentType: 'image/png' },
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

test('Gemini rejects image-only requests when every attachment is invalid', async () => {
    const originalKey = process.env.GOOGLE_AI_KEY;
    const originalFetch = globalThis.fetch;
    process.env.GOOGLE_AI_KEY = 'test-key';
    globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'text/plain' },
    });

    try {
        await assert.rejects(
            getAiResponse(
                '\n\n[Discord context]',
                'system',
                DEFAULT_AI_MODEL,
                false,
                null,
                [{
                    url: 'https://cdn.discordapp.com/attachments/123/456/invalid.png',
                    contentType: 'image/png',
                }],
                0,
                { requireValidImage: true }
            ),
            error => error?.code === 'AI_NO_VALID_INPUT'
        );
    } finally {
        globalThis.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.GOOGLE_AI_KEY;
        else process.env.GOOGLE_AI_KEY = originalKey;
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
            getAiResponse('逾時測試', 'system', DEFAULT_AI_MODEL, false, null, [], 2, { timeoutMs: 20 }),
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

test('AI history requires requester permission and isolates the requester reply chain', () => {
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
        ['bot-other-reply', {
            id: 'bot-other-reply',
            content: '其他人的回答',
            author: { id: 'bot', bot: true },
            reference: { messageId: 'other-human' },
        }],
        ['bot-reply', {
            id: 'bot-reply',
            content: '先前回答',
            author: { id: 'bot', bot: true },
            reference: { messageId: 'requester-question' },
        }],
        ['other-human', {
            id: 'other-human',
            content: '其他人的秘密',
            author: { id: 'other-human', username: 'bob', bot: false },
        }],
        ['requester-question', {
            id: 'requester-question',
            content: '先前問題',
            author: { id: 'requester', username: 'alice', bot: false },
        }],
    ]);

    assert.deepEqual(buildAiHistory(messages, 'bot', 'requester'), [
        { role: 'user', parts: [{ text: '先前問題' }] },
        { role: 'model', parts: [{ text: '先前回答' }] },
    ]);
});

test('AI history applies per-message and total character budgets', () => {
    const oversized = `問題${'😀'.repeat(AI_HISTORY_LIMITS.maxMessageChars)}`;
    const messages = new Map();
    for (let index = 5; index >= 0; index--) {
        messages.set(`bot-${index}`, {
            id: `bot-${index}`,
            content: `回答-${index}-${'答'.repeat(AI_HISTORY_LIMITS.maxMessageChars)}`,
            author: { id: 'bot', bot: true },
            reference: { messageId: `user-${index}` },
        });
        messages.set(`user-${index}`, {
            id: `user-${index}`,
            content: oversized,
            author: { id: 'requester', bot: false },
        });
    }

    const history = buildAiHistory(messages, 'bot', 'requester');
    const texts = history.map(entry => entry.parts[0].text);
    assert.ok(texts.every(text => text.length <= AI_HISTORY_LIMITS.maxMessageChars));
    assert.ok(texts.reduce((sum, text) => sum + text.length, 0) <= AI_HISTORY_LIMITS.maxTotalChars);
    assert.ok(texts.every(text => !/[\uD800-\uDBFF]$/.test(text)));
    assert.deepEqual(
        history
            .filter(entry => entry.role === 'model')
            .map(entry => Number(entry.parts[0].text.match(/^回答-(\d+)/)?.[1])),
        [4, 5]
    );
    assert.equal(texts.some(text => text.startsWith('回答-3')), false);
});

test('AI history excludes ordinary channel messages and expired reply pairs', () => {
    const now = 2_000_000;
    const messages = new Map([
        ['fresh-ordinary', {
            id: 'fresh-ordinary',
            content: '普通頻道發言，不是 AI 對話',
            createdTimestamp: now - 1_000,
            author: { id: 'requester', bot: false },
        }],
        ['expired-bot', {
            id: 'expired-bot',
            content: '過期回答',
            createdTimestamp: now - AI_HISTORY_LIMITS.ttlMs - 1,
            author: { id: 'bot', bot: true },
            reference: { messageId: 'expired-user' },
        }],
        ['expired-user', {
            id: 'expired-user',
            content: '過期問題',
            createdTimestamp: now - AI_HISTORY_LIMITS.ttlMs - 2,
            author: { id: 'requester', bot: false },
        }],
    ]);

    assert.deepEqual(buildAiHistory(messages, 'bot', 'requester', { now }), []);
});

test('AI request limits enforce cooldown and guild/global in-flight caps with idempotent release', () => {
    resetAiRequestLimitsForTests();
    const first = tryAcquireAiRequest({ guildId: 'guild-1', userId: 'user-1', now: 1000 });
    assert.equal(first.ok, true);
    const sameUserWhileRunning = tryAcquireAiRequest({
        guildId: 'guild-1',
        userId: 'user-1',
        now: 1000 + AI_REQUEST_LIMITS.userCooldownMs + 1,
    });
    assert.equal(sameUserWhileRunning.ok, false);
    assert.equal(sameUserWhileRunning.reason, 'user_busy');
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

test('AI replies are split safely and capped at three Discord messages', () => {
    const reply = `前言\n\`\`\`js\n${'const emoji = "😀";\n'.repeat(800)}\`\`\`\n尾聲`;
    const chunks = splitAiReply(reply);

    assert.equal(chunks.length, AI_REPLY_LIMITS.maxChunks);
    assert.ok(chunks.every(chunk => chunk.length <= AI_REPLY_LIMITS.maxChunkLength));
    assert.match(chunks.at(-1), /回覆過長，已截斷/);
    assert.ok(chunks.every(chunk => (chunk.match(/```/g) || []).length % 2 === 0));
    assert.ok(chunks.every(chunk => !/[\uD800-\uDBFF]$/.test(chunk)));
    assert.ok(chunks.every(chunk => !/^[\uDC00-\uDFFF]/.test(chunk)));
});

test('AI reply splitting never cuts through a triple-backtick fence', () => {
    const chunks = splitAiReply(
        'abcdefghij```js\nconst value = 123456789;\n```tail',
        { maxChunkLength: 16, maxChunks: 20 }
    );

    assert.ok(chunks.length > 1);
    assert.ok(chunks.every(chunk => chunk.length <= 16));
    assert.ok(chunks.every(chunk => (chunk.match(/```/g) || []).length % 2 === 0));
    assert.ok(chunks.every(chunk => ((chunk.match(/^`+/)?.[0].length || 0) % 3) === 0));
    assert.ok(chunks.every(chunk => ((chunk.match(/`+$/)?.[0].length || 0) % 3) === 0));
});

test('AI metadata result normalization accepts object and legacy string responses safely', () => {
    assert.deepEqual(normalizeAiResult('舊格式回答'), {
        text: '舊格式回答',
        usageMetadata: {},
        queryCount: 0,
        finishReason: 'unknown',
        attemptCount: 0,
        retryCount: 0,
    });

    const normalized = normalizeAiResult({
        text: '新格式回答',
        usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 8,
            thoughtsTokenCount: 4,
            cachedContentTokenCount: 2,
            totalTokenCount: 26,
            unsafeField: 'secret',
        },
        groundingMetadata: { citations: [], queryCount: 2 },
        finishReason: 'STOP\nforged-log=true',
        attemptCount: 2,
        retryCount: 1,
    });
    assert.deepEqual(normalized.usageMetadata, {
        promptTokenCount: 12,
        candidatesTokenCount: 8,
        thoughtsTokenCount: 4,
        cachedContentTokenCount: 2,
        totalTokenCount: 26,
    });
    assert.equal(normalized.queryCount, 2);
    assert.equal(normalized.finishReason, 'STOPforged-logtrue');
    assert.equal(normalized.attemptCount, 2);
    assert.equal(normalized.retryCount, 1);
});

test('AI typing indicator repeats and cleans up idempotently', async () => {
    let sends = 0;
    let intervalCallback;
    let intervalMs;
    let cleared = 0;
    const timer = { unrefCalled: false, unref() { this.unrefCalled = true; } };
    const stopTyping = startAiTyping(
        { sendTyping: async () => { sends += 1; } },
        {
            setIntervalFn(callback, ms) {
                intervalCallback = callback;
                intervalMs = ms;
                return timer;
            },
            clearIntervalFn(value) {
                assert.equal(value, timer);
                cleared += 1;
            },
        }
    );

    await Promise.resolve();
    assert.equal(sends, 1);
    assert.equal(intervalMs, 9_000);
    assert.equal(timer.unrefCalled, true);
    await intervalCallback();
    assert.equal(sends, 2);
    assert.equal(stopTyping(), true);
    assert.equal(stopTyping(), false);
    assert.equal(cleared, 1);
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

test('non-mentioned messages bypass AI settings lookup', async () => {
    stopMessageCreate();
    const listeners = [];
    const client = {
        user: { id: 'bot' },
        on(eventName, listener) {
            if (eventName === 'messageCreate') listeners.push(listener);
        },
    };
    register(client);

    try {
        await assert.doesNotReject(listeners[0]({
            author: { id: 'user', bot: false },
            guild: { id: 'guild-without-database' },
            client,
            content: '',
            mentions: { has: () => false },
        }));
    } finally {
        stopMessageCreate();
    }
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
