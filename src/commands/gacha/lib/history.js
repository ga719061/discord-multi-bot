import { emptyWuwaHistory, WUWA_HISTORY_VERSION, WUWA_POOL_BY_ID } from './constants.js';

export function normalizeHistory(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('抽卡紀錄格式無效。');
  const history = emptyWuwaHistory();
  const pools = raw.version === WUWA_HISTORY_VERSION ? raw.pools : raw.banners;
  if (!pools || typeof pools !== 'object') throw new Error('抽卡紀錄缺少卡池資料。');

  for (const [poolId, records] of Object.entries(pools)) {
    if (!WUWA_POOL_BY_ID.has(String(poolId)) || !Array.isArray(records)) continue;
    history.pools[String(poolId)] = records
      .map((record) => normalizeRecord(record, String(poolId)))
      .sort((a, b) => b.time.localeCompare(a.time));
  }
  return history;
}

export function mergeWuwaHistories(existingRaw, freshRaw) {
  const existing = normalizeHistory(existingRaw);
  const fresh = normalizeHistory(freshRaw);
  const history = emptyWuwaHistory();
  let added = 0;

  for (const poolId of WUWA_POOL_BY_ID.keys()) {
    const before = existing.pools[poolId];
    const merged = mergeOrderedRecords(fresh.pools[poolId], before);
    history.pools[poolId] = merged;
    added += Math.max(0, merged.length - before.length);
  }
  return { history, added };
}

export function mergeOrderedRecords(fresh, existing) {
  if (existing.length === 0) return [...fresh];
  if (fresh.length === 0) return [...existing];

  const anchorLength = Math.min(3, existing.length);
  for (let length = anchorLength; length >= 1; length -= 1) {
    const start = findAlignment(fresh, existing, length);
    if (start >= 0) return [...fresh.slice(0, start), ...existing];
  }

  return mergeWithoutAnchor(fresh, existing);
}

export function recordFingerprint(record) {
  return [
    record.time,
    record.resourceId,
    record.qualityLevel,
    record.count,
  ].join('|');
}

function normalizeRecord(record, poolId) {
  const qualityLevel = Number(record.qualityLevel ?? record.quality_level);
  const resourceId = String(record.resourceId ?? record.resource_id ?? '');
  const name = String(record.name ?? '').trim();
  const time = normalizeTime(record.time);
  if (!name || !time || ![3, 4, 5].includes(qualityLevel)) {
    throw new Error('抽卡紀錄包含無效項目。');
  }
  return {
    resourceId,
    qualityLevel,
    resourceType: String(record.resourceType ?? record.resource_type ?? '未知'),
    cardPoolType: poolId,
    name,
    count: Number(record.count ?? 1) || 1,
    time,
    languageCode: String(record.languageCode ?? record.language_code ?? ''),
  };
}

function normalizeTime(value) {
  const raw = String(value ?? '').trim().replace('T', ' ').replace(/Z$/, '');
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? raw : '';
}

function findAlignment(fresh, existing, length) {
  for (let start = 0; start <= fresh.length - length; start += 1) {
    let matches = true;
    for (let offset = 0; offset < length; offset += 1) {
      if (recordFingerprint(fresh[start + offset]) !== recordFingerprint(existing[offset])) {
        matches = false;
        break;
      }
    }
    if (matches) return start;
  }
  return -1;
}

function mergeWithoutAnchor(fresh, existing) {
  const maxCounts = new Map();
  for (const source of [fresh, existing]) {
    const counts = new Map();
    for (const record of source) {
      const key = recordFingerprint(record);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of counts) {
      maxCounts.set(key, Math.max(maxCounts.get(key) ?? 0, count));
    }
  }

  const emitted = new Map();
  return [...fresh, ...existing]
    .map((record, index) => ({ record, index }))
    .sort((a, b) => b.record.time.localeCompare(a.record.time) || a.index - b.index)
    .filter(({ record }) => {
      const key = recordFingerprint(record);
      const used = emitted.get(key) ?? 0;
      if (used >= maxCounts.get(key)) return false;
      emitted.set(key, used + 1);
      return true;
    })
    .map(({ record }) => record);
}
