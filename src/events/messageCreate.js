import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getUserLevel, addXp, getAiSettings, getRankTitle, getGuildSettings } from '../utils/database.js';
import { getAiResponse, DEFAULT_AI_PROMPT } from '../utils/aiChat.js';
import { DEFAULT_AI_MODEL } from '../utils/aiConfig.js';
import { buildAiMentionPolicy, sanitizeAiReplyMentions, buildAllowedMentions } from '../utils/aiMentions.js';
import { logger } from '../utils/logger.js';
import { embedsToV2Payload, v2Notice } from '../utils/componentsV2.js';
import { UI_COLORS } from '../utils/style.js';

const XP_COOLDOWN = 60_000;
const XP_MIN = 15;
const XP_MAX = 25;

// === 記憶體快取 ===
const xpCooldownCache = new Map();
let cleanupInterval = null;
const xpMessageCache = new Map(); // 用於防重複發言的快取

// 定期清理快取避免記憶體無限增長 (每 10 分鐘清理超過 5 分鐘未更新的條目)
function startCleanupInterval() {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(() => {
        const cutoff = Date.now() - 5 * 60_000;
        for (const [key, time] of xpCooldownCache) {
            if (time < cutoff) xpCooldownCache.delete(key);
        }
        // xpMessageCache 沒有時間戳，直接清空即可（下次發言會重新建立）
        if (xpMessageCache.size > 10000) xpMessageCache.clear();
    }, 10 * 60_000);
}

// ========== 吉吉國王互動系統 ==========

const patReactions = [
    { text: '🐕👑 汪～好舒服...本王允許你再摸一次！', mood: '😊', color: 0xFFD700 },
    { text: '🐕💢 汪！！你...你竟敢摸本王的頭！？\n...再摸一下啦...', mood: '😤', color: 0xFF6B6B },
    { text: '🐕✨ *搖尾巴* 嗯...本王今天心情不錯，賞你摸！', mood: '🥰', color: 0x57F287 },
    { text: '🐕💤 zzZ...本王正在午睡...你還摸？\n*翻了個身繼續睡*', mood: '😴', color: 0x99AAB5 },
    { text: '🐕👑 哼！本王才不是因為喜歡才讓你摸的！\n...只是今天特別恩准而已！汪！', mood: '😳', color: 0xFFA500 },
    { text: '🐕🎵 *開心地轉圈圈* 汪汪汪！本王最喜歡被摸了～\n...啊不對！本王是威嚴的國王！咳咳！', mood: '🤩', color: 0xFF69B4 },
];

const hugReactions = [
    { text: '🐕💕 汪～好溫暖...本王勉強讓你抱一下...\n*小小的身體縮在你懷裡* 嗯...不準放開。', color: 0xFF69B4 },
    { text: '🐕👑 哼！堂堂國王怎麼可以被人抱！\n...但你的懷抱好舒服...本王再待一下就好...汪。', color: 0xFFD700 },
    { text: '🐕✨ *瘋狂搖尾巴* 汪汪汪！抱抱！本王最喜歡抱抱了！！\n*在你臉上瘋狂舔*', color: 0x57F287 },
    { text: '🐕💤 *在你懷裡睡著了* zzZ...汪...zzZ...\n（看起來國王睡得很香）', color: 0x99AAB5 },
];

const fortuneLuck = [
    { luck: '🌟 大吉', text: '汪！！本王感應到你今天超幸運！', color: 0xFFD700 },
    { luck: '✨ 中吉', text: '本王覺得你今天運氣不錯！汪！', color: 0x57F287 },
    { luck: '☀️ 小吉', text: '還不錯的一天～本王祝福你！', color: 0x3498DB },
    { luck: '☁️ 末吉', text: '普通的運勢，多摸摸本王帶來好運！', color: 0xB0BEC5 },
    { luck: '🌧️ 凶', text: '今天要小心...不過有本王在別怕！汪！', color: 0xE67E22 },
    { luck: '🐕👑 國王特別獎', text: '汪汪！本王特別賜福給你！你是最棒的子民！', color: 0xFF69B4 },
];

const dailyQuotes = [
    '「身為國王最重要的事情就是...午睡。」',
    '「體型不代表一切！本王雖小但心很大！」',
    '「人生就像一根骨頭，要好好把握才行！」',
    '「忠誠是最珍貴的品質，就像本王對牛排的忠誠一樣。」',
    '「每一天都是新的冒險！特別是散步的時候！」',
    '「快樂其實很簡單：溫暖的懷抱、好吃的肉、搖尾巴的理由。」',
    '「就算全世界都看不起你，本王也會站在你腳邊支持你！」',
    '「壓力大就去追自己的尾巴轉三圈，保證忘記煩惱。」',
    '「今天的你比昨天更進步了！因為你今天來看本王了！汪！」',
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
    '🐕🐾 *用小爪子拍了拍你* 汪！本王覺得你是個好人！',
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

function handleKingInteraction(message) {
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
        message.reply(embedsToV2Payload([embed], { allowedMentions: { parse: [] } }));
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
        message.reply(embedsToV2Payload([embed], { allowedMentions: { parse: [] } }));
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
        message.reply(embedsToV2Payload([embed], { allowedMentions: { parse: [] } }));
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
            .setColor(0xFFD700)
            .setTitle('🐕👑 吉吉國王的每日金句')
            .setDescription(`> ${quote}\n\n— 吉吉國王`)
            .addFields({ name: '🍀 幸運指數', value: `${'⭐'.repeat(Math.ceil(luckyNum / 20))} (${luckyNum}/100)` })
            .setFooter({ text: '🐕 每天打「每日一汪」找本王領金句！' });
        message.reply(embedsToV2Payload([embed], { allowedMentions: { parse: [] } }));
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

        message.reply({ content: reply, allowedMentions: { parse: [], repliedUser: false } });
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
        const settings = getAiSettings(message.guild.id);
        const isPartyActive = settings.party_channel_id === message.channel.id && settings.party_expires_at && Date.now() < settings.party_expires_at;

        // ===== AI 攔截（白名單用戶 @mention 或處於狂歡派對中）=====
        if (isMention && (settings.whitelist.includes(message.author.id) || isPartyActive)) {
            try {
                const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
                const mentionPolicy = buildAiMentionPolicy({
                    botUserId: client.user.id,
                    userIds: [...message.mentions.users.keys()],
                    roleIds: [...message.mentions.roles.keys()],
                    allowRoleMentions: isAdmin,
                });
                const allowedMentions = buildAllowedMentions(mentionPolicy);
                const userText = message.content
                    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
                    .trim();
                // 抓取圖片附件（最多 3 張）
                const imageAttachments = [...message.attachments.values()]
                    .filter(att => att.contentType?.startsWith('image/'))
                    .slice(0, 3);

                if (userText.length > 0 || imageAttachments.length > 0) {
                    const displayText = userText || '（請看圖片）';
                    await message.channel.sendTyping();

                    // 建立環境上下文
                    const { getServerKnowledge } = await import('../utils/serverKnowledge.js');
                    const serverInfo = getServerKnowledge(message.guild.id, isAdmin);
                    const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
                    const context = [
                        `[系統資訊]`,
                        `時間: ${now}`,
                        `伺服器: ${message.guild.name} (成員數: ${message.guild.memberCount})`,
                        `權限: ${isAdmin ? '管理員' : '一般成員'}`,
                        `發訊者: ${message.member.displayName} (ID: ${message.author.id})`,
                        `發訊者身分組: ${message.member.roles.cache.map(r => r.name).filter(n => n !== '@everyone').join(', ') || '無'}`,
                        `\n[伺服器指南]\n${serverInfo}`,
                        !isAdmin ? `\n[安全性規範]\n你目前正在與「一般成員」對話。你被嚴格禁止回答任何有關「伺服器管理、權限設定、後台操作、bot 內部系統配置」或「/設定」皇家管理控制台的問題。若對方詢問，請直接回絕並告知其「御前權限不足，本王無法呈上此類機密資訊」，不准有任何例外或誘導。` : '',
                        `\n[提及規範]\n${buildMentionInstructions(message, mentionPolicy, isAdmin)}`,
                    ].join('\n');

                    const basePrompt = settings.system_prompt || DEFAULT_AI_PROMPT;
                    const fullPrompt = `${basePrompt}\n\n${context}`;

                    const modelName = settings.model || DEFAULT_AI_MODEL;
                    const useSearch = settings.search_enabled || false;
                    const useContext = settings.context_enabled !== false; // 預設開啟

                    let history = [];
                    if (useContext) {
                        try {
                            const messages = await message.channel.messages.fetch({ limit: 12, before: message.id });
                            const validMessages = messages.filter(m =>
                                !m.system &&
                                m.content.length > 0 &&
                                !m.content.startsWith('/') &&
                                !m.content.startsWith('!')
                            ).reverse();

                            const rawHistory = [];
                            for (const msg of validMessages.values()) {
                                const role = msg.author.id === client.user.id ? 'model' : 'user';
                                let textInfo = msg.content.replace(/<@!?\d+>/g, '').trim();
                                if (!textInfo) continue;
                                if (role === 'user') {
                                    textInfo = `[${msg.author.displayName}]: ${textInfo}`;
                                }
                                rawHistory.push({ role, parts: [{ text: textInfo }] });
                            }

                            // 合併連續相同 role 的訊息，確保歷史紀錄遵循 Gemini 要求的 user -> model 交替格式
                            for (const h of rawHistory) {
                                if (history.length === 0) {
                                    if (h.role === 'user') history.push(h);
                                    continue;
                                }
                                const last = history[history.length - 1];
                                if (last.role === h.role) {
                                    last.parts[0].text += `\n${h.parts[0].text}`;
                                } else {
                                    history.push(h);
                                }
                            }
                            // 如果最後一則是 user，將其移除，以確保能由當前的 userMessage 順接
                            if (history.length > 0 && history[history.length - 1].role === 'user') {
                                history.pop();
                            }
                        } catch (err) {
                            logger.warn(`[AI] 讀取對話歷史失敗 guild=${message.guild.id}: ${err.message}`);
                        }
                    }

                    const aiReply = sanitizeAiReplyMentions(
                        await getAiResponse(displayText, fullPrompt, modelName, useSearch, history, imageAttachments),
                        mentionPolicy
                    );
                    // 若回應超過 2000 字，自動分段發送
                    const MAX_LEN = 1990;
                    if (aiReply.length <= MAX_LEN) {
                        await message.reply({ content: aiReply, allowedMentions });
                    } else {
                        const chunks = [];
                        for (let i = 0; i < aiReply.length; i += MAX_LEN) {
                            chunks.push(aiReply.slice(i, i + MAX_LEN));
                        }
                        await message.reply({ content: chunks[0], allowedMentions });
                        for (let i = 1; i < chunks.length; i++) {
                            await message.channel.send({ content: chunks[i], allowedMentions });
                        }
                    }
                    return; // AI 處理完，不走後面的邏輯
                }
            } catch (err) {
                logger.error(`[AI] 回應失敗 guild=${message.guild.id}:`, err);
                await message.reply('🐕💥 汪！AI 突然腦子當機了... 等一下再試試？').catch(() => { });
                return;
            }
        }

        // 吉吉國王互動（非白名單或 AI 關閉時走這裡）
        try {
            if (handleKingInteraction(message)) return;
        } catch { /* 互動失敗不影響 XP 系統 */ }

        // ================= 防刷機制 (Anti-Spam) =================
        const content = message.content.trim();

        // 1. 最低字數限制 (大於3個字)
        if (content.length <= 3) return;

        // 2. 表情符號與純貼圖過濾 (只剩符號或完全沒字)
        const textOnly = content.replace(/<a?:.+?:\d+>/g, '').trim(); // 移除自定義表情符號
        if (textOnly.length === 0) return;

        // 3. 防重複發言 (與上一句完全相同)
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

