import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import { countV2Components } from '../src/utils/componentsV2.js';
import {
  buildSteamDealDetailPayload,
  buildSteamDealsPayload,
  buildSteamFreeGamesPayload,
  clearSteamAppDetailsCacheForTests,
  fetchSteamAppDetails,
  fetchSteamJson,
  fetchSteamLimitedFreeGames,
  fetchSteamLimitedFreeGamesSnapshot,
  getSteamFailureMessage,
  isValidSteamDealTime,
} from '../src/utils/steamDeals.js';

function steamSearchResult(id) {
  return `<a data-ds-appid="${id}" data-price-final="0" data-discount="100">` +
    `<img src="https://cdn.example.test/free-${id}.jpg">` +
    `<span class="title">Search Game ${id}</span>` +
    '<div class="discount_original_price">NT$ 500</div></a>';
}

test('isValidSteamDealTime accepts Taiwan daily push time format only', () => {
  assert.equal(isValidSteamDealTime('20:00'), true);
  assert.equal(isValidSteamDealTime('7:00'), false);
  assert.equal(isValidSteamDealTime('24:00'), false);
});

test('fetchSteamJson classifies unavailable and invalid responses', async () => {
  await assert.rejects(
    fetchSteamJson('https://steam.invalid', async () => ({ ok: false, status: 503 })),
    (error) => error.code === 'unavailable'
  );
  await assert.rejects(
    fetchSteamJson('https://steam.invalid', async () => ({ ok: true, json: async () => { throw new Error('bad json'); } })),
    (error) => error.code === 'invalid_data'
  );
});

test('getSteamFailureMessage gives distinct feedback for malformed data', () => {
  assert.match(getSteamFailureMessage({ code: 'invalid_data' }), /資料格式不完整/);
  assert.match(getSteamFailureMessage({ code: 'unavailable' }), /無法連線/);
});

test('buildSteamDealsPayload displays up to ten ranked deal rows with capsule images and detail selector', () => {
  const deals = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    name: `Game ${index + 1}`,
    discount_percent: 50,
    original_price: 50000,
    final_price: 25000,
    header_image: `https://cdn.example.test/header-${index + 1}.jpg`,
    large_capsule_image: `https://cdn.example.test/game-${index + 1}.jpg`,
  }));

  const payload = buildSteamDealsPayload(deals);
  const children = payload.components.flatMap((panel) => panel.toJSON().components);
  const galleries = children.filter((component) => component.type === ComponentType.MediaGallery);
  const actionRow = children.find((component) => component.type === ComponentType.ActionRow);
  const selector = actionRow.components[0];
  const text = JSON.stringify(payload.components.map((panel) => panel.toJSON()));

  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  assert.equal(payload.components.length, 1);
  assert.equal(galleries.length, 10);
  assert.equal(galleries[0].items[0].media.url, 'https://cdn.example.test/header-1.jpg');
  assert.equal(galleries[9].items[0].media.url, 'https://cdn.example.test/header-10.jpg');
  assert.match(text, /吉吉王國・御用特價情報/);
  assert.equal(text.includes('候選'), false);
  assert.equal(text.includes('更多特價'), false);
  assert.match(text, /挑選一款特價遊戲，覲見皇家情報/);
  assert.equal(text.includes('皇家採購'), false);
  assert.equal(selector.custom_id, 'steam_deal_detail');
  assert.equal(selector.options.length, 10);
  assert.equal(countV2Components(payload.components) <= 40, true);
});

test('fetchSteamAppDetails and detail payload provide private interactive game information', async () => {
  clearSteamAppDetailsCacheForTests();
  const details = await fetchSteamAppDetails(42, async () => ({
    ok: true,
    json: async () => ({
      42: {
        success: true,
        data: {
          name: 'Royal Game',
          short_description: 'A delightful discount.',
          header_image: 'https://cdn.example.test/detail.jpg',
          price_overview: {
            discount_percent: 60,
            initial_formatted: 'NT$ 500',
            final_formatted: 'NT$ 200',
          },
          release_date: { date: '2026 年 5 月 24 日' },
          metacritic: { score: 88 },
        },
      },
    }),
  }));
  const payload = buildSteamDealDetailPayload(42, details, { checkedAt: new Date('2026-05-24T09:00:00Z') });
  const components = payload.components[0].toJSON().components;
  const row = components.find((component) => component.type === ComponentType.ActionRow);

  assert.equal((payload.flags & MessageFlags.Ephemeral) !== 0, true);
  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  assert.match(JSON.stringify(components), /Royal Game/);
  assert.match(JSON.stringify(components), /NT\$ 200/);
  assert.equal(row.components[0].url, 'https://store.steampowered.com/app/42/');
});

test('fetchSteamAppDetails reuses fresh cached details for repeated lookups', async () => {
  clearSteamAppDetailsCacheForTests();

  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        777: {
          success: true,
          data: { name: `Cached Game ${calls}` },
        },
      }),
    };
  };

  const first = await fetchSteamAppDetails(777, fetchImpl, { now: 1000 });
  const second = await fetchSteamAppDetails(777, fetchImpl, { now: 2000 });

  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(second.name, 'Cached Game 1');
});

test('fetchSteamLimitedFreeGames keeps only temporary 100 percent free discounts', async () => {
  const html = [
    '<a data-ds-appid="101" data-price-final="0" data-discount="100"><img src="https://cdn.example.test/free.jpg"><span class="title">Limited Free</span><div class="discount_original_price">NT$ 500</div></a>',
    '<a data-ds-appid="102" data-price-final="0" data-discount="0"><img src="https://cdn.example.test/f2p.jpg"><span class="title">Always Free</span></a>',
    '<a data-ds-appid="103" data-price-final="25000" data-discount="50"><img src="https://cdn.example.test/deal.jpg"><span class="title">Half Off</span><div class="discount_original_price">NT$ 500</div></a>',
    '<a data-ds-appid="104" data-price-final="0" data-discount="100"><img src="https://cdn.example.test/no-original.jpg"><span class="title">No Original Price</span></a>',
  ].join('');

  const games = await fetchSteamLimitedFreeGames(10, async () => ({
    ok: true,
    json: async () => ({ results_html: html }),
  }));

  assert.equal(games.length, 1);
  assert.equal(games[0].id, 101);
  assert.equal(games[0].name, 'Limited Free');
  assert.equal(games[0].final_price, 0);
  assert.equal(games[0].original_price, 50000);
});

test('fetchSteamLimitedFreeGamesSnapshot paginates all candidates and verifies them in batches of 50', async () => {
  const candidateIds = Array.from({ length: 52 }, (_, index) => index + 1001);
  const searchStarts = [];
  const browseBatchSizes = [];

  const games = await fetchSteamLimitedFreeGamesSnapshot(async (url) => {
    const requestUrl = new URL(url);
    if (requestUrl.hostname === 'store.steampowered.com') {
      const start = Number(requestUrl.searchParams.get('start'));
      searchStarts.push(start);
      const ids = start === 0 ? candidateIds.slice(0, 50) : candidateIds.slice(50);
      return {
        ok: true,
        json: async () => ({
          total_count: candidateIds.length,
          results_html: ids.map(steamSearchResult).join(''),
        }),
      };
    }

    const input = JSON.parse(requestUrl.searchParams.get('input_json'));
    browseBatchSizes.push(input.ids.length);
    assert.deepEqual(input.context, { language: 'tchinese', country_code: 'TW' });
    assert.equal(input.data_request.include_all_purchase_options, true);
    return {
      ok: true,
      json: async () => ({
        response: {
          store_items: input.ids.map(({ appid }) => ({
            appid,
            name: `Official Game ${appid}`,
            is_free_temporarily: true,
            best_purchase_option: {
              is_free_to_keep: true,
              original_price_in_cents: 50000,
              final_price_in_cents: 0,
              free_to_keep_ends: 2_000_000_000,
            },
          })),
        },
      }),
    };
  }, { now: 1_000_000_000 });

  assert.deepEqual(searchStarts, [0, 50]);
  assert.deepEqual(browseBatchSizes, [50, 2]);
  assert.equal(games.length, 52);
  assert.deepEqual(games[0], {
    id: 1001,
    name: 'Official Game 1001',
    discount_percent: 100,
    final_price: 0,
    original_price: 50000,
    header_image: 'https://cdn.example.test/free-1001.jpg',
    large_capsule_image: 'https://cdn.example.test/free-1001.jpg',
    free_until: 2_000_000_000,
  });
});

test('fetchSteamLimitedFreeGamesSnapshot excludes expired and non-free-to-keep items but keeps unknown deadlines', async () => {
  const statuses = new Map([
    [201, { is_free_temporarily: true, is_free_to_keep: true, free_to_keep_ends: 2_000 }],
    [202, { is_free_temporarily: true, is_free_to_keep: true, free_to_keep_ends: 999 }],
    [203, { is_free_temporarily: false, is_free_to_keep: true, free_to_keep_ends: 2_000 }],
    [204, { is_free_temporarily: true, is_free_to_keep: false, free_to_keep_ends: 2_000 }],
    [205, { is_free_temporarily: true, is_free_to_keep: true }],
  ]);

  const games = await fetchSteamLimitedFreeGamesSnapshot(async (url) => {
    const requestUrl = new URL(url);
    if (requestUrl.hostname === 'store.steampowered.com') {
      return {
        ok: true,
        json: async () => ({
          total_count: statuses.size,
          results_html: [...statuses.keys()].map(steamSearchResult).join(''),
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        response: {
          store_items: [...statuses].map(([appid, status]) => ({
            appid,
            is_free_temporarily: status.is_free_temporarily,
            best_purchase_option: {
              is_free_to_keep: status.is_free_to_keep,
              original_price_in_cents: null,
              free_to_keep_ends: status.free_to_keep_ends,
            },
          })),
        },
      }),
    };
  }, { now: 1_000 });

  assert.deepEqual(games.map((game) => game.id), [201, 205]);
  assert.equal(games[0].original_price, 50000);
  assert.equal(games[0].free_until, 2_000);
  assert.equal(games[1].free_until, null);
});

test('fetchSteamLimitedFreeGamesSnapshot keeps search candidates when Steam browse is unavailable', async () => {
  const games = await fetchSteamLimitedFreeGamesSnapshot(async (url) => {
    const requestUrl = new URL(url);
    if (requestUrl.hostname === 'store.steampowered.com') {
      return {
        ok: true,
        json: async () => ({ total_count: 1, results_html: steamSearchResult(301) }),
      };
    }
    return { ok: false, status: 503 };
  });

  assert.deepEqual(games.map((game) => game.id), [301]);
  assert.equal(games[0].free_until, null);
  assert.equal(games[0].browse_verified, false);
});

test('fetchSteamLimitedFreeGamesSnapshot keeps candidates omitted from a partial browse response', async () => {
  const warnings = [];
  const games = await fetchSteamLimitedFreeGamesSnapshot(async (url) => {
    const requestUrl = new URL(url);
    if (requestUrl.hostname === 'store.steampowered.com') {
      return {
        ok: true,
        json: async () => ({
          total_count: 2,
          results_html: steamSearchResult(401) + steamSearchResult(402),
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        response: {
          store_items: [{
            appid: 401,
            name: 'Verified Game 401',
            is_free_temporarily: true,
            best_purchase_option: {
              is_free_to_keep: true,
              free_to_keep_ends: 2_000_000_000,
            },
          }],
        },
      }),
    };
  }, {
    now: 1_000_000_000,
    logger: { warn: (...args) => warnings.push(args) },
  });

  assert.deepEqual(games.map((game) => game.id), [401, 402]);
  assert.equal(games[0].free_until, 2_000_000_000);
  assert.equal(games[1].free_until, null);
  assert.equal(games[1].browse_verified, false);
  assert.equal(warnings.length, 1);
});

test('fetchSteamLimitedFreeGamesSnapshot keeps and warns about incomplete browse verification', async () => {
  const warnings = [];
  const games = await fetchSteamLimitedFreeGamesSnapshot(async (url) => {
    const requestUrl = new URL(url);
    if (requestUrl.hostname === 'store.steampowered.com') {
      return {
        ok: true,
        json: async () => ({ total_count: 1, results_html: steamSearchResult(501) }),
      };
    }
    return {
      ok: true,
      json: async () => ({ response: { store_items: [{ appid: 501 }] } }),
    };
  }, { logger: { warn: (...args) => warnings.push(args) } });

  assert.deepEqual(games.map((game) => game.id), [501]);
  assert.equal(games[0].browse_verified, false);
  assert.equal(warnings.length, 1);
});

test('fetchSteamLimitedFreeGamesSnapshot rejects non-empty search results that cannot be parsed', async () => {
  await assert.rejects(
    fetchSteamLimitedFreeGamesSnapshot(async () => ({
      ok: true,
      json: async () => ({
        total_count: 1,
        results_html: '<a class="search_result_row"><span>changed markup</span></a>',
      }),
    })),
    (error) => error.name === 'SteamServiceError' && error.code === 'invalid_data'
  );
});

test('buildSteamFreeGamesPayload displays up to ten ranked free-game rows with capsule images and detail selector', () => {
  const games = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    name: `Free Game ${index + 1}`,
    discount_percent: 100,
    original_price: 50000,
    final_price: 0,
    large_capsule_image: `https://cdn.example.test/free-${index + 1}.jpg`,
  }));

  const payload = buildSteamFreeGamesPayload(games);
  const children = payload.components.flatMap((panel) => panel.toJSON().components);
  const galleries = children.filter((component) => component.type === ComponentType.MediaGallery);
  const actionRow = children.find((component) => component.type === ComponentType.ActionRow);
  const selector = actionRow.components[0];
  const text = JSON.stringify(payload.components.map((panel) => panel.toJSON()));

  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  assert.equal(payload.components.length, 1);
  assert.equal(galleries.length, 10);
  assert.equal(galleries[0].items[0].media.url, 'https://cdn.example.test/free-1.jpg');
  assert.equal(galleries[9].items[0].media.url, 'https://cdn.example.test/free-10.jpg');
  assert.match(text, /限時免費/);
  assert.match(text, /https:\/\/store\.steampowered\.com\/app\/1/);
  assert.equal(text.includes('候選'), false);
  assert.equal(selector.custom_id, 'steam_deal_detail');
  assert.equal(selector.options.length, 10);
  assert.equal(countV2Components(payload.components) <= 40, true);
});

test('buildSteamFreeGamesPayload sorts deadlines and displays Taiwan and Discord relative times', () => {
  const later = Math.floor(Date.parse('2026-08-11T04:00:00Z') / 1000);
  const sooner = Math.floor(Date.parse('2026-08-10T04:00:00Z') / 1000);
  const games = [
    { id: 1, name: 'Later', discount_percent: 100, original_price: 50000, final_price: 0, free_until: later },
    { id: 2, name: 'Unknown', discount_percent: 100, original_price: 50000, final_price: 0, free_until: null },
    { id: 3, name: 'Sooner', discount_percent: 100, original_price: 50000, final_price: 0, free_until: sooner },
  ];

  const payload = buildSteamFreeGamesPayload(games, {
    checkedAt: new Date('2026-08-09T04:00:00Z'),
  });
  const children = payload.components[0].toJSON().components;
  const selector = children.find((component) => component.type === ComponentType.ActionRow).components[0];
  const text = JSON.stringify(children);

  assert.deepEqual(selector.options.map((option) => option.value), ['3', '1', '2']);
  assert.match(text, new RegExp(`免費截止：2026/08/10 12:00（台灣時間，<t:${sooner}:R>）`));
  assert.match(text, /免費截止：Steam 未提供截止時間/);
  assert.match(text, /最後檢查 2026-08-09 12:00/);
});

test('buildSteamFreeGamesPayload keeps old content while showing a disabled notice', () => {
  const payload = buildSteamFreeGamesPayload([{
    id: 42,
    name: 'Still Visible',
    discount_percent: 100,
    original_price: 50000,
    final_price: 0,
  }], {
    disabled: true,
  });
  const text = JSON.stringify(payload.components.map((panel) => panel.toJSON()));

  assert.match(text, /Still Visible/);
  assert.match(text, /自動更新已停用/);
  assert.equal(countV2Components(payload.components) <= 40, true);
});

test('buildSteamFreeGamesPayload produces an empty state without an empty select menu', () => {
  const payload = buildSteamFreeGamesPayload([], {
    checkedAt: new Date('2026-08-09T04:00:00Z'),
  });
  const children = payload.components[0].toJSON().components;
  const text = JSON.stringify(children);

  assert.match(text, /目前沒有 Steam 限時免費活動/);
  assert.equal(children.some((component) => component.type === ComponentType.ActionRow), false);
  assert.equal(countV2Components(payload.components) <= 40, true);
});

test('buildSteamFreeGamesPayload labels browse fallback candidates as awaiting verification', () => {
  const payload = buildSteamFreeGamesPayload([{
    id: 77,
    name: 'Fallback Game',
    discount_percent: 100,
    original_price: 50000,
    final_price: 0,
    free_until: null,
    browse_verified: false,
  }]);
  const text = JSON.stringify(payload.components.map((panel) => panel.toJSON()));

  assert.match(text, /永久入庫狀態與截止時間暫時無法由 Steam 複核/);
  assert.match(text, /永久入庫狀態待 Steam 複核/);
});
