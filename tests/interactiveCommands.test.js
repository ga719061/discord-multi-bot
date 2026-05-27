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
    data as giveawayData,
    helpOnly as giveawayHelpOnly,
} from '../src/commands/fun/giveaway.js';
import {
    buildReminderManagerPayload,
    buildReminderModal,
    buildReminderSuccessPayload,
    data as reminderData,
} from '../src/commands/general/remind.js';

function serialize(payload) {
    return JSON.stringify(payload.components.map((component) => component.toJSON()));
}

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
