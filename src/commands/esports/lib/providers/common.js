import { load } from 'cheerio';

const REQUEST_TIMEOUT_MS = 10000;

export async function fetchPublicHtml(url, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; GigiKingdomBot/1.0; public stats preview)',
        'accept-language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    if (response.status === 404) return { status: 'not_found' };
    if (response.status === 403 || response.status === 429) return { status: 'blocked' };
    if (!response.ok) return { status: 'unavailable' };

    return { status: 'ok', html: await response.text() };
  } catch (error) {
    if (error?.name === 'AbortError') return { status: 'unavailable' };
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

export function readableDocument(html) {
  const $ = load(String(html || ''));
  $('script, style, noscript').remove();
  return $;
}

export function readableLines(html) {
  const $ = readableDocument(html);
  return $('body')
    .text()
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

export function compactText(html) {
  const $ = readableDocument(html);
  return $('body').text().replace(/\s+/g, ' ').trim();
}
