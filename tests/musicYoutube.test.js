import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import sharp from 'sharp';
import { MusicYouTubeClient, extractYouTubeVideoId, extractBilibiliVideoId } from '../src/utils/musicYoutube.js';
import { MusicError } from '../src/utils/musicLibrary.js';
import { createMusicAudioResource } from '../src/utils/musicPlayback.js';

const ID = 'Abc_dEf-123';
const URL = `https://www.youtube.com/watch?v=${ID}`;
const BV_ID = 'BV1AbCdEfGhJ';
const BV_URL = `https://www.bilibili.com/video/${BV_ID}?p=1`;
const INFO = {
  id: ID, title: '測試音樂', channel: '測試頻道', duration: 180, live_status: 'not_live',
  format_id: '251', ext: 'webm', vcodec: 'none', acodec: 'opus',
  url: 'https://secret.example.test/signed?token=private',
};

function fixture(steps, options = {}) {
  const calls = [];
  const killed = [];
  const children = [];
  const client = new MusicYouTubeClient({
    ...options,
    killTreeImpl: async child => { killed.push(child); child.kill(); },
    spawnImpl(path, args, spawnOptions) {
      calls.push({ path, args, options: spawnOptions });
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => { child.stdout.destroy(); child.stderr.destroy(); queueMicrotask(() => child.emit('close', null, 'SIGKILL')); };
      children.push(child);
      const step = steps.shift();
      assert.ok(step, 'unexpected child process');
      setImmediate(() => step(child));
      return child;
    },
  });
  return { client, calls, killed, children };
}

function json(data = INFO) {
  return child => { child.stdout.end(JSON.stringify(data)); child.emit('close', 0, null); };
}

function code(expected) {
  return error => {
    assert.ok(error instanceof MusicError);
    assert.equal(error.code, expected);
    assert.equal(`${error.stack} ${JSON.stringify(error)}`.includes('private'), false);
    return true;
  };
}

test('only supported HTTPS YouTube video routes yield a canonical video ID', () => {
  for (const url of [URL, `${URL}&list=playlist&t=99`, `https://youtu.be/${ID}?si=tracking`,
    `https://youtube.com/shorts/${ID}`, `https://music.youtube.com/watch?v=${ID}`, `https://m.youtube.com/watch?v=${ID}`]) {
    assert.equal(extractYouTubeVideoId(url), ID);
  }
  for (const url of [ID, `http://youtube.com/watch?v=${ID}`, `https://youtube.com.evil.test/watch?v=${ID}`,
    `https://user@youtube.com/watch?v=${ID}`, `https://youtube.com:444/watch?v=${ID}`,
    `https://youtube.com/redirect?q=${encodeURIComponent(URL)}`, `https://youtube.com/playlist?list=test`,
    `https://youtube.com/embed/${ID}`, `${URL}&v=XXXXXXXXXXX`, `${URL}\n`, `https://youtu.be/${ID}/extra`]) {
    assert.throws(() => extractYouTubeVideoId(url), code('MUSIC_YOUTUBE_URL'));
  }
});

test('Bilibili URLs accept only the first BV video part on fixed HTTPS hosts', () => {
  for (const url of [BV_URL, `https://bilibili.com/video/${BV_ID}/?from=share`,
    `https://www.bilibili.com/video/${BV_ID}?p=1&share_source=test`]) {
    assert.equal(extractBilibiliVideoId(url), BV_ID);
  }
  for (const url of [BV_ID, `http://www.bilibili.com/video/${BV_ID}`, `https://bilibili.com.evil.test/video/${BV_ID}`,
    `https://user@bilibili.com/video/${BV_ID}`, `https://bilibili.com:444/video/${BV_ID}`,
    `https://bilibili.com/video/${BV_ID}?p=2`, `https://bilibili.com/video/${BV_ID}?p=1&p=2`,
    `https://bilibili.com/video/${BV_ID}?p=`, `https://bilibili.com/video/${BV_ID}/extra`,
    `https://bilibili.com/video/av12345`, `https://bilibili.com/bangumi/play/ep1`,
    `https://b23.tv/abc123`, `https://bilibili.com/video/${BV_ID}\n`]) {
    assert.throws(() => extractBilibiliVideoId(url), code('MUSIC_YOUTUBE_URL'));
  }
});

test('Bilibili resolves and plays an isolated first part with sanitized metadata and a fresh audio format', async () => {
  for (const returnedId of [BV_ID, `${BV_ID}_p1`]) {
    const data = { ...INFO, id: returnedId, title: '合成測試', channel: undefined, uploader: '測試作者',
      ext: 'm4a', format_id: '30280', acodec: 'mp4a.40.2' };
    const f = fixture([json(data), json(data), child => {
      child.stdout.end(Buffer.from('synthetic Bilibili audio'));
      child.emit('close', 0, null);
    }]);
    try {
      const track = await f.client.getTrack(`https://bilibili.com/video/${BV_ID}/?tracking=ignore`);
      assert.deepEqual(track, { source: 'bilibili', id: BV_ID, title: '合成測試', artist: '測試作者',
        album: 'Bilibili', duration: 180, mime: 'audio/mp4' });
      const opened = await f.client.openAudio(track);
      try {
        const chunks = [];
        for await (const chunk of opened.source) chunks.push(chunk);
        assert.equal(Buffer.concat(chunks).toString(), 'synthetic Bilibili audio');
        assert.equal(opened.mime, 'audio/mp4');
      } finally { await opened.dispose(); }
      assert.equal(f.calls.length, 3);
      for (const call of f.calls) {
        assert.equal(call.args.at(-1), BV_URL);
        assert.ok(call.args.includes('--no-playlist'));
        assert.equal(call.args.some(arg => /cookies|tracking/.test(arg)), false);
        assert.equal(call.options.shell, false);
      }
      assert.equal(f.calls[2].args[f.calls[2].args.indexOf('-f') + 1], '30280');
      assert.equal(f.client.children.size, 0);
    } finally { await f.client.close(); }
  }
});

test('Bilibili rejects foreign IDs, redirected episodes, playlists, other parts and unsupported formats', async () => {
  for (const changes of [
    { id: `${BV_ID}_p2` }, { id: 'different' }, { id: '1933368' },
    { _type: 'playlist', entries: [] }, { _type: 'multi_video', entries: [] },
    { duration: 7201 }, { is_live: true }, { vcodec: 'avc1' }, { ext: 'exe' },
  ]) {
    const f = fixture([json({ ...INFO, id: BV_ID, ...changes })]);
    try { await assert.rejects(f.client.getTrack(BV_URL), error => error instanceof MusicError); }
    finally { await f.client.close(); }
  }
  const f = fixture([]);
  await assert.rejects(f.client.openAudio({ source: 'bilibili', id: ID }), code('MUSIC_YOUTUBE_URL'));
  await assert.rejects(f.client.openAudio({ source: 'unknown', id: BV_ID }), code('MUSIC_YOUTUBE_URL'));
  assert.equal(f.calls.length, 0);
});

test('Bilibili stop during audio download preserves cancellation and waits for process cleanup', async () => {
  let downloader;
  const f = fixture([json({ ...INFO, id: `${BV_ID}_p1` }), child => {
    downloader = child;
    child.stdout.write(Buffer.from('partial audio'));
  }]);
  const controller = new AbortController();
  const opened = await f.client.openAudio({ source: 'bilibili', id: BV_ID }, { signal: controller.signal });
  try {
    const failed = new Promise(resolve => opened.source.once('error', resolve));
    controller.abort();
    assert.equal((await failed).code, 'MUSIC_ABORTED');
  } finally { await opened.dispose(); await f.client.close(); }
  assert.ok(f.killed.includes(downloader));
  assert.equal(f.client.children.size, 0);
});

test('metadata is sanitized and commands prohibit config, plugins, remote EJS and shell execution', async () => {
  const f = fixture([json()]);
  assert.deepEqual(await f.client.getTrack(`${URL}&list=ignored&t=99`), {
    source: 'youtube', id: ID, title: '測試音樂', artist: '測試頻道', album: 'YouTube', duration: 180, mime: 'audio/webm',
  });
  const call = f.calls[0];
  assert.equal(call.options.shell, false);
  assert.equal(call.options.windowsHide, true);
  for (const flag of ['--ignore-config', '--no-config-locations', '--no-plugin-dirs', '--no-remote-components', '--no-cache-dir', '--no-playlist']) assert.ok(call.args.includes(flag));
  assert.equal(call.args.at(-1), URL);
  assert.equal(call.args[call.args.indexOf('-f') + 1], 'bestaudio[ext=webm]/bestaudio');
  assert.ok(call.args.includes(`node:${process.execPath}`));
  assert.equal(f.client.children.size, 0);
});

test('duration, livestream, unknown format and non-audio metadata are rejected safely', async () => {
  for (const [changes, expected] of [
    [{ duration: 7201 }, 'MUSIC_YOUTUBE_DURATION'], [{ duration: null }, 'MUSIC_YOUTUBE_DURATION'],
    [{ duration: NaN }, 'MUSIC_YOUTUBE_DURATION'], [{ live_status: 'is_live' }, 'MUSIC_YOUTUBE_LIVE'],
    [{ is_upcoming: true }, 'MUSIC_YOUTUBE_LIVE'], [{ vcodec: 'avc1' }, 'MUSIC_YOUTUBE_RESPONSE'],
    [{ ext: 'exe' }, 'MUSIC_YOUTUBE_RESPONSE'], [{ format_id: '251+137' }, 'MUSIC_YOUTUBE_RESPONSE'],
    [{ id: 'XXXXXXXXXXX' }, 'MUSIC_YOUTUBE_RESPONSE'],
  ]) {
    const f = fixture([json({ ...INFO, ...changes })]);
    await assert.rejects(f.client.getTrack(URL), code(expected));
    await f.client.close();
  }
  const f = fixture([json({ ...INFO, duration: 7200 })]);
  assert.equal((await f.client.getTrack(URL)).duration, 7200);
});

test('availability is cached, concurrent probes share a child and missing tools are nonfatal', async () => {
  const f = fixture([child => { child.stdout.end('2026.10.01\n'); child.emit('close', 0, null); }]);
  assert.deepEqual(await Promise.all([f.client.available(), f.client.available()]), [true, true]);
  assert.equal(await f.client.available(), true);
  assert.equal(f.calls.length, 1);
  const missing = fixture([child => child.emit('error', Object.assign(new Error('private'), { code: 'ENOENT' }))]);
  assert.equal(await missing.client.available(), false);
  assert.equal(await missing.client.available(), false);
  assert.equal(missing.calls.length, 1);
});

test('metadata limits, timeout, abort and nonzero exit terminate owned processes without leaking stderr', async () => {
  const timeout = fixture([() => {}], { requestTimeoutMs: 10 });
  await assert.rejects(timeout.client.getTrack(URL), code('MUSIC_YOUTUBE_TIMEOUT'));
  assert.equal(timeout.killed.length, 1);
  assert.equal(timeout.client.children.size, 0);
  const overflow = fixture([child => child.stdout.write('x'.repeat(33))], { jsonMaxBytes: 32 });
  await assert.rejects(overflow.client.getTrack(URL), code('MUSIC_YOUTUBE_RESPONSE'));
  assert.equal(overflow.killed.length, 1);
  const failure = fixture([child => { child.stderr.end('private raw upstream data'); child.stdout.end(); child.emit('close', 1, null); }]);
  await assert.rejects(failure.client.getTrack(URL), code('MUSIC_YOUTUBE_UNAVAILABLE'));
  const abort = fixture([() => {}]);
  const controller = new AbortController();
  const pending = abort.client.getTrack(URL, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, code('MUSIC_ABORTED'));
  assert.equal(abort.killed.length, 1);
});

test('all clients share two metadata slots, release them on close, and version probes use no metadata slot', async () => {
  const f = fixture([() => {}, () => {}, child => { child.stdout.end('2026.10.01'); child.emit('close', 0, null); }]);
  const first = f.client.getTrack(URL);
  const second = f.client.resolve(ID);
  const firstResult = assert.rejects(first, code('MUSIC_ABORTED'));
  const secondResult = assert.rejects(second, code('MUSIC_ABORTED'));
  const other = fixture([]);
  await assert.rejects(other.client.getTrack(URL), code('MUSIC_CAPACITY'));
  assert.equal(await f.client.available(), true);
  await f.client.close();
  await Promise.all([firstResult, secondResult]);
  assert.equal(f.killed.length, 2);
  const fresh = fixture([json()]);
  assert.equal((await fresh.client.getTrack(URL)).id, ID);
});

test('failed YouTube downloads expose only fixed diagnostic codes for denied, throttled and interrupted transfers', async () => {
  for (const [diagnostic, expected] of [
    ['ERROR: unable to download video data: HTTP Error 403: Forbidden', 'MUSIC_YOUTUBE_BLOCKED'],
    ['ERROR: HTTP Error 429: Too Many Requests', 'MUSIC_YOUTUBE_RATE_LIMIT'],
    ['ERROR: Sign in to confirm you are not a bot', 'MUSIC_YOUTUBE_BLOCKED'],
    ['ERROR: The read operation timed out', 'MUSIC_YOUTUBE_NETWORK'],
    ['ERROR: IncompleteRead: 1024 bytes read, 4096 more expected', 'MUSIC_YOUTUBE_NETWORK'],
    ['ERROR: Connection reset by peer', 'MUSIC_YOUTUBE_NETWORK'],
  ]) {
    const f = fixture([child => {
      child.stderr.write(`${diagnostic} https://secret.example.test/?token=private`);
      child.stdout.end();
      child.emit('close', 1, null);
    }]);
    await assert.rejects(f.client.getTrack(URL), code(expected));
    assert.equal(f.client.children.size, 0);
  }
});

test('late audio failures retain split diagnostic codes while process termination takes precedence', async () => {
  for (const signal of [null, 'SIGKILL']) {
    let downloader;
    const f = fixture([json(), child => { downloader = child; child.stdout.write(Buffer.from('partial audio')); }]);
    const opened = await f.client.openAudio({ id: ID });
    const failed = new Promise(resolve => opened.source.once('error', resolve));
    downloader.stderr.write('ERROR: unable to download video data: HTTP Error 4');
    downloader.stderr.write('03: Forbidden https://secret.example.test/?token=private\n');
    downloader.stdout.end();
    downloader.emit('close', signal ? null : 1, signal);
    assert.equal((await failed).code, signal ? 'MUSIC_YOUTUBE_PROCESS' : 'MUSIC_YOUTUBE_BLOCKED');
    await opened.dispose();
    assert.equal(f.client.children.size, 0);
  }
});

test('yt-dlp retry ERROR carriage returns and ANSI survive chunk boundaries without losing network classification', async () => {
  for (const formatted of [false, true]) {
    const diagnostics = [];
    let downloader;
    const f = fixture([json(), child => { downloader = child; child.stdout.write(Buffer.from('partial audio')); }], {
      onFailure: diagnostic => diagnostics.push(diagnostic),
    });
    const opened = await f.client.openAudio({ id: ID });
    try {
      const failed = new Promise(resolve => opened.source.once('error', resolve));
      downloader.stderr.write(formatted ? '\x1b[31mERROR:\x1b[0m ' : 'ERROR: ');
      downloader.stderr.write('\r');
      downloader.stderr.write('[download] Got error: Connection reset by peer. Giving up after 3 retries');
      // A later generic summary must not erase a recognized cause.
      downloader.stderr.write('\nERROR: unable to download video data\n');
      downloader.stdout.end();
      downloader.emit('close', 1, null);
      assert.equal((await failed).code, 'MUSIC_YOUTUBE_NETWORK');
      assert.equal(diagnostics.length, 1);
      assert.equal(diagnostics[0].stderrTags, formatted ? 'ANSI,RESET,RETRIES' : 'RESET,RETRIES');
    } finally { await opened.dispose(); await f.client.close(); }
  }
});

test('audio download uses finite retries and fails on missing fragments instead of accepting partial audio', async () => {
  const f = fixture([json(), child => { child.stdout.end(Buffer.from('audio')); child.emit('close', 0, null); }]);
  const opened = await f.client.openAudio({ id: ID });
  try {
    for await (const chunk of opened.source) assert.ok(chunk.length);
    const args = f.calls[1].args;
    assert.equal(args[args.indexOf('--retries') + 1], '3');
    assert.equal(args[args.indexOf('--fragment-retries') + 1], '3');
    assert.equal(args[args.indexOf('--color') + 1], 'never');
    assert.ok(args.includes('--abort-on-unavailable-fragments'));
  } finally { await opened.dispose(); await f.client.close(); }
});

test('partial yt-dlp output followed by a retry-exhausted exit cannot start cached WebM playback', async () => {
  let downloader, markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const f = fixture([json(), child => {
    downloader = child;
    child.stdout.write(Buffer.from('partial audio'));
    markStarted();
  }]);
  const preparing = createMusicAudioResource(f.client, { source: 'youtube', id: ID }, {
    spawnImpl() { assert.fail('an incomplete download must never start FFmpeg'); },
  });
  const rejected = assert.rejects(preparing, code('MUSIC_YOUTUBE_NETWORK'));
  try {
    await started;
    downloader.stderr.write('ERROR: \r[download] Got error: Connection reset by peer. Giving up after 3 retries\n');
    downloader.stdout.end();
    downloader.emit('close', 1, null);
    await rejected;
    assert.equal(f.client.children.size, 0);
  } finally { await f.client.close(); }
});

test('audio failure concurrent with the first bytes preserves its classification at the consumer', async () => {
  const f = fixture([json(), child => {
    child.stdout.write(Buffer.from('first audio bytes'));
    child.stderr.write('ERROR: HTTP Error 429: private upstream details\n');
    child.stdout.end();
    child.emit('close', 1, null);
  }]);
  await assert.rejects(async () => {
    let opened;
    try {
      opened = await f.client.openAudio({ id: ID });
      for await (const chunk of opened.source) assert.ok(chunk.length);
    } finally { await opened?.dispose(); }
  }, code('MUSIC_YOUTUBE_RATE_LIMIT'));
  assert.equal(f.client.children.size, 0);
});

test('unclassified audio exits report a bounded safe diagnostic before cleanup', async () => {
  const diagnostics = [];
  let downloader;
  const f = fixture([json(), child => { downloader = child; child.stdout.write(Buffer.from('partial audio')); }], {
    onFailure: diagnostic => diagnostics.push(diagnostic),
  });
  const opened = await f.client.openAudio({ id: ID });
  const failed = new Promise(resolve => opened.source.once('error', resolve));
  downloader.stderr.write('\x1b[31mERROR:\x1b[0m HTTPError 503 private token https://secret.example.test/\n');
  downloader.stdout.end();
  downloader.emit('close', 1, null);
  assert.equal((await failed).code, 'MUSIC_YOUTUBE_UNAVAILABLE');
  await opened.dispose();
  assert.deepEqual(diagnostics, [{
    stage: 'audio', origin: 'exit', exitCode: 1, signal: 'NONE', systemCode: 'NONE',
    bytes: 13, httpStatus: 503, stderrTags: 'ANSI',
  }]);
  assert.equal(JSON.stringify(diagnostics).includes('private'), false);
  assert.equal(JSON.stringify(diagnostics).includes('secret.example'), false);
  assert.equal(f.client.children.size, 0);
});

test('stdout failures report their original boundary once and allowlist system codes', async () => {
  for (const [systemCode, expected] of [['EPIPE', 'EPIPE'], ['private-token', 'OTHER']]) {
    const diagnostics = [];
    let downloader;
    const f = fixture([json(), child => { downloader = child; child.stdout.write(Buffer.from('audio')); }], {
      onFailure: diagnostic => diagnostics.push(diagnostic),
    });
    const opened = await f.client.openAudio({ id: ID });
    const failed = new Promise(resolve => opened.source.once('error', resolve));
    downloader.stdout.destroy(Object.assign(new Error('private stdout failure'), { code: systemCode }));
    assert.equal((await failed).code, 'MUSIC_YOUTUBE_UNAVAILABLE');
    await opened.dispose();
    assert.deepEqual(diagnostics, [{
      stage: 'audio', origin: 'stdout', exitCode: null, signal: 'NONE', systemCode: expected,
      bytes: 5, httpStatus: null, stderrTags: 'NONE',
    }]);
    assert.equal(JSON.stringify(diagnostics).includes('private'), false);
    assert.equal(f.client.children.size, 0);
  }
});

test('process failure diagnostics distinguish metadata startup and external audio termination', async () => {
  const diagnostics = [];
  const denied = fixture([child => child.emit('error', Object.assign(new Error('private'), { code: 'EACCES' }))], {
    onFailure: diagnostic => diagnostics.push(diagnostic),
  });
  await assert.rejects(denied.client.getTrack(URL), code('MUSIC_YOUTUBE_UNAVAILABLE'));
  assert.deepEqual(diagnostics, [{
    stage: 'metadata', origin: 'process', exitCode: null, signal: 'NONE', systemCode: 'EACCES',
    bytes: 0, httpStatus: null, stderrTags: 'NONE',
  }]);
  let downloader;
  const killed = fixture([json(), child => { downloader = child; child.stdout.write(Buffer.from('audio')); }], {
    onFailure: diagnostic => diagnostics.push(diagnostic),
  });
  const opened = await killed.client.openAudio({ id: ID });
  const failed = new Promise(resolve => opened.source.once('error', resolve));
  downloader.stdout.end();
  downloader.emit('close', null, 'SIGKILL');
  assert.equal((await failed).code, 'MUSIC_YOUTUBE_PROCESS');
  await opened.dispose();
  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[1].origin, 'exit');
  assert.equal(diagnostics[1].signal, 'SIGKILL');
});

test('safe diagnostic tags preserve only fixed observations from split errors and discard long raw data', async () => {
  const diagnostics = [];
  const f = fixture([child => {
    child.stderr.write('private'.repeat(10000));
    child.stderr.write('\nERROR: IncompleteRead private HTTP Error 4');
    child.stderr.write('16; giving up after retries\n');
    child.stdout.end();
    child.emit('close', 1, null);
  }], { onFailure: diagnostic => diagnostics.push(diagnostic) });
  await assert.rejects(f.client.getTrack(URL), code('MUSIC_YOUTUBE_NETWORK'));
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].httpStatus, 416);
  assert.equal(diagnostics[0].stderrTags, 'INCOMPLETE,RETRIES');
  assert.equal(JSON.stringify(diagnostics).includes('private'), false);
});

test('successful recovery and intentional abort, timeout and byte limits emit no download-failure diagnostic', async () => {
  const diagnostics = [];
  const options = { onFailure: diagnostic => diagnostics.push(diagnostic) };
  const recovered = fixture([json(), child => {
    child.stderr.write('ERROR: IncompleteRead private HTTP Error 503\n');
    child.stdout.end(Buffer.from('audio'));
    child.emit('close', 0, null);
  }], options);
  const complete = await recovered.client.openAudio({ id: ID });
  for await (const chunk of complete.source) assert.ok(chunk.length);
  await complete.dispose();
  const timeout = fixture([json(), () => {}], { ...options, firstAudioTimeoutMs: 10 });
  await assert.rejects(timeout.client.openAudio({ id: ID }), code('MUSIC_YOUTUBE_TIMEOUT'));
  const size = fixture([json(), child => child.stdout.write(Buffer.alloc(33))], { ...options, maxBytes: 32 });
  await assert.rejects(size.client.openAudio({ id: ID }), code('MUSIC_SIZE'));
  const cancelled = fixture([json(), child => child.stdout.write(Buffer.from('audio'))], options);
  const controller = new AbortController();
  const opened = await cancelled.client.openAudio({ id: ID }, { signal: controller.signal });
  const failed = new Promise(resolve => opened.source.once('error', resolve));
  controller.abort();
  assert.equal((await failed).code, 'MUSIC_ABORTED');
  await opened.dispose();
  assert.deepEqual(diagnostics, []);
});

test('diagnostic reporter failures preserve original process, stdout and exit failures and finish cleanup', async t => {
  const warnings = [];
  t.mock.method(process, 'emitWarning', (...args) => warnings.push(args));
  for (const asyncReporter of [false, true]) {
    const onFailure = () => {
      const error = new Error('private diagnostic reporter failure');
      if (asyncReporter) return Promise.reject(error);
      throw error;
    };
    const denied = fixture([child => child.emit('error', Object.assign(new Error('private'), { code: 'EACCES' }))], {
      onFailure, requestTimeoutMs: 20,
    });
    try { await assert.rejects(denied.client.getTrack(URL), code('MUSIC_YOUTUBE_UNAVAILABLE')); }
    finally { await denied.client.close(); }
    assert.equal(denied.client.children.size, 0);
    for (const origin of ['stdout', 'exit']) {
      let downloader;
      const f = fixture([json(), child => { downloader = child; child.stdout.write(Buffer.from('audio')); }], { onFailure });
      const opened = await f.client.openAudio({ id: ID });
      try {
        const failed = new Promise(resolve => opened.source.once('error', resolve));
        if (origin === 'stdout') downloader.stdout.destroy(Object.assign(new Error('private'), { code: 'EPIPE' }));
        else { downloader.stdout.end(); downloader.emit('close', 1, null); }
        assert.equal((await failed).code, 'MUSIC_YOUTUBE_UNAVAILABLE');
      } finally { await opened.dispose(); await f.client.close(); }
      assert.equal(f.client.children.size, 0);
    }
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(warnings.length, 6);
  for (const warning of warnings) assert.deepEqual(warning, [
    'YouTube failure diagnostic could not be reported.', { code: 'MUSIC_YOUTUBE_DIAGNOSTIC' },
  ]);
});

test('long or unrelated stderr does not become a public error or remain attached to process records', async () => {
  const f = fixture([child => {
    child.stderr.write('private'.repeat(10000));
    child.stderr.write('\nERROR: unknown private failure\n');
    child.stdout.end();
    child.emit('close', 1, null);
  }]);
  await assert.rejects(f.client.getTrack(URL), code('MUSIC_YOUTUBE_UNAVAILABLE'));
  assert.equal(f.client.children.size, 0);
});

test('recovered downloader diagnostics do not fail complete audio or override explicit cancellation', async () => {
  const complete = fixture([json(), child => {
    child.stderr.write('ERROR: IncompleteRead: private upstream data\n');
    child.stdout.end(Buffer.from('complete audio'));
    child.emit('close', 0, null);
  }]);
  const finished = await complete.client.openAudio({ id: ID });
  const chunks = [];
  for await (const chunk of finished.source) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(), 'complete audio');
  await finished.dispose();

  let downloader;
  const cancelled = fixture([json(), child => { downloader = child; child.stdout.write(Buffer.from('audio')); }]);
  const controller = new AbortController();
  const opened = await cancelled.client.openAudio({ id: ID }, { signal: controller.signal });
  const failed = new Promise(resolve => opened.source.once('error', resolve));
  downloader.stderr.write('ERROR: HTTP Error 403: private\n');
  controller.abort();
  assert.equal((await failed).code, 'MUSIC_ABORTED');
  await opened.dispose();
});

test('metadata malformed JSON and missing executable map to safe errors', async () => {
  const invalid = fixture([child => { child.stdout.end('{private malformed json'); child.emit('close', 0, null); }]);
  await assert.rejects(invalid.client.getTrack(URL), code('MUSIC_YOUTUBE_RESPONSE'));
  const missing = fixture([child => child.emit('error', Object.assign(new Error('private missing binary'), { code: 'ENOENT' }))]);
  await assert.rejects(missing.client.getTrack(URL), code('MUSIC_YOUTUBE_TOOL'));
});

test('metadata waits for stdout EOF even if close arrives before buffered output', async () => {
  const f = fixture([child => {
    child.emit('close', 0, null);
    setImmediate(() => child.stdout.end(JSON.stringify(INFO)));
  }]);
  assert.equal((await f.client.getTrack(URL)).title, INFO.title);
});

test('availability timeout closes its process and caches the nonfatal outcome', async () => {
  const f = fixture([() => {}], { requestTimeoutMs: 10 });
  assert.equal(await f.client.available(), false);
  assert.equal(await f.client.available(), false);
  assert.equal(f.killed.length, 1);
  assert.equal(f.calls.length, 1);
  assert.equal(f.client.children.size, 0);
});

test('playback re-resolves an explicit audio-only format and streams every buffered byte before EOF', async () => {
  const chunks = [Buffer.alloc(65536, 1), Buffer.alloc(65536, 2), Buffer.alloc(65536, 3)];
  const f = fixture([json({ ...INFO, format_id: '250' }), child => {
    for (const chunk of chunks) child.stdout.write(chunk);
    child.stdout.end();
    child.emit('close', 0, null);
  }]);
  const opened = await f.client.openAudio({ id: ID, mime: 'audio/mp4' });
  assert.equal(opened.mime, 'audio/webm');
  const received = [];
  for await (const chunk of opened.source) received.push(chunk);
  assert.deepEqual(Buffer.concat(received), Buffer.concat(chunks));
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].args[f.calls[1].args.indexOf('-f') + 1], '250');
  assert.equal(f.calls[1].args[f.calls[1].args.indexOf('-o') + 1], '-');
  assert.equal(f.calls[1].args.includes('--no-part'), true);
  await opened.dispose();
  assert.equal(f.client.children.size, 0);
});

test('M4A fallback is surfaced to the existing seekable transport', async () => {
  const f = fixture([json({ ...INFO, ext: 'm4a', format_id: '140', acodec: 'mp4a.40.2' }), child => {
    child.stdout.end(Buffer.from('synthetic-audio')); child.emit('close', 0, null);
  }]);
  const opened = await f.client.openAudio({ id: ID });
  assert.equal(opened.mime, 'audio/mp4');
  for await (const chunk of opened.source) assert.ok(chunk.length);
  await opened.dispose();
});

test('partial audio followed by exit 1, exit 141 or SIGPIPE is never treated as a complete track', async () => {
  for (const [exitCode, signal] of [[1, null], [141, null], [null, 'SIGPIPE']]) {
    let downloader;
    const f = fixture([json(), child => {
      downloader = child;
      child.stdout.write(Buffer.from('partial synthetic audio'));
    }]);
    const opened = await f.client.openAudio({ id: ID });
    try {
      const failed = new Promise(resolve => opened.source.once('error', resolve));
      downloader.stdout.end();
      downloader.emit('close', exitCode, signal);
      assert.equal((await failed).code, signal ? 'MUSIC_YOUTUBE_PROCESS' : 'MUSIC_YOUTUBE_UNAVAILABLE');
      assert.equal(opened.source.destroyed, true);
      assert.equal(f.client.children.size, 0);
    } finally { await opened.dispose(); await f.client.close(); }
  }
});

test('first audio timeout, file limit, child failures and shutdown clean up every owned process', async () => {
  const timeout = fixture([json(), () => {}], { firstAudioTimeoutMs: 10 });
  await assert.rejects(timeout.client.openAudio({ id: ID }), code('MUSIC_YOUTUBE_TIMEOUT'));
  assert.equal(timeout.killed.length, 1);
  const overflow = fixture([json(), child => child.stdout.write(Buffer.alloc(33))], { maxBytes: 32 });
  await assert.rejects(overflow.client.openAudio({ id: ID }), code('MUSIC_SIZE'));
  assert.equal(overflow.killed.length, 1);
  const failed = fixture([json(), child => { child.stdout.end(); child.emit('close', null, 'SIGTERM'); }]);
  await assert.rejects(failed.client.openAudio({ id: ID }), code('MUSIC_YOUTUBE_PROCESS'));
  const active = fixture([json(), child => child.stdout.write(Buffer.from('audio'))]);
  const opened = await active.client.openAudio({ id: ID });
  const errored = new Promise(resolve => opened.source.once('error', resolve));
  await active.client.close();
  assert.equal((await errored).code, 'MUSIC_ABORTED');
  assert.equal(active.client.children.size, 0);
  await opened.dispose();
});

test('disposal waits for child close and caller cancellation remains observable after first audio', async () => {
  const f = fixture([json(), child => {
    child.kill = () => setTimeout(() => child.emit('close', null, 'SIGKILL'), 20);
    child.stdout.write(Buffer.from('audio'));
  }]);
  const controller = new AbortController();
  const opened = await f.client.openAudio({ id: ID }, { signal: controller.signal });
  const errored = new Promise(resolve => opened.source.once('error', resolve));
  controller.abort();
  assert.equal((await errored).code, 'MUSIC_ABORTED');
  await opened.dispose();
  assert.equal(f.client.children.size, 0);
  assert.equal(f.killed.length, 1);
});

test('YouTube cover uses a fixed thumbnail origin and shared image limits', async () => {
  const buffer = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#123456' } }).jpeg().toBuffer();
  const calls = [];
  const client = new MusicYouTubeClient({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(buffer, { headers: { 'content-type': 'image/jpeg' } });
  } });
  const cover = await client.getCover(ID);
  assert.equal(calls[0].url, `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(cover.name, 'cover.webp');
  assert.equal((await sharp(cover.buffer).metadata()).width, 512);
  await assert.rejects(client.getCover('../private'), code('MUSIC_YOUTUBE_URL'));
  await client.close();
});

test('invalid cover MIME, oversize cover and missing cover have safe outcomes', async () => {
  for (const [response, expected] of [
    [new Response('private', { headers: { 'content-type': 'text/html' } }), 'MUSIC_RESPONSE'],
    [new Response('x', { headers: { 'content-type': 'image/png', 'content-length': String(2 * 1024 * 1024 + 1) } }), 'MUSIC_SIZE'],
  ]) {
    const client = new MusicYouTubeClient({ fetchImpl: async () => response });
    await assert.rejects(client.getCover(ID), code(expected));
    await client.close();
  }
  const client = new MusicYouTubeClient({ fetchImpl: async () => new Response(null, { status: 404 }) });
  assert.equal(await client.getCover(ID), null);
  await client.close();
});

test('caller cancellation interrupts a stalled cover request even if upstream ignores abort', async () => {
  const client = new MusicYouTubeClient({ fetchImpl: () => new Promise(() => {}) });
  const controller = new AbortController();
  const pending = client.getCover(ID, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, code('MUSIC_ABORTED'));
  await client.close();
});

test('real Node child streams drain in full and default process-tree cleanup waits for close', async () => {
  const closed = [];
  let holdOpen = false;
  const client = new MusicYouTubeClient({ spawnImpl(path, args, options) {
    const script = args.includes('--dump-single-json')
      ? `process.stdout.end(${JSON.stringify(JSON.stringify(INFO))});`
      : `process.stdout.write(Buffer.alloc(262144, 7));${holdOpen ? 'setInterval(()=>{},1000);' : 'process.stdout.end();'}`;
    const child = spawn(process.execPath, ['-e', script], options);
    child.once('close', () => closed.push(child.pid));
    return child;
  } });
  const finished = await client.openAudio({ id: ID });
  let bytes = 0;
  for await (const chunk of finished.source) bytes += chunk.length;
  assert.equal(bytes, 262144);
  await finished.dispose();
  holdOpen = true;
  const active = await client.openAudio({ id: ID });
  const errored = new Promise(resolve => active.source.once('error', resolve));
  await client.close();
  assert.equal((await errored).code, 'MUSIC_ABORTED');
  assert.equal(client.children.size, 0);
  assert.equal(closed.length, 4);
  await active.dispose();
});
