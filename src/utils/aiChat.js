import { GoogleGenAI } from '@google/genai';
import { DEFAULT_AI_MODEL } from './aiConfig.js';
import { logger } from './logger.js';
import { AI_PERSONA_PROMPT } from '../knowledge/persona.js';
import { fetchWithLimit } from './imageRendering.js';

let genAI = null;

export const DEFAULT_AI_PROMPT = AI_PERSONA_PROMPT;
export const SERVER_INFO_RESTRICTION = '你沒有本 Discord 伺服器的功能、指令、設定、權限或管理資訊。遇到相關問題時，請簡短說明無法提供，不要猜測、整理或引用伺服器內容。';
const IMAGE_FETCH_TIMEOUT_MS = 3500;
const MAX_AI_IMAGE_BYTES = 5 * 1024 * 1024;

export function buildAiSystemPrompt(basePrompt, context = '') {
    return [
        basePrompt || DEFAULT_AI_PROMPT,
        `[伺服器資訊限制]\n${SERVER_INFO_RESTRICTION}`,
        context,
    ].filter(Boolean).join('\n\n');
}

function getGeminiClient() {
    if (!genAI) {
        if (!process.env.GOOGLE_AI_KEY) throw new Error('GOOGLE_AI_KEY 未設定！');
        genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_KEY });
    }
    return genAI;
}

function summarizeAiError(err) {
    const status = err?.status || err?.statusCode || err?.code || 'unknown';
    const message = String(err?.message || err || 'Unknown error')
        .replace(/key=[^&\s]+/gi, 'key=[REDACTED]')
        .replace(/\s+/g, ' ')
        .slice(0, 500);
    return { status, message };
}

function normalizeImageMime(contentType) {
    const mimeType = String(contentType || '').split(';')[0].trim().toLowerCase();
    return mimeType.startsWith('image/') ? mimeType : null;
}

async function fetchImageAttachment(img) {
    const declaredMimeType = normalizeImageMime(img.contentType);
    if (!declaredMimeType) return null;

    try {
        const response = await fetchWithLimit(img.url, fetch, {
            maxBytes: MAX_AI_IMAGE_BYTES,
            timeoutMs: IMAGE_FETCH_TIMEOUT_MS,
        });
        if (!response.ok) return null;

        const responseContentType = response.headers?.get?.('content-type');
        const responseMimeType = responseContentType ? normalizeImageMime(responseContentType) : declaredMimeType;
        if (!responseMimeType) return null;

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_AI_IMAGE_BYTES) {
            logger.warn(`[AI] 圖片超過大小限制，已略過: ${buffer.length} bytes`);
            return null;
        }

        return {
            mimeType: responseMimeType,
            data: buffer.toString('base64'),
        };
    } catch (err) {
        logger.warn(`[AI] 圖片下載失敗: ${err.message}`);
        return null;
    }
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
export async function getAiResponse(userMessage, systemPrompt, modelName = DEFAULT_AI_MODEL, useSearch = false, history = null, imageAttachments = [], retryCount = 2) {
    const client = getGeminiClient();
    const config = {
        systemInstruction: systemPrompt || DEFAULT_AI_PROMPT,
    };
    if (useSearch) {
        config.tools = [{ googleSearch: {} }];
    }

    // 建立 multimodal parts
    const parts = [{ text: userMessage }];

    // 將圖片轉為 base64 inlineData
    for (const img of imageAttachments) {
        try {
            const inlineData = await fetchImageAttachment(img);
            if (!inlineData) continue;
            parts.push({
                inlineData,
            });
        } catch (err) {
            logger.warn(`[AI] 圖片下載失敗: ${err.message}`);
        }
    }

    const performRequest = async (currentRetry) => {
        try {
            if (history && history.length > 0) {
                const chat = client.chats.create({ model: modelName, config, history });
                const response = await chat.sendMessage({ message: parts });
                return response.text || '';
            } else {
                const response = await client.models.generateContent({
                    model: modelName,
                    contents: [{ role: 'user', parts }],
                    config,
                });
                return response.text || '';
            }
        } catch (err) {
            const { status, message } = summarizeAiError(err);
            const isRetryable = [429, 500, 502, 503, 504].includes(Number(status)) ||
                message.includes('503') ||
                message.includes('Service Unavailable') ||
                message.includes('finishReason: RECITATIONS') ||
                message.includes('fetch failed') ||
                err.code === 'ECONNRESET' ||
                err.code === 'ETIMEDOUT'; // 有時觸發引用攔截也可以重試

            if (isRetryable && currentRetry > 0) {
                const delay = (3 - currentRetry) * 2000; // 指數退避延遲 2s, 4s
                logger.warn(`[AI] Google API 暫時不可用 (${status})，${delay}ms 後重試 (剩餘: ${currentRetry})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return performRequest(currentRetry - 1);
            }
            logger.error(`[AI] Gemini 請求失敗 model=${modelName} search=${useSearch} history=${history?.length || 0} status=${status}: ${message}`);
            throw err;
        }
    };

    return performRequest(retryCount);
}
