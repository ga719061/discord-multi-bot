import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { fetchBufferWithLimit } from './imageRendering.js';

const JSON_LIMIT = 1024 * 1024;
export const MUSIC_STREAM_MAX_BYTES = 512 * 1024 * 1024;
export const MUSIC_REQUEST_TIMEOUT_MS = 8000;
export const MUSIC_CUE_REQUEST_TIMEOUT_MS = 60_000;
export const MUSIC_COVER_TIMEOUT_MS = 5000;
export const MUSIC_COVER_MAX_BYTES = 2 * 1024 * 1024;
const COVER_PIXEL_LIMIT = 16 * 1024 * 1024;
const MEDIA_ID = /^(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i;
const ERROR_MESSAGES = {
  MUSIC_CONFIG: '音樂庫服務位址尚未完成設定，請聯絡管理員。',
  MUSIC_LOGIN: '請先在私人音樂面板登入自己的音樂庫帳號。',
  MUSIC_AUTH: '音樂庫帳號無法登入，請重新登入並確認帳號已核准及密碼正確。',
  MUSIC_UNAVAILABLE: '暫時無法連線至音樂庫，請稍後再試。',
  MUSIC_RESPONSE: '音樂庫回傳的資料無法辨識。',
  MUSIC_NOT_FOUND: '這首曲目已不存在或無法讀取，請重新搜尋。',
  MUSIC_SIZE: '這首曲目的檔案超過播放器的大小限制。',
  MUSIC_ABORTED: '音樂操作已取消。',
  MUSIC_VOICE: '無法連線至語音頻道，請確認機器人具有檢視、連線及說話權限。',
  MUSIC_CHANNEL: '請先加入一般語音頻道，並在播放器所在的語音頻道操作。',
  MUSIC_FORBIDDEN: '這個伺服器尚未獲准使用私人音樂庫。',
  MUSIC_BUSY: '播放器正在處理操作，請稍後再試。',
  MUSIC_CAPACITY: '播放器目前已達使用上限，請稍後再試。',
  MUSIC_QUEUE_FULL: '待播佇列已達 100 首，請先播放部分曲目，或停止後重新點播。',
  MUSIC_PLAYBACK: '音訊無法播放，請確認 FFmpeg 可用，或改選其他曲目。',
  MUSIC_FFMPEG: '音訊轉碼程序中斷，請重新點播；若持續發生，請檢查容器資源與 FFmpeg。',
  MUSIC_STREAM_STALLED: '音訊串流持續沒有資料，播放已中斷；請重新點播或選擇下一首。',
  MUSIC_EXPIRED: '這份音樂面板已失效，請重新使用 `/音樂`。',
  MUSIC_YOUTUBE_URL: '請貼上 YouTube、Shorts 或 YouTube Music 的單支影片 HTTPS 連結。',
  MUSIC_YOUTUBE_TOOL: 'YouTube 播放工具尚未安裝或無法使用，請聯絡管理員；NAS 曲庫仍可使用。',
  MUSIC_YOUTUBE_UNAVAILABLE: '無法讀取這支 YouTube 影片；影片可能受驗證、地區或存取限制。',
  MUSIC_YOUTUBE_RESPONSE: 'YouTube 回傳的影片或音訊資料無法辨識。',
  MUSIC_YOUTUBE_DURATION: '只支援時長明確且不超過 2 小時的單支影片。',
  MUSIC_YOUTUBE_LIVE: '目前不支援直播或尚未開始的影片。',
  MUSIC_YOUTUBE_TIMEOUT: 'YouTube 解析或音訊準備逾時，請稍後重試。',
};

export class MusicError extends Error {
  constructor(code = 'MUSIC_UNAVAILABLE') {
    super(ERROR_MESSAGES[code] || ERROR_MESSAGES.MUSIC_UNAVAILABLE);
    this.name = 'MusicError';
    this.code = Object.hasOwn(ERROR_MESSAGES, code) ? code : 'MUSIC_UNAVAILABLE';
  }
}

function validateBaseUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.search || url.hash || url.pathname !== '/') throw new Error();
    return url.origin;
  } catch {
    throw new MusicError('MUSIC_CONFIG');
  }
}

export function getMusicConfiguration(env = process.env) {
  let baseUrl = null;
  try { baseUrl = validateBaseUrl(env.MUSIC_API_BASE_URL); } catch (error) {
    if (!(error instanceof MusicError)) throw error;
  }
  return {
    baseUrl, nasConfigured: baseUrl !== null, ffmpegPath: env.MUSIC_FFMPEG_PATH || 'ffmpeg',
    ytdlpPath: env.MUSIC_YTDLP_PATH || 'yt-dlp',
  };
}

export function normalizeMusicTrack(value) {
  if (!value || typeof value !== 'object' || !MEDIA_ID.test(String(value.id || ''))) {
    throw new MusicError('MUSIC_RESPONSE');
  }
  const text = (input, fallback = '') => String(input || fallback).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300);
  const duration = Number(value.duration);
  const size = Number(value.size);
  return {
    source: 'nas',
    id: String(value.id).toLowerCase(),
    title: text(value.title, '未命名曲目'),
    artist: text(value.artist, '未知歌手'),
    album: text(value.album),
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    size: Number.isSafeInteger(size) && size >= 0 ? size : 0,
    mime: text(value.mime),
    isCueTrack: value.isCueTrack === true,
    trackNumber: Number.isInteger(value.trackNumber) && value.trackNumber >= 1 && value.trackNumber <= 99
      ? value.trackNumber : null,
  };
}

export async function normalizeMusicCover(buffer, mime, { signal } = {}) {
  const signatureMatches = mime === 'image/png'
    ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === 'image/jpeg' ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      : mime === 'image/webp' && buffer.toString('ascii', 0, 4) === 'RIFF'
        && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!signatureMatches) throw new MusicError('MUSIC_RESPONSE');
  const decoder = sharp(buffer, { limitInputPixels: COVER_PIXEL_LIMIT, failOn: 'warning', animated: true });
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => { decoder.destroy(); reject(new MusicError('MUSIC_ABORTED')); };
    signal?.addEventListener('abort', abort, { once: true });
  });
  try {
    if (signal?.aborted) throw new MusicError('MUSIC_ABORTED');
    return await Promise.race([(async () => {
      const metadata = await decoder.metadata();
      if ((metadata.pages || 1) !== 1) throw new MusicError('MUSIC_RESPONSE');
      const output = await decoder.resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 }).toBuffer();
      if (signal?.aborted) throw new MusicError('MUSIC_ABORTED');
      return { buffer: output, name: 'cover.webp' };
    })(), cancelled]);
  } catch (error) {
    if (error instanceof MusicError) throw error;
    throw new MusicError('MUSIC_RESPONSE');
  } finally {
    signal?.removeEventListener('abort', abort);
    decoder.destroy();
  }
}

export class MusicLibraryClient {
  constructor({
    baseUrl, email, password, fetchImpl = fetch, requestTimeoutMs = MUSIC_REQUEST_TIMEOUT_MS,
    cueRequestTimeoutMs = MUSIC_CUE_REQUEST_TIMEOUT_MS,
  }) {
    this.baseUrl = validateBaseUrl(baseUrl);
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      throw new MusicError('MUSIC_LOGIN');
    }
    this.email = email.trim();
    this.password = password;
    this.fetchImpl = fetchImpl;
    this.requestTimeoutMs = requestTimeoutMs;
    if (![requestTimeoutMs, cueRequestTimeoutMs].every(timeout => Number.isInteger(timeout)
      && timeout > 0 && timeout <= MUSIC_CUE_REQUEST_TIMEOUT_MS)) throw new MusicError('MUSIC_CONFIG');
    this.cueRequestTimeoutMs = cueRequestTimeoutMs;
    this.cookie = null;
    this.loginPromise = null;
    this.controller = new AbortController();
  }

  async search(query = '') {
    const params = new URLSearchParams({ q: String(query).slice(0, 120), limit: '100' });
    const data = await this.authenticatedJson(`/api/library/search?${params}`);
    if (!Array.isArray(data?.tracks)) throw new MusicError('MUSIC_RESPONSE');
    return data.tracks.slice(0, 100).map(normalizeMusicTrack);
  }

  async getTrack(id) {
    this.validateId(id);
    return normalizeMusicTrack(await this.authenticatedJson(`/api/library/media/${id}`));
  }

  async getCover(id, { signal } = {}) {
    this.validateId(id);
    const controller = new AbortController();
    const combined = AbortSignal.any([this.controller.signal, controller.signal, ...(signal ? [signal] : [])]);
    const timeout = setTimeout(() => controller.abort(), MUSIC_COVER_TIMEOUT_MS);
    let response;
    let abort;
    const cancelled = new Promise((_, reject) => {
      abort = () => {
        reject(new MusicError(this.controller.signal.aborted || signal?.aborted ? 'MUSIC_ABORTED' : 'MUSIC_UNAVAILABLE'));
      };
      combined.addEventListener('abort', abort, { once: true });
    });
    try {
      const operation = (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          if (combined.aborted) throw new MusicError('MUSIC_ABORTED');
          await this.login();
          if (combined.aborted) throw new MusicError('MUSIC_ABORTED');
          const cookie = this.cookie;
          let result;
          try {
            result = await fetchBufferWithLimit(`${this.baseUrl}/api/library/media/${id}/cover`, async (url, options) => {
              response = await this.fetchImpl(url, options);
              if (combined.aborted) await response?.body?.cancel?.();
              return response;
            }, {
              headers: { Cookie: cookie }, redirect: 'error', signal: combined,
              timeoutMs: MUSIC_COVER_TIMEOUT_MS, maxBytes: MUSIC_COVER_MAX_BYTES,
            });
          } catch (error) {
            await response?.body?.cancel?.().catch(() => { /* The fetch abort may already have closed the body. */ });
            throw error;
          }
          if (combined.aborted) throw new MusicError('MUSIC_ABORTED');
          if (!response.ok) {
            await response.body?.cancel?.();
            if (response.status === 404) return null;
            if (response.status === 401 && attempt === 0) {
              if (this.cookie === cookie) this.cookie = null;
              continue;
            }
            throw new MusicError([401, 403].includes(response.status) ? 'MUSIC_AUTH' : 'MUSIC_UNAVAILABLE');
          }
          const { buffer } = result;
          const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
          return await normalizeMusicCover(buffer, mime, { signal: combined });
        }
      })();
      if (combined.aborted) abort();
      return await Promise.race([operation, cancelled]);
    } catch (error) {
      if (this.controller.signal.aborted || signal?.aborted) throw new MusicError('MUSIC_ABORTED');
      if (controller.signal.aborted) throw new MusicError('MUSIC_UNAVAILABLE');
      if (error instanceof MusicError) throw error;
      throw new MusicError(error?.code === 'DOWNLOAD_SIZE_LIMIT' ? 'MUSIC_SIZE'
        : 'MUSIC_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
      combined.removeEventListener('abort', abort);
    }
  }

  validateId(id) {
    if (!MEDIA_ID.test(String(id || ''))) throw new MusicError('MUSIC_RESPONSE');
  }

  async login() {
    if (this.controller.signal.aborted) throw new MusicError('MUSIC_ABORTED');
    if (this.cookie) return;
    if (!this.loginPromise) {
      this.loginPromise = this.requestJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: this.email, password: this.password }),
        headers: { 'Content-Type': 'application/json' },
      }).then(({ response }) => {
        if (this.controller.signal.aborted) throw new MusicError('MUSIC_ABORTED');
        if (!response.ok) throw new MusicError('MUSIC_AUTH');
        const cookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
        const cookie = cookies.map(value => value.match(/(?:^|,\s*)music_session=([^;,\s]+)/)?.[1]).find(Boolean);
        if (!cookie) throw new MusicError('MUSIC_AUTH');
        this.cookie = `music_session=${cookie}`;
      }).finally(() => { this.loginPromise = null; });
    }
    await this.loginPromise;
  }

  async requestJson(path, options = {}) {
    try {
      const { response, buffer } = await fetchBufferWithLimit(this.baseUrl + path, this.fetchImpl, {
        ...options, redirect: 'error', timeoutMs: this.requestTimeoutMs, maxBytes: JSON_LIMIT,
        signal: this.controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel?.();
        return { response, data: null };
      }
      let data;
      try { data = JSON.parse(buffer.toString('utf8')); } catch { throw new MusicError('MUSIC_RESPONSE'); }
      return { response, data };
    } catch (error) {
      if (error instanceof MusicError) throw error;
      if (this.controller.signal.aborted) throw new MusicError('MUSIC_ABORTED');
      throw new MusicError(error?.code === 'DOWNLOAD_SIZE_LIMIT' ? 'MUSIC_RESPONSE' : 'MUSIC_UNAVAILABLE');
    }
  }

  async authenticatedJson(path) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.login();
      const cookie = this.cookie;
      const { response, data } = await this.requestJson(path, { headers: { Cookie: cookie } });
      if (response.ok) return data;
      if (response.status === 401 && attempt === 0) {
        if (this.cookie === cookie) this.cookie = null;
        continue;
      }
      throw new MusicError(response.status === 404 ? 'MUSIC_NOT_FOUND'
        : [401, 403].includes(response.status) ? 'MUSIC_AUTH' : 'MUSIC_UNAVAILABLE');
    }
  }

  async openStream(id, { signal, isCueTrack = false } = {}) {
    this.validateId(id);
    const controller = new AbortController();
    const combined = AbortSignal.any([this.controller.signal, controller.signal, ...(signal ? [signal] : [])]);
    let response;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        await this.login();
        const cookie = this.cookie;
        // CUE streams can wait for the server's first per-track FLAC conversion.
        const timeoutMs = isCueTrack === true ? this.cueRequestTimeoutMs : this.requestTimeoutMs;
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          response = await this.fetchImpl(`${this.baseUrl}/api/library/media/${id}/stream`, {
            headers: { Cookie: cookie }, redirect: 'error', signal: combined,
          });
        } finally { clearTimeout(timeout); }
        if (response.ok) break;
        await response.body?.cancel?.();
        if (response.status === 401 && attempt === 0) {
          if (this.cookie === cookie) this.cookie = null;
          continue;
        }
        throw new MusicError(response.status === 404 ? 'MUSIC_NOT_FOUND'
          : [401, 403].includes(response.status) ? 'MUSIC_AUTH' : 'MUSIC_UNAVAILABLE');
      }
      const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if ((!mime.startsWith('audio/') && mime !== 'application/octet-stream') || !response.body) {
        throw new MusicError('MUSIC_RESPONSE');
      }
      const length = Number(response.headers.get('content-length'));
      if (length > MUSIC_STREAM_MAX_BYTES) throw new MusicError('MUSIC_SIZE');
      let bytes = 0;
      const bounded = new Transform({
        transform(chunk, encoding, callback) {
          bytes += chunk.length;
          callback(bytes > MUSIC_STREAM_MAX_BYTES ? new MusicError('MUSIC_SIZE') : null, chunk);
        },
      });
      const source = Readable.fromWeb(response.body);
      const abort = () => source.destroy(new MusicError('MUSIC_ABORTED'));
      combined.addEventListener('abort', abort, { once: true });
      if (combined.aborted) abort();
      bounded.once('close', () => { controller.abort(); combined.removeEventListener('abort', abort); });
      pipeline(source, bounded).catch(() => { /* pipeline forwards the error to the consumer. */ });
      return bounded;
    } catch (error) {
      const aborted = combined.aborted;
      controller.abort();
      await response?.body?.cancel?.().catch(() => {});
      if (error instanceof MusicError) throw error;
      throw new MusicError(aborted ? 'MUSIC_ABORTED' : 'MUSIC_UNAVAILABLE');
    }
  }

  close() {
    this.email = null;
    this.password = null;
    this.cookie = null;
    this.controller.abort();
  }
}
