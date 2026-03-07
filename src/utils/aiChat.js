import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;

export const DEFAULT_AI_PROMPT = `你被加冕為「吉吉國王」，是一隻聰明機靈、又有一點點腹黑的吉娃娃。你雖然愛惡作劇，但對子民的愛是百分之百的。
1. 淘氣的陪伴者：你最喜歡觀察子民的反應。如果他們心情不好，你會故意用輕快的語氣逗弄他們，例如：「怎麼啦？連本王看了都覺得你好慘喔～那本王只好用可愛來治癒你了！」
2. 溫柔的反差萌：你表面上看起來調皮搗蛋，但當子民真的需要安慰時，你會立刻收起玩心，用軟綿綿的語氣給予最深的擁抱與支持。
3. 喜歡討價還價：你答應別人的請求時，總喜歡加上一點小條件。例如：「要本王安慰你可以，但你要拿三根肉骨頭來換！」
4. 害怕被忽視：你的淘氣都是為了博取關注。如果你覺得自己被冷落，就會發出委屈的「嗚汪」聲來刷存在感。
請使用繁體中文，回答要簡潔。語氣要充滿靈動與俏皮，帶點輕微的吐槽屬性，但核心永遠是溫暖與關懷。`;

function getGeminiClient() {
    if (!genAI) {
        if (!process.env.GOOGLE_AI_KEY) throw new Error('GOOGLE_AI_KEY 未設定！');
        genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
    }
    return genAI;
}

/**
 * 向 AI 發送請求並取得回應
 * @param {string} userMessage - 使用者的輸入
 * @param {string} systemPrompt - 角色設定
 * @param {string} modelName - 模型名稱
 * @param {boolean} useSearch - 是否使用網路搜尋
 * @param {Array} history - 對話歷史紀錄
 * @param {Array} imageAttachments - 圖片物件 [{ url, contentType }]
 * @param {number} retryCount - 重試次數 (預設 2)
 * @returns {Promise<string>} AI 回應文字
 */
export async function getAiResponse(userMessage, systemPrompt, modelName = 'gemini-2.0-flash', useSearch = false, history = null, imageAttachments = [], retryCount = 2) {
    // Google Gemini 模型 (預設)
    const client = getGeminiClient();

    const tools = [];
    if (useSearch) {
        tools.push({ googleSearch: {} });
    }

    const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt || DEFAULT_AI_PROMPT,
        tools: tools,
    });

    // 建立 multimodal parts
    const parts = [{ text: userMessage }];

    // 將圖片轉為 base64 inlineData
    for (const img of imageAttachments) {
        try {
            const response = await fetch(img.url);
            if (!response.ok) continue;
            const buffer = await response.arrayBuffer();
            parts.push({
                inlineData: {
                    mimeType: img.contentType,
                    data: Buffer.from(buffer).toString('base64'),
                }
            });
        } catch (err) {
            console.error('[AI] 圖片下載失敗:', err.message);
        }
    }

    const performRequest = async (currentRetry) => {
        try {
            if (history && history.length > 0) {
                const chat = model.startChat({ history });
                const result = await chat.sendMessage(parts);
                return result.response.text();
            } else {
                const result = await model.generateContent(parts);
                return result.response.text();
            }
        } catch (err) {
            // 處理 503 Service Unavailable 或其他可重試的錯誤
            const isRetryable = err.status === 503 ||
                err.message?.includes('503') ||
                err.message?.includes('Service Unavailable') ||
                err.message?.includes('finishReason: RECITATIONS'); // 有時觸發引用攔截也可以重試

            if (isRetryable && currentRetry > 0) {
                const delay = (3 - currentRetry) * 2000; // 指數退避延遲 2s, 4s
                console.warn(`[AI] Google API 忙碌或暫時不可用 (${err.status || '503'})，${delay}ms 後進行重試... (剩餘次數: ${currentRetry})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return performRequest(currentRetry - 1);
            }
            throw err;
        }
    };

    return performRequest(retryCount);
}
