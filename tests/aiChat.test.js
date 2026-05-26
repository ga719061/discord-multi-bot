import test from 'node:test';
import assert from 'node:assert/strict';
import { getAiResponse } from '../src/utils/aiChat.js';

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
