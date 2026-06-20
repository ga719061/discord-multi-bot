import { WUWA_POOL_BY_ID } from './constants.js';

export function calculateWuwaPoolStats(history, poolId) {
  const pool = WUWA_POOL_BY_ID.get(String(poolId));
  if (!pool) throw new Error('不支援的卡池類型。');
  const records = history.pools[String(poolId)] ?? [];
  const counts = { 3: 0, 4: 0, 5: 0 };
  for (const record of records) counts[record.qualityLevel] += 1;

  const pity5 = pullsSince(records, 5);
  const pity4 = pullsSince(records, 4);
  const fiveStars = fiveStarHistory(records);
  const averagePity = fiveStars.length
    ? fiveStars.reduce((sum, item) => sum + item.pulls, 0) / fiveStars.length
    : null;

  return {
    pool,
    total: records.length,
    counts,
    pity5,
    pity4,
    remaining5: Math.max(0, pool.hardPity - pity5),
    averagePity,
    fiveStars,
  };
}

function pullsSince(records, rank) {
  const index = records.findIndex((record) => record.qualityLevel >= rank);
  return index < 0 ? records.length : index;
}

function fiveStarHistory(records) {
  const chronological = [...records].reverse();
  const results = [];
  let pulls = 0;
  for (const record of chronological) {
    pulls += 1;
    if (record.qualityLevel === 5) {
      results.push({ ...record, pulls });
      pulls = 0;
    }
  }
  return results.reverse();
}
