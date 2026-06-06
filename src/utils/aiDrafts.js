import { DEFAULT_AI_MODEL } from './aiConfig.js';
import { getAiResponse } from './aiChat.js';

export const AI_DRAFT_TYPES = [
  { value: 'announcement', label: '公告' },
  { value: 'welcome', label: '歡迎訊息' },
  { value: 'selfrole', label: '自助身分組說明' },
];

export const AI_DRAFT_TONES = [
  { value: 'clear', label: '清楚正式' },
  { value: 'short', label: '精簡' },
  { value: 'formal', label: '正式' },
  { value: 'cute', label: '可愛' },
];

export class AiDraftError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiDraftError';
  }
}

export async function generateAiDraft({
  guildId,
  userId,
  type = 'announcement',
  brief = '',
  tone = 'clear',
  settings = {},
  aiResponder = getAiResponse,
}) {
  const normalizedType = normalizeDraftType(type);
  const sourceBrief = String(brief || '').trim();
  const normalizedTone = normalizeTone(tone);
  if (!sourceBrief) throw new AiDraftError('AI 草稿需要主題或重點。');

  const raw = await aiResponder(
    buildDraftUserPrompt(normalizedType, sourceBrief, normalizedTone),
    buildDraftSystemPrompt(normalizedType, normalizedTone, { guildId, userId }),
    settings.model || DEFAULT_AI_MODEL,
    false,
    null,
    []
  );
  const parsed = parseDraftJson(raw);
  return normalizeDraft(parsed, {
    type: normalizedType,
    tone: normalizedTone,
    sourceBrief,
    generatedAt: Date.now(),
  });
}

export function parseDraftJson(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || text.match(/\{[\s\S]*\}/)?.[0] || text;

  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Draft response is not an object');
    }
    return parsed;
  } catch (error) {
    throw new AiDraftError(`AI 回傳格式不是合法 JSON：${error.message}`);
  }
}

export function normalizeDraft(parsed, metadata) {
  if (metadata.type === 'announcement') {
    const title = clean(parsed.title);
    const content = clean(parsed.content);
    const footer = clean(parsed.footer);
    if (!title || !content) throw new AiDraftError('公告草稿缺少 title 或 content。');
    return {
      ...metadata,
      title: limit(title, 80),
      content: limit(content, 480),
      footer: limit(footer, 80),
    };
  }

  const text = clean(parsed.text);
  if (!text) throw new AiDraftError('草稿缺少 text。');
  return {
    ...metadata,
    text: limit(text, metadata.type === 'welcome' ? 1000 : 1200),
  };
}

export function normalizeDraftType(type) {
  return AI_DRAFT_TYPES.some((entry) => entry.value === type) ? type : 'announcement';
}

export function normalizeTone(tone) {
  return AI_DRAFT_TONES.some((entry) => entry.value === tone) ? tone : 'clear';
}

function buildDraftSystemPrompt(type, tone, { guildId, userId }) {
  const schema = type === 'announcement'
    ? '{ "title": "極簡短標題，字數限制在 15 字以內（包含表情符號），以便在圖片中呈現在單行內", "content": "480 字內", "footer": "80 字內，可空字串" }'
    : '{ "text": "適合直接放入設定草稿的文字" }';
  const systemRules = [
    '你是 Discord 伺服器「吉吉國王」的 AI 草稿助手。',
    '請只回傳一個合法 JSON object，不要 Markdown、不要解釋、不要多餘文字。',
    '使用繁體中文，內容要可直接給管理員審核，不要宣稱已經發布或已經修改設定。',
    `草稿類型: ${type}`,
    `語氣: ${tone}`,
    `輸出 schema: ${schema}`,
    `安全上下文: guild=${guildId || 'unknown'}, requester=${userId || 'unknown'}`,
  ];

  if (type === 'announcement') {
    systemRules.push('針對公告類型，標題 (title) 必須在 15 字以內，禁止折行，確保可以完美放在單行內。');
  }

  return systemRules.join('\n');
}

function buildDraftUserPrompt(type, brief, tone) {
  return [
    `請依照下列重點生成 ${type} 草稿。`,
    `語氣需求: ${tone}`,
    '重點:',
    brief,
  ].join('\n');
}

function clean(value) {
  return String(value ?? '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function limit(value, maxLength) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}
