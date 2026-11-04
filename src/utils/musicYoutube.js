import { spawn } from 'node:child_process';
import { Transform } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import {
  MusicError, MUSIC_STREAM_MAX_BYTES, MUSIC_COVER_TIMEOUT_MS, MUSIC_COVER_MAX_BYTES, normalizeMusicCover,
} from './musicLibrary.js';
import { fetchBufferWithLimit } from './imageRendering.js';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const BILIBILI_ID = /^BV[A-Za-z0-9]{10}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);
const SELECTOR = 'bestaudio[ext=webm]/bestaudio';
const SYSTEM_CODES = new Set(['ENOENT', 'EACCES', 'EPIPE', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOSPC', 'EMFILE', 'ENFILE', 'EIO']);
const SIGNALS = new Set(['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGPIPE', 'SIGABRT', 'SIGSEGV']);
const STDERR_TAGS = {
  ANSI: /\x1b/,
  TIMEOUT: /timed? out|timeout/i,
  RESET: /connection reset|remote end closed/i,
  INCOMPLETE: /IncompleteRead|ContentTooShort|content too short|bytes read|more expected|unexpected eof/i,
  EMPTY: /did not get any data blocks/i,
  WRITE: /unable to write data|broken pipe|EPIPE/i,
  DISK: /no space left on device/i,
  PERMISSION: /permission denied/i,
  VERIFY: /sign in|login required|confirm.*bot/i,
  CERTIFICATE: /certificate|SSL error/i,
  RETRIES: /giving up|retrying|retries/i,
  FORMAT: /requested format is not available/i,
  CHALLENGE: /challenge solving failed|nsig extraction failed/i,
};
let metadataInFlight = 0;

export function extractYouTubeVideoId(input) {
  try {
    if (typeof input !== 'string' || input.length > 2048 || /[\u0000-\u0020\u007f]/.test(input)) throw new Error();
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !HOSTS.has(url.hostname)) throw new Error();
    let id;
    if (['youtu.be', 'www.youtu.be'].includes(url.hostname)) id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    else if (url.pathname === '/watch') {
      if (url.searchParams.getAll('v').length !== 1) throw new Error();
      id = url.searchParams.get('v');
    } else id = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    if (!VIDEO_ID.test(id || '')) throw new Error();
    return id;
  } catch { throw new MusicError('MUSIC_YOUTUBE_URL'); }
}

export function extractBilibiliVideoId(input) {
  try {
    if (typeof input !== 'string' || input.length > 2048 || /[\u0000-\u0020\u007f]/.test(input)) throw new Error();
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !['bilibili.com', 'www.bilibili.com'].includes(url.hostname)) throw new Error();
    const id = url.pathname.match(/^\/video\/(BV[A-Za-z0-9]{10})\/?$/)?.[1];
    const pages = url.searchParams.getAll('p');
    if (!BILIBILI_ID.test(id || '') || pages.length > 1 || (pages.length && pages[0] !== '1')) throw new Error();
    return id;
  } catch { throw new MusicError('MUSIC_YOUTUBE_URL'); }
}

function canonical(id, source = 'youtube') {
  if (source === 'bilibili' && BILIBILI_ID.test(id || '')) return `https://www.bilibili.com/video/${id}?p=1`;
  if (source === 'youtube' && VIDEO_ID.test(id || '')) return `https://www.youtube.com/watch?v=${id}`;
  throw new MusicError('MUSIC_YOUTUBE_URL');
}

function metadataTrack(data, id, source = 'youtube') {
  if (!data || (data.id !== id && !(source === 'bilibili' && data.id === `${id}_p1`))
    || data._type === 'playlist' || Array.isArray(data.entries)) throw new MusicError('MUSIC_YOUTUBE_RESPONSE');
  if (data.is_live || data.is_upcoming || ['is_live', 'is_upcoming', 'post_live'].includes(data.live_status)) throw new MusicError('MUSIC_YOUTUBE_LIVE');
  const duration = Number(data.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 7200) throw new MusicError('MUSIC_YOUTUBE_DURATION');
  const format = data.requested_downloads?.[0] || data;
  if (format.vcodec !== 'none' || !format.acodec || format.acodec === 'none'
    || !/^[A-Za-z0-9_.-]{1,80}$/.test(String(format.format_id || ''))) throw new MusicError('MUSIC_YOUTUBE_RESPONSE');
  const mime = ({ webm: 'audio/webm', m4a: 'audio/mp4', mp4: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/ogg', mp3: 'audio/mpeg', aac: 'audio/aac', flac: 'audio/flac', wav: 'audio/wav' })[format.ext];
  if (!mime) throw new MusicError('MUSIC_YOUTUBE_RESPONSE');
  const text = (value, fallback) => String(value || fallback).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300);
  const name = source === 'bilibili' ? 'Bilibili' : 'YouTube';
  return {
    track: { source, id, title: text(data.title, `${name} 曲目`), artist: text(data.channel || data.uploader, '未知頻道'), album: name, duration, mime },
    formatId: String(format.format_id),
  };
}

function diagnosticCode(line) {
  line = stripVTControlCharacters(line).replace(/\r/g, ' ');
  if (!/^\s*ERROR:\s/i.test(line)) return null;
  if (/HTTP Error 429\b/i.test(line)) return 'MUSIC_YOUTUBE_RATE_LIMIT';
  if (/HTTP Error 403\b|sign in|login required|confirm.*bot/i.test(line)) return 'MUSIC_YOUTUBE_BLOCKED';
  if (/timed? out|timeout|connection reset|remote end closed|IncompleteRead|content too short|\bbytes read\b|unexpected eof|EOF occurred in violation/i.test(line)) return 'MUSIC_YOUTUBE_NETWORK';
  return 'MUSIC_YOUTUBE_UNAVAILABLE';
}

function downloadFailure(record) {
  return record.error || new MusicError(record.signal ? 'MUSIC_YOUTUBE_PROCESS'
    : record.failureCode || 'MUSIC_YOUTUBE_UNAVAILABLE');
}

function diagnosticReporterFailed() {
  process.emitWarning('YouTube failure diagnostic could not be reported.', { code: 'MUSIC_YOUTUBE_DIAGNOSTIC' });
}

async function terminateTree(child, platform) {
  if (!child.pid) { child.kill?.('SIGKILL'); return; }
  if (platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
      killer.once('error', () => { child.kill('SIGKILL'); resolve(); });
      killer.once('close', resolve);
    });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
      if (error.code !== 'ESRCH') child.kill('SIGKILL');
    }
  }
}

export class MusicYouTubeClient {
  constructor({ ytdlpPath = 'yt-dlp', spawnImpl = spawn, fetchImpl = fetch, requestTimeoutMs = 30_000,
    firstAudioTimeoutMs = 30_000, maxBytes = MUSIC_STREAM_MAX_BYTES, jsonMaxBytes = 1024 * 1024,
    platform = process.platform, killTreeImpl = terminateTree, onFailure = () => {} } = {}) {
    if (![requestTimeoutMs, firstAudioTimeoutMs].every(value => Number.isInteger(value) && value > 0 && value <= 30_000)
      || !Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MUSIC_STREAM_MAX_BYTES
      || !Number.isSafeInteger(jsonMaxBytes) || jsonMaxBytes <= 0 || jsonMaxBytes > 1024 * 1024) throw new MusicError('MUSIC_CONFIG');
    Object.assign(this, { ytdlpPath, spawnImpl, fetchImpl, requestTimeoutMs, firstAudioTimeoutMs, maxBytes, jsonMaxBytes, platform, killTreeImpl, onFailure });
    this.controller = new AbortController();
    this.children = new Set();
  }

  args() {
    return ['--ignore-config', '--no-config-locations', '--no-plugin-dirs', '--no-remote-components',
      '--no-js-runtimes', '--js-runtimes', `node:${process.execPath}`, '--no-playlist', '--no-warnings',
      '--no-progress', '--color', 'never', '--no-cache-dir', '--no-wait-for-video', '--no-mark-watched', '--socket-timeout', '15',
      '--retries', '3', '--fragment-retries', '3', '--abort-on-unavailable-fragments'];
  }

  reportFailure(record, origin, systemCode) {
    // Snapshot before cleanup: a SIGKILL sent by stop must not replace the original failure.
    if (record.reported || record.stopping) return;
    record.reported = true;
    try {
      Promise.resolve(this.onFailure({
        stage: record.stage, origin, exitCode: Number.isInteger(record.code) ? record.code : null,
        signal: record.signal ? SIGNALS.has(record.signal) ? record.signal : 'OTHER' : 'NONE',
        systemCode: systemCode ? SYSTEM_CODES.has(systemCode) ? systemCode : 'OTHER' : 'NONE',
        bytes: record.bytes, httpStatus: record.httpStatus, stderrTags: [...record.stderrTags].sort().join(',') || 'NONE',
      })).catch(diagnosticReporterFailed);
    } catch { diagnosticReporterFailed(); }
  }

  start(args) {
    if (this.controller.signal.aborted) throw new MusicError('MUSIC_ABORTED');
    let child;
    try { child = this.spawnImpl(this.ytdlpPath, [...this.args(), ...args], {
      shell: false, windowsHide: true, detached: this.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    }); } catch { throw new MusicError('MUSIC_YOUTUBE_TOOL'); }
    const record = { child, ended: false, stopping: null, bytes: 0, httpStatus: null, stderrTags: new Set(),
      stage: args.includes('--version') ? 'version' : args.includes('--dump-single-json') ? 'metadata' : 'audio' };
    let stderrTail = '';
    const classify = line => {
      const code = diagnosticCode(line);
      if (code && (code !== 'MUSIC_YOUTUBE_UNAVAILABLE' || !record.failureCode)) record.failureCode = code;
      if (!/ERROR:|WARNING:|\[download\].*(?:error|retry|giving up)/i.test(line)) return;
      for (const [tag, pattern] of Object.entries(STDERR_TAGS)) if (pattern.test(line)) record.stderrTags.add(tag);
      const http = line.match(/\bHTTP(?: Error|Error|\/)\s*(?:\d\.\d\s+)?([1-5]\d{2})\b/i);
      if (http) record.httpStatus = Number(http[1]);
    };
    child.stderr?.on('data', chunk => {
      // yt-dlp retry failures contain "ERROR: \r[download] Got error: ...".
      // CR is part of that error, not a new line; splitting it loses the classification.
      const lines = (stderrTail + chunk.toString('utf8')).split('\n');
      // Keep only a bounded unfinished line in memory; records contain fixed codes only.
      stderrTail = lines.pop().slice(-2048);
      for (const line of lines) classify(line);
    });
    record.closed = new Promise(resolve => {
      child.once('error', error => {
        record.error = new MusicError(error.code === 'ENOENT' ? 'MUSIC_YOUTUBE_TOOL' : 'MUSIC_YOUTUBE_UNAVAILABLE');
        this.reportFailure(record, 'process', error.code);
        if (!child.pid) { record.ended = true; this.children.delete(record); resolve(); }
      });
      child.once('close', (code, signal) => {
        classify(stderrTail);
        stderrTail = '';
        record.ended = true;
        record.code = code;
        record.signal = signal;
        this.children.delete(record);
        resolve();
      });
    });
    this.children.add(record);
    return record;
  }

  async stop(record) {
    if (!record.stopping) record.stopping = (async () => {
      if (!record.ended) await this.killTreeImpl(record.child, this.platform);
      await record.closed;
    })();
    return record.stopping;
  }

  async read(args, { signal, maxBytes = this.jsonMaxBytes, timeoutMs = this.requestTimeoutMs } = {}) {
    const combined = AbortSignal.any([this.controller.signal, ...(signal ? [signal] : [])]);
    if (combined.aborted) throw new MusicError('MUSIC_ABORTED');
    const record = this.start(args);
    let error;
    let bytes = 0;
    const chunks = [];
    let rejectFailure;
    const failed = new Promise((_, reject) => { rejectFailure = reject; });
    const stdoutEnded = new Promise(resolve => record.child.stdout.once('end', resolve));
    const fail = reason => {
      error ||= reason;
      rejectFailure(error);
      this.stop(record).catch(() => { record.error ||= new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'); });
    };
    const abort = () => fail(new MusicError('MUSIC_ABORTED'));
    combined.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => fail(new MusicError('MUSIC_YOUTUBE_TIMEOUT')), timeoutMs);
    record.child.stdout.on('data', chunk => {
      bytes += chunk.length;
      record.bytes = bytes;
      if (bytes > maxBytes) fail(new MusicError('MUSIC_YOUTUBE_RESPONSE'));
      else if (!error) chunks.push(chunk);
    });
    record.child.stdout.on('error', error => {
      this.reportFailure(record, 'stdout', error.code);
      fail(new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'));
    });
    try {
      if (combined.aborted) abort();
      await Promise.race([record.closed.then(async () => {
        if (!record.error && record.code === 0 && !record.signal) await stdoutEnded;
      }), failed]);
      if (record.stopping) await record.stopping;
      if (error || record.error) throw error || record.error;
      if (record.code !== 0 || record.signal) {
        this.reportFailure(record, 'exit');
        throw downloadFailure(record);
      }
      return Buffer.concat(chunks).toString('utf8');
    } catch (error) {
      await this.stop(record);
      throw error;
    } finally {
      clearTimeout(timer);
      combined.removeEventListener('abort', abort);
    }
  }

  async available() {
    if (this.controller.signal.aborted) return false;
    this.availability ||= (async () => {
      try { return /^\d{4}\.\d{2}\.\d{2}/.test((await this.read(['--version'], {
        maxBytes: 1024, timeoutMs: Math.min(this.requestTimeoutMs, 2000),
      })).trim()); } catch { return false; }
    })();
    return this.availability;
  }

  async resolve(id, { signal, source = 'youtube' } = {}) {
    const url = canonical(id, source);
    if (metadataInFlight >= 2) throw new MusicError('MUSIC_CAPACITY');
    metadataInFlight++;
    try {
      const result = await this.read(['--skip-download', '--dump-single-json', '-f', SELECTOR, '--', url], { signal });
      let data;
      try { data = JSON.parse(result); } catch { throw new MusicError('MUSIC_YOUTUBE_RESPONSE'); }
      return metadataTrack(data, id, source);
    } finally { metadataInFlight--; }
  }

  async getTrack(input, options = {}) {
    let hostname;
    try { hostname = new URL(input).hostname; }
    catch { throw new MusicError('MUSIC_YOUTUBE_URL'); }
    const source = ['bilibili.com', 'www.bilibili.com'].includes(hostname) ? 'bilibili' : 'youtube';
    const id = source === 'bilibili' ? extractBilibiliVideoId(input) : extractYouTubeVideoId(input);
    return (await this.resolve(id, { ...options, source })).track;
  }

  async openAudio(track, { signal } = {}) {
    const sourceName = track.source ?? 'youtube';
    const { track: fresh, formatId } = await this.resolve(track.id, { signal, source: sourceName });
    const combined = AbortSignal.any([this.controller.signal, ...(signal ? [signal] : [])]);
    if (combined.aborted) throw new MusicError('MUSIC_ABORTED');
    const record = this.start(['--no-part', '--no-continue', '--fixup', 'never', '-f', formatId, '-o', '-', '--', canonical(track.id, sourceName)]);
    let bytes = 0;
    let firstResolve;
    let firstReject;
    let timer;
    let disposed = false;
    const first = new Promise((resolve, reject) => { firstResolve = resolve; firstReject = reject; });
    const source = new Transform({ transform: (chunk, encoding, callback) => {
      bytes += chunk.length;
      record.bytes = bytes;
      if (bytes > this.maxBytes) { callback(new MusicError('MUSIC_SIZE')); return; }
      clearTimeout(timer);
      firstResolve();
      callback(null, chunk);
    } });
    // Keep startup failures observable through first; consumers own stream errors after return.
    const streamError = error => {
      firstReject(error);
      this.stop(record).catch(() => { record.error ||= new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'); });
    };
    source.on('error', streamError);
    const fail = error => { firstReject(error); source.destroy(error); };
    const abort = () => fail(new MusicError('MUSIC_ABORTED'));
    combined.addEventListener('abort', abort, { once: true });
    const dispose = async () => {
      if (!disposed) {
        disposed = true;
        clearTimeout(timer);
        combined.removeEventListener('abort', abort);
        record.child.stdout.unpipe(source);
        source.destroy();
      }
      await this.stop(record);
    };
    source.once('close', () => {
      clearTimeout(timer);
      combined.removeEventListener('abort', abort);
      this.stop(record).catch(() => { record.error ||= new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'); });
    });
    record.child.stdout.on('error', error => {
      this.reportFailure(record, 'stdout', error.code);
      fail(new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'));
    });
    const stdoutEnded = new Promise(resolve => record.child.stdout.once('end', resolve));
    record.closed.then(() => {
      if (disposed) return;
      if (record.error || record.code !== 0 || record.signal) {
        this.reportFailure(record, 'exit');
        fail(downloadFailure(record));
      }
      else stdoutEnded.then(() => {
        if (!bytes) fail(new MusicError('MUSIC_YOUTUBE_RESPONSE'));
        else if (!disposed && !source.destroyed) source.end();
      });
    });
    timer = setTimeout(() => fail(new MusicError('MUSIC_YOUTUBE_TIMEOUT')), this.firstAudioTimeoutMs);
    record.child.stdout.pipe(source, { end: false });
    try {
      if (combined.aborted) abort();
      await first;
      if (source.destroyed) throw source.errored instanceof MusicError ? source.errored : downloadFailure(record);
      return { source, mime: fresh.mime, dispose };
    } catch (error) { await dispose(); throw error; }
  }

  async getCover(id, { signal } = {}) {
    canonical(id);
    const deadline = new AbortController();
    const combined = AbortSignal.any([this.controller.signal, deadline.signal, ...(signal ? [signal] : [])]);
    const timer = setTimeout(() => deadline.abort(), MUSIC_COVER_TIMEOUT_MS);
    let abort;
    const cancelled = new Promise((_, reject) => {
      abort = () => reject(new MusicError('MUSIC_ABORTED'));
      combined.addEventListener('abort', abort, { once: true });
    });
    try {
      if (combined.aborted) throw new MusicError('MUSIC_ABORTED');
      return await Promise.race([(async () => {
        const { response, buffer } = await fetchBufferWithLimit(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, this.fetchImpl, {
          signal: combined, redirect: 'error', maxBytes: MUSIC_COVER_MAX_BYTES, timeoutMs: MUSIC_COVER_TIMEOUT_MS,
        });
        if (response.status === 404) { await response.body?.cancel?.(); return null; }
        if (!response.ok) { await response.body?.cancel?.(); throw new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'); }
        const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        return await normalizeMusicCover(buffer, mime, { signal: combined });
      })(), cancelled]);
    } catch (error) {
      if (this.controller.signal.aborted || signal?.aborted) throw new MusicError('MUSIC_ABORTED');
      if (deadline.signal.aborted) throw new MusicError('MUSIC_YOUTUBE_TIMEOUT');
      if (error instanceof MusicError) throw error;
      throw new MusicError(error.code === 'DOWNLOAD_SIZE_LIMIT' ? 'MUSIC_SIZE' : 'MUSIC_YOUTUBE_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
      combined.removeEventListener('abort', abort);
    }
  }

  async close() {
    this.controller.abort();
    await Promise.all([...this.children].map(record => this.stop(record)));
  }
}
