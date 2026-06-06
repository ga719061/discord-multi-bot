const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

export function buildCacheKey(game, playerName, tag, region = '') {
  return [game, region, playerName, tag]
    .map((value) => String(value).trim().toLowerCase())
    .join(':');
}

const MAX_CACHE_SIZE = 100;

export async function cachedStats(key, loader, now = Date.now()) {
  // Prune expired entries
  for (const [k, item] of cache.entries()) {
    if (item.expiresAt <= now) {
      cache.delete(k);
    }
  }

  const stored = cache.get(key);
  if (stored && stored.expiresAt > now) {
    return stored.value;
  }

  const value = await loader();

  if (cache.size >= MAX_CACHE_SIZE && !cache.has(key)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    value,
    expiresAt: now + CACHE_TTL_MS,
  });
  return value;
}

export function clearStatsCache() {
  cache.clear();
}
