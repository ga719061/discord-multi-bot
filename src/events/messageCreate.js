import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getUserLevel, addXp, getAiSettings, getRankTitle, getGuildSettings } from '../utils/database.js';
import {
    buildAiSystemPrompt,
    getAiResponse,
    DEFAULT_AI_PROMPT,
    MAX_AI_IMAGE_COUNT,
} from '../utils/aiChat.js';
import { buildAiGuildContext } from '../utils/aiGuildContext.js';
import {
    getAiActionAuthorizationError,
    parseMentionedAiActionTrigger,
    prepareAiAction,
    rememberAiActionLauncher,
} from '../utils/aiActionTools.js';
import { DEFAULT_AI_MODEL } from '../utils/aiConfig.js';
import { buildAiMentionPolicy, sanitizeAiReplyMentions, buildAllowedMentions } from '../utils/aiMentions.js';
import { logger } from '../utils/logger.js';
import { embedsToV2Payload, v2Notice } from '../utils/componentsV2.js';
import { UI_COLORS } from '../utils/style.js';

const XP_COOLDOWN = 60_000;
const XP_MIN = 15;
const XP_MAX = 25;
const XP_MIN_MEANINGFUL_CHARS = 4;
export const AI_REQUEST_LIMITS = Object.freeze({
    userCooldownMs: 8_000,
    maxGuildInFlight: 2,
    maxGlobalInFlight: 6,
});
export const AI_HISTORY_LIMITS = Object.freeze({
    maxMessageChars: 1_200,
    maxTotalChars: 6_000,
    ttlMs: 30 * 60_000,
});
export const AI_REPLY_LIMITS = Object.freeze({
    maxChunkLength: 1_990,
    maxChunks: 3,
});
const AI_TYPING_INTERVAL_MS = 9_000;
const AI_REPLY_TRUNCATED_NOTICE = '\n\n_回覆過長，已截斷。_';

class LimitedMap extends Map {
    constructor(limit = 10000) {
        super();
        this.limit = limit;
    }
    set(key, value) {
        if (this.size >= this.limit && !this.has(key)) {
            const oldestKey = this.keys().next().value;
            if (oldestKey !== undefined) this.delete(oldestKey);
        }
        return super.set(key, value);
    }
}

// === 記憶體快取 ===
const xpCooldownCache = new LimitedMap(5000);
let cleanupInterval = null;
const xpMessageCache = new LimitedMap(10000); // 用於防重複發言的快取
const aiUserCooldownCache = new LimitedMap(5000);
const aiUsersInFlight = new Set();
const aiGuildInFlight = new Map();
let aiGlobalInFlight = 0;

// 定期清理快取避免記憶體無限增長 (每 10 分鐘清理超過 5 分鐘未更新的條目)
function startCleanupInterval() {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(() => {
        const cutoff = Date.now() - 5 * 60_000;
        for (const [key, time] of xpCooldownCache) {
            if (time < cutoff) xpCooldownCache.delete(key);
        }
        for (const [key, time] of aiUserCooldownCache) {
            if (time < cutoff) aiUserCooldownCache.delete(key);
        }
    }, 10 * 60_000);
    cleanupInterval.unref?.();
}

export function stopMessageCreate() {
    if (!cleanupInterval) return false;
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    return true;
}

export { stopMessageCreate as stop };

export function resetAiRequestLimitsForTests() {
    aiUserCooldownCache.clear();
    aiUsersInFlight.clear();
    aiGuildInFlight.clear();
    aiGlobalInFlight = 0;
}

export function tryAcquireAiRequest({ guildId, userId, now = Date.now() }) {
    const key = `${guildId}:${userId}`;
    const lastAcceptedAt = aiUserCooldownCache.get(key);
    const retryAfterMs = lastAcceptedAt === undefined
        ? 0
        : AI_REQUEST_LIMITS.userCooldownMs - (now - lastAcceptedAt);

    if (retryAfterMs > 0) {
        return { ok: false, reason: 'cooldown', retryAfterMs };
    }
    if (aiUsersInFlight.has(key)) {
        return { ok: false, reason: 'user_busy' };
    }
    if (aiGlobalInFlight >= AI_REQUEST_LIMITS.maxGlobalInFlight) {
        return { ok: false, reason: 'global_busy' };
    }

    const guildInFlight = aiGuildInFlight.get(guildId) || 0;
    if (guildInFlight >= AI_REQUEST_LIMITS.maxGuildInFlight) {
        return { ok: false, reason: 'guild_busy' };
    }

    aiUserCooldownCache.set(key, now);
    aiUsersInFlight.add(key);
    aiGuildInFlight.set(guildId, guildInFlight + 1);
    aiGlobalInFlight += 1;

    let released = false;
    return {
        ok: true,
        release() {
            if (released) return;
            released = true;
            aiUsersInFlight.delete(key);
            aiGlobalInFlight = Math.max(0, aiGlobalInFlight - 1);
            const remaining = Math.max(0, (aiGuildInFlight.get(guildId) || 1) - 1);
            if (remaining === 0) aiGuildInFlight.delete(guildId);
            else aiGuildInFlight.set(guildId, remaining);
        },
    };
}

export function canReadAiHistory(message) {
    if (!message?.member || typeof message?.channel?.permissionsFor !== 'function') return false;
    try {
        return Boolean(
            message.channel.permissionsFor(message.member)?.has?.(PermissionFlagsBits.ReadMessageHistory)
        );
    } catch {
        return false;
    }
}

function sliceWithoutBrokenSurrogate(text, maxLength) {
    if (text.length <= maxLength) return text;
    let end = maxLength;
    const lastCodeUnit = text.charCodeAt(end - 1);
    if (lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF) end -= 1;
    return text.slice(0, end);
}

export function buildAiHistory(messages, botUserId, requesterId, {
    now = Date.now(),
    ttlMs = AI_HISTORY_LIMITS.ttlMs,
} = {}) {
    if (!requesterId) return [];

    const sourceEntries = typeof messages?.entries === 'function'
        ? [...messages.entries()]
        : [...(messages?.values?.() ?? [])].map((message, index) => [index, message]);
    const candidates = sourceEntries
        .map(([collectionId, message], sourceIndex) => ({
            message,
            id: String(message?.id || collectionId),
            sourceIndex,
        }))
        .filter(({ message }) => {
            const content = String(message?.content || '');
            const createdTimestamp = Number(message?.createdTimestamp);
            const isFresh = !Number.isFinite(createdTimestamp)
                || createdTimestamp <= 0
                || now - createdTimestamp <= ttlMs;
            return !message?.system
                && !message?.webhookId
                && (message?.author?.id === requesterId || message?.author?.id === botUserId)
                && isFresh
                && content.length > 0
                && !content.startsWith('/')
                && !content.startsWith('!');
        });

    const requesterMessages = new Map(
        candidates
            .filter(({ message }) => message.author.id === requesterId)
            .map(candidate => [candidate.id, candidate])
    );
    const pairedTurns = new Map();
    for (const botCandidate of candidates) {
        if (botCandidate.message.author.id !== botUserId) continue;
        const requesterMessageId = String(botCandidate.message.reference?.messageId || '');
        const requesterCandidate = requesterMessages.get(requesterMessageId);
        if (!requesterCandidate) continue;

        const existing = pairedTurns.get(requesterMessageId);
        if (!existing || botCandidate.sourceIndex < existing.bot.sourceIndex) {
            pairedTurns.set(requesterMessageId, {
                user: requesterCandidate,
                bot: botCandidate,
                recency: Math.max(
                    Number(requesterCandidate.message.createdTimestamp) || 0,
                    Number(botCandidate.message.createdTimestamp) || 0
                ) || (Number.MAX_SAFE_INTEGER - botCandidate.sourceIndex),
            });
        }
    }

    const selectedTurns = [];
    let totalChars = 0;
    const newestFirst = [...pairedTurns.values()].sort((a, b) => b.recency - a.recency);
    for (const turn of newestFirst) {
        const userText = sliceWithoutBrokenSurrogate(
            String(turn.user.message.content).replace(/<@!?\d+>/g, '').trim(),
            AI_HISTORY_LIMITS.maxMessageChars
        );
        const botText = sliceWithoutBrokenSurrogate(
            String(turn.bot.message.content).replace(/<@!?\d+>/g, '').trim(),
            AI_HISTORY_LIMITS.maxMessageChars
        );
        if (!userText || !botText) continue;
        const turnChars = userText.length + botText.length;
        if (totalChars + turnChars > AI_HISTORY_LIMITS.maxTotalChars) break;
        totalChars += turnChars;
        selectedTurns.push({ userText, botText, recency: turn.recency });
    }

    return selectedTurns
        .sort((a, b) => a.recency - b.recency)
        .flatMap(turn => [
            { role: 'user', parts: [{ text: turn.userText }] },
            { role: 'model', parts: [{ text: turn.botText }] },
        ]);
}

function updateCodeFenceState(text, initialLanguage) {
    let language = initialLanguage;
    const fencePattern = /```([^\r\n`]*)/g;
    let match;
    while ((match = fencePattern.exec(text)) !== null) {
        language = language === null ? match[1].trim().slice(0, 30) : null;
    }
    return language;
}

function findAiReplyBoundary(text, maxLength) {
    if (text.length <= maxLength) return text.length;
    const candidate = sliceWithoutBrokenSurrogate(text, maxLength);
    const minimumNaturalBreak = Math.floor(candidate.length * 0.55);
    for (const separator of ['\n\n', '\n', ' ']) {
        const index = candidate.lastIndexOf(separator);
        if (index >= minimumNaturalBreak) {
            return moveBoundaryOutsideCodeFence(text, index + separator.length, maxLength);
        }
    }
    return moveBoundaryOutsideCodeFence(text, candidate.length, maxLength);
}

function moveBoundaryOutsideCodeFence(text, boundary, maxLength) {
    let runStart = boundary;
    let runEnd = boundary;
    while (runStart > 0 && text[runStart - 1] === '`') runStart -= 1;
    while (runEnd < text.length && text[runEnd] === '`') runEnd += 1;
    if (runEnd - runStart < 3 || boundary === runStart || boundary === runEnd) return boundary;
    if (runStart > 0) return runStart;
    return runEnd <= maxLength ? runEnd : boundary;
}

export function splitAiReply(reply, limits = AI_REPLY_LIMITS) {
    let remaining = String(reply || '').trim();
    if (!remaining) return [];

    const chunks = [];
    let openFenceLanguage = null;
    for (let index = 0; index < limits.maxChunks && remaining; index++) {
        const maxFenceLanguageLength = Math.max(0, limits.maxChunkLength - 8);
        const fenceLanguage = openFenceLanguage?.slice(0, maxFenceLanguageLength) || '';
        const prefix = openFenceLanguage === null ? '' : `\`\`\`${fenceLanguage}\n`;
        const isLastChunk = index === limits.maxChunks - 1;
        const reservedLength = 4 + (isLastChunk ? AI_REPLY_TRUNCATED_NOTICE.length : 0);
        const contentLimit = Math.max(1, limits.maxChunkLength - prefix.length - reservedLength);
        const boundary = findAiReplyBoundary(remaining, contentLimit);
        const sourceChunk = remaining.slice(0, boundary).trimEnd();
        remaining = remaining.slice(boundary).trimStart();

        openFenceLanguage = updateCodeFenceState(sourceChunk, openFenceLanguage);
        const closeFence = openFenceLanguage === null ? '' : '\n```';
        const truncatedNotice = isLastChunk && remaining ? AI_REPLY_TRUNCATED_NOTICE : '';
        chunks.push(`${prefix}${sourceChunk}${closeFence}${truncatedNotice}`);
    }
    return chunks;
}

export function normalizeAiResult(result) {
    if (!result || typeof result !== 'object') {
        return {
            text: String(result || ''),
            usageMetadata: {},
            queryCount: 0,
            finishReason: 'unknown',
            attemptCount: 0,
            retryCount: 0,
        };
    }
    const usageMetadata = {};
    for (const key of [
        'promptTokenCount',
        'candidatesTokenCount',
        'thoughtsTokenCount',
        'cachedContentTokenCount',
        'totalTokenCount',
    ]) {
        const value = Number(result.usageMetadata?.[key]);
        if (Number.isFinite(value) && value >= 0) usageMetadata[key] = value;
    }
    const queryCount = Number(result.groundingMetadata?.queryCount);
    const attemptCount = Number(result.attemptCount);
    const retryCount = Number(result.retryCount);
    return {
        text: String(result.text || ''),
        usageMetadata,
        queryCount: Number.isInteger(queryCount) && queryCount >= 0 ? queryCount : 0,
        finishReason: String(result.finishReason || 'unknown')
            .replace(/[^A-Za-z0-9_-]/g, '')
            .slice(0, 40) || 'unknown',
        attemptCount: Number.isInteger(attemptCount) && attemptCount >= 1 ? attemptCount : 0,
        retryCount: Number.isInteger(retryCount) && retryCount >= 0 ? retryCount : 0,
    };
}

export function startAiTyping(channel, {
    intervalMs = AI_TYPING_INTERVAL_MS,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
} = {}) {
    const sendTyping = () => Promise.resolve(channel?.sendTyping?.()).catch(() => {});
    void sendTyping();
    const timer = setIntervalFn(sendTyping, intervalMs);
    timer?.unref?.();

    let stopped = false;
    return () => {
        if (stopped) return false;
        stopped = true;
        clearIntervalFn(timer);
        return true;
    };
}

// ========== 吉吉國王互動系統 ==========

const patReactions = [
    { text: '🐕👑 汪～好舒服...本王允許你再摸一次！', mood: '😊', color: UI_COLORS.ROYAL },
    { text: '🐕💢 汪！！你...你竟敢摸本王的頭！？\n...再摸一下啦...', mood: '😤', color: UI_COLORS.DANGER },
    { text: '🐕✨ *搖尾巴* 嗯...本王今天心情不錯，賞你摸！', mood: '🥰', color: UI_COLORS.SUCCESS },
    { text: '🐕💤 zzZ...本王正在午睡...你還摸？\n*翻了個身繼續睡*', mood: '😴', color: UI_COLORS.MUTED },
    { text: '🐕👑 哼！本王才不是因為喜歡才讓你摸的！\n...只是今天特別恩准而已！汪！', mood: '😳', color: UI_COLORS.WARNING },
    { text: '🐕🎵 *開心地轉圈圈* 汪汪汪！本王最喜歡被摸了～\n...啊不對！本王是威嚴的國王！咳咳！', mood: '🤩', color: UI_COLORS.FUN },
];

const hugReactions = [
    { text: '🐕💕 汪～好溫暖...本王勉強讓你抱一下...\n*小小的身體縮在你懷裡* 嗯...不準放開。', color: UI_COLORS.FUN },
    { text: '🐕👑 哼！堂堂國王怎麼可以被人抱！\n...但你的懷抱好舒服...本王再待一下就好...汪。', color: UI_COLORS.ROYAL },
    { text: '🐕✨ *瘋狂搖尾巴* 汪汪汪！抱抱！本王最喜歡抱抱了！！\n*在你臉上瘋狂舔*', color: UI_COLORS.SUCCESS },
    { text: '🐕💤 *在你懷裡睡著了* zzZ...汪...zzZ...\n（看起來國王睡得很香）', color: UI_COLORS.MUTED },
];

const fortuneLuck = [
    { luck: '🌟 狂暴大吉', text: '汪汪汪！本王感應到強烈的金色靈光！你今天簡直就是幸運化身！✨', color: UI_COLORS.ROYAL },
    { luck: '✨ 搖尾中吉', text: '好耶！本王覺得你今天運氣相當不錯，尾巴忍不住幫你搖兩下！汪！🐾', color: UI_COLORS.SUCCESS },
    { luck: '☀️ 暖心小吉', text: '是個溫暖的好日子～本王把今日份皇家祝福塞進你的口袋囉！', color: UI_COLORS.INFO },
    { luck: '☁️ 摸摸末吉', text: '運勢普普通通，不過沒關係，多打「摸摸國王」來蹭蹭本王的好運氣吧！👑', color: UI_COLORS.MUTED },
    { luck: '🌧️ 抖抖小凶', text: '哎呀，今天出門要注意喔！不過別怕，本王會一邊發抖一邊在後面保護你的！🐕💦', color: UI_COLORS.WARNING },
    { luck: '💀 皇家大凶', text: '嗚汪……本王占出超級黑色大凶！今天就乖乖窩在家裡，像本王躲洗澡一樣躲著一切！🚿😱', color: UI_COLORS.DANGER },
    { luck: '🐕👑 國王特別獎', text: '天啊！是萬中選一的皇家特賞！本王宣布賜你無上榮光，你就是最棒的特級子民！🥩', color: UI_COLORS.FUN },
];

const dailyQuotes = [
    '「本王每天最尊貴的行程……就是挑個最軟的墊子午睡！💤」',
    '「體型小怎麼了？本王雖然只有三公斤，但脾氣和夢想都有三百噸重！汪！😤」',
    '「人生就像一根香噴噴的肉乾，必須死死咬住、絕不鬆口！🍖」',
    '「忠誠可是無價之寶！就像本王對剛煎好的沙朗牛排一樣忠貞不二！🥩」',
    '「睜開眼就是新的冒險！尤其是聽到『出門散步』這四個字的時候！🐕💨」',
    '「快樂密碼超簡單：熱呼呼的抱抱、滿滿的肉乾，還有看見你時搖個不停的尾巴！💕」',
    '「別怕！就算全世界都背叛你，本王也會一邊發抖一邊擋在你腳邊，對著世界超兇地狂吠！🐕」',
    '「心情煩躁嗎？試著原地追著自己的屁股轉三圈，保證你頭暈到忘記煩惱！🌀」',
    '「今天你又變厲害了呢！問我為什麼？因為你今天又來覲見帥氣的本王了呀！汪！✨」',
];

const talkKeywords = {
    '可愛': '🐕👑 哼！本王知道自己很可愛！不用你說！\n...但聽到還是很開心啦...汪。',
    '帥': '🐕✨ 當然！本王可是全伺服器最帥的吉娃娃！沒有之一！',
    '喜歡': '🐕💕 汪！本...本王才沒有很高興呢！\n...好吧本王也喜歡你。小聲地說。',
    '笨': '🐕💢 你說什麼！？本王可是高智商吉娃娃！哼！',
    '醜': '🐕😤 什麼！？本王超級美的好嗎！你去照鏡子吧！汪！',
    '早安': '🐕☀️ 早安～子民！本王已經起床巡視領地了！今天也要元氣滿滿喔！汪！',
    '晚安': '🐕🌙 晚安～本王准許你去睡覺！*把小被子蓋好* 明天見～汪。',
    '無聊': '🐕🎮 無聊？那就來陪本王玩！打「摸摸國王」或「抱抱國王」試試！',
    '餓': '🐕😢 本王也餓了！快用 /餵食 進貢食物給本王！',
    '睡覺': '🐕💤 本王最喜歡睡覺了～特別是在溫暖的膝蓋上...*打哈欠* 汪～',
    '散步': '🐕🏃 散步！？本王要去散步！！*興奮地轉圈* 快帶本王出門！汪汪！',
    '洗澡': '🐕😱 不要！！！本王討厭洗澡！！！*躲到沙發底下*',
    '你好': '🐕👑 汪！歡迎覲見本王！有何貴幹？',
    '謝謝': '🐕☺️ 不用謝！保護子民是本王的職責！...但再來點牛排就更好了。汪。',
    '厲害': '🐕👑 那是當然的！本王可是國王欸！厲害是基本的！',
    '好棒': '🐕💕 汪～被稱讚了好開心！*搖尾巴搖到快飛起來*',
    '壞': '🐕😢 你說本王壞...好傷心...*蹲在角落畫圈圈* ...才怪！哼！',
    '零食': '🐕🤤 零食！？在哪！？本王要！本王現在就要！汪汪汪！',
};

const defaultTalkReplies = [
    '🐕👑 嗯？本王聽到了...但不太理解。汪。',
    '🐕🤔 你在說什麼？本王歪頭想了想...還是不懂。',
    '🐕💤 *打了個哈欠* 嗯嗯...本王有在聽...大概吧。',
    '🐕🐾 *用小爪子拍了拍你* 汪！本王端正看著你，覺得你是個好人！',
    '🐕💭 本王正在思考...其實在想晚餐吃什麼。汪。',
    '🐕👑 身為國王，本王選擇搖尾巴回應你。',
];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function buildMentionInstructions(message, policy, canMentionRoles) {
    const userTargets = policy.users.map(id => {
        const name = message.guild.members.cache.get(id)?.displayName
            || message.mentions.users.get(id)?.username
            || id;
        return `${name}: <@${id}>`;
    });
    const roleTargets = policy.roles.map(id => {
        const name = message.mentions.roles.get(id)?.name || id;
        return `${name}: <@&${id}>`;
    });
    const targets = [];

    if (userTargets.length) targets.push(`允許標記的使用者: ${userTargets.join('、')}`);
    if (roleTargets.length) targets.push(`允許標記的身分組: ${roleTargets.join('、')}`);
    if (!canMentionRoles && message.mentions.roles.size > 0) {
        targets.push('本次發訊者不是管理員，不可實際標記身分組。');
    }
    if (!targets.length) targets.push('本次沒有允許實際標記的對象。');

    return [
        '只有在使用者明確要求通知時，才能原樣使用下列 Discord token。',
        ...targets,
        '禁止標記未列出的對象，且永遠禁止 @everyone 與 @here。',
    ].join('\n');
}

export function shouldTriggerAi({ settings, isMention, userId, channelId, now = Date.now() }) {
    const isExpired = settings.expires_at !== null && now > settings.expires_at;
    if (settings.enabled === 0 || isExpired || !isMention) return false;

    const isWhitelistedUser = settings.whitelist.includes(userId);
    const isPartyActive = settings.party_channel_id === channelId &&
                          settings.party_expires_at &&
                          now < settings.party_expires_at;
    return isWhitelistedUser || Boolean(isPartyActive);
}

export function isEligibleXpMessage(message) {
    const content = String(message?.content || '').trim();
    if (!content) return false;

    const withoutDiscordTokens = content
        .replace(/<a?:[^:\s>]+:\d+>/g, '')
        .replace(/<(?:@!?|@&|#)\d+>/g, '');
    const meaningfulCharacters = withoutDiscordTokens.match(/[\p{L}\p{N}]/gu) || [];
    return meaningfulCharacters.length >= XP_MIN_MEANINGFUL_CHARS;
}

async function handleKingInteraction(message) {
    const content = message.content;
    const mention = message.mentions.has(message.client.user);

    // 摸摸國王
    if (content.match(/摸摸(國王|吉吉|吉娃娃|本王)/)) {
        const r = pick(patReactions);
        const embed = new EmbedBuilder()
            .setColor(r.color)
            .setTitle(`${r.mood} 摸摸吉吉國王`)
            .setDescription(`${message.author} 摸了摸吉吉國王...\n\n${r.text}`)
            .setFooter({ text: '🐕 直接打「摸摸國王」就能摸本王喔！' });
        await message.reply(embedsToV2Payload([embed], { allowedMentions: { parse: [] } }));
        return true;
    }

    // 抱抱國王
    if (content.match(/抱抱(國王|吉吉|吉娃娃|本王)/)) {
        const r = pick(hugReactions);
        const embed = new EmbedBuilder()
            .setColor(r.color)
            .setTitle('🐕💕 抱抱吉吉國王')
            .setDescription(`${message.author} 把吉吉國王抱了起來...\n\n${r.text}`)
            .setFooter({ text: '🐕 直接打「抱抱國王」就能抱本王喔！' });
        await message.reply(embedsToV2Payload([embed], { allowedMentions: { parse: [] } }));
        return true;
    }

    // 占卜 / 運勢
    if (content.match(/(占卜|運勢|今日運勢)/)) {
        const r = pick(fortuneLuck);
        const embed = new EmbedBuilder()
            .setColor(r.color)
            .setTitle('🐕🔮 吉吉國王的占卜')
            .setDescription(`*國王閉上眼睛，搖了搖小尾巴...*`)
            .addFields(
                { name: '🔮 今日運勢', value: `**${r.luck}**` },
                { name: '👑 國王的話', value: r.text }
            )
            .setFooter({ text: '🐕 打「占卜」就能請本王占卜！' });
        await message.reply(embedsToV2Payload([embed], { allowedMentions: { parse: [] } }));
        return true;
    }

    // 每日一汪
    if (content.match(/(每日一汪|每日金句|國王金句)/)) {
        const today = new Date().toISOString().split('T')[0];
        const seed = today + message.author.id;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0;
        }
        const quote = dailyQuotes[Math.abs(hash) % dailyQuotes.length];
        const luckyNum = (Math.abs(hash) % 100) + 1;
        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.ROYAL)
            .setTitle('🐕👑 吉吉國王的每日金句')
            .setDescription(`> ${quote}\n\n— 吉吉國王`)
            .addFields({ name: '🍀 幸運指數', value: `${'⭐'.repeat(Math.ceil(luckyNum / 20))} (${luckyNum}/100)` })
            .setFooter({ text: '🐕 每天打「每日一汪」找本王領金句！' });
        await message.reply(embedsToV2Payload([embed], { allowedMentions: { parse: [] } }));
        return true;
    }

    // @提及 或 叫國王 → 關鍵字聊天
    if (mention || content.match(/(國王|吉吉|吉娃娃|本王)/)) {
        const cleanContent = content.replace(/<@!?\d+>/g, '').trim();
        if (!cleanContent || cleanContent.length < 1) return false;

        let reply = null;
        for (const [keyword, response] of Object.entries(talkKeywords)) {
            if (cleanContent.includes(keyword)) {
                reply = response;
                break;
            }
        }

        if (!reply) {
            reply = pick(defaultTalkReplies);
        }

        await message.reply({ content: reply, allowedMentions: { parse: [], repliedUser: false } });
        return true;
    }

    return false;
}

// ========== 主事件 ==========

export function register(client) {
    startCleanupInterval();
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const isMention = message.mentions.has(client.user);
        const settings = isMention ? getAiSettings(message.guild.id) : null;
        const mentionedText = isMention
            ? message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim()
            : '';
        const actionTrigger = isMention
            ? parseMentionedAiActionTrigger(message.content, client.user.id)
            : null;

        if (settings && actionTrigger) {
            await handleAiActionMessage(message, client, settings, actionTrigger);
            return;
        }

        // ===== AI 啟用狀態判定 (FUNC-05) =====
        // ===== AI 攔截 =====
        if (settings && shouldTriggerAi({
            settings,
            isMention,
            userId: message.author.id,
            channelId: message.channel.id,
        })) {
            const userText = mentionedText;
            const imageAttachments = [...message.attachments.values()]
                .filter(att => att.contentType?.startsWith('image/'))
                .slice(0, MAX_AI_IMAGE_COUNT);

            if (userText.length > 0 || imageAttachments.length > 0) {
                const requestSlot = tryAcquireAiRequest({
                    guildId: message.guild.id,
                    userId: message.author.id,
                });
                if (!requestSlot.ok) {
                    const content = ['cooldown', 'user_busy'].includes(requestSlot.reason)
                        ? '🐕⏳ 本王還在整理你的上一個問題，請幾秒後再試。'
                        : '🐕🧠 皇家智慧核心正忙，請稍後再試。';
                    await message.reply({
                        content,
                        allowedMentions: { parse: [], repliedUser: false },
                    }).catch(() => {});
                    return;
                }

                let stopTyping = () => false;
                try {
                    stopTyping = startAiTyping(message.channel);
                    const isAdmin = Boolean(
                        message.member?.permissions?.has?.(PermissionFlagsBits.Administrator)
                    );
                    const mentionPolicy = buildAiMentionPolicy({
                        botUserId: client.user.id,
                        userIds: [...message.mentions.users.keys()],
                        roleIds: [...message.mentions.roles.keys()],
                        allowRoleMentions: isAdmin,
                    });
                    const allowedMentions = buildAllowedMentions(mentionPolicy);
                    const displayText = userText;

                    // 建立最小化的公開伺服器上下文，不注入管理設定或敏感資訊。
                    const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
                    const guildContext = buildAiGuildContext(message);
                    const context = [
                        `[系統資訊]`,
                        `時間: ${now}`,
                        `\n[提及規範]\n${buildMentionInstructions(message, mentionPolicy, isAdmin)}`,
                    ].filter(Boolean).join('\n');

                    const basePrompt = settings.system_prompt || DEFAULT_AI_PROMPT;
                    const fullPrompt = buildAiSystemPrompt(basePrompt, context);

                    const modelName = settings.model || DEFAULT_AI_MODEL;
                    const useSearch = settings.search_enabled || false;
                    const useContext = settings.context_enabled !== false; // 預設開啟

                    let history = [];
                    if (useContext && canReadAiHistory(message)) {
                        try {
                            const messages = await message.channel.messages.fetch({ limit: 12, before: message.id });
                            history = buildAiHistory(messages, client.user.id, message.author.id);
                        } catch (err) {
                            const code = String(err?.code || err?.name || 'UNKNOWN')
                                .replace(/[^A-Za-z0-9_-]/g, '')
                                .slice(0, 40);
                            logger.warn(`[AI] 讀取對話歷史失敗 guild=${message.guild.id} code=${code}`);
                        }
                    }

                    const requestStartedAt = Date.now();
                    const aiResult = await getAiResponse(
                        `${displayText}\n\n${guildContext}`,
                        fullPrompt,
                        modelName,
                        useSearch,
                        history,
                        imageAttachments,
                        2,
                        {
                            returnMetadata: true,
                            includeCitations: settings.citations_enabled,
                            requireValidImage: !displayText,
                        }
                    );
                    const normalizedResult = normalizeAiResult(aiResult);
                    const aiReply = sanitizeAiReplyMentions(
                        normalizedResult.text,
                        mentionPolicy
                    );
                    const usage = normalizedResult.usageMetadata;
                    const safeModelName = String(modelName).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 60);
                    logger.info(
                        `[AI] response guild=${message.guild.id} model=${safeModelName}`
                        + ` latencyMs=${Date.now() - requestStartedAt}`
                        + ` attempts=${normalizedResult.attemptCount}`
                        + ` retries=${normalizedResult.retryCount}`
                        + ` promptTokens=${usage.promptTokenCount ?? 'unknown'}`
                        + ` outputTokens=${usage.candidatesTokenCount ?? 'unknown'}`
                        + ` thoughtTokens=${usage.thoughtsTokenCount ?? 'unknown'}`
                        + ` cachedTokens=${usage.cachedContentTokenCount ?? 'unknown'}`
                        + ` totalTokens=${usage.totalTokenCount ?? 'unknown'}`
                        + ` searchQueries=${normalizedResult.queryCount}`
                        + ` finishReason=${normalizedResult.finishReason}`
                    );
                    const chunks = splitAiReply(aiReply);
                    if (chunks.length === 0) {
                        await message.reply({
                            content: '🐕💭 本王這次沒有產生可用的回覆，請換個方式再問一次。',
                            allowedMentions: { parse: [], repliedUser: false },
                        });
                        return;
                    }
                    await message.reply({ content: chunks[0], allowedMentions });
                    for (let i = 1; i < chunks.length; i++) {
                        await message.channel.send({ content: chunks[i], allowedMentions });
                    }
                    return; // AI 處理完，不走後面的邏輯
                } catch (err) {
                    const errorCode = String(err?.code || err?.name || 'UNKNOWN')
                        .replace(/[^A-Za-z0-9_-]/g, '')
                        .slice(0, 40);
                    logger.error(`[AI] 回應失敗 guild=${message.guild.id} code=${errorCode}`);
                    const failureMessage = err?.code === 'AI_TIMEOUT'
                        ? '🐕⏳ 本王思考太久了，這次先停止處理；請稍後再試。'
                        : err?.code === 'AI_NO_VALID_INPUT'
                            ? '🐕🖼️ 本王無法讀取這張圖片，請改用支援的圖片格式或補上文字說明。'
                            : '🐕💥 汪！AI 突然腦子當機了... 等一下再試試？';
                    await message.reply({
                        content: failureMessage,
                        allowedMentions: { parse: [], repliedUser: false },
                    }).catch(() => { });
                    return;
                } finally {
                    stopTyping();
                    requestSlot.release();
                }
            }
        }

        // 吉吉國王互動（非白名單或 AI 關閉時走這裡）
        try {
            if (await handleKingInteraction(message)) return;
        } catch (err) {
            logger.error('[Message] 處理吉吉國王互動失敗:', err);
        }

        // ================= 防刷機制 (Anti-Spam) =================
        const content = message.content.trim();

        // 1. 排除空白、貼圖、純 emoji／符號、自訂 emoji 與過短內容
        if (!isEligibleXpMessage(message)) return;

        // 2. 防重複發言 (與上一句完全相同)
        const userGuildKey = `${message.guild.id}-${message.author.id}`;
        const lastMessageContent = xpMessageCache.get(userGuildKey);

        if (lastMessageContent === content) {
            return; // 拒絕一模一樣的重複發言
        }

        // 記錄本次發言，供下次比對防重複
        xpMessageCache.set(userGuildKey, content);

        // ========================================================

        // 等級系統冷卻檢查（記憶體快取，避免頻繁查詢 DB）
        const lastTime = xpCooldownCache.get(userGuildKey);

        if (lastTime && (Date.now() - lastTime < XP_COOLDOWN)) {
            return; // 還在冷卻中，不存取資料庫
        }

        const user = getUserLevel(message.guild.id, message.author.id);
        if (Date.now() - user.last_xp_time < XP_COOLDOWN) {
            // 同步快取
            xpCooldownCache.set(userGuildKey, user.last_xp_time);
            return;
        }

        let xpGain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
        if (message.member && message.member.premiumSince) {
            xpGain = Math.floor(xpGain * 1.5);
        }
        const result = addXp(message.guild.id, message.author.id, xpGain);

        // 更新快取為當前時間
        xpCooldownCache.set(userGuildKey, Date.now());

        if (result.leveledUp) {
            const guildSettings = getGuildSettings(message.guild.id);

            if (guildSettings.level_up_announcement_enabled !== 0) {
                const oldTitle = getRankTitle(result.newLevel - 1);
                const newTitle = getRankTitle(result.newLevel);

                let msg = `🐕👑 汪汪！本王宣布 ${message.author} 晉升為 **等級 ${result.newLevel}** 的子民！繼續效忠本王吧～🎉`;

                // 如果階級頭銜變了，發佈特別冊封廣播
                if (oldTitle !== newTitle) {
                    msg = `🐕👑 **【皇家冊封大典】** 汪！本王看見了 ${message.author} 的忠誠與努力！\n特別賜予你 **「${newTitle}」** 的頭銜！成為王國的棟樑吧！🎉`;
                }

                message.channel.send(v2Notice(
                    oldTitle !== newTitle ? '👑 皇家冊封大典' : '🐕👑 皇家晉升喜報',
                    msg,
                    oldTitle !== newTitle ? UI_COLORS.ROYAL : UI_COLORS.SUCCESS,
                    { ephemeral: false, allowedMentions: { parse: [], users: [message.author.id] } }
                )).catch(() => { });
            }
        }
    });
}

async function handleAiActionMessage(message, client, settings, trigger) {
    const now = Date.now();
    const deniedMessage = getAiActionAuthorizationError({
        tool: trigger.tool,
        settings,
        userId: message.author.id,
        isAdministrator: Boolean(
            message.member?.permissions?.has?.(PermissionFlagsBits.Administrator)
        ),
        hasAttachments: message.attachments.size > 0,
        now,
    });

    if (deniedMessage) {
        await message.reply(v2Notice(
            '🐕👑 AI 操作未執行',
            deniedMessage,
            UI_COLORS.WARNING,
            { ephemeral: false, allowedMentions: { parse: [], repliedUser: false } }
        )).catch(() => {});
        return;
    }

    const requestSlot = tryAcquireAiRequest({
        guildId: message.guild.id,
        userId: message.author.id,
    });
    if (!requestSlot.ok) {
        const content = ['cooldown', 'user_busy'].includes(requestSlot.reason)
            ? '本王還在整理你的上一個要求，請幾秒後再試。'
            : '皇家智慧核心正忙，請稍後再試。';
        await message.reply(v2Notice(
            '🐕⏳ AI 操作暫緩',
            content,
            UI_COLORS.WARNING,
            { ephemeral: false, allowedMentions: { parse: [], repliedUser: false } }
        )).catch(() => {});
        return;
    }

    let stopTyping = () => false;
    try {
        if (trigger.instruction) stopTyping = startAiTyping(message.channel);
        const prepared = await prepareAiAction({
            ...trigger,
            guildId: message.guild.id,
            channelId: message.channel.id,
            userId: message.author.id,
            sourceMessageId: message.id,
            settings,
        });
        const launcher = await message.reply(prepared.payload);
        rememberAiActionLauncher(prepared.sessionId, launcher, client);
    } catch (error) {
        const code = String(error?.code || error?.name || 'AI_ACTION_PREPARE_FAILED')
            .replace(/[^A-Za-z0-9_-]/g, '')
            .slice(0, 40);
        logger.error(`[AI Action] prepare failed tool=${trigger.tool} guild=${message.guild.id} code=${code}`);
        await message.reply(v2Notice(
            '🐕💥 AI 操作草稿失敗',
            error?.code === 'AI_TIMEOUT'
                ? '本王整理操作資料太久了，請稍後再試。'
                : '本王無法建立這份操作草稿，請改用更明確的內容重試。',
            UI_COLORS.WARNING,
            { ephemeral: false, allowedMentions: { parse: [], repliedUser: false } }
        )).catch(() => {});
    } finally {
        stopTyping();
        requestSlot.release();
    }
}

export { xpMessageCache };
