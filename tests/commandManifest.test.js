import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommandManifest, validateCommandManifest } from '../scripts/command-manifest.js';

test('command manifest retains /help and excludes stale English commands', async () => {
    const manifest = await buildCommandManifest();
    const names = validateCommandManifest(manifest);

    assert.equal(names.includes('help'), true);
    assert.equal(names.includes('設定'), true);
    assert.equal(names.includes('投票'), false);
    assert.equal(names.includes('抽獎'), false);
    assert.equal(names.includes('智慧登入'), false);
    assert.equal(names.includes('智慧設定'), false);
    assert.equal(names.includes('設定紀錄'), false);
    assert.equal(names.includes('設定歡迎'), false);
    assert.equal(names.includes('設定等級系統'), false);
    assert.equal(names.includes('設定特價推播'), false);
    assert.equal(names.includes('自助身分組'), false);
    assert.equal(names.includes('反應身分組'), false);
    assert.equal(names.includes('伺服器資訊'), false);
    assert.equal(names.includes('機器人狀態'), false);
    assert.equal(names.includes('發布公告'), false);
    assert.equal(names.includes('查身家'), false);
    assert.equal(names.includes('volume'), false);
    assert.equal(names.includes('stop'), false);
    assert.equal(names.includes('shuffle'), false);
    assert.deepEqual(names.filter((name) => /^[a-z0-9_-]+$/i.test(name)), ['help']);
});

test('public manifest keeps compact entries and exposes music shortcuts', async () => {
    const manifest = await buildCommandManifest();
    const names = validateCommandManifest(manifest);

    assert.deepEqual([...names].sort(), [
        'help', '幫助', '設定', '延遲', '提醒', '每日一汪', '占卜',
        '等級', '排行榜', '特價查詢', '音樂', '點播', '播放器',
    ].sort());

    const play = manifest.find((command) => command.name === '點播');
    assert.deepEqual(play.options.map((option) => [option.name, option.type, option.required ?? false]), [
        ['連結', 3, false],
    ]);
    const player = manifest.find((command) => command.name === '播放器');
    assert.deepEqual(player.options.map((option) => option.name), [
        '現在播放', '佇列', '暫停', '繼續', '下一首', '循環', '隨機', '停止',
    ]);
    assert.equal(player.options.every((option) => option.type === 1), true);
    const loop = player.options.find((option) => option.name === '循環');
    assert.equal(loop.options.length, 1);
    assert.equal(loop.options[0].name, '模式');
    assert.equal(loop.options[0].type, 3);
    assert.equal(loop.options[0].required, true);
    assert.deepEqual(loop.options[0].choices.map((choice) => choice.value), ['off', 'track', 'queue']);
});

test('command manifest rejects duplicate and unsupported English command names', () => {
    assert.throws(
        () => validateCommandManifest([{ name: '幫助' }, { name: '幫助' }]),
        /指令名稱重複/
    );
    assert.throws(
        () => validateCommandManifest([{ name: 'help' }, { name: 'volume' }]),
        /已停用指令/
    );
    assert.throws(
        () => validateCommandManifest([{ name: 'help' }, { name: 'play' }]),
        /英文指令入口僅允許/
    );
});

test('logging member event does not import the bot entrypoint', () => {
    const source = fs.readFileSync('src/events/logging/memberLog.js', 'utf8');

    assert.equal(source.includes('../../bot.js'), false);
    assert.match(source, /utils\/inviteCache\.js/);
});
