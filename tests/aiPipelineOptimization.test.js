import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
    AI_MAX_OUTPUT_TOKENS,
    AiResponseError,
    getAiFunctionProposal,
    getAiResponse,
    MAX_AI_IMAGE_COUNT,
    MAX_AI_IMAGE_INPUT_DIMENSION,
    MAX_AI_IMAGE_INPUT_PIXELS,
    MAX_AI_IMAGE_OUTPUT_DIMENSION,
    MAX_AI_IMAGE_TOTAL_BYTES,
} from '../src/utils/aiChat.js';
import { fetchBufferWithLimit } from '../src/utils/imageRendering.js';

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VALID_PNG = await sharp({
    create: { width: 8, height: 6, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 1 } },
}).png().toBuffer();

const POLL_FUNCTION_DECLARATION = Object.freeze({
    name: 'draft_poll',
    description: 'Extract a poll draft without publishing it.',
    parameters: {
        type: 'OBJECT',
        properties: {
            question: { type: 'STRING' },
            options: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['question', 'options'],
    },
});

test('Gemini function proposal forces one allowlisted function without executing it', async () => {
    let request;
    await withMockGemini(async (_url, options) => {
        request = JSON.parse(options.body);
        return geminiResponse({
            candidates: [{
                finishReason: 'STOP',
                content: {
                    role: 'model',
                    parts: [{
                        functionCall: {
                            name: 'draft_poll',
                            args: { question: '今晚玩什麼？', options: ['A', 'B'] },
                        },
                    }],
                },
            }],
            usageMetadata: {
                promptTokenCount: 12,
                candidatesTokenCount: 5,
                totalTokenCount: 17,
            },
        });
    }, async () => {
        const result = await getAiFunctionProposal({
            userMessage: '投票：今晚玩 A 還是 B？',
            systemPrompt: '只整理明確提供的投票資料。',
            modelName: 'gemini-3.8-flash',
            functionDeclaration: POLL_FUNCTION_DECLARATION,
            retryCount: 0,
        });
        assert.deepEqual(result, {
            name: 'draft_poll',
            args: { question: '今晚玩什麼？', options: ['A', 'B'] },
            usageMetadata: {
                promptTokenCount: 12,
                candidatesTokenCount: 5,
                totalTokenCount: 17,
            },
            finishReason: 'STOP',
            attemptCount: 1,
            retryCount: 0,
        });
    });

    assert.deepEqual(request.tools, [{ functionDeclarations: [POLL_FUNCTION_DECLARATION] }]);
    assert.deepEqual(request.toolConfig, {
        functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: ['draft_poll'],
        },
    });
    assert.equal(request.generationConfig.thinkingConfig.thinkingLevel, 'low');
    assert.equal(request.generationConfig.maxOutputTokens, AI_MAX_OUTPUT_TOKENS);
    assert.equal('googleSearch' in request.tools[0], false);
    assert.equal(request.contents.length, 1);
    assert.deepEqual(request.contents[0].parts, [{ text: '投票：今晚玩 A 還是 B？' }]);
});

test('Gemini function proposal rejects wrong or multiple function calls without exposing args', async () => {
    await withMockGemini(async () => geminiResponse({
        candidates: [{
            finishReason: 'STOP',
            content: {
                role: 'model',
                parts: [{
                    functionCall: {
                        name: 'unexpected_tool',
                        args: { secret: 'do not log this' },
                    },
                }],
            },
        }],
    }), async () => {
        await assert.rejects(
            getAiFunctionProposal({
                userMessage: 'malicious proposal',
                systemPrompt: 'system',
                functionDeclaration: POLL_FUNCTION_DECLARATION,
                retryCount: 2,
            }),
            error => error instanceof AiResponseError
                && error.code === 'AI_INVALID_PROPOSAL'
                && !error.message.includes('secret')
        );
    });

    await assert.rejects(
        getAiFunctionProposal({
            userMessage: 'invalid declaration',
            functionDeclaration: { name: 'bad name', parameters: {} },
        }),
        error => error instanceof AiResponseError && error.code === 'AI_INVALID_REQUEST'
    );
});

test('Gemini function proposal shares retry accounting and timeout abort behavior', async () => {
    const originalRandom = Math.random;
    let requestCount = 0;
    Math.random = () => 0;
    try {
        await withMockGemini(async () => {
            requestCount += 1;
            if (requestCount === 1) {
                return geminiResponse({ error: { code: 429, message: 'busy' } }, 429);
            }
            return geminiResponse({
                candidates: [{
                    finishReason: 'STOP',
                    content: {
                        role: 'model',
                        parts: [{ functionCall: { name: 'draft_poll', args: { question: 'Q', options: ['A', 'B'] } } }],
                    },
                }],
            });
        }, async () => {
            const result = await getAiFunctionProposal({
                userMessage: 'retry proposal',
                systemPrompt: 'system',
                functionDeclaration: POLL_FUNCTION_DECLARATION,
                retryCount: 1,
            });
            assert.equal(result.attemptCount, 2);
            assert.equal(result.retryCount, 1);
        });
    } finally {
        Math.random = originalRandom;
    }
    assert.equal(requestCount, 2);

    await withMockGemini(async () => new Promise(() => {}), async () => {
        await assert.rejects(
            getAiFunctionProposal({
                userMessage: 'timeout proposal',
                systemPrompt: 'system',
                functionDeclaration: POLL_FUNCTION_DECLARATION,
                timeoutMs: 20,
            }),
            error => error.code === 'AI_TIMEOUT'
        );
    });
});

test('Gemini pipeline applies output and per-model thinking limits and returns safe metadata', async () => {
    const requests = [];
    await withMockGemini(async (_url, options) => {
        requests.push(JSON.parse(options.body));
        return geminiResponse({
            candidates: [{
                finishReason: 'STOP',
                content: { role: 'model', parts: [{ text: '有來源的回答' }] },
                groundingMetadata: {
                    webSearchQueries: ['private generated query'],
                    groundingChunks: [
                        { web: { uri: 'https://example.com/source', title: ' # [Example](bad) <https://phish.example> \\ Source ' } },
                        { web: { uri: 'javascript:alert(1)', title: 'unsafe' } },
                        { web: { uri: 'https://user:secret@example.com/private', title: 'credentials' } },
                        { web: { uri: 'https://example.org/two', title: 'Second' } },
                        { web: { uri: 'https://example.net/three', title: 'Third' } },
                        { web: { uri: 'https://example.edu/four', title: 'Fourth' } },
                    ],
                },
            }],
            usageMetadata: {
                promptTokenCount: 20,
                candidatesTokenCount: 7,
                thoughtsTokenCount: 3,
                totalTokenCount: 30,
                unexpectedSensitiveField: 'not returned',
            },
        });
    }, async () => {
        const detailed = await getAiResponse(
            '查資料',
            'system',
            'gemini-3.8-flash',
            true,
            null,
            [],
            0,
            { returnMetadata: true }
        );
        assert.equal(
            detailed.text,
            '有來源的回答\n\n**來源**\n1. \\# \\[Example\\]\\(bad\\) \\\\ Source — <https://example.com/source>\n'
                + '2. Second — <https://example.org/two>\n'
                + '3. Third — <https://example.net/three>'
        );
        assert.deepEqual(detailed.usageMetadata, {
            promptTokenCount: 20,
            candidatesTokenCount: 7,
            totalTokenCount: 30,
            thoughtsTokenCount: 3,
        });
        assert.equal(detailed.finishReason, 'STOP');
        assert.equal(detailed.groundingMetadata.queryCount, 1);
        assert.deepEqual(detailed.groundingMetadata.webSearchQueries, ['private generated query']);
        assert.equal(detailed.groundingMetadata.citations.length, 4);
        assert.equal(detailed.groundingMetadata.citations[0].title.includes('phish'), false);
        assert.equal((detailed.text.match(/<https?:\/\//g) || []).length, 3);
        assert.equal(detailed.text.includes('example.edu'), false);

        assert.equal(
            await getAiResponse('便宜回答', 'system', 'gemini-3.5-flash-lite', false, null, [], 0),
            '有來源的回答\n\n**來源**\n1. \\# \\[Example\\]\\(bad\\) \\\\ Source — <https://example.com/source>\n'
                + '2. Second — <https://example.org/two>\n'
                + '3. Third — <https://example.net/three>'
        );
        const hiddenSources = await getAiResponse(
            '不要顯示來源',
            'system',
            'gemini-3.8-flash',
            true,
            null,
            [],
            0,
            { returnMetadata: true, includeCitations: false }
        );
        assert.equal(hiddenSources.text, '有來源的回答');
        assert.equal(hiddenSources.groundingMetadata.queryCount, 1);
        assert.equal(hiddenSources.groundingMetadata.citations.length, 4);
        assert.equal(detailed.attemptCount, 1);
        assert.equal(detailed.retryCount, 0);
    });

    assert.equal(AI_MAX_OUTPUT_TOKENS, 1200);
    assert.equal(requests[0].generationConfig.maxOutputTokens, AI_MAX_OUTPUT_TOKENS);
    assert.equal(requests[0].generationConfig.thinkingConfig.thinkingLevel, 'low');
    assert.equal(requests[1].generationConfig.thinkingConfig.thinkingLevel, 'minimal');
    assert.deepEqual(requests[2].tools, [{ googleSearch: {} }]);
});

test('Gemini image pipeline only fetches Discord HTTPS images, rejects fake bytes, and caps count', async () => {
    const fetchedImages = [];
    let geminiRequest;
    await withMockGemini(async (url, options = {}) => {
        const value = String(url);
        if (value.includes('generativelanguage.googleapis.com')) {
            geminiRequest = JSON.parse(options.body);
            return geminiResponse({
                candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
            });
        }

        fetchedImages.push({ url: value, redirect: options.redirect });
        if (value.endsWith('/fake.png')) {
            return new Response(new Uint8Array([1, 2, 3]), {
                status: 200,
                headers: { 'content-type': 'image/png' },
            });
        }
        return new Response(VALID_PNG, {
            status: 200,
            headers: { 'content-type': 'image/png' },
        });
    }, async () => {
        const response = await getAiResponse(
            '看圖片',
            'system',
            'gemini-3.8-flash',
            false,
            null,
            [
                { url: 'https://evil.example/image.png', contentType: 'image/png' },
                { url: 'https://media.discordapp.net/attachments/1/2/fake.png', contentType: 'image/png' },
                { url: 'https://cdn.discordapp.com/attachments/1/2/valid.png', contentType: 'image/png' },
            ],
            0
        );
        assert.equal(response, 'ok');
    });

    assert.equal(MAX_AI_IMAGE_COUNT, 2);
    assert.equal(MAX_AI_IMAGE_TOTAL_BYTES, 8 * 1024 * 1024);
    assert.equal(MAX_AI_IMAGE_INPUT_PIXELS, 16_000_000);
    assert.deepEqual(fetchedImages, [
        {
            url: 'https://media.discordapp.net/attachments/1/2/fake.png',
            redirect: 'error',
        },
        {
            url: 'https://cdn.discordapp.com/attachments/1/2/valid.png',
            redirect: 'error',
        },
    ]);
    assert.equal(geminiRequest.contents[0].parts.length, 2);
    const inlineData = geminiRequest.contents[0].parts[1].inlineData;
    assert.equal(inlineData.mimeType, 'image/webp');
    const normalized = await sharp(Buffer.from(inlineData.data, 'base64')).metadata();
    assert.equal(normalized.format, 'webp');
    assert.ok(normalized.width <= MAX_AI_IMAGE_OUTPUT_DIMENSION);
    assert.ok(normalized.height <= MAX_AI_IMAGE_OUTPUT_DIMENSION);
});

test('Gemini image pipeline decodes real images and resizes the longest edge to 2048', async () => {
    const largePng = await sharp({
        create: { width: 3000, height: 1200, channels: 3, background: { r: 120, g: 30, b: 90 } },
    }).png().toBuffer();
    let geminiRequest;
    await withMockGemini(async (url, options = {}) => {
        if (String(url).includes('generativelanguage.googleapis.com')) {
            geminiRequest = JSON.parse(options.body);
            return geminiResponse({
                candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
            });
        }
        return new Response(largePng, { status: 200, headers: { 'content-type': 'image/png' } });
    }, async () => {
        assert.equal(await getAiResponse(
            '',
            'system',
            'gemini-3.8-flash',
            false,
            null,
            [{ url: 'https://cdn.discordapp.com/attachments/1/2/large.png', contentType: 'image/png' }],
            0,
            { requireValidImage: true }
        ), 'ok');
    });

    const inlineData = geminiRequest.contents[0].parts[0].inlineData;
    const metadata = await sharp(Buffer.from(inlineData.data, 'base64')).metadata();
    assert.equal(inlineData.mimeType, 'image/webp');
    assert.equal(metadata.width, MAX_AI_IMAGE_OUTPUT_DIMENSION);
    assert.ok(metadata.height < MAX_AI_IMAGE_OUTPUT_DIMENSION);
    assert.ok(MAX_AI_IMAGE_INPUT_DIMENSION > MAX_AI_IMAGE_OUTPUT_DIMENSION);

    const tooWidePng = await sharp({
        create: {
            width: MAX_AI_IMAGE_INPUT_DIMENSION + 1,
            height: 1,
            channels: 3,
            background: { r: 0, g: 0, b: 0 },
        },
    }).png().toBuffer();
    let oversizedReachedGemini = false;
    await withMockGemini(async (url) => {
        if (String(url).includes('generativelanguage.googleapis.com')) oversizedReachedGemini = true;
        return new Response(tooWidePng, { status: 200, headers: { 'content-type': 'image/png' } });
    }, async () => {
        await assert.rejects(
            getAiResponse(
                '',
                'system',
                'gemini-3.8-flash',
                false,
                null,
                [{ url: 'https://cdn.discordapp.com/attachments/1/2/too-wide.png', contentType: 'image/png' }],
                0,
                { requireValidImage: true }
            ),
            error => error.code === 'AI_NO_VALID_INPUT'
        );
    });
    assert.equal(oversizedReachedGemini, false);

    const tooManyPixelsPng = await sharp({
        create: {
            width: 4097,
            height: 4097,
            channels: 3,
            background: { r: 10, g: 20, b: 30 },
        },
    }).png({ compressionLevel: 9, palette: true }).toBuffer();
    assert.ok(4097 <= MAX_AI_IMAGE_INPUT_DIMENSION);
    assert.ok(4097 * 4097 > MAX_AI_IMAGE_INPUT_PIXELS);
    let pixelLimitReachedGemini = false;
    await withMockGemini(async (url) => {
        if (String(url).includes('generativelanguage.googleapis.com')) pixelLimitReachedGemini = true;
        return new Response(tooManyPixelsPng, { status: 200, headers: { 'content-type': 'image/png' } });
    }, async () => {
        await assert.rejects(
            getAiResponse(
                '',
                'system',
                'gemini-3.8-flash',
                false,
                null,
                [{ url: 'https://cdn.discordapp.com/attachments/1/2/too-many-pixels.png', contentType: 'image/png' }],
                0,
                { requireValidImage: true }
            ),
            error => error.code === 'AI_NO_VALID_INPUT'
        );
    });
    assert.equal(pixelLimitReachedGemini, false);
});

test('rejected image bytes consume the shared 8MB download budget', async () => {
    const rejectedBytes = Buffer.alloc(5 * 1024 * 1024);
    Buffer.from(PNG_SIGNATURE).copy(rejectedBytes);
    let downloadedBytes = 0;
    let geminiRequest;

    await withMockGemini(async (url, options = {}) => {
        const value = String(url);
        if (value.includes('generativelanguage.googleapis.com')) {
            geminiRequest = JSON.parse(options.body);
            return geminiResponse({
                candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
            });
        }
        if (value.endsWith('/rejected.png')) {
            return countedStreamResponse(rejectedBytes, count => { downloadedBytes += count; }, {
                'content-type': 'image/png',
                'content-length': String(rejectedBytes.length),
            });
        }

        const secondLength = 4 * 1024 * 1024;
        return countedGeneratedResponse(secondLength, count => { downloadedBytes += count; }, {
            'content-type': 'image/png',
            'content-length': String(secondLength),
        });
    }, async () => {
        assert.equal(await getAiResponse(
            '文字仍可回答',
            'system',
            'gemini-3.8-flash',
            false,
            null,
            [
                { url: 'https://cdn.discordapp.com/attachments/1/2/rejected.png', contentType: 'image/png' },
                { url: 'https://media.discordapp.net/attachments/1/2/second.png', contentType: 'image/png' },
            ],
            0
        ), 'ok');
    });

    assert.ok(downloadedBytes <= MAX_AI_IMAGE_TOTAL_BYTES);
    assert.equal(geminiRequest.contents[0].parts.length, 1);
});

test('Gemini retries transient failures without retrying safety blocks and exposes only safe errors', async () => {
    let requestCount = 0;
    await withMockGemini(async () => {
        requestCount += 1;
        if (requestCount === 1) {
            return geminiResponse({
                error: { code: 429, message: 'secret prompt and https://private.example', status: 'RESOURCE_EXHAUSTED' },
            }, 429);
        }
        return geminiResponse({
            candidates: [{ content: { role: 'model', parts: [{ text: '重試成功' }] }, finishReason: 'STOP' }],
        });
    }, async () => {
        const result = await getAiResponse('retry', 'system', 'gemini-3.8-flash', false, null, [], 1, {
            retryBaseDelayMs: 0,
            random: () => 0,
            returnMetadata: true,
        });
        assert.equal(result.text, '重試成功');
        assert.equal(result.attemptCount, 2);
        assert.equal(result.retryCount, 1);
    });
    assert.equal(requestCount, 2);

    let blockedRequestCount = 0;
    await withMockGemini(async () => {
        blockedRequestCount += 1;
        return geminiResponse({
            candidates: [{ finishReason: 'RECITATION', content: { role: 'model', parts: [{ text: 'partial' }] } }],
        });
    }, async () => {
        await assert.rejects(
            getAiResponse('blocked', 'system', 'gemini-3.8-flash', false, null, [], 2),
            error => error instanceof AiResponseError
                && error.code === 'AI_SAFETY_BLOCKED'
                && !error.message.includes('blocked')
        );
    });
    assert.equal(blockedRequestCount, 1);

    await withMockGemini(async () => geminiResponse({
        error: { code: 400, message: 'prompt=https://private.example attachment=secret.png' },
    }, 400), async () => {
        await assert.rejects(
            getAiResponse('private prompt', 'system', 'gemini-3.8-flash', false, null, [], 2),
            error => error instanceof AiResponseError
                && error.code === 'AI_INVALID_REQUEST'
                && error.status === 400
                && !error.message.includes('private')
                && !error.message.includes('secret')
        );
    });
});

test('retry backoff is capped by the shared deadline and clears its timer', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const activeTimers = new Set();
    let requestCount = 0;

    globalThis.setTimeout = (callback, delay, ...args) => {
        let handle;
        handle = originalSetTimeout(() => {
            activeTimers.delete(handle);
            callback(...args);
        }, delay);
        activeTimers.add(handle);
        return handle;
    };
    globalThis.clearTimeout = handle => {
        activeTimers.delete(handle);
        return originalClearTimeout(handle);
    };

    const startedAt = Date.now();
    try {
        await withMockGemini(async () => {
            requestCount += 1;
            return geminiResponse({ error: { code: 429, message: 'busy' } }, 429);
        }, async () => {
            await assert.rejects(
                getAiResponse('deadline', 'system', 'gemini-3.8-flash', false, null, [], 2, {
                    timeoutMs: 25,
                    retryBaseDelayMs: 1000,
                    random: () => 1,
                }),
                error => error.code === 'AI_TIMEOUT'
            );
        });
        assert.equal(requestCount, 1);
        assert.ok(Date.now() - startedAt < 250);
        assert.equal(activeTimers.size, 0);
    } finally {
        for (const timer of activeTimers) originalClearTimeout(timer);
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
});

test('pure-image requests fail safely when every attachment is rejected', async () => {
    let geminiCalled = false;
    await withMockGemini(async (url) => {
        if (String(url).includes('generativelanguage.googleapis.com')) geminiCalled = true;
        return new Response(PNG_SIGNATURE, {
            status: 200,
            headers: { 'content-type': 'image/png' },
        });
    }, async () => {
        await assert.rejects(
            getAiResponse(
                '[Discord public context]',
                'system',
                'gemini-3.8-flash',
                false,
                null,
                [{ url: 'https://cdn.discordapp.com/attachments/1/2/fake.png', contentType: 'image/png' }],
                0,
                { requireValidImage: true }
            ),
            error => error instanceof AiResponseError && error.code === 'AI_NO_VALID_INPUT'
        );
    });
    assert.equal(geminiCalled, false);
});

test('buffer-limited downloads expose one Buffer path while keeping fetchWithLimit compatibility', async () => {
    let seenOptions;
    const { response, buffer } = await fetchBufferWithLimit('https://example.test/image', async (_url, options) => {
        seenOptions = options;
        return new Response(PNG_SIGNATURE, { status: 200, headers: { 'content-type': 'image/png' } });
    }, { maxBytes: 20, timeoutMs: 100, redirect: 'error' });

    assert.equal(response.ok, true);
    assert.equal(Buffer.isBuffer(buffer), true);
    assert.deepEqual([...buffer], [...PNG_SIGNATURE]);
    assert.equal(seenOptions.redirect, 'error');
    assert.equal('maxBytes' in seenOptions, false);
    assert.equal('timeoutMs' in seenOptions, false);
});

test('buffer-limited downloads report bytes read on stream limit and timeout errors', async () => {
    await assert.rejects(
        fetchBufferWithLimit('https://example.test/oversize', async () => new Response(
            new Uint8Array([1, 2, 3, 4, 5, 6]),
            { status: 200 }
        ), { maxBytes: 4, timeoutMs: 100 }),
        error => error.code === 'DOWNLOAD_SIZE_LIMIT' && error.bytesRead === 6
    );

    await assert.rejects(
        fetchBufferWithLimit('https://example.test/timeout', async (_url, options) => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array([1, 2, 3]));
                    options.signal.addEventListener('abort', () => {
                        const error = new Error('aborted');
                        error.name = 'AbortError';
                        controller.error(error);
                    }, { once: true });
                },
            });
            return new Response(stream, { status: 200 });
        }, { maxBytes: 20, timeoutMs: 10 }),
        error => error.code === 'DOWNLOAD_ABORTED' && error.bytesRead === 3
    );
});

async function withMockGemini(fetchImpl, run) {
    const originalKey = process.env.GOOGLE_AI_KEY;
    const originalFetch = globalThis.fetch;
    process.env.GOOGLE_AI_KEY = 'pipeline-test-key';
    globalThis.fetch = fetchImpl;
    try {
        return await run();
    } finally {
        globalThis.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.GOOGLE_AI_KEY;
        else process.env.GOOGLE_AI_KEY = originalKey;
    }
}

function geminiResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function countedStreamResponse(buffer, onChunk, headers) {
    let offset = 0;
    const stream = new ReadableStream({
        pull(controller) {
            if (offset >= buffer.length) {
                controller.close();
                return;
            }
            const end = Math.min(buffer.length, offset + 64 * 1024);
            const chunk = buffer.subarray(offset, end);
            offset = end;
            onChunk(chunk.length);
            controller.enqueue(chunk);
        },
    });
    return new Response(stream, { status: 200, headers });
}

function countedGeneratedResponse(totalBytes, onChunk, headers) {
    let emitted = 0;
    const stream = new ReadableStream({
        pull(controller) {
            if (emitted >= totalBytes) {
                controller.close();
                return;
            }
            const length = Math.min(64 * 1024, totalBytes - emitted);
            emitted += length;
            onChunk(length);
            controller.enqueue(new Uint8Array(length));
        },
    });
    return new Response(stream, { status: 200, headers });
}
