import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import {
    buildPollOptionCountPayload,
    buildPollOptionsModal,
    buildPollQuestionModal,
    data as pollData,
    helpOnly as pollHelpOnly,
} from '../src/commands/fun/poll.js';
import {
    buildGiveawayErrorPayload,
    buildGiveawayModal,
    buildGiveawayPayload,
    data as giveawayData,
    helpOnly as giveawayHelpOnly,
} from '../src/commands/fun/giveaway.js';
import {
    buildReminderManagerPayload,
    buildReminderModal,
    buildReminderSuccessPayload,
    data as reminderData,
} from '../src/commands/general/remind.js';
import { execute as patKing, helpOnly as patHelpOnly } from '../src/commands/fun/pat.js';
import { hugUser, helpOnly as hugHelpOnly } from '../src/commands/fun/hug.js';
import { feedKing, foodChoices, helpOnly as feedHelpOnly } from '../src/commands/fun/feed.js';
import { helpOnly as statsHelpOnly } from '../src/commands/esports/stats.js';
import { helpOnly as wuwaHelpOnly } from '../src/commands/gacha/wuwa.js';

function serialize(payload) {
    return JSON.stringify(payload.components.map((component) => component.toJSON()));
}

test('games and simple entertainment remain available through help without slash registration', () => {
    for (const helpOnly of [patHelpOnly, hugHelpOnly, feedHelpOnly, statsHelpOnly, wuwaHelpOnly]) {
        assert.equal(helpOnly, true);
    }
});

test('entertainment helpers preserve king, friend and food interactions without slash options', async () => {
    let payload;
    const interaction = {
        user: { toString: () => '<@viewer>' },
        client: { user: { id: 'king' } },
        async reply(reply) { payload = reply; },
    };
    await patKing(interaction);
    assert.match(serialize(payload), /摸摸吉吉國王/);
    await hugUser(interaction);
    assert.match(serialize(payload), /抱抱吉吉國王/);
    await hugUser(interaction, { id: 'friend', toString: () => '<@friend>' });
    assert.match(serialize(payload), /吃醋了/);
    assert.match(serialize(payload), /<@friend>/);
    await hugUser(interaction, { id: 'king' });
    assert.match(serialize(payload), /抱抱吉吉國王/);
    assert.equal(foodChoices.length, 8);
    for (const food of foodChoices) {
        await feedKing(interaction, food.value);
        assert.match(serialize(payload), /餵食吉吉國王/);
    }
    await assert.rejects(feedKing(interaction, '__proto__'), /不支援的食物/);
});

test('interactive public commands open without legacy slash parameters', () => {
    assert.equal(pollHelpOnly, true);
    assert.equal(giveawayHelpOnly, true);
    assert.equal(pollData.toJSON().options?.length ?? 0, 0);
    assert.equal(giveawayData.toJSON().options?.length ?? 0, 0);
    assert.equal(reminderData.toJSON().options?.length ?? 0, 0);
    assert.match(JSON.stringify(buildPollQuestionModal('poll').toJSON()), /question/);
    assert.match(JSON.stringify(buildGiveawayModal('draw').toJSON()), /prize/);
    assert.match(JSON.stringify(buildReminderModal('clock').toJSON()), /content/);
});

test('poll composer preserves two to five option creation through a second modal', () => {
    const selector = buildPollOptionCountPayload('poll', '今晚玩什麼？');
    const selectorText = serialize(selector);

    assert.equal((selector.flags & MessageFlags.Ephemeral) !== 0, true);
    assert.match(selectorText, /2 個選項/);
    assert.match(selectorText, /5 個選項/);
    assert.equal(buildPollOptionsModal('poll', 2).toJSON().components.length, 2);
    assert.equal(buildPollOptionsModal('poll', 5).toJSON().components.length, 5);
    assert.notEqual(
        buildPollOptionsModal('poll', 3, 'first').toJSON().custom_id,
        buildPollOptionsModal('poll', 3, 'second').toJSON().custom_id
    );
    assert.match(serialize(buildPollOptionCountPayload('poll', '議題', true)), /建立流程已逾時/);
});

test('giveaway invalid input response supports rebuilding the modal', () => {
    const error = buildGiveawayErrorPayload('draw');
    const text = serialize(error);

    assert.equal((error.flags & MessageFlags.Ephemeral) !== 0, true);
    assert.match(text, /重新建立抽獎/);
    assert.match(text, /giveaway:draw:retry/);
});

test('giveaway public card displays the creator without broad mentions', () => {
    const payload = buildGiveawayPayload('Steam 禮物卡', 60, 1, Date.now() + 60_000, {
        creatorId: 'creator123',
        creatorName: '吉吉國王',
    });
    const text = serialize(payload);

    assert.match(text, /發起子民/);
    assert.match(text, /吉吉國王/);
    assert.equal(text.includes('<@creator123>'), false);
    assert.equal(payload.allowedMentions.parse.length, 0);
});

test('reminder success and manager views provide creation and deletion controls', () => {
    const success = buildReminderSuccessPayload('clock', '喝水', Date.now() + 60_000);
    const manager = buildReminderManagerPayload('clock', [
        { id: 7, content: '喝水', target_time: Date.now() + 60_000 },
    ]);
    const components = manager.components[0].toJSON().components;
    const select = components
        .filter((component) => component.type === ComponentType.ActionRow)
        .flatMap((row) => row.components)
        .find((component) => component.type === ComponentType.StringSelect);

    assert.match(serialize(success), /新增提醒/);
    assert.match(serialize(success), /管理我的提醒/);
    assert.equal(select.custom_id, 'reminder:clock:delete');
    assert.match(serialize(manager), /提醒 #7/);
    assert.match(serialize(buildReminderManagerPayload('clock', [], true)), /管理頁已逾時/);
});
