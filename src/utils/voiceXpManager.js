import { logger } from './logger.js';
import { addXp, getGuildSettings } from './database.js';
import { v2Notice } from './componentsV2.js';
import { UI_COLORS } from './style.js';
import { createJobOverlapGuard } from './jobGuards.js';

const SCAN_INTERVAL = 10 * 60 * 1000; // 10 分鐘
const BASE_XP = 10;
const BOOST_MULTIPLIER = 1.5;
const MAX_TRACKED_SESSIONS = 10_000;
const runScanVoiceChannels = createJobOverlapGuard('VoiceXP', scanVoiceChannels, logger);

let scanInterval = null;
let activeClient = null;
let voiceStateListener = null;
let nowProvider = Date.now;
let clearIntervalProvider = clearInterval;
const voiceSessions = new Map();

function getSessionKey(state) {
    const guildId = state?.guild?.id || state?.member?.guild?.id;
    const userId = state?.id || state?.member?.id;
    return guildId && userId ? `${guildId}:${userId}` : null;
}

function isEligibleVoiceState(state) {
    const guild = state?.guild || state?.member?.guild;
    return Boolean(
        guild
        && state?.channelId
        && !state?.member?.user?.bot
        && state.channelId !== guild.afkChannelId
    );
}

function startTracking(state, now) {
    const key = getSessionKey(state);
    if (!key) return null;

    let session = voiceSessions.get(key);
    if (!session) {
        if (voiceSessions.size >= MAX_TRACKED_SESSIONS) {
            const disconnectedKey = [...voiceSessions].find(([, value]) => value.connectedAt === null)?.[0];
            voiceSessions.delete(disconnectedKey || voiceSessions.keys().next().value);
        }
        session = { accumulatedMs: 0, connectedAt: now, state };
        voiceSessions.set(key, session);
    } else {
        session.connectedAt ??= now;
        session.state = state;
    }
    return session;
}

function accrueSession(session, now) {
    if (session.connectedAt === null) return;
    session.accumulatedMs += Math.max(0, now - session.connectedAt);
    session.connectedAt = now;
}

async function announceLevelUp(state, result) {
    if (!result.leveledUp) return;

    const guild = state.guild || state.member.guild;
    const settings = getGuildSettings(guild.id);
    if (settings.level_up_announcement_enabled === 0) return;

    const channel = guild.systemChannel || state.channel;
    if (channel?.isTextBased()) {
        await channel.send(v2Notice(
            '🐕👑 皇家晉升喜報',
            `恭喜 ${state.member} 在語音頻道修行有成，晉升為 **等級 ${result.newLevel}**！🎉`,
            UI_COLORS.SUCCESS,
            { ephemeral: false, allowedMentions: { parse: [], users: [state.member.id] } }
        )).catch(() => {});
    }
}

async function settleCompletedBlocks(session) {
    let rewardedBlocks = 0;
    while (session.accumulatedMs >= SCAN_INTERVAL) {
        session.accumulatedMs -= SCAN_INTERVAL;
        const state = session.state;
        const guild = state.guild || state.member.guild;
        const isBooster = state.member.premiumSince !== null;
        const amount = isBooster ? Math.floor(BASE_XP * BOOST_MULTIPLIER) : BASE_XP;
        const result = addXp(guild.id, state.id || state.member.id, amount, {
            source: 'voice',
            voiceMinutes: SCAN_INTERVAL / 60_000,
        });
        rewardedBlocks += 1;
        await announceLevelUp(state, result);
    }
    return rewardedBlocks;
}

async function advanceState(state, now) {
    const session = startTracking(state, now);
    if (!session) return 0;
    accrueSession(session, now);
    return settleCompletedBlocks(session);
}

async function handleVoiceStateUpdate(oldState, newState) {
    const now = nowProvider();
    const oldEligible = isEligibleVoiceState(oldState);
    const newEligible = isEligibleVoiceState(newState);

    if (oldEligible) {
        const session = startTracking(oldState, now);
        accrueSession(session, now);
        session.state = oldState;
        if (!newEligible) session.connectedAt = null;
        await settleCompletedBlocks(session);
    }

    if (newEligible) {
        const session = startTracking(newState, now);
        session.state = newState;
        session.connectedAt ??= now;
    }
}

/**
 * 初始化語音經驗值管理員
 * @param {import('discord.js').Client} client 
 */
export function initVoiceXpManager(client, options = {}) {
    if (scanInterval) return false;
    nowProvider = options.now || Date.now;
    clearIntervalProvider = options.clearInterval || clearInterval;
    const setIntervalProvider = options.setInterval || setInterval;
    activeClient = client;
    voiceStateListener = async (oldState, newState) => {
        try {
            await handleVoiceStateUpdate(oldState, newState);
        } catch (error) {
            logger.error('[VoiceXP] 處理語音狀態變更時發生錯誤:', error);
        }
    };
    client.on('voiceStateUpdate', voiceStateListener);

    const now = nowProvider();
    for (const guild of client.guilds.cache.values()) {
        for (const state of guild.voiceStates.cache.values()) {
            if (isEligibleVoiceState(state)) startTracking(state, now);
        }
    }

    logger.info('[VoiceXP] 語音經驗值系統已啟動，掃描間隔：10 分鐘。');

    scanInterval = setIntervalProvider(async () => {
        try {
            await runScanVoiceChannels(client);
        } catch (error) {
            logger.error('[VoiceXP] 掃描語音頻道時發生錯誤:', error);
        }
    }, SCAN_INTERVAL);
    scanInterval?.unref?.();
    return true;
}

export function stopVoiceXpManager() {
    if (!scanInterval) return false;

    clearIntervalProvider(scanInterval);
    activeClient?.off?.('voiceStateUpdate', voiceStateListener);
    if (!activeClient?.off) activeClient?.removeListener?.('voiceStateUpdate', voiceStateListener);
    scanInterval = null;
    activeClient = null;
    voiceStateListener = null;
    nowProvider = Date.now;
    clearIntervalProvider = clearInterval;
    voiceSessions.clear();
    logger.info('[VoiceXP] 語音經驗值系統已停止');
    return true;
}

/**
 * 掃描所有伺服器的語音頻道並發放經驗值
 * @param {import('discord.js').Client} client 
 */
export async function scanVoiceChannels(client) {
    let totalRewarded = 0;
    const now = nowProvider();
    const eligibleKeys = new Set();

    for (const guild of client.guilds.cache.values()) {
        const voiceStates = guild.voiceStates.cache;
        if (voiceStates.size === 0) continue;

        for (const state of voiceStates.values()) {
            if (!isEligibleVoiceState(state)) continue;
            const key = getSessionKey(state);
            eligibleKeys.add(key);
            try {
                totalRewarded += await advanceState(state, now);
            } catch (err) {
                logger.error(`[VoiceXP] 無法為用戶 ${state.id} 發放經驗值:`, err);
            }
        }
    }

    for (const [key, session] of voiceSessions) {
        if (session.connectedAt !== null && !eligibleKeys.has(key)) {
            accrueSession(session, now);
            session.connectedAt = null;
            totalRewarded += await settleCompletedBlocks(session);
        }
    }

    if (totalRewarded > 0) {
        logger.debug(`[VoiceXP] 週期性檢查完成，共結算 ${totalRewarded} 個 10 分鐘區段。`);
    }
}
