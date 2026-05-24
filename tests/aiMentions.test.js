import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildAiMentionPolicy,
    sanitizeAiReplyMentions,
    buildAllowedMentions,
} from '../src/utils/aiMentions.js';

test('AI mention policy excludes the bot and limits role mentions to administrators', () => {
    const memberPolicy = buildAiMentionPolicy({
        botUserId: '100',
        userIds: ['100', '200', '200'],
        roleIds: ['300'],
    });
    const adminPolicy = buildAiMentionPolicy({
        botUserId: '100',
        userIds: ['100', '200'],
        roleIds: ['300', '300'],
        allowRoleMentions: true,
    });

    assert.deepEqual(memberPolicy, { users: ['200'], roles: [] });
    assert.deepEqual(adminPolicy, { users: ['200'], roles: ['300'] });
});

test('AI replies can mention approved targets but cannot create new or broadcast pings', () => {
    const policy = { users: ['200'], roles: ['300'] };
    const reply = sanitizeAiReplyMentions(
        '通知 <@200> <@!999> <@&300> <@&888> @everyone @here',
        policy
    );

    assert.equal(reply.includes('<@200>'), true);
    assert.equal(reply.includes('<@&300>'), true);
    assert.equal(reply.includes('<@!999>'), false);
    assert.equal(reply.includes('<@&888>'), false);
    assert.equal(reply.includes('@everyone'), false);
    assert.equal(reply.includes('@here'), false);
});

test('Discord mention options only parse targets approved for the AI reply', () => {
    assert.deepEqual(
        buildAllowedMentions({ users: ['200'], roles: ['300'] }),
        {
            parse: [],
            users: ['200'],
            roles: ['300'],
            repliedUser: false,
        }
    );
});
