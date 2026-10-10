import test from 'node:test';
import assert from 'node:assert/strict';
import { createReminderFromDraft, validateReminderDraft } from '../src/commands/general/remind.js';
import { normalizePollDraft, publishPollDraft } from '../src/commands/fun/poll.js';

test('reminder domain validates and persists caller-owned source identity', () => {
    const now = 1_000;
    assert.deepEqual(validateReminderDraft({ content: '  喝水  ', targetTime: 2_000 }, { now }), {
        content: '喝水',
        targetTime: 2_000,
    });
    assert.throws(() => validateReminderDraft({ content: '', targetTime: 2_000 }, { now }), /1 到 500/);
    assert.throws(() => validateReminderDraft({ content: 'x'.repeat(501), targetTime: 2_000 }, { now }), /1 到 500/);
    assert.throws(() => validateReminderDraft({ content: '喝水', targetTime: now }, { now }), /未來時間/);

    const inserts = [];
    const result = createReminderFromDraft({
        guildId: 'guild',
        channelId: 'channel',
        userId: 'user',
        content: '  <@everyone> 喝水  ',
        targetTime: 2_000,
    }, {
        now,
        insertReminder: (...args) => {
            inserts.push(args);
            return { lastInsertRowid: 7 };
        },
    });
    assert.deepEqual(inserts, [[
        'guild',
        'channel',
        'user',
        '<@everyone> 喝水',
        2_000,
    ]]);
    assert.equal(result.lastInsertRowid, 7);
    assert.throws(() => createReminderFromDraft({
        guildId: '', channelId: 'channel', userId: 'user', content: '喝水', targetTime: 2_000,
    }, { now, insertReminder: () => {} }), /來源身份/);
});

test('poll domain normalizes limits and rejects duplicate options', () => {
    assert.deepEqual(normalizePollDraft({
        question: '  今晚玩什麼？ ',
        options: [' Valorant ', ' LoL '],
    }), {
        question: '今晚玩什麼？',
        options: ['Valorant', 'LoL'],
    });
    assert.throws(() => normalizePollDraft({ question: '', options: ['A', 'B'] }), /1 到 150/);
    assert.throws(() => normalizePollDraft({ question: '問題', options: ['A'] }), /2 到 5/);
    assert.throws(() => normalizePollDraft({ question: '問題', options: ['A', 'Ａ'] }), /不可重複/);
    assert.throws(() => normalizePollDraft({ question: '問題', options: ['A', 'x'.repeat(81)] }), /1 到 80/);
});

test('poll publish sends mention-safe payload before inserting the normalized draft', async () => {
    const events = [];
    const statements = [];
    const message = { id: 'message', delete: async () => events.push('delete') };
    const channel = {
        id: 'channel',
        async send(payload) {
            events.push('send');
            assert.deepEqual(payload.allowedMentions, { parse: [] });
            assert.match(JSON.stringify(payload), /<@everyone>/);
            return message;
        },
    };
    const db = {
        prepare(sql) {
            statements.push(sql);
            return { run: (...args) => events.push(['insert', ...args]) };
        },
    };

    const published = await publishPollDraft({
        guildId: 'guild',
        channel,
        creatorId: 'creator',
        draft: {
            question: '  <@everyone> 要玩什麼？ ',
            options: [' Valorant ', ' LoL '],
        },
    }, { db, now: 3_000 });

    assert.equal(published.message, message);
    assert.equal(statements.length, 1);
    assert.equal(events[0], 'send');
    assert.deepEqual(events[1].slice(0, 6), [
        'insert', 'guild', 'channel', 'message', 'creator', '<@everyone> 要玩什麼？',
    ]);
    assert.equal(events.includes('delete'), false);
});

test('poll publish deletes the sent message when persistence fails', async () => {
    let deleted = 0;
    const originalError = new Error('db failed');
    await assert.rejects(
        publishPollDraft({
            guildId: 'guild',
            creatorId: 'creator',
            channel: {
                id: 'channel',
                send: async () => ({ id: 'message', delete: async () => { deleted += 1; } }),
            },
            draft: { question: '問題', options: ['A', 'B'] },
        }, {
            db: { prepare: () => ({ run: () => { throw originalError; } }) },
            now: 3_000,
        }),
        error => error === originalError
    );
    assert.equal(deleted, 1);
});
