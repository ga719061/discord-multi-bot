const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

export function buildCacheKey(game, playerName, tag, region = '') {
  return [game, region, playerName, tag]
    .map((value) => String(value).trim().toLowerCase())
    .join(':');
}

export async function cachedStats(key, loader, now = Date.now()) {
  const stored = cache.get(key);
  if (stored && stored.expiresAt > now) {
    return stored.value;
  }

  const value = await loader();
  cache.set(key, {
    value,
    expiresAt: now + CACHE_TTL_MS,
  });
  return value;
}

export function clearStatsCache() {
  cache.clear();
}
