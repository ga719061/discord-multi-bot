import { fetchWithLimit, imageUrlToDataUri } from '../../../utils/imageRendering.js';

const ENCORE_API = 'https://api-v2.encore.moe/api';
const CACHE_LIMIT = 100;
const catalogCache = new Map();
const imageCache = new Map();

export async function resolveWuwaItemImages(records, languageCode, fetchImpl = fetch) {
  const lang = supportedLanguage(languageCode);
  const [characters, weapons] = await Promise.all([
    fetchCatalog(lang, 'character', fetchImpl),
    fetchCatalog(lang, 'weapon', fetchImpl),
  ]);
  const images = new Map();
  await Promise.all(records.map(async (record) => {
    const id = String(record.resourceId);
    const type = String(record.resourceType).toLowerCase();
    const url = type.includes('weapon') || type.includes('武器')
      ? weapons.get(id)
      : characters.get(id);
    if (!url) return;
    const dataUri = await imageUrlToDataUri(url, fetchImpl, {
      width: 112,
      height: 112,
      fit: 'cover',
      timeoutMs: 4000,
      maxBytes: 1024 * 1024,
      cache: imageCache,
    });
    if (dataUri) images.set(id, dataUri);
  }));
  return images;
}

async function fetchCatalog(lang, segment, fetchImpl) {
  const key = `${lang}:${segment}`;
  if (catalogCache.has(key)) return catalogCache.get(key);
  try {
    const response = await fetchWithLimit(`${ENCORE_API}/${lang}/${segment}`, fetchImpl, {
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: 5000,
    });
    if (!response.ok) return new Map();
    const body = await response.json();
    const list = segment === 'character' ? body.roleList : body.weapons;
    const iconKey = segment === 'character' ? 'RoleHeadIcon' : 'Icon';
    const catalog = new Map((Array.isArray(list) ? list : [])
      .filter((item) => item?.Id != null && item?.[iconKey])
      .map((item) => [String(item.Id), item[iconKey]]));
    setLimited(catalogCache, key, catalog);
    return catalog;
  } catch {
    return new Map();
  }
}

function setLimited(cache, key, value) {
  if (cache.size >= CACHE_LIMIT && !cache.has(key)) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

function supportedLanguage(value) {
  const lang = String(value ?? '');
  return new Set(['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'de', 'es', 'fr', 'id', 'pt', 'ru', 'th', 'vi']).has(lang)
    ? lang
    : 'en';
}
