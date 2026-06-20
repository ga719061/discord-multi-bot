export const WUWA_HISTORY_VERSION = 1;
export const WUWA_API_ENDPOINT = 'https://gmserver-api.aki-game2.net/gacha/record/query';
export const WUWA_URL_HOSTS = new Set([
  'aki-gm-resources.aki-game.net',
  'aki-gm-resources-oversea.aki-game.net',
]);
export const WUWA_POOL_TYPES = [
  { id: '1', name: '角色活動喚取', hardPity: 80 },
  { id: '2', name: '武器活動喚取', hardPity: 80 },
  { id: '3', name: '角色常駐喚取', hardPity: 80 },
  { id: '4', name: '武器常駐喚取', hardPity: 80 },
  { id: '5', name: '新手喚取', hardPity: 50 },
  { id: '6', name: '新手自選喚取', hardPity: 80 },
  { id: '8', name: '角色新旅喚取', hardPity: 80 },
  { id: '9', name: '武器新旅喚取', hardPity: 80 },
  { id: '10', name: '角色聯動喚取', hardPity: 80 },
  { id: '11', name: '武器聯動喚取', hardPity: 80 },
];

export const WUWA_POOL_BY_ID = new Map(WUWA_POOL_TYPES.map((pool) => [pool.id, pool]));

export function emptyWuwaHistory() {
  return {
    version: WUWA_HISTORY_VERSION,
    pools: Object.fromEntries(WUWA_POOL_TYPES.map((pool) => [pool.id, []])),
  };
}
