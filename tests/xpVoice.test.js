import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { afterEach, test } from 'node:test';
import { isEligibleXpMessage } from '../src/events/messageCreate.js';
import { addXp, getUserLevel } from '../src/utils/database.js';
import { initVoiceXpManager, stopVoiceXpManager } from '../src/utils/voiceXpManager.js';
import { cleanupTestDatabase, initTestDatabase } from './helpers/database.js';

function createVoiceFixture() {
    const guild = {
        id: 'guild-1',
        afkChannelId: 'afk',
        systemChannel: null,
        voiceStates: { cache: new Map() },
    };
    const member = {
        id: 'user-1',
        guild,
        premiumSince: null,
        user: { bot: false },
    };
    const activeState = {
        id: member.id,
        guild,
        member,
        channelId: 'voice-1',
        channel: null,
    };
    const inactiveState = {
        ...activeState,
        channelId: null,
    };
    guild.voiceStates.cache.set(member.id, activeState);

    const client = new EventEmitter();
    client.guilds = { cache: new Map([[guild.id, guild]]) };

    let now = 0;
    const timers = [];
    const clearedTimers = [];
    const options = {
        now: () => now,
        setInterval(callback, delay) {
            const timer = { callback, delay, unref() {} };
            timers.push(timer);
            return timer;
        },
        clearInterval(timer) {
            clearedTimers.push(timer);
        },
    };

    return {
        activeState,
        client,
        clearedTimers,
        guild,
        inactiveState,
        options,
        setNow(value) {
            now = value;
        },
        timers,
    };
}

afterEach(() => {
    stopVoiceXpManager();
    cleanupTestDatabase();
});

test('XP eligibility rejects emoji, symbols, custom emoji, stickers, and short content', () => {
    const eligible = (content) => isEligibleXpMessage({ content });

    assert.equal(eligible('😀😀😀😀'), false);
    assert.equal(eligible('👨‍👩‍👧‍👦✨'), false);
    assert.equal(eligible('!!!???'), false);
    assert.equal(eligible('<:party:123456789012345678>'), false);
    assert.equal(eligible('<a:dance:123456789012345678>'), false);
    assert.equal(eligible(''), false);
    assert.equal(isEligibleXpMessage({ content: '', stickers: new Map([['1', {}]]) }), false);
    assert.equal(eligible('abc!'), false);
});

test('XP eligibility preserves meaningful Chinese and English messages', () => {
    assert.equal(isEligibleXpMessage({ content: '你好世界！' }), true);
    assert.equal(isEligibleXpMessage({ content: 'Hi all 😀' }), true);
    assert.equal(isEligibleXpMessage({ content: 'Café time' }), true);
});

test('voice XP is based on accumulated connection time, not scan timing', async () => {
    initTestDatabase('voice-duration');
    const fixture = createVoiceFixture();
    assert.equal(initVoiceXpManager(fixture.client, fixture.options), true);

    fixture.setNow(1_000);
    await fixture.timers[0].callback();
    assert.equal(getUserLevel('guild-1', 'user-1').xp, 0);

    fixture.setNow(10 * 60_000);
    await fixture.timers[0].callback();
    const user = getUserLevel('guild-1', 'user-1');
    assert.equal(user.xp, 10);
    assert.equal(user.total_voice_mins, 10);
});

test('leaving voice preserves the unfinished duration for the next connection', async () => {
    initTestDatabase('voice-remainder');
    const fixture = createVoiceFixture();
    initVoiceXpManager(fixture.client, fixture.options);
    const listener = fixture.client.listeners('voiceStateUpdate')[0];

    fixture.setNow(5 * 60_000);
    fixture.guild.voiceStates.cache.delete('user-1');
    await listener(fixture.activeState, fixture.inactiveState);
    assert.equal(getUserLevel('guild-1', 'user-1').xp, 0);

    fixture.setNow(20 * 60_000);
    fixture.guild.voiceStates.cache.set('user-1', fixture.activeState);
    await listener(fixture.inactiveState, fixture.activeState);

    fixture.setNow(25 * 60_000);
    await fixture.timers[0].callback();
    const user = getUserLevel('guild-1', 'user-1');
    assert.equal(user.xp, 10);
    assert.equal(user.total_voice_mins, 10);
});

test('voice XP does not change the text XP cooldown timestamp', async () => {
    initTestDatabase('voice-cooldown');
    addXp('guild-1', 'user-1', 15);
    const textXpTime = getUserLevel('guild-1', 'user-1').last_xp_time;
    const fixture = createVoiceFixture();
    initVoiceXpManager(fixture.client, fixture.options);

    fixture.setNow(10 * 60_000);
    await fixture.timers[0].callback();

    const user = getUserLevel('guild-1', 'user-1');
    assert.equal(user.last_xp_time, textXpTime);
    assert.equal(user.total_messages, 1);
    assert.equal(user.total_voice_mins, 10);
});

test('voice XP manager removes its listener and interval and can restart', () => {
    initTestDatabase('voice-lifecycle');
    const fixture = createVoiceFixture();

    assert.equal(initVoiceXpManager(fixture.client, fixture.options), true);
    assert.equal(initVoiceXpManager(fixture.client, fixture.options), false);
    assert.equal(fixture.client.listenerCount('voiceStateUpdate'), 1);
    assert.equal(fixture.timers.length, 1);

    assert.equal(stopVoiceXpManager(), true);
    assert.equal(fixture.client.listenerCount('voiceStateUpdate'), 0);
    assert.deepEqual(fixture.clearedTimers, [fixture.timers[0]]);
    assert.equal(stopVoiceXpManager(), false);

    assert.equal(initVoiceXpManager(fixture.client, fixture.options), true);
    assert.equal(fixture.client.listenerCount('voiceStateUpdate'), 1);
    assert.equal(fixture.timers.length, 2);
});
