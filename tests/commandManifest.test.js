import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommandManifest, validateCommandManifest } from '../scripts/command-manifest.js';

test('command manifest retains /help and excludes stale English commands', async () => {
    const manifest = await buildCommandManifest();
    const names = validateCommandManifest(manifest);

    assert.equal(names.includes('help'), true);
    assert.equal(names.includes('設定'), true);
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
