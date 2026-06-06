import assert from 'node:assert';
import test from 'node:test';
import { LimitedMap } from '../src/commands/esports/lib/statsImage.js';
import { cachedStats, clearStatsCache } from '../src/commands/esports/lib/cache.js';
import { fetchSteamAppDetails, clearSteamAppDetailsCacheForTests } from '../src/utils/steamDeals.js';
import { xpMessageCache } from '../src/events/messageCreate.js';

test('Cache Size & Eviction Optimization', async (t) => {
  await t.test('1. LimitedMap should respect limit and execute FIFO eviction', () => {
    const map = new LimitedMap(3);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    assert.strictEqual(map.size, 3);

    // 寫入第 4 個，最早的 'a' 應被刪除
    map.set('d', 4);
    assert.strictEqual(map.size, 3);
    assert.strictEqual(map.has('a'), false);
    assert.strictEqual(map.has('b'), true);
    assert.strictEqual(map.has('c'), true);
    assert.strictEqual(map.has('d'), true);
    
    // 更新既有鍵 'b' 不應淘汰任何鍵
    map.set('b', 20);
    assert.strictEqual(map.size, 3);
    assert.strictEqual(map.get('b'), 20);
  });

  await t.test('2. cachedStats (esports) should limit capacity to 100 and prune expired', async () => {
    clearStatsCache();

    // 塞滿 105 個快取
    for (let i = 1; i <= 105; i++) {
      await cachedStats(`key_${i}`, async () => `val_${i}`);
    }

    let loaderCalls = 0;
    
    // key_1 已被淘汰，所以 loader 應被呼叫
    const val1 = await cachedStats('key_1', async () => {
      loaderCalls++;
      return 'new_val_1';
    });
    assert.strictEqual(loaderCalls, 1, 'key_1 should be evicted and call loader');
    
    // key_105 沒有被淘汰，所以 loader 不會被呼叫
    let loaderCalls2 = 0;
    const val105 = await cachedStats('key_105', async () => {
      loaderCalls2++;
      return 'new_val_105';
    });
    assert.strictEqual(loaderCalls2, 0, 'key_105 should be hit in cache and not call loader');
    assert.strictEqual(val105, 'val_105');
  });

  await t.test('3. steamAppDetailsCache should limit capacity to 100', async () => {
    clearSteamAppDetailsCacheForTests();

    // 使用 Proxy 來 Mock 任何 appId 的 API 回應
    const mockJson = (gameName) => new Proxy({}, {
      get: (target, prop) => ({
        success: true,
        data: { name: `${gameName}_${String(prop)}` }
      })
    });

    const mockFetch = (gameName) => async () => ({
      ok: true,
      json: async () => mockJson(gameName)
    });

    const initialFetch = mockFetch('Mock Game');

    // 寫入 105 個快取
    for (let i = 1; i <= 105; i++) {
      await fetchSteamAppDetails(i, initialFetch);
    }

    // 由於限制 100，現在 cache 中應該只保留最後 100 個 (即 6 ~ 105)
    // 驗證 1~5 已經不見了 (fetchSteamAppDetails(1) 應再次觸發 fetch)
    let fetchCalled = 0;
    const mockFetchRefetched = async () => {
      fetchCalled++;
      return {
        ok: true,
        json: async () => mockJson('Mock Game Refetched')
      };
    };

    const details1 = await fetchSteamAppDetails(1, mockFetchRefetched);
    assert.strictEqual(fetchCalled, 1, 'appId 1 should be evicted and require fetch');
    assert.strictEqual(details1.name, 'Mock Game Refetched_1');

    // 驗證 105 還在快取裡 (不觸發 fetch)
    fetchCalled = 0;
    const details105 = await fetchSteamAppDetails(105, mockFetchRefetched);
    assert.strictEqual(fetchCalled, 0, 'appId 105 should be cached');
    assert.strictEqual(details105.name, 'Mock Game_105');
  });

  await t.test('4. xpMessageCache should enforce limit (10000) and FIFO eviction', () => {
    xpMessageCache.clear();
    assert.strictEqual(xpMessageCache.limit, 10000);
    
    // 快速在 xpMessageCache set 10005 次
    for (let i = 1; i <= 10005; i++) {
      xpMessageCache.set(`user_${i}`, `content_${i}`);
    }

    assert.strictEqual(xpMessageCache.size, 10000);
    // 最早的 5 個應已被 FIFO 淘汰
    assert.strictEqual(xpMessageCache.has('user_1'), false);
    assert.strictEqual(xpMessageCache.has('user_5'), false);
    assert.strictEqual(xpMessageCache.has('user_6'), true);
    assert.strictEqual(xpMessageCache.has('user_10005'), true);
  });
});
