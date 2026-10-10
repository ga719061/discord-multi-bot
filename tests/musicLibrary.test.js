import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import {
  MusicLibraryClient,
  MusicError,
  getMusicConfiguration,
  normalizeMusicTrack,
  MUSIC_REQUEST_TIMEOUT_MS,
  MUSIC_CUE_REQUEST_TIMEOUT_MS,
  MUSIC_COVER_TIMEOUT_MS,
  MUSIC_COVER_MAX_BYTES,
} from '../src/utils/musicLibrary.js';

const BASE_URL = 'http://music.example.test:8480';
const EMAIL = 'bot@example.test';
const PASSWORD = 'fixture-password-never-log';
const ID = '0123456789abcdef0123456789abcdef';
const TRACK = {
  source: 'nas',
  id: ID,
  title: '測試歌曲',
  artist: '測試歌手',
  album: '測試專輯',
  duration: 123.5,
  size: 1024,
  mime: 'audio/flac',
  isCueTrack: false,
  trackNumber: null,
};

function jsonResponse(value, options = {}) {
  return new Response(JSON.stringify(value), {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
}

function loginResponse(session = 'fixture-session') {
  const headers = new Headers({ 'content-type': 'application/json' });
  headers.append('set-cookie', 'music_csrf=fixture-csrf; Path=/; SameSite=Lax');
  headers.append('set-cookie', `music_session=${session}; HttpOnly; Path=/; SameSite=Lax`);
  return new Response(JSON.stringify({ user: { id: 1 }, csrfToken: 'fixture-csrf' }), { headers });
}

function createClient(fetchImpl, options = {}) {
  return new MusicLibraryClient({ baseUrl: BASE_URL, email: EMAIL, password: PASSWORD, fetchImpl, ...options });
}

function header(options, name) {
  return new Headers(options.headers).get(name);
}

function isSafeMusicError(error) {
  assert.ok(error instanceof MusicError);
  const visible = `${error.message} ${error.stack} ${JSON.stringify(error)}`;
  for (const sensitive of [EMAIL, PASSWORD, BASE_URL, 'provider-private-detail', 'fixture-session']) {
    assert.equal(visible.includes(sensitive), false, `error leaked ${sensitive}`);
  }
  return true;
}

test('music configuration only requires the service origin and optional FFmpeg path', () => {
  assert.deepEqual(getMusicConfiguration({ MUSIC_API_BASE_URL: BASE_URL }), { baseUrl: BASE_URL, nasConfigured: true, ffmpegPath: 'ffmpeg', ytdlpPath: 'yt-dlp' });
  assert.deepEqual(getMusicConfiguration({ MUSIC_API_BASE_URL: BASE_URL, MUSIC_FFMPEG_PATH: '/usr/bin/ffmpeg' }), {
    baseUrl: BASE_URL, nasConfigured: true, ffmpegPath: '/usr/bin/ffmpeg', ytdlpPath: 'yt-dlp',
  });
});

test('configuration never reads legacy credentials or the guild allowlist', () => {
  const env = { MUSIC_API_BASE_URL: BASE_URL };
  for (const key of ['MUSIC_API_EMAIL', 'MUSIC_API_PASSWORD', 'MUSIC_ALLOWED_GUILD_IDS']) {
    Object.defineProperty(env, key, { get() { throw new Error(`unexpected legacy setting: ${key}`); } });
  }
  assert.deepEqual(getMusicConfiguration(env), { baseUrl: BASE_URL, nasConfigured: true, ffmpegPath: 'ffmpeg', ytdlpPath: 'yt-dlp' });
  assert.deepEqual(getMusicConfiguration({
    MUSIC_API_BASE_URL: BASE_URL, MUSIC_API_EMAIL: EMAIL, MUSIC_API_PASSWORD: PASSWORD, MUSIC_ALLOWED_GUILD_IDS: 'invalid',
  }), { baseUrl: BASE_URL, nasConfigured: true, ffmpegPath: 'ffmpeg', ytdlpPath: 'yt-dlp' });
});

test('missing or unsafe NAS origins disable NAS while retaining YouTube configuration', () => {
  for (const baseUrl of [undefined, '', '   ', 'file:///library', 'ftp://music.example.test',
    'http://user:password@music.example.test', `${BASE_URL}/api`, `${BASE_URL}?key=private`, `${BASE_URL}#private`]) {
    assert.deepEqual(getMusicConfiguration({ MUSIC_API_BASE_URL: baseUrl, MUSIC_YTDLP_PATH: '/usr/bin/yt-dlp' }), {
      baseUrl: null, nasConfigured: false, ffmpegPath: 'ffmpeg', ytdlpPath: '/usr/bin/yt-dlp',
    });
    assert.throws(() => createClient(fetch, { baseUrl }), error => {
      assert.equal(error.code, 'MUSIC_CONFIG');
      assert.equal(error.message.includes('服務位址'), true);
      return isSafeMusicError(error);
    });
  }
});

test('client requires credentials from the private login flow', () => {
  for (const credentials of [{}, { email: EMAIL }, { password: PASSWORD }, { email: '  ', password: PASSWORD },
    { email: EMAIL, password: 42 }, { email: {}, password: PASSWORD }]) {
    assert.throws(() => new MusicLibraryClient({ baseUrl: BASE_URL, ...credentials }), error => {
      assert.equal(error.code, 'MUSIC_LOGIN');
      assert.match(error.message, /私人音樂面板/);
      return isSafeMusicError(error);
    });
  }
});

test('track normalization accepts backend UUIDs and drops paths and external URLs', () => {
  const track = normalizeMusicTrack({
    ...TRACK,
    relpath: 'private/music.flac',
    path: '/library/private/music.flac',
    streamUrl: 'https://third-party.example.test/steal',
    cover: '/api/library/media/cover',
    arbitrary: 'provider-private-detail',
  });
  assert.deepEqual(track, TRACK);
  const canonical = '01234567-89ab-cdef-0123-456789abcdef';
  assert.equal(normalizeMusicTrack({ ...TRACK, id: canonical }).id, canonical);
  for (const id of ['', '../private', `${ID}/stream`, 'https://third-party.example.test', 42, null]) {
    assert.throws(() => normalizeMusicTrack({ ...TRACK, id }), (error) => {
      assert.equal(error.code, 'MUSIC_RESPONSE');
      return isSafeMusicError(error);
    });
  }
});

test('CUE metadata preserves only a strict flag and bounded track number, never source paths or offsets', () => {
  const cue = normalizeMusicTrack({
    ...TRACK, isCueTrack: true, trackNumber: 2,
    sourcePath: '/library/private/album.flac', cuePath: '/library/private/album.cue',
    start: 125.75, end: 360, streamUrl: 'https://third-party.example.test/steal',
  });
  assert.deepEqual(cue, { ...TRACK, isCueTrack: true, trackNumber: 2 });
  for (const trackNumber of [0, 100, -1, 1.5, '2', null, undefined]) {
    assert.equal(normalizeMusicTrack({ ...TRACK, isCueTrack: 'true', trackNumber }).trackNumber, null);
    assert.equal(normalizeMusicTrack({ ...TRACK, isCueTrack: 'true', trackNumber }).isCueTrack, false);
  }
  for (const trackNumber of [1, 99]) {
    assert.equal(normalizeMusicTrack({ ...TRACK, trackNumber }).trackNumber, trackNumber);
  }
});

test('stream header timeout defaults stay bounded at 8 seconds ordinary and 60 seconds CUE', () => {
  const client = createClient(async () => { throw new Error('unexpected request'); });
  try {
    assert.equal(MUSIC_REQUEST_TIMEOUT_MS, 8000);
    assert.equal(MUSIC_CUE_REQUEST_TIMEOUT_MS, 60_000);
    assert.equal(client.requestTimeoutMs, 8000);
    assert.equal(client.cueRequestTimeoutMs, 60_000);
    for (const timeout of [0, -1, Infinity, NaN, '60000', 60_001]) {
      assert.throws(() => createClient(fetch, { cueRequestTimeoutMs: timeout }), error => error.code === 'MUSIC_CONFIG');
    }
  } finally { client.close(); }
});

function pendingHeaders(options = {}) {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let request;
  const client = createClient((_url, options) => new Promise((_resolve, reject) => {
    request = options;
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    options.signal.addEventListener('abort', abort, { once: true });
    if (options.signal.aborted) abort();
    started();
  }), options);
  client.cookie = 'music_session=fixture-session';
  return { client, ready, getSignal: () => request.signal };
}

for (const [isCueTrack, timeoutMs] of [[false, 8000], [true, 60_000]]) {
  test(`${isCueTrack ? 'CUE' : 'ordinary'} stream expires at its own header deadline`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { client, ready, getSignal } = pendingHeaders();
    try {
      const failed = assert.rejects(client.openStream(ID, { isCueTrack }), isSafeMusicError);
      await ready;
      t.mock.timers.tick(timeoutMs - 1);
      assert.equal(getSignal().aborted, false);
      t.mock.timers.tick(1);
      assert.equal(getSignal().aborted, true);
      await failed;
    } finally { client.close(); }
  });
}

test('CUE header preparation cancels immediately on caller abort instead of waiting 60 seconds', async () => {
  const { client, ready, getSignal } = pendingHeaders();
  const controller = new AbortController();
  try {
    const failed = assert.rejects(client.openStream(ID, { isCueTrack: true, signal: controller.signal }), error => {
      assert.equal(error.code, 'MUSIC_ABORTED');
      return isSafeMusicError(error);
    });
    await ready;
    controller.abort();
    assert.equal(getSignal().aborted, true);
    await failed;
  } finally { client.close(); }
});

test('CUE header timeout can be shortened independently without changing JSON timeout', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const client = createClient((_url, options) => new Promise((_resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    started();
  }), { cueRequestTimeoutMs: 25 });
  client.cookie = 'music_session=fixture-session';
  try {
    assert.equal(client.requestTimeoutMs, 8000);
    const failed = assert.rejects(client.openStream(ID, { isCueTrack: true }), isSafeMusicError);
    await ready;
    t.mock.timers.tick(24);
    assert.equal(signal.aborted, false);
    t.mock.timers.tick(1);
    await failed;
    assert.equal(signal.aborted, true);
  } finally { client.close(); }
});

test('JSON calls keep their 8-second deadline independently from CUE preparation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { client, ready, getSignal } = pendingHeaders({ cueRequestTimeoutMs: 25 });
  try {
    const failed = assert.rejects(client.search(), isSafeMusicError);
    await ready;
    t.mock.timers.tick(7999);
    assert.equal(getSignal().aborted, false);
    t.mock.timers.tick(1);
    assert.equal(getSignal().aborted, true);
    await failed;
  } finally { client.close(); }
});

test('search logs in using JSON credentials and forwards only the session cookie to fixed API paths', async () => {
  const requests = [];
  const client = createClient(async (url, options) => {
    requests.push({ url: String(url), options });
    if (new URL(url).pathname === '/api/auth/login') return loginResponse();
    return jsonResponse({ tracks: [{ ...TRACK, streamUrl: 'https://third-party.example.test/steal' }] });
  });
  try {
    assert.deepEqual(await client.search('歌手 & genre/歌曲'), [TRACK]);
    assert.equal(requests.length, 2);
    const login = requests[0];
    assert.equal(login.url, `${BASE_URL}/api/auth/login`);
    assert.equal(login.options.method, 'POST');
    assert.match(header(login.options, 'content-type'), /^application\/json/);
    assert.deepEqual(JSON.parse(login.options.body), { email: EMAIL, password: PASSWORD });

    const search = requests[1];
    const endpoint = new URL(search.url);
    assert.equal(endpoint.origin, BASE_URL);
    assert.equal(endpoint.pathname, '/api/library/search');
    assert.equal(endpoint.searchParams.get('q'), '歌手 & genre/歌曲');
    assert.equal(endpoint.searchParams.get('limit'), '100');
    assert.equal(header(search.options, 'cookie'), 'music_session=fixture-session');
    assert.equal(search.options.method || 'GET', 'GET');
    for (const request of requests) assert.equal(request.options.redirect, 'error');
  } finally {
    client.close();
  }
});

test('concurrent searches share one login request', async () => {
  let loginCount = 0;
  let releaseLogin;
  const loginGate = new Promise((resolve) => { releaseLogin = resolve; });
  const client = createClient(async (url) => {
    if (new URL(url).pathname === '/api/auth/login') {
      loginCount += 1;
      await loginGate;
      return loginResponse();
    }
    return jsonResponse({ tracks: [TRACK] });
  });
  try {
    const results = [client.search('one'), client.search('two'), client.search('three')];
    await Promise.resolve();
    releaseLogin();
    assert.deepEqual(await Promise.all(results), [[TRACK], [TRACK], [TRACK]]);
    assert.equal(loginCount, 1);
  } finally {
    releaseLogin();
    client.close();
  }
});

test('HTTP 401 renews the session once and retries with the new cookie', async () => {
  let loginCount = 0;
  const cookies = [];
  const client = createClient(async (url, options) => {
    if (new URL(url).pathname === '/api/auth/login') return loginResponse(`session-${++loginCount}`);
    cookies.push(header(options, 'cookie'));
    return cookies.length === 1
      ? jsonResponse({ detail: 'provider-private-detail' }, { status: 401 })
      : jsonResponse({ tracks: [TRACK] });
  });
  try {
    assert.deepEqual(await client.search(), [TRACK]);
    assert.equal(loginCount, 2);
    assert.deepEqual(cookies, ['music_session=session-1', 'music_session=session-2']);
  } finally {
    client.close();
  }
});

test('persistent HTTP 401 stops after one renewal without exposing provider data', async () => {
  let loginCount = 0;
  let requestCount = 0;
  const client = createClient(async (url) => {
    if (new URL(url).pathname === '/api/auth/login') return loginResponse(`session-${++loginCount}`);
    requestCount += 1;
    return jsonResponse({ detail: `provider-private-detail ${PASSWORD}` }, { status: 401 });
  });
  try {
    await assert.rejects(client.search(), isSafeMusicError);
    assert.equal(loginCount, 2);
    assert.equal(requestCount, 2);
  } finally {
    client.close();
  }
});

test('login requires a music_session Set-Cookie header', async () => {
  const client = createClient(async () => jsonResponse({ user: { id: 1 }, csrfToken: 'csrf-only' }));
  try {
    await assert.rejects(client.search(), isSafeMusicError);
  } finally {
    client.close();
  }
});

test('getTrack uses the fixed media route and rejects invalid IDs before any request', async () => {
  const requests = [];
  const client = createClient(async (url) => {
    requests.push(String(url));
    return new URL(url).pathname === '/api/auth/login' ? loginResponse() : jsonResponse(TRACK);
  });
  try {
    for (const id of ['../auth/login', `${ID}?url=https://third-party.example.test`, 'https://third-party.example.test']) {
      await assert.rejects(client.getTrack(id), isSafeMusicError);
      await assert.rejects(client.openStream(id), isSafeMusicError);
    }
    assert.equal(requests.length, 0);
    assert.deepEqual(await client.getTrack(ID), TRACK);
    assert.equal(requests[1], `${BASE_URL}/api/library/media/${ID}`);
  } finally {
    client.close();
  }
});

test('redirect responses are rejected without sending cookies to a different origin', async () => {
  const requests = [];
  const client = createClient(async (url, options) => {
    requests.push({ url: String(url), options });
    if (new URL(url).pathname === '/api/auth/login') return loginResponse();
    return new Response(null, { status: 302, headers: { location: 'https://third-party.example.test/steal' } });
  });
  try {
    await assert.rejects(client.search(), isSafeMusicError);
    assert.equal(requests.length, 2);
    for (const request of requests) {
      assert.equal(new URL(request.url).origin, BASE_URL);
      assert.equal(request.options.redirect, 'error');
    }
  } finally {
    client.close();
  }
});

test('search rejects malformed response shape and JSON larger than 1 MB', async () => {
  for (const payload of [{ tracks: 'provider-private-detail' }, { tracks: [null] }, { tracks: [], padding: 'x'.repeat(1024 * 1024) }]) {
    const client = createClient(async (url) => new URL(url).pathname === '/api/auth/login' ? loginResponse() : jsonResponse(payload));
    try {
      await assert.rejects(client.search(), isSafeMusicError);
    } finally {
      client.close();
    }
  }
});

test('network errors are converted to safe MusicError messages', async () => {
  const client = createClient(async () => {
    throw new Error(`provider-private-detail ${PASSWORD} ${BASE_URL}`);
  });
  try {
    await assert.rejects(client.search(), isSafeMusicError);
  } finally {
    client.close();
  }
});

test('openStream returns readable original audio and ignores upstream track URLs', async () => {
  const requests = [];
  const audio = Buffer.from('fixture-audio-bytes');
  const client = createClient(async (url, options) => {
    requests.push({ url: String(url), options });
    if (new URL(url).pathname === '/api/auth/login') return loginResponse();
    return new Response(audio, { headers: { 'content-type': 'audio/flac', 'content-length': String(audio.length) } });
  });
  try {
    const stream = await client.openStream(ID);
    assert.ok(stream instanceof Readable);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), audio);
    assert.equal(requests[1].url, `${BASE_URL}/api/library/media/${ID}/stream`);
    assert.equal(header(requests[1].options, 'cookie'), 'music_session=fixture-session');
    assert.equal(requests[1].options.redirect, 'error');
  } finally {
    client.close();
  }
});

test('fixed media streams accept the backend octet-stream MIME fallback for decoder input', async () => {
  const requests = [];
  const audio = Buffer.from('ID3-fixture-audio-bytes');
  const client = createClient(async (url, options) => {
    requests.push({ url: String(url), options });
    if (new URL(url).pathname === '/api/auth/login') return loginResponse();
    assert.equal(String(url), `${BASE_URL}/api/library/media/${ID}/stream`);
    return new Response(audio, {
      headers: { 'content-type': 'application/octet-stream', 'content-length': String(audio.length) },
    });
  });
  try {
    const stream = await client.openStream(ID);
    assert.ok(stream instanceof Readable);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), audio);
    assert.equal(requests.length, 2);
    for (const request of requests) {
      assert.equal(new URL(request.url).origin, BASE_URL);
      assert.equal(request.options.redirect, 'error');
    }
    assert.equal(header(requests[1].options, 'cookie'), 'music_session=fixture-session');
  } finally {
    client.close();
  }
});

test('openStream rejects HTML MIME and Content-Length above 512 MB', async () => {
  for (const headers of [
    { 'content-type': 'text/html' },
    { 'content-type': 'audio/flac', 'content-length': String(512 * 1024 * 1024 + 1) },
  ]) {
    const client = createClient(async (url) => new URL(url).pathname === '/api/auth/login'
      ? loginResponse()
      : new Response('provider-private-detail', { headers }));
    try {
      await assert.rejects(client.openStream(ID), isSafeMusicError);
    } finally {
      client.close();
    }
  }
});

test('openStream enforces 512 MB while reading without trusting Content-Length', { timeout: 5000 }, async () => {
  const chunk = new Uint8Array(8 * 1024 * 1024);
  let emitted = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (emitted++ < 70) controller.enqueue(chunk);
      else controller.error(new Error('fixture stream continued beyond the limit'));
    },
    cancel() { cancelled = true; },
  });
  const client = createClient(async (url) => new URL(url).pathname === '/api/auth/login'
    ? loginResponse()
    : new Response(body, { headers: { 'content-type': 'audio/flac' } }));
  try {
    const stream = await client.openStream(ID);
    let receivedBytes = 0;
    await assert.rejects(async () => {
      for await (const data of stream) receivedBytes += data.length;
    }, isSafeMusicError);
    assert.ok(receivedBytes <= 512 * 1024 * 1024);
    assert.equal(cancelled, true);
  } finally {
    client.close();
  }
});

function blockingStreamFetch(signals) {
  return async (url, options) => {
    if (new URL(url).pathname === '/api/auth/login') return loginResponse();
    signals.push(options.signal);
    const body = new ReadableStream({
      start(controller) {
        const abort = () => controller.error(new DOMException('Aborted', 'AbortError'));
        if (options.signal.aborted) abort();
        else options.signal.addEventListener('abort', abort, { once: true });
      },
    });
    return new Response(body, { headers: { 'content-type': 'audio/mpeg' } });
  };
}

test('caller abort stops an active stream request and releases its readable', { timeout: 2000 }, async () => {
  const signals = [];
  const client = createClient(blockingStreamFetch(signals));
  const controller = new AbortController();
  try {
    const stream = await client.openStream(ID, { signal: controller.signal });
    const reading = (async () => { for await (const _chunk of stream) { /* consume */ } })();
    const rejected = assert.rejects(reading);
    controller.abort();
    await rejected;
    assert.equal(signals[0].aborted, true);
    assert.equal(stream.destroyed, true);
  } finally {
    client.close();
  }
});

test('close aborts all active stream requests', { timeout: 2000 }, async () => {
  const signals = [];
  const client = createClient(blockingStreamFetch(signals));
  try {
    const streams = await Promise.all([client.openStream(ID), client.openStream(ID)]);
    const rejected = streams.map((stream) => assert.rejects(async () => {
      for await (const _chunk of stream) { /* consume */ }
    }));
    client.close();
    await Promise.all(rejected);
    assert.equal(signals.length, 2);
    assert.ok(signals.every((signal) => signal.aborted));
    assert.ok(streams.every((stream) => stream.destroyed));
  } finally {
    client.close();
  }
});

test('close permanently rejects further operations without sending requests', async () => {
  let requestCount = 0;
  const client = createClient(async (url) => {
    requestCount += 1;
    return new URL(url).pathname === '/api/auth/login' ? loginResponse() : jsonResponse({ tracks: [TRACK] });
  });
  assert.deepEqual(await client.search(), [TRACK]);
  client.close();
  assert.equal(client.email, null);
  assert.equal(client.password, null);
  assert.equal(client.cookie, null);
  const before = requestCount;
  await assert.rejects(client.search(), isSafeMusicError);
  await assert.rejects(client.getTrack(ID), isSafeMusicError);
  await assert.rejects(client.openStream(ID), isSafeMusicError);
  assert.equal(requestCount, before);
});

test('close clears credentials and aborts a pending private login', async () => {
  let requestSignal;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const client = createClient((_url, options) => new Promise((_resolve, reject) => {
    requestSignal = options.signal;
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    started();
  }));
  const rejected = assert.rejects(client.login(), error => {
    assert.equal(error.code, 'MUSIC_ABORTED');
    return isSafeMusicError(error);
  });
  await ready;
  client.close();
  assert.equal(requestSignal.aborted, true);
  assert.equal(client.email, null);
  assert.equal(client.password, null);
  assert.equal(client.cookie, null);
  await rejected;
  assert.equal(client.loginPromise, null);
});

test('a late login response after logout cannot restore the session cookie', async () => {
  let release;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const client = createClient(() => new Promise(resolve => {
    release = () => resolve(loginResponse());
    started();
  }));
  const rejected = assert.rejects(client.login(), error => {
    assert.equal(error.code, 'MUSIC_ABORTED');
    return isSafeMusicError(error);
  });
  await ready;
  client.close();
  release();
  await rejected;
  assert.equal(client.email, null);
  assert.equal(client.password, null);
  assert.equal(client.cookie, null);
});

test('close aborts a pending authenticated search as well as active streams', async () => {
  const { client, ready, getSignal } = pendingHeaders();
  const rejected = assert.rejects(client.search(), error => {
    assert.equal(error.code, 'MUSIC_ABORTED');
    return isSafeMusicError(error);
  });
  await ready;
  client.close();
  assert.equal(getSignal().aborted, true);
  await rejected;
  assert.equal(client.email, null);
  assert.equal(client.password, null);
  assert.equal(client.cookie, null);
});

test('rejected credentials only prompt private re-login without exposing the provider response', async () => {
  const client = createClient(async () => jsonResponse({ detail: `${EMAIL} ${PASSWORD} provider-private-detail` }, { status: 403 }));
  try {
    await assert.rejects(client.login(), error => {
      assert.equal(error.code, 'MUSIC_AUTH');
      assert.match(error.message, /重新登入/);
      assert.match(error.message, /帳號已核准/);
      return isSafeMusicError(error);
    });
  } finally { client.close(); }
});

function coverResponse(buffer, mime = 'image/png', headers = {}) {
  return new Response(buffer, { headers: { 'content-type': mime, ...headers } });
}

async function syntheticCover(format = 'png', width = 800, height = 400) {
  return sharp({ create: { width, height, channels: 3, background: '#b08d57' } })[format]().toBuffer();
}

test('cover requests use the authenticated fixed ID route and return a bounded WebP attachment', async () => {
  for (const [format, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
    const image = await syntheticCover(format);
    const requests = [];
    const client = createClient(async (url, options) => {
      requests.push({ url: String(url), options });
      return new URL(url).pathname === '/api/auth/login' ? loginResponse() : coverResponse(image, mime);
    });
    try {
      const result = await client.getCover(ID);
      assert.equal(result.name, 'cover.webp');
      assert.ok(Buffer.isBuffer(result.buffer));
      const metadata = await sharp(result.buffer).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, 512);
      assert.equal(metadata.height, 256);
      assert.equal(requests[1].url, `${BASE_URL}/api/library/media/${ID}/cover`);
      assert.equal(header(requests[1].options, 'cookie'), 'music_session=fixture-session');
      assert.ok(requests.every(({ options }) => options.redirect === 'error'));
    } finally { client.close(); }
  }
});

test('CUE cover uses its own virtual media ID and never consumes an upstream cover URL', async () => {
  const cueId = '01234567-89ab-cdef-0123-456789abcdef';
  const image = await syntheticCover('png', 20, 20);
  const paths = [];
  const client = createClient(async (url) => {
    paths.push(String(url));
    return new URL(url).pathname === '/api/auth/login' ? loginResponse() : coverResponse(image);
  });
  try {
    const track = normalizeMusicTrack({ ...TRACK, id: cueId, isCueTrack: true, trackNumber: 2,
      cover: 'https://third-party.example.test/steal', sourcePath: 'private/source.flac' });
    const result = await client.getCover(track.id);
    assert.ok(result.buffer);
    assert.deepEqual(paths, [`${BASE_URL}/api/auth/login`, `${BASE_URL}/api/library/media/${cueId}/cover`]);
    const before = paths.length;
    await assert.rejects(client.getCover('https://third-party.example.test/steal'), isSafeMusicError);
    assert.equal(paths.length, before);
  } finally { client.close(); }
});

test('cover 401 renews only once and a missing cover returns null', async () => {
  for (const status of [200, 401, 404]) {
    let logins = 0;
    const cookies = [];
    const image = await syntheticCover('png', 20, 20);
    const client = createClient(async (url, options) => {
      if (new URL(url).pathname === '/api/auth/login') return loginResponse(`session-${++logins}`);
      cookies.push(header(options, 'cookie'));
      return cookies.length === 1 || status !== 200
        ? jsonResponse({ detail: 'provider-private-detail' }, { status: cookies.length === 1 ? 401 : status })
        : coverResponse(image);
    });
    try {
      if (status === 401) await assert.rejects(client.getCover(ID), error => {
        assert.equal(error.code, 'MUSIC_AUTH');
        return isSafeMusicError(error);
      });
      else {
        const result = await client.getCover(ID);
        if (status === 404) assert.equal(result, null);
        else assert.ok(result.buffer);
      }
      assert.equal(logins, 2);
      assert.deepEqual(cookies, ['music_session=session-1', 'music_session=session-2']);
    } finally { client.close(); }
  }
});

test('cover rejects redirect, unsafe MIME, magic mismatch, corrupt images and excessive pixels', async () => {
  const image = await syntheticCover('png', 20, 20);
  const tooManyPixels = await syntheticCover('png', 4097, 4097);
  const animated = await sharp(Buffer.from([255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 255, 0]), {
    raw: { width: 2, height: 2, pageHeight: 1, channels: 3 },
  }).webp({ delay: [100, 100], loop: 0 }).toBuffer();
  assert.equal((await sharp(animated, { animated: true }).metadata()).pages, 2);
  for (const response of [
    new Response(null, { status: 302, headers: { location: 'https://third-party.example.test/steal' } }),
    coverResponse(image, 'image/svg+xml'), coverResponse(image, 'image/jpeg'),
    coverResponse(Buffer.concat([image.subarray(0, 8), Buffer.from('corrupt image')])),
    coverResponse(tooManyPixels), coverResponse(animated, 'image/webp'),
  ]) {
    let covers = 0;
    const client = createClient(async (url, options) => {
      assert.equal(new URL(url).origin, BASE_URL);
      assert.equal(options.redirect, 'error');
      if (new URL(url).pathname === '/api/auth/login') return loginResponse();
      covers++;
      return response;
    });
    try {
      await assert.rejects(client.getCover(ID), isSafeMusicError);
      assert.equal(covers, 1);
    } finally { client.close(); }
  }
});

test('cover download caps both declared and streamed bytes at 2 MB', async () => {
  assert.equal(MUSIC_COVER_MAX_BYTES, 2 * 1024 * 1024);
  for (const declared of [true, false]) {
    let cancelled = false;
    const body = new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(MUSIC_COVER_MAX_BYTES + 1)); },
      cancel() { cancelled = true; },
    });
    const client = createClient(async (url, options) => {
      if (new URL(url).pathname === '/api/auth/login') return loginResponse();
      options.signal.addEventListener('abort', () => body.cancel().catch(() => {}), { once: true });
      return coverResponse(body, 'image/png', declared ? { 'content-length': String(MUSIC_COVER_MAX_BYTES + 1) } : {});
    });
    try {
      await assert.rejects(client.getCover(ID), error => {
        assert.equal(error.code, 'MUSIC_SIZE');
        return isSafeMusicError(error);
      });
      assert.equal(cancelled, true);
    } finally { client.close(); }
  }
});

function pendingCover({ body = false, login = false } = {}) {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let requestSignal;
  const client = createClient((_url, options) => {
    requestSignal = options.signal;
    if (!body) return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      started();
    });
    const stream = new ReadableStream({
      start(controller) {
        options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
        started();
      },
    });
    return Promise.resolve(coverResponse(stream));
  });
  if (!login) client.cookie = 'music_session=fixture-session';
  return { client, ready, getSignal: () => requestSignal };
}

for (const phase of ['headers', 'body', 'login']) {
  test(`cover total 5-second deadline cancels stalled ${phase}`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    assert.equal(MUSIC_COVER_TIMEOUT_MS, 5000);
    const { client, ready, getSignal } = pendingCover({ body: phase === 'body', login: phase === 'login' });
    try {
      const rejected = assert.rejects(client.getCover(ID), error => {
        assert.equal(error.code, 'MUSIC_UNAVAILABLE');
        return isSafeMusicError(error);
      });
      await ready;
      t.mock.timers.tick(4999);
      assert.equal(getSignal().aborted, false);
      t.mock.timers.tick(1);
      await rejected;
      if (phase !== 'login') assert.equal(getSignal().aborted, true);
    } finally { client.close(); }
  });
}

for (const close of [false, true]) {
  test(`cover body is cancelled by ${close ? 'client close' : 'caller abort'}`, async () => {
    const { client, ready, getSignal } = pendingCover({ body: true });
    const controller = new AbortController();
    try {
      const rejected = assert.rejects(client.getCover(ID, { signal: controller.signal }), error => {
        assert.equal(error.code, 'MUSIC_ABORTED');
        return isSafeMusicError(error);
      });
      await ready;
      if (close) client.close();
      else controller.abort();
      await rejected;
      assert.equal(getSignal().aborted, true);
    } finally { client.close(); }
  });
}
