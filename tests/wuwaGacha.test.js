import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import {
  bindWuwaAccount,
  closeDatabaseForTests,
  deleteWuwaAccount,
  getDb,
  getWuwaAccount,
  initDatabase,
  updateWuwaAccount,
} from '../src/utils/database.js';
import { initTestDatabase, cleanupTestDatabase } from './helpers/database.js';
import { emptyWuwaHistory } from '../src/commands/gacha/lib/constants.js';
import {
  mergeOrderedRecords,
  mergeWuwaHistories,
  normalizeHistory,
} from '../src/commands/gacha/lib/history.js';
import {
  maskWuwaUid,
  parseWuwaConveneUrl,
  parseWuwaJson,
  readWuwaImport,
} from '../src/commands/gacha/lib/importer.js';
import { calculateWuwaPoolStats } from '../src/commands/gacha/lib/statistics.js';
import { fetchWuwaHistory } from '../src/commands/gacha/lib/provider.js';
import { buildWuwaSvg, renderWuwaCard } from '../src/commands/gacha/lib/image.js';
import { resolveWuwaItemImages } from '../src/commands/gacha/lib/itemAssets.js';
import {
  buildHomePayload,
  buildImportModal,
  buildPoolSelectionPayload,
  data,
  refreshWuwaHome,
} from '../src/commands/gacha/wuwa.js';
import { buildWuwaCardPayload } from '../src/commands/gacha/lib/reply.js';
import { countV2Components } from '../src/utils/componentsV2.js';

const fixtureUrl = new URL('./fixtures/wuwa-history.json', import.meta.url);

test.afterEach(() => cleanupTestDatabase());

test('wuwa account database enforces one Discord user and one UID', async () => {
  initTestDatabase('wuwa-account');
  const parsed = parseWuwaJson(await fs.readFile(fixtureUrl, 'utf8'));
  bindWuwaAccount('discord-1', {
    playerUid: parsed.playerUid,
    region: parsed.region,
    languageCode: parsed.languageCode,
    history: parsed.history,
    updatedAt: 1000,
  });

  const stored = getWuwaAccount('discord-1');
  assert.equal(stored.player_uid, '900123456');
  assert.equal(JSON.parse(stored.history_json).version, 1);
  assert.throws(() => bindWuwaAccount('discord-2', {
    playerUid: parsed.playerUid,
    history: parsed.history,
    updatedAt: 1001,
  }), /UNIQUE constraint failed/);

  updateWuwaAccount('discord-1', {
    playerUid: parsed.playerUid,
    history: parsed.history,
    languageCode: 'en',
    updatedAt: 2000,
  });
  assert.equal(getWuwaAccount('discord-1').language_code, 'en');
  assert.equal(deleteWuwaAccount('discord-1').changes, 1);
  assert.equal(getWuwaAccount('discord-1'), null);
});

test('wuwa table is added when initializing an existing database', () => {
  const { dbPath } = initTestDatabase('wuwa-migration');
  getDb().exec('DROP TABLE wuwa_accounts');
  closeDatabaseForTests();
  initDatabase({ dbPath });
  const db = new Database(dbPath, { readonly: true });
  const columns = db.pragma('table_info(wuwa_accounts)').map((column) => column.name);
  db.close();
  assert.deepEqual(columns, [
    'discord_user_id',
    'player_uid',
    'region',
    'language_code',
    'history_json',
    'bound_at',
    'updated_at',
  ]);
});

test('convene URL parser accepts only global official hosts and keeps credentials transient', () => {
  const valid = 'https://aki-gm-resources-oversea.aki-game.net/aki/gacha/index.html#/record?svr_id=srv&player_id=900123456&record_id=secret&resources_id=pool&lang=zh-Hant';
  const parsed = parseWuwaConveneUrl(valid);
  assert.equal(parsed.credential.playerId, '900123456');
  assert.equal(parsed.credential.recordId, 'secret');
  assert.equal(parsed.region, 'SEA');
  assert.throws(
    () => parseWuwaConveneUrl(valid.replace('aki-game.net', 'evil.example')),
    /僅支援/
  );
  assert.throws(
    () => parseWuwaConveneUrl(valid.replace('aki-game.net', 'aki-game.com')),
    /僅支援/
  );
  assert.equal(JSON.stringify(parsed).includes(valid), false);
  assert.equal(maskWuwaUid('900123456'), '900****56');
});

test('JSON fixture imports supported history and rejects unknown schemas or oversized attachments', async () => {
  const raw = await fs.readFile(fixtureUrl, 'utf8');
  const parsed = parseWuwaJson(raw);
  assert.equal(parsed.playerUid, '900123456');
  assert.equal(parsed.history.pools['1'].length, 2);
  assert.throws(() => parseWuwaJson('{"hello":"world"}'), /不支援/);

  await assert.rejects(() => readWuwaImport({
    attachment: {
      url: 'https://cdn.discord.test/file.json',
      name: 'file.json',
      contentType: 'application/json',
      size: 2 * 1024 * 1024 + 1,
    },
  }), /2 MB/);
});

test('ordered merge preserves same-second duplicates and old history', () => {
  const base = [
    record('newest', '2026-06-03 10:00:00', 3, '1'),
    record('same', '2026-06-02 10:00:00', 3, '2'),
    record('same', '2026-06-02 10:00:00', 3, '2'),
    record('old', '2026-06-01 10:00:00', 5, '3'),
  ];
  const fresh = [
    record('brand-new', '2026-06-04 10:00:00', 4, '4'),
    ...base.slice(0, 3),
  ];
  const merged = mergeOrderedRecords(fresh, base);
  assert.equal(merged.length, 5);
  assert.equal(merged[0].name, 'brand-new');
  assert.equal(merged.filter((item) => item.name === 'same').length, 2);
  assert.equal(merged.at(-1).name, 'old');
});

test('statistics calculate pity, rarity and five-star intervals', () => {
  const history = emptyWuwaHistory();
  history.pools['1'] = [
    record('three-now', '2026-06-06 10:00:00', 3, '6'),
    record('four-now', '2026-06-05 10:00:00', 4, '5'),
    record('five-new', '2026-06-04 10:00:00', 5, '4'),
    record('three-old', '2026-06-03 10:00:00', 3, '3'),
    record('five-old', '2026-06-02 10:00:00', 5, '2'),
  ];
  const stats = calculateWuwaPoolStats(history, '1');
  assert.equal(stats.total, 5);
  assert.equal(stats.pity5, 2);
  assert.equal(stats.pity4, 1);
  assert.equal(stats.counts[5], 2);
  assert.deepEqual(stats.fiveStars.map((item) => item.pulls), [2, 1]);
  assert.equal(stats.averagePity, 1.5);
});

test('provider fetches all pools, reports partial failures and never follows user hosts', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (calls.length === 2) return new Response(JSON.stringify({ code: -1, message: 'failed' }), { status: 200 });
    return new Response(JSON.stringify({
      code: 0,
      message: 'ok',
      data: [record('item', '2026-06-01 10:00:00', 3, String(calls.length))],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await fetchWuwaHistory({
    playerId: '900123456',
    cardPoolId: 'pool-secret',
    serverId: 'server-secret',
    recordId: 'record-secret',
    languageCode: 'zh-Hant',
  }, { fetchImpl, sleep: async () => {} });

  assert.equal(calls.length, 10);
  assert.equal(new Set(calls.map((call) => call.url)).size, 1);
  assert.equal(calls[0].url, 'https://gmserver-api.aki-game2.net/gacha/record/query');
  assert.equal(result.failedPools.length, 1);
  assert.equal(result.history.pools['1'].length, 1);
});

test('expired credentials fail without exposing credential values', async () => {
  const credential = {
    playerId: '900123456',
    cardPoolId: 'pool-secret',
    serverId: 'server-secret',
    recordId: 'record-secret',
    languageCode: 'zh-Hant',
  };
  await assert.rejects(
    () => fetchWuwaHistory(credential, {
      fetchImpl: async () => new Response(JSON.stringify({ code: -1, message: 'expired' }), { status: 200 }),
      sleep: async () => {},
    }),
    (error) => {
      assert.equal(error.code, 'credential_expired');
      const message = String(error.message);
      assert.equal(message.includes(credential.recordId), false);
      assert.equal(message.includes(credential.serverId), false);
      assert.equal(message.includes(credential.cardPoolId), false);
      return true;
    }
  );
});

test('image renderer outputs readable SVG and non-empty PNG without thumbnails', async () => {
  const imported = parseWuwaJson(await fs.readFile(fixtureUrl, 'utf8'));
  const account = {
    playerUid: imported.playerUid,
    region: imported.region,
    languageCode: imported.languageCode,
    history: imported.history,
    updatedAt: Date.UTC(2026, 5, 19),
  };
  const stats = calculateWuwaPoolStats(account.history, '1');
  const svg = buildWuwaSvg(account, stats, new Map(), {
    backgroundImage: 'data:image/png;base64,background',
  });
  assert.match(svg, /width="1600" height="900"/);
  assert.match(svg, /皇家喚取卷宗/);
  assert.match(svg, /data-role="wuwa-background"/);
  assert.match(svg, /900\*{4}56/);
  assert.equal(svg.includes('record-secret'), false);

  const rendered = await renderWuwaCard(account, '1', {
    fetchImpl: async () => new Response('', { status: 503 }),
  });
  assert.equal(rendered.filename, 'wuwa-1-card.png');
  assert.ok(rendered.buffer.length > 10_000);
});

test('five-star timeline centers one to five portraits below its heading', () => {
  const history = emptyWuwaHistory();
  history.pools['1'] = Array.from({ length: 5 }, (_, index) =>
    record(`five-${index}`, `2026-06-${String(10 - index).padStart(2, '0')} 10:00:00`, 5, String(index + 1))
  );
  const stats = calculateWuwaPoolStats(history, '1');
  const svg = buildWuwaSvg({
    playerUid: '900123456',
    region: 'SEA',
    languageCode: 'zh-Hant',
    history,
    updatedAt: Date.UTC(2026, 5, 19),
  }, stats);

  assert.match(svg, /<path d="M826 638 H1506"/);
  assert.match(svg, /cx="914" cy="692"/);
  assert.match(svg, /cx="1418" cy="692"/);
  assert.match(svg, /x="914" y="764" text-anchor="middle"/);
});

test('item thumbnails load from the fixed public catalog and remain optional', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.endsWith('/zh-Hant/character')) {
      return new Response(JSON.stringify({
        roleList: [{ Id: 1107, RoleHeadIcon: 'https://api.encore.moe/test-assets/1107.png' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (href.endsWith('/zh-Hant/weapon')) {
      return new Response(JSON.stringify({ weapons: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (href === 'https://api.encore.moe/test-assets/1107.png') {
      return new Response(png, {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': String(png.length) },
      });
    }
    return new Response('', { status: 404 });
  };
  const images = await resolveWuwaItemImages([
    record('五星角色甲', '2026-06-18 12:00:00', 5, '1107'),
  ], 'zh-Hant', fetchImpl);
  assert.match(images.get('1107'), /^data:image\/png;base64,/);
});

test('item thumbnails retry a transient image failure on the next render', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  let imageCalls = 0;
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.endsWith('/ja/character')) {
      return new Response(JSON.stringify({
        roleList: [{ Id: 1503, RoleHeadIcon: 'https://api.encore.moe/test-assets/verina.png' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (href.endsWith('/ja/weapon')) {
      return new Response(JSON.stringify({ weapons: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (href === 'https://api.encore.moe/test-assets/verina.png') {
      imageCalls += 1;
      return imageCalls === 1
        ? new Response('', { status: 503 })
        : new Response(png, {
          status: 200,
          headers: { 'content-type': 'image/png', 'content-length': String(png.length) },
        });
    }
    return new Response('', { status: 404 });
  };
  const records = [record('維里奈', '2026-06-18 12:00:00', 5, '1503')];

  const first = await resolveWuwaItemImages(records, 'ja', fetchImpl);
  const second = await resolveWuwaItemImages(records, 'ja', fetchImpl);

  assert.equal(first.has('1503'), false);
  assert.match(second.get('1503'), /^data:image\/png;base64,/);
  assert.equal(imageCalls, 2);
});

test('item catalog caches are isolated between fetch implementations', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const createFetch = (suffix) => async (url) => {
    const href = String(url);
    if (href.endsWith('/ko/character')) {
      return new Response(JSON.stringify({
        roleList: [{ Id: 1503, RoleHeadIcon: `https://api.encore.moe/test-assets/${suffix}.png` }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (href.endsWith('/ko/weapon')) {
      return new Response(JSON.stringify({ weapons: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (href === `https://api.encore.moe/test-assets/${suffix}.png`) {
      return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });
    }
    return new Response('', { status: 404 });
  };
  const records = [record('維里奈', '2026-06-18 12:00:00', 5, '1503')];

  const first = await resolveWuwaItemImages(records, 'ko', createFetch('first'));
  const second = await resolveWuwaItemImages(records, 'ko', createFetch('second'));

  assert.match(first.get('1503'), /^data:image\/png;base64,/);
  assert.match(second.get('1503'), /^data:image\/png;base64,/);
});

test('item thumbnails reject catalog image hosts outside the fixed allowlist', async () => {
  let untrustedImageCalls = 0;
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.endsWith('/th/character')) {
      return new Response(JSON.stringify({
        roleList: [{ Id: 1503, RoleHeadIcon: 'https://untrusted.invalid/verina.png' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (href.endsWith('/th/weapon')) {
      return new Response(JSON.stringify({ weapons: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (href === 'https://untrusted.invalid/verina.png') untrustedImageCalls += 1;
    return new Response('', { status: 404 });
  };

  const images = await resolveWuwaItemImages([
    record('維里奈', '2026-06-18 12:00:00', 5, '1503'),
  ], 'th', fetchImpl);

  assert.equal(images.size, 0);
  assert.equal(untrustedImageCalls, 0);
});

test('item thumbnail downloads reject redirects from the approved host', async () => {
  let imageRequestOptions;
  const fetchImpl = async (url, options) => {
    const href = String(url);
    if (href.endsWith('/vi/character')) {
      return new Response(JSON.stringify({
        roleList: [{ Id: 1503, RoleHeadIcon: 'https://api.encore.moe/resource/verina.webp' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (href.endsWith('/vi/weapon')) {
      return new Response(JSON.stringify({ weapons: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (href === 'https://api.encore.moe/resource/verina.webp') {
      imageRequestOptions = options;
      return new Response('', { status: 302, headers: { location: 'https://untrusted.invalid/verina.webp' } });
    }
    return new Response('', { status: 404 });
  };

  await resolveWuwaItemImages([
    record('維里奈', '2026-06-18 12:00:00', 5, '1503'),
  ], 'vi', fetchImpl);

  assert.equal(imageRequestOptions.redirect, 'error');
});

test('item thumbnails fall back across catalogs for localized weapon type names', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.endsWith('/id/character')) {
      return new Response(JSON.stringify({ roleList: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (href.endsWith('/id/weapon')) {
      return new Response(JSON.stringify({
        weapons: [{ Id: 21010015, Icon: 'https://api.encore.moe/test-assets/weapon.png' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (href === 'https://api.encore.moe/test-assets/weapon.png') {
      return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });
    }
    return new Response('', { status: 404 });
  };

  const images = await resolveWuwaItemImages([{
    ...record('五星武器', '2026-06-18 12:00:00', 5, '21010015'),
    resourceType: '무기',
  }], 'id', fetchImpl);

  assert.match(images.get('21010015'), /^data:image\/png;base64,/);
});

test('Discord command exposes safe modal and component layouts', () => {
  assert.equal(data.toJSON().name, '鳴潮抽卡');
  const modal = buildImportModal('session', false).toJSON();
  assert.match(JSON.stringify(modal), /wuwa_json/);
  assert.match(JSON.stringify(modal), /max_length":4000/);

  const home = buildHomePayload('user', null);
  const selection = buildPoolSelectionPayload('session');
  assert.ok(countV2Components(home.components) <= 40);
  assert.ok(countV2Components(selection.components) <= 40);
  const homeJson = JSON.stringify(home.components.map((item) => item.toJSON()));
  assert.match(homeJson, /Windows PowerShell/);
  assert.match(homeJson, /iwr -UseBasicParsing/);
  assert.match(homeJson, /c46dbadc006ed0d2c3f3a20b06b448a45475d32b/);
  assert.match(homeJson, /查看 PowerShell 腳本/);
  assert.match(homeJson, /```ansi/);
  assert.match(stripAnsi(homeJson), /\[帳號\] 尚未綁定/);
  assert.match(stripAnsi(homeJson), /\[UID\] 尚無資料/);
  assert.match(JSON.stringify(modal), /複製 PowerShell 指令/);
  const selectionJson = JSON.stringify(selection.components.map((item) => item.toJSON()));
  assert.match(selectionJson, /角色聯動喚取/);
  assert.match(selectionJson, /```ansi/);
  assert.match(stripAnsi(selectionJson), /\[卡池\] 共 \d+ 類/);
  assert.match(stripAnsi(selectionJson), /\[狀態\] 等待選擇/);
});

test('WuWa result card summarizes masked account and pool before the image', () => {
  const history = emptyWuwaHistory();
  history.pools['1'] = [record('五星角色甲', '2026-06-18 12:00:00', 5, '1107')];
  const payload = buildWuwaCardPayload({
    filename: 'wuwa-1-card.png',
    attachment: Buffer.from('image'),
  }, {
    playerUid: '900123456',
    history,
    updatedAt: 2000,
    recordId: 'record-secret',
    serverId: 'server-secret',
    cardPoolId: 'pool-secret',
    credentialUrl: 'https://credential.example.test/?recordId=record-secret',
  }, '1', {
    ephemeral: true,
    publishCustomId: 'wuwa_publish:session:1',
  });
  const json = JSON.stringify(payload.components.map((item) => item.toJSON()));

  assert.match(json, /900\*{4}56/);
  assert.match(json, /角色活動喚取/);
  assert.match(json, /```ansi/);
  assert.match(stripAnsi(json), /\[帳號\] 已綁定/);
  assert.match(stripAnsi(json), /\[UID\] 900\*{4}56/);
  assert.match(stripAnsi(json), /\[卡池\] 角色活動喚取/);
  assert.match(stripAnsi(json), /\[紀錄\] 1 筆/);
  assert.match(json, /attachment:\/\/wuwa-1-card\.png/);
  assert.match(json, /喚取統計圖片，共 1 筆紀錄/);
  assert.match(json, /發布至目前頻道/);
  assert.equal(json.includes('record-secret'), false);
  assert.equal(json.includes('server-secret'), false);
  assert.equal(json.includes('pool-secret'), false);
  assert.equal(json.includes('credential.example.test'), false);
  assert.equal((payload.flags & MessageFlags.Ephemeral) !== 0, true);
  assert.ok(countV2Components(payload.components) <= 40);
});

test('active WuWa session redraws the private home after bind, update and unbind', async () => {
  initTestDatabase('wuwa-home-refresh');
  const edits = [];
  const interaction = {
    editReply: async (payload) => edits.push(payload),
  };
  const account = {
    playerUid: '900123456',
    region: 'SEA',
    languageCode: 'zh-Hant',
    history: emptyWuwaHistory(),
    updatedAt: 1000,
  };

  bindWuwaAccount('user', account);
  assert.equal(await refreshWuwaHome(interaction, 'user'), true);
  let home = serializeComponents(edits.at(-1));
  assert.match(JSON.stringify(home), /900\*{4}56/);
  assert.equal(findCustomId(home, 'wuwa:user:bind').disabled, true);
  assert.equal(findCustomId(home, 'wuwa:user:query').disabled, false);
  assert.equal(findCustomId(home, 'wuwa:user:update').disabled, false);
  assert.equal(findCustomId(home, 'wuwa:user:unbind').disabled, false);

  updateWuwaAccount('user', { ...account, updatedAt: 2000 });
  await refreshWuwaHome(interaction, 'user');
  home = serializeComponents(edits.at(-1));
  assert.match(JSON.stringify(home), /<t:2:R>/);

  deleteWuwaAccount('user');
  await refreshWuwaHome(interaction, 'user');
  home = serializeComponents(edits.at(-1));
  assert.equal(findCustomId(home, 'wuwa:user:bind').disabled, false);
  assert.equal(findCustomId(home, 'wuwa:user:query').disabled, true);
  assert.equal(findCustomId(home, 'wuwa:user:update').disabled, true);
  assert.equal(findCustomId(home, 'wuwa:user:unbind').disabled, true);

  const editCount = edits.length;
  assert.equal(await refreshWuwaHome(interaction, 'user', () => false), false);
  assert.equal(edits.length, editCount);
});

test('history merge validates versioned storage', async () => {
  const parsed = parseWuwaJson(await fs.readFile(fixtureUrl, 'utf8'));
  const normalized = normalizeHistory(parsed.history);
  const merged = mergeWuwaHistories(normalized, normalized);
  assert.equal(merged.added, 0);
  assert.equal(merged.history.pools['1'].length, 2);
});

function record(name, time, qualityLevel, resourceId) {
  return {
    resourceId,
    qualityLevel,
    resourceType: qualityLevel === 5 ? '角色' : '武器',
    cardPoolType: '1',
    name,
    count: 1,
    time,
    languageCode: 'zh-Hant',
  };
}

function serializeComponents(payload) {
  return payload.components.map((component) => component.toJSON());
}

function stripAnsi(text) {
  return text
    .replace(/\\u001b\[[0-9;]*m/g, '')
    .replace(/\u001b\[[0-9;]*m/g, '');
}

function findCustomId(value, customId) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCustomId(item, customId);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  if (value.custom_id === customId) return value;
  return findCustomId(Object.values(value), customId);
}
