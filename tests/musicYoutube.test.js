import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import sharp from 'sharp';
import { MusicYouTubeClient, extractYouTubeVideoId } from '../src/utils/musicYoutube.js';
import { MusicError } from '../src/utils/musicLibrary.js';

const ID = 'Abc_dEf-123';
const URL = `https://www.youtube.com/watch?v=${ID}`;
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
      assert.equal((await failed).code, 'MUSIC_YOUTUBE_UNAVAILABLE');
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
  await assert.rejects(failed.client.openAudio({ id: ID }), code('MUSIC_YOUTUBE_UNAVAILABLE'));
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
