import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { access, readFile } from 'node:fs/promises';
import { Readable, Writable } from 'node:stream';
import { AudioPlayerStatus, StreamType, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState } from '@discordjs/voice';
import { createMusicAudioResource, MusicPlaybackManager } from '../src/utils/musicPlayback.js';
import { MusicError } from '../src/utils/musicLibrary.js';

function track(number) {
  return {
    id: number.toString(16).padStart(32, '0'),
    title: `歌曲 ${number}`, artist: '測試歌手', album: '測試專輯',
    duration: 120, size: 1024, mime: 'audio/mpeg',
  };
}

function guild(id = 'guild-one') {
  return { id, voiceAdapterCreator: () => {} };
}

function channel(id = 'voice-one') { return { id }; }

class FakePlayer extends EventEmitter {
  constructor() {
    super();
    this.state = { status: AudioPlayerStatus.Idle };
    this.played = [];
  }

  play(resource) {
    this.played.push(resource);
    this.state = { status: AudioPlayerStatus.Playing, resource };
  }

  pause() {
    this.state = { ...this.state, status: AudioPlayerStatus.Paused };
    return true;
  }

  unpause() {
    this.state = { ...this.state, status: AudioPlayerStatus.Playing };
    return true;
  }

  stop() {
    const wasIdle = this.state.status === AudioPlayerStatus.Idle;
    this.state = { status: AudioPlayerStatus.Idle };
    if (!wasIdle) this.emit(AudioPlayerStatus.Idle);
    return !wasIdle;
  }

  finish() {
    this.state = { status: AudioPlayerStatus.Idle };
    this.emit(AudioPlayerStatus.Idle);
  }
}

class FakeConnection extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.state = { status: VoiceConnectionStatus.Ready };
    this.destroyCount = 0;
  }

  subscribe(player) { this.player = player; }

  destroy() {
    this.destroyCount += 1;
    this.state = { status: VoiceConnectionStatus.Destroyed };
  }
}

function transportFor(selected) {
  return {
    resource: {
      trackId: selected.id, playbackDuration: 0,
    },
    disposeCount: 0,
    dispose() { this.disposeCount += 1; },
  };
}

function fixture(options = {}) {
  const players = [];
  const connections = [];
  const transports = [];
  const updates = [];
  const preparations = [];
  const library = { closeCount: 0, close() { this.closeCount += 1; } };
  const manager = new MusicPlaybackManager({
    library,
    voice: {
      createAudioPlayer() {
        const player = new FakePlayer();
        players.push(player);
        return player;
      },
      joinVoiceChannel(joinOptions) {
        const connection = new FakeConnection(joinOptions);
        connections.push(connection);
        return connection;
      },
      async entersState(subject) { return subject; },
    },
    createResource: async (_library, selected, resourceOptions) => {
      preparations.push({ selected, options: resourceOptions });
      const transport = transportFor(selected);
      transports.push(transport);
      return transport;
    },
    onUpdate: (session) => updates.push(manager.snapshot(session)),
    ...options,
  });
  return { manager, library, players, connections, transports, updates, preparations };
}

test('stop cancels external requests synchronously before awaiting audio cleanup and only once', async () => {
  const stopped = [];
  const { manager } = fixture({ onStop: session => stopped.push(session) });
  let release;
  const cleanup = new Promise(resolve => { release = resolve; });
  try {
    const session = await manager.connect(guild(), channel());
    session.cleanupPromise = cleanup;
    const first = manager.stop(session);
    assert.deepEqual(stopped, [session]);
    assert.equal(session.status, 'stopped');
    assert.equal(session.controller.signal.aborted, true);
    const repeated = manager.stop(session);
    assert.equal(repeated, first);
    assert.equal(stopped.length, 1);
    release();
    await first;
  } finally {
    release();
    await manager.close();
  }
});

function errorCode(code) {
  return (error) => error instanceof MusicError && error.code === code;
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

function audioChild() {
  const child = new EventEmitter();
  child.stdin = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  child.stdout = new Readable({ read() {} });
  child.stderr = new Readable({ read() {} });
  child.exitCode = null;
  child.signalCode = null;
  child.kill = () => { child.signalCode = 'SIGTERM'; child.emit('close'); };
  return child;
}

function youtubeTrack(number = 1) {
  return { ...track(number), source: 'youtube', id: `video${String(number).padStart(6, '0')}`, mime: 'audio/webm' };
}

test('YouTube audio uses fresh provider MIME, awaits process and provider cleanup, and never calls NAS', async () => {
  for (const mime of ['audio/webm', 'audio/mp4']) {
    const source = Readable.from([Buffer.from('synthetic-provider-audio')]);
    const controller = new AbortController();
    let releaseClose, releaseProvider, input;
    let providerDisposed = 0;
    const providerCleanup = new Promise(resolve => { releaseProvider = resolve; });
    const child = audioChild();
    child.kill = () => { releaseClose = () => child.emit('close'); };
    const provider = {
      openStream() { assert.fail('YouTube IDs must not reach the NAS API'); },
      async openAudio(selected, options) {
        assert.equal(selected.source, 'youtube');
        assert.equal(options.signal, controller.signal);
        return { source, mime, dispose() { providerDisposed++; return providerCleanup; } };
      },
    };
    const transport = await createMusicAudioResource(provider, { ...youtubeTrack(), mime: 'audio/mpeg' }, {
      signal: controller.signal,
      spawnImpl(_path, args) { input = args[args.indexOf('-i') + 1]; return child; },
    });
    let settled = false;
    const disposing = transport.dispose().then(() => { settled = true; });
    try {
      await flush();
      assert.equal(settled, false);
      assert.equal(providerDisposed, 1);
      assert.equal(source.destroyed, true);
      if (mime === 'audio/mp4') {
        assert.notEqual(input, 'pipe:0');
        assert.deepEqual(await readFile(input), Buffer.from('synthetic-provider-audio'));
      } else assert.equal(input, 'pipe:0');
      releaseClose();
      await flush();
      assert.equal(settled, false, 'provider cleanup must also complete');
      releaseProvider();
      await disposing;
      assert.equal(settled, true);
      await transport.dispose();
      assert.equal(providerDisposed, 1);
      if (mime === 'audio/mp4') await assert.rejects(access(input), { code: 'ENOENT' });
    } finally { releaseClose?.(); releaseProvider(); await disposing; }
  }
});

test('YouTube spawn failure and aborted preparation await source disposal without starting audio', async () => {
  for (const cancelled of [false, true]) {
    const source = new Readable({ read() {} });
    let disposed = 0;
    const controller = new AbortController();
    const provider = { async openAudio() {
      if (cancelled) controller.abort();
      return { source, mime: 'audio/webm', async dispose() { await flush(); disposed++; } };
    } };
    await assert.rejects(createMusicAudioResource(provider, youtubeTrack(), {
      signal: controller.signal,
      spawnImpl() {
        assert.equal(cancelled, false, 'already cancelled sources cannot spawn FFmpeg');
        throw new Error('private provider process information');
      },
    }), errorCode(cancelled ? 'MUSIC_ABORTED' : 'MUSIC_PLAYBACK'));
    assert.equal(source.destroyed, true);
    assert.equal(disposed, 1);
  }
});

test('YouTube M4A preparation preserves safe stream errors and disposes the downloader', async () => {
  const source = new Readable({ read() { this.destroy(new MusicError('MUSIC_SIZE')); } });
  let disposed = 0;
  await assert.rejects(createMusicAudioResource({ async openAudio() {
    return { source, mime: 'audio/mp4', async dispose() { disposed++; } };
  } }, youtubeTrack(), { spawnImpl() { assert.fail('failed downloads cannot start FFmpeg'); } }), errorCode('MUSIC_SIZE'));
  assert.equal(disposed, 1);
  assert.equal(source.destroyed, true);
});

test('cancelling YouTube M4A while downloading reaps the provider before preparation settles', async () => {
  const controller = new AbortController();
  let markReading, disposed = 0;
  const reading = new Promise(resolve => { markReading = resolve; });
  const source = new Readable({ read() { markReading(); } });
  const preparing = createMusicAudioResource({ async openAudio() {
    return { source, mime: 'audio/mp4', async dispose() { await flush(); disposed++; } };
  } }, youtubeTrack(), {
    signal: controller.signal, spawnImpl() { assert.fail('partial M4A cannot spawn FFmpeg'); },
  });
  const rejected = assert.rejects(preparing, errorCode('MUSIC_ABORTED'));
  await reading;
  controller.abort();
  await rejected;
  assert.equal(source.destroyed, true);
  assert.equal(disposed, 1);
});

test('FFmpeg cleanup escalates a resistant process and still awaits its close event', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const signals = [];
  const child = audioChild();
  child.kill = signal => { signals.push(signal || 'SIGTERM'); if (signal === 'SIGKILL') child.emit('close'); };
  const transport = await createMusicAudioResource({ async openAudio() {
    return { source: new Readable({ read() {} }), mime: 'audio/webm', async dispose() {} };
  } }, youtubeTrack(), { spawnImpl: () => child });
  let settled = false;
  const disposing = transport.dispose().then(() => { settled = true; });
  await flush();
  assert.equal(settled, false);
  assert.deepEqual(signals, ['SIGTERM']);
  t.mock.timers.tick(2000);
  await disposing;
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(settled, true);
});

test('a synchronous FFmpeg spawn failure closes the opened audio source', async () => {
  const source = Readable.from([Buffer.from('fixture-audio')]);
  const library = {
    async openStream(id) {
      assert.equal(id, track(1).id);
      return source;
    },
  };
  await assert.rejects(createMusicAudioResource(library, track(1), {
    spawnImpl() { throw new Error('private spawn failure'); },
  }), (error) => {
    assert.ok(error instanceof MusicError);
    assert.equal(error.code, 'MUSIC_PLAYBACK');
    assert.equal(error.message.includes('private spawn failure'), false);
    return true;
  });
  assert.equal(source.destroyed, true);
});

test('direct Ogg Opus output bypasses JavaScript encoding and keeps the default half-level gain', async () => {
  const source = Readable.from([Buffer.from('fixture-audio')]);
  let spawnArguments;
  let child;
  const library = { async openStream() { return source; } };
  const transport = await createMusicAudioResource(library, track(1), {
    spawnImpl(_file, args, options) {
      spawnArguments = args;
      child = new EventEmitter();
      child.stdin = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
      child.stdout = new Readable({ read() {} });
      child.stderr = new Readable({ read() {} });
      child.exitCode = null;
      child.signalCode = null;
      child.kill = () => { child.signalCode = 'SIGTERM'; child.emit('close'); };
      assert.equal(options.shell, false);
      return child;
    },
  });
  try {
    assert.deepEqual(transport.resource.edges.map((edge) => edge.type), ['ogg/opus demuxer']);
    assert.equal(transport.resource.encoder, undefined);
    assert.equal(transport.resource.volume, undefined);
    assert.equal(transport.resource.edges.some((edge) => edge.type.includes('volume')), false);
    for (const args of [
      ['-af', 'volume=0.5'], ['-ar', '48000'], ['-ac', '2'], ['-c:a', 'libopus'],
      ['-b:a', '128k'], ['-vbr', 'on'], ['-compression_level', '10'], ['-application', 'audio'],
      ['-frame_duration', '20'], ['-f', 'ogg'], ['-page_duration', '20000'], ['-flush_packets', '1'],
    ]) assert.ok(spawnArguments.some((value, index) => value === args[0] && spawnArguments[index + 1] === args[1]));
    assert.equal(transport.resource.edges[0].type, 'ogg/opus demuxer');
  } finally {
    await transport.dispose();
  }
  assert.equal(source.destroyed, true);
});

test('audio preparation forwards only the CUE flag, opaque ID and cancellation signal to the library', async () => {
  for (const isCueTrack of [false, true, 'true']) {
    const controller = new AbortController();
    let requested = false;
    const selected = {
      ...track(1), isCueTrack, trackNumber: 2, mime: 'audio/flac',
      sourcePath: '/library/private/album.flac', start: 125, end: 250,
    };
    const library = {
      async openStream(id, options) {
        requested = true;
        assert.equal(id, selected.id);
        assert.deepEqual(options, { signal: controller.signal, isCueTrack: isCueTrack === true });
        throw new MusicError('MUSIC_ABORTED');
      },
    };
    await assert.rejects(createMusicAudioResource(library, selected, {
      signal: controller.signal,
      spawnImpl() { assert.fail('cancelled preparation must not start FFmpeg'); },
    }), errorCode('MUSIC_ABORTED'));
    assert.equal(requested, true);
  }
});

test('unexpected FFmpeg signal termination is an audio error while cleanup only cancels the stream', async () => {
  for (const intentional of [false, true]) {
    const source = new Readable({ read() {} });
    let child;
    const transport = await createMusicAudioResource({ openStream: async () => source }, track(1), {
      spawnImpl() {
        child = new EventEmitter();
        child.stdin = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
        child.stdout = new Readable({ read() {} });
        child.stderr = new Readable({ read() {} });
        child.exitCode = null;
        child.signalCode = null;
        child.kill = () => { child.signalCode = 'SIGTERM'; child.emit('exit', null, 'SIGTERM'); child.emit('close'); };
        return child;
      },
    });
    const errors = [];
    transport.resource.playStream.on('error', error => errors.push(error));
    try {
      if (intentional) await transport.dispose();
      child.signalCode = 'SIGKILL';
      child.emit('exit', null, 'SIGKILL');
      await flush();
      // The SDK pipeline reports its expected close error when disposal destroys a live stream.
      assert.deepEqual(errors.map(error => error.code), [intentional ? 'ERR_STREAM_PREMATURE_CLOSE' : 'MUSIC_FFMPEG']);
      assert.equal(transport.failure?.code ?? null, intentional ? null : 'MUSIC_FFMPEG');
    } finally { await transport.dispose(); }
    assert.equal(source.destroyed, true);
    assert.equal(child.stdout.destroyed, true);
  }
});

test('connections are reused in one voice channel and reject a different channel', async () => {
  const { manager, connections } = fixture();
  try {
    const [first, second] = await Promise.all([
      manager.connect(guild(), channel()),
      manager.connect(guild(), channel()),
    ]);
    assert.equal(first, second);
    assert.equal(connections.length, 1);
    assert.equal(connections[0].player, first.player);
    await assert.rejects(manager.connect(guild(), channel('another-voice')), errorCode('MUSIC_CHANNEL'));
    assert.equal(connections.length, 1);
    assert.equal(manager.snapshot(first).voiceChannelId, 'voice-one');
  } finally {
    await manager.close();
  }
});

test('persistent idle sessions occupy at most two slots and manual stopping frees capacity', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { manager, connections } = fixture();
  try {
    const first = await manager.connect(guild('one'), channel());
    await manager.connect(guild('two'), channel());
    t.mock.timers.tick(10 * 60_000);
    await flush();
    await assert.rejects(manager.connect(guild('three'), channel()), errorCode('MUSIC_CAPACITY'));
    assert.equal(connections.length, 2);
    await manager.stop(first);
    const replacement = await manager.connect(guild('three'), channel());
    assert.equal(manager.snapshot(replacement).status, 'idle');
    assert.equal(connections[0].destroyCount, 1);
  } finally {
    await manager.close();
  }
});

test('enqueue starts playback and limits the pending queue to 100 tracks', async () => {
  const { manager, players, preparations } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester-one');
    assert.equal(manager.snapshot(session).status, 'playing');
    assert.equal(manager.snapshot(session).current.id, track(1).id);
    assert.equal(manager.snapshot(session).current.requestedBy, 'requester-one');
    assert.equal(players[0].played.length, 1);
    for (let index = 2; index <= 101; index++) await manager.enqueue(session, track(index), 'requester-two');
    assert.equal(manager.snapshot(session).queue.length, 100);
    await assert.rejects(manager.enqueue(session, track(102), 'requester-two'), errorCode('MUSIC_QUEUE_FULL'));
    assert.equal(manager.snapshot(session).queue.length, 100);
    assert.equal(preparations.length, 1);
  } finally {
    await manager.close();
  }
});

test('pause, resume, loop and shuffle preserve the playing track', async (t) => {
  const { manager, players } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    for (let index = 1; index <= 6; index++) await manager.enqueue(session, track(index), 'requester');
    await manager.control(session, 'pause');
    assert.equal(manager.snapshot(session).status, 'paused');
    assert.equal(players[0].state.status, AudioPlayerStatus.Paused);
    await manager.control(session, 'resume');
    assert.equal(manager.snapshot(session).status, 'playing');
    assert.equal(players[0].state.status, AudioPlayerStatus.Playing);
    for (const expected of ['track', 'queue', 'off']) {
      await manager.control(session, 'loop');
      assert.equal(manager.snapshot(session).loop, expected);
    }
    const before = manager.snapshot(session);
    t.mock.method(Math, 'random', () => 0);
    await manager.control(session, 'shuffle');
    const after = manager.snapshot(session);
    assert.equal(after.current.id, before.current.id);
    assert.notDeepEqual(after.queue.map((item) => item.id), before.queue.map((item) => item.id));
    assert.deepEqual(after.queue.map((item) => item.id).sort(), before.queue.map((item) => item.id).sort());
    assert.equal(players[0].played.length, 1);
  } finally {
    await manager.close();
  }
});

test('natural Idle advances to the next track and releases the finished resource', async () => {
  const { manager, players, transports } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester');
    await manager.enqueue(session, track(2), 'requester');
    players[0].finish();
    await flush();
    assert.equal(manager.snapshot(session).current.id, track(2).id);
    assert.equal(manager.snapshot(session).status, 'playing');
    assert.equal(transports[0].disposeCount, 1);
    assert.equal(players[0].played.length, 2);
    players[0].finish();
    await flush();
    assert.equal(manager.snapshot(session).current, null);
    assert.equal(manager.snapshot(session).status, 'idle');
    assert.equal(transports[1].disposeCount, 1);
  } finally {
    await manager.close();
  }
});

function streamingFixture() {
  const streams = [];
  const failures = [];
  let player;
  const receiver = { prepareAudioPacket() {}, dispatchAudio() {} };
  const result = fixture({
    onPlaybackError: failure => failures.push(failure),
    voice: {
      createAudioPlayer(options) {
        player = createAudioPlayer(options);
        // Only the Discord network receiver is mocked; packet scheduling uses the real SDK.
        Object.defineProperty(player, 'playable', { get: () => [receiver] });
        return player;
      },
      joinVoiceChannel: options => new FakeConnection(options),
      entersState: (subject, status, signal) => subject === player
        ? entersState(subject, status, signal) : Promise.resolve(subject),
    },
    createResource: async () => {
      const source = new Readable({ objectMode: true, read() {} });
      streams.push(source);
      source.push(Buffer.from([0xf8, 0xff, 0xfe]));
      return { resource: createAudioResource(source, { inputType: StreamType.Opus }), dispose: () => source.destroy() };
    },
  });
  return { ...result, streams, failures, get player() { return player; } };
}

function audioTicks(player, count) {
  for (let index = 0; index < count; index++) {
    if (player.checkPlayable()) player._stepPrepare();
  }
}

// FFmpeg-generated 300ms stereo Ogg Opus silence: 16 audio packets, including the final partial frame.
const TAIL_OGG = Buffer.from('T2dnUwACAAAAAAAAAAANGziuAAAAAG6CAeIBE09wdXNIZWFkAQI4AYC7AAAAAABPZ2dTAAAAAAAAAAAAAA0bOK4BAAAAItGE9QE+T3B1c1RhZ3MNAAAATGF2ZjYyLjEyLjEwMQEAAAAdAAAAZW5jb2Rlcj1MYXZjNjIuMjguMTAxIGxpYm9wdXNPZ2dTAAR4OQAAAAAAAA0bOK4CAAAAfzCo7hADAwMDAwMDAwMDAwMDAwMD/P/+/P/+/P/+/P/+/P/+/P/+/P/+/P/+/P/+/P/+/P/+/P/+/P/+/P/+/P/+/P/+', 'base64');

test('real voice player drains the complete tail when FFmpeg closes stdin after input EOF and exits successfully', async () => {
  for (const pipeCode of ['EPIPE', 'ERR_STREAM_PREMATURE_CLOSE']) {
    const source = Readable.from([Buffer.from('complete synthetic input')]);
    const child = audioChild();
    let finishInput;
    child.stdin = new Writable({
      write(_chunk, _encoding, callback) { callback(); },
      final(callback) { finishInput = callback; },
    });
    const transport = await createMusicAudioResource({ openStream: async () => source }, track(1), {
      spawnImpl: () => child,
    });
    const player = createAudioPlayer();
    const errors = [];
    let sentPackets = 0;
    Object.defineProperty(player, 'playable', { get: () => [{
      prepareAudioPacket() { sentPackets++; }, dispatchAudio() {},
    }] });
    player.on('error', error => errors.push(error));
    try {
      child.stdout.push(TAIL_OGG);
      player.play(transport.resource);
      await entersState(player, AudioPlayerStatus.Playing, 1000);
      audioTicks(player, 1);
      assert.equal(source.readableEnded, true);
      assert.equal(typeof finishInput, 'function');
      finishInput(Object.assign(new Error('synthetic pipe closed'), { code: pipeCode }));
      await flush();
      child.emit('exit', 0, null);
      child.stdout.push(null);
      await flush();
      assert.deepEqual(errors, [], 'successful FFmpeg EOF must not destroy buffered audio');
      assert.equal(transport.failure, null);
      for (let tick = 0; tick < 30 && player.state.status !== AudioPlayerStatus.Idle; tick++) {
        audioTicks(player, 1);
        await flush();
      }
      assert.equal(transport.resource.playStream.readableEnded, true);
      assert.equal(player.state.status, AudioPlayerStatus.Idle);
      assert.equal(sentPackets, 21, 'all 16 audio packets and five SDK tail-padding packets must be sent');
    } finally { player.stop(true); await transport.dispose(); }
  }
});

test('tail pipe handling preserves incomplete input, upstream errors and unsuccessful FFmpeg exits', async () => {
  for (const scenario of ['partial', 'upstream', 'nonzero', 'signal', 'cancel']) {
    const source = scenario === 'partial' || scenario === 'upstream'
      ? new Readable({ read() {} }) : Readable.from([Buffer.from('complete synthetic input')]);
    if (scenario === 'partial' || scenario === 'upstream') source.push(Buffer.from('partial input'));
    const child = audioChild();
    let finishInput;
    child.stdin = new Writable({
      write(_chunk, _encoding, callback) { callback(); },
      final(callback) { finishInput = callback; },
    });
    const transport = await createMusicAudioResource({ openStream: async () => source }, track(1), {
      spawnImpl: () => child,
    });
    const player = createAudioPlayer();
    const errors = [];
    Object.defineProperty(player, 'playable', { get: () => [{ prepareAudioPacket() {}, dispatchAudio() {} }] });
    player.on('error', error => errors.push(error));
    try {
      child.stdout.push(TAIL_OGG);
      player.play(transport.resource);
      await entersState(player, AudioPlayerStatus.Playing, 1000);
      const pipeError = Object.assign(new Error('synthetic pipe closed'), { code: 'EPIPE' });
      if (scenario === 'partial') child.stdin.destroy(pipeError);
      else if (scenario === 'upstream') source.destroy(new MusicError('MUSIC_YOUTUBE_UNAVAILABLE'));
      else finishInput(pipeError);
      await flush();
      if (scenario === 'cancel') {
        player.stop(true);
        await transport.dispose();
        assert.equal(transport.failure, null);
        assert.deepEqual(errors, []);
      } else {
        child.emit('exit', scenario === 'nonzero' ? 1 : scenario === 'signal' ? null : 0,
          scenario === 'signal' ? 'SIGTERM' : null);
        await flush();
        assert.equal(errors.length, 1);
        assert.equal(transport.failure.code, scenario === 'upstream' ? 'MUSIC_YOUTUBE_UNAVAILABLE'
          : scenario === 'partial' ? 'MUSIC_PLAYBACK' : 'MUSIC_FFMPEG');
      }
    } finally { player.stop(true); await transport.dispose(); }
  }
});

test('real voice player survives a brief supply gap and resumes the same song', async () => {
  const playback = streamingFixture();
  const { manager, streams, failures } = playback;
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester');
    const resource = session.transport.resource;
    audioTicks(playback.player, 12); // One packet followed by about 220ms without data.
    await flush();
    assert.equal(streams[0].readableEnded, false);
    assert.equal(manager.snapshot(session).status, 'playing');
    assert.equal(session.transport.resource, resource);
    const duration = resource.playbackDuration;
    streams[0].push(Buffer.from([0xf8, 0xff, 0xfe]));
    audioTicks(playback.player, 1);
    assert.equal(resource.playbackDuration, duration + 20);
    assert.deepEqual(failures, []);
  } finally { await manager.close(); }
});

test('real voice player reports persistent starvation instead of looping an unfinished song', async () => {
  const playback = streamingFixture();
  const { manager, streams, failures } = playback;
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester');
    await manager.enqueue(session, track(2), 'requester');
    session.loop = 'track';
    audioTicks(playback.player, 65);
    await flush();
    assert.equal(streams[0].readableEnded, false);
    const snapshot = manager.snapshot(session);
    assert.equal(snapshot.status, 'idle');
    assert.equal(snapshot.current, null);
    assert.deepEqual(snapshot.queue.map(item => item.id), [track(2).id]);
    assert.equal(snapshot.errorText, new MusicError('MUSIC_STREAM_STALLED').message);
    assert.deepEqual(failures, [{ stage: 'audio', code: 'MUSIC_STREAM_STALLED', playedSeconds: 0.02 }]);
    assert.equal(streams.length, 1);
    assert.equal(session.connection.state.status, VoiceConnectionStatus.Ready);
    assert.equal(streams[0].destroyed, true);
  } finally { await manager.close(); }
});

test('real voice player advances normally on EOF and explicit skip does not report starvation', async () => {
  const playback = streamingFixture();
  const { manager, streams, failures } = playback;
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester');
    await manager.enqueue(session, track(2), 'requester');
    audioTicks(playback.player, 1);
    streams[0].push(null);
    playback.player.state.resource.playStream.read();
    await flush();
    audioTicks(playback.player, 12);
    await flush();
    assert.equal(streams[0].readableEnded, true);
    assert.equal(manager.snapshot(session).current.id, track(2).id);
    await manager.enqueue(session, track(3), 'requester');
    await manager.control(session, 'skip');
    assert.equal(manager.snapshot(session).current.id, track(3).id);
    await manager.stop(session);
    assert.deepEqual(failures, []);
    assert.ok(streams.every(stream => stream.destroyed));
  } finally { await manager.close(); }
});

test('real voice player preserves safe FFmpeg and YouTube failure codes when the SDK wraps stream errors', async () => {
  for (const code of ['MUSIC_FFMPEG', 'MUSIC_YOUTUBE_TIMEOUT']) {
  const failures = [];
  let player;
  const { manager } = fixture({
    onPlaybackError: failure => failures.push(failure),
    voice: {
      createAudioPlayer(options) {
        player = createAudioPlayer(options);
        Object.defineProperty(player, 'playable', { get: () => [{ prepareAudioPacket() {}, dispatchAudio() {} }] });
        return player;
      },
      joinVoiceChannel: options => new FakeConnection(options),
      entersState: (subject, status, signal) => subject === player
        ? entersState(subject, status, signal) : Promise.resolve(subject),
    },
    createResource: async () => {
      const source = new Readable({ objectMode: true, read() {} });
      source.push(Buffer.from([0xf8, 0xff, 0xfe]));
      // The transport retains only a sanitized MusicError, never FFmpeg stderr or input URLs.
      const failure = new MusicError(code);
      return { resource: createAudioResource(source, { inputType: StreamType.Opus }),
        failure, dispose: () => source.destroy() };
    },
  });
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, code === 'MUSIC_FFMPEG' ? track(1) : youtubeTrack(1), 'requester');
    await manager.enqueue(session, track(2), 'requester');
    session.loop = 'track';
    session.transport.resource.playStream.destroy(new MusicError(code));
    await flush();
    assert.deepEqual(failures, [{ stage: 'audio', code, playedSeconds: 0 }]);
    assert.equal(manager.snapshot(session).errorText, new MusicError(code).message);
    assert.equal(manager.snapshot(session).status, 'idle');
    assert.equal(session.current, null);
    assert.deepEqual(session.queue.map(item => item.id), [track(2).id]);
  } finally { await manager.close(); }
  }
});

test('skip during delayed natural-end cleanup does not advance twice or leak the next resource', async () => {
  const { manager, players, transports } = fixture();
  let releaseCleanup;
  const cleanup = new Promise((resolve) => { releaseCleanup = resolve; });
  try {
    const session = await manager.connect(guild(), channel());
    for (let index = 1; index <= 3; index++) await manager.enqueue(session, track(index), 'requester');
    transports[0].dispose = function () {
      this.disposeCount += 1;
      return cleanup;
    };
    players[0].finish();
    const skipping = manager.control(session, 'skip');
    releaseCleanup();
    await skipping;
    await flush();
    const state = manager.snapshot(session);
    assert.equal(state.status, 'playing');
    assert.equal(state.current.id, track(2).id);
    assert.deepEqual(state.queue.map((item) => item.id), [track(3).id]);
    assert.deepEqual(players[0].played.map((resource) => resource.trackId), [track(1).id, track(2).id]);
    assert.equal(transports.length, 2);
    assert.equal(transports[0].disposeCount, 1);
    await manager.close();
    assert.equal(transports[1].disposeCount, 1);
  } finally {
    releaseCleanup();
    await manager.close();
  }
});

test('single-track loop repeats naturally but skip still advances to another track', async () => {
  const { manager, players } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester');
    await manager.enqueue(session, track(2), 'requester');
    await manager.control(session, 'loop');
    players[0].finish();
    await flush();
    assert.equal(manager.snapshot(session).current.id, track(1).id);
    assert.deepEqual(manager.snapshot(session).queue.map((item) => item.id), [track(2).id]);
    await manager.control(session, 'skip');
    assert.equal(manager.snapshot(session).current.id, track(2).id);
    assert.equal(manager.snapshot(session).loop, 'track');
    await manager.control(session, 'skip');
    assert.equal(manager.snapshot(session).current, null);
    assert.equal(manager.snapshot(session).status, 'idle');
  } finally {
    await manager.close();
  }
});

test('queue loop appends a finished song after pending songs', async () => {
  const { manager, players } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester');
    await manager.enqueue(session, track(2), 'requester');
    await manager.control(session, 'loop');
    await manager.control(session, 'loop');
    players[0].finish();
    await flush();
    assert.equal(manager.snapshot(session).current.id, track(2).id);
    assert.deepEqual(manager.snapshot(session).queue.map((item) => item.id), [track(1).id]);
  } finally {
    await manager.close();
  }
});

test('single-track loop repeats the current song even with 100 pending tracks', async () => {
  const { manager, players } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    for (let index = 1; index <= 101; index++) await manager.enqueue(session, track(index), 'requester');
    await manager.control(session, 'loop');
    const pendingIds = manager.snapshot(session).queue.map((item) => item.id);
    assert.equal(pendingIds.length, 100);
    players[0].finish();
    await flush();
    const state = manager.snapshot(session);
    assert.equal(state.status, 'playing');
    assert.equal(state.current.id, track(1).id);
    assert.equal(state.queue.length, 100);
    assert.deepEqual(state.queue.map((item) => item.id), pendingIds);
  } finally {
    await manager.close();
  }
});

test('queue loop retains the finished song after advancing a full pending queue', async () => {
  const { manager, players } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    for (let index = 1; index <= 101; index++) await manager.enqueue(session, track(index), 'requester');
    await manager.control(session, 'loop');
    await manager.control(session, 'loop');
    players[0].finish();
    await flush();
    const state = manager.snapshot(session);
    assert.equal(state.status, 'playing');
    assert.equal(state.current.id, track(2).id);
    assert.equal(state.queue.length, 100);
    assert.deepEqual(state.queue.map((item) => item.id), [
      ...Array.from({ length: 99 }, (_, index) => track(index + 3).id),
      track(1).id,
    ]);
  } finally {
    await manager.close();
  }
});

test('audio errors remain visible and never repeatedly retry a bad track', async () => {
  const failures = [];
  const { manager, players, transports, preparations } = fixture({ onPlaybackError: failure => failures.push(failure) });
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester');
    await manager.enqueue(session, track(2), 'requester');
    await manager.control(session, 'loop');
    players[0].emit('error', new Error('private upstream error'));
    players[0].finish();
    await flush();
    const state = manager.snapshot(session);
    assert.equal(state.status, 'idle');
    assert.equal(state.current, null);
    assert.ok(state.errorText.length > 0);
    assert.equal(state.errorText.includes('private upstream error'), false);
    assert.deepEqual(state.queue.map((item) => item.id), [track(2).id]);
    assert.equal(preparations.length, 1);
    assert.equal(transports[0].disposeCount, 1);
    assert.deepEqual(failures, [{ stage: 'audio', code: 'MUSIC_PLAYBACK', playedSeconds: 0 }]);
  } finally {
    await manager.close();
  }
});

test('preparation failure is visible without automatic retries', async () => {
  let attempts = 0;
  const failures = [];
  const { manager, players } = fixture({
    onPlaybackError: failure => failures.push(failure),
    createResource: async () => {
      attempts += 1;
      throw new Error('private ffmpeg failure');
    },
  });
  try {
    const session = await manager.connect(guild(), channel());
    await assert.rejects(manager.enqueue(session, track(1), 'requester'), errorCode('MUSIC_PLAYBACK'));
    await flush();
    assert.equal(attempts, 1);
    assert.equal(players[0].played.length, 0);
    const state = manager.snapshot(session);
    assert.equal(state.status, 'idle');
    assert.ok(state.errorText.length > 0);
    assert.equal(state.errorText.includes('private ffmpeg failure'), false);
    assert.deepEqual(failures, [{ stage: 'prepare', code: 'MUSIC_PLAYBACK', playedSeconds: 0 }]);
  } finally {
    await manager.close();
  }
});

test('a preparation failure preserves pending tracks for a manual skip', async () => {
  const attempts = [];
  const { manager, players } = fixture({
    createResource: async (_library, selected) => {
      attempts.push(selected.id);
      if (selected.id === track(2).id) throw new MusicError('MUSIC_PLAYBACK');
      return transportFor(selected);
    },
  });
  try {
    const session = await manager.connect(guild(), channel());
    for (let index = 1; index <= 3; index++) await manager.enqueue(session, track(index), 'requester');
    players[0].finish();
    await flush();
    const failed = manager.snapshot(session);
    assert.equal(failed.status, 'idle');
    assert.equal(failed.current, null);
    assert.ok(failed.errorText.length > 0);
    assert.deepEqual(failed.queue.map((item) => item.id), [track(3).id]);
    assert.deepEqual(attempts, [track(1).id, track(2).id]);
    await manager.control(session, 'skip');
    const resumed = manager.snapshot(session);
    assert.equal(resumed.status, 'playing');
    assert.equal(resumed.current.id, track(3).id);
    assert.equal(resumed.errorText, '');
    assert.deepEqual(attempts, [track(1).id, track(2).id, track(3).id]);
  } finally {
    await manager.close();
  }
});

test('idle sessions remain connected without listeners until manually stopped', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { manager, connections, updates } = fixture();
  try {
    const session = await manager.connect(guild(), { ...channel(), members: new Map() });
    t.mock.timers.tick(10 * 60_000);
    await flush();
    assert.equal(manager.getSession('guild-one'), session);
    assert.equal(manager.snapshot(session).status, 'idle');
    assert.equal(connections[0].destroyCount, 0);
    assert.equal(updates.length, 0, 'empty idle sessions do not repeatedly edit an unchanged panel');
    await manager.control(session, 'stop');
    assert.equal(manager.getSession('guild-one'), null);
    assert.equal(manager.snapshot(session).status, 'stopped');
    assert.equal(connections[0].destroyCount, 1);
    const updateCount = updates.length;
    t.mock.timers.tick(10 * 60_000);
    await flush();
    assert.equal(updates.length, updateCount, 'manual stop also clears the periodic presenter callback');
  } finally {
    await manager.close();
  }
});

test('finishing the queue stays connected and supports later requests without reconnecting', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { manager, connections, players, transports, updates } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester');
    players[0].finish();
    await flush();
    const updateCount = updates.length;
    t.mock.timers.tick(10 * 60_000);
    await flush();
    assert.equal(manager.getSession('guild-one'), session);
    assert.equal(manager.snapshot(session).status, 'idle');
    assert.equal(manager.snapshot(session).current, null);
    assert.equal(connections[0].destroyCount, 0);
    assert.equal(transports[0].disposeCount, 1);
    assert.equal(updates.length, updateCount);
    await manager.enqueue(session, track(2), 'requester');
    assert.equal(manager.snapshot(session).status, 'playing');
    assert.equal(manager.snapshot(session).current.id, track(2).id);
    assert.equal(connections.length, 1);
    await manager.control(session, 'stop');
    assert.equal(connections[0].destroyCount, 1);
    assert.equal(transports[1].disposeCount, 1);
  } finally {
    await manager.close();
  }
});

test('logout removing the last song leaves an idle connection until shutdown', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { manager, connections, transports } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester');
    await manager.removeUserTracks(session, 'requester');
    t.mock.timers.tick(10 * 60_000);
    await flush();
    assert.equal(manager.getSession('guild-one'), session);
    assert.equal(manager.snapshot(session).status, 'idle');
    assert.equal(transports[0].disposeCount, 1);
    assert.equal(connections[0].destroyCount, 0);
    await manager.close();
    assert.equal(manager.getSession('guild-one'), null);
    assert.equal(connections[0].destroyCount, 1);
  } finally {
    await manager.close();
  }
});

test('idle playback failures retain queued account refreshes without leaving voice', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { manager, players, connections, transports, updates } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'alice');
    await manager.enqueue(session, track(2), 'bob');
    players[0].emit('error', new MusicError('MUSIC_PLAYBACK'));
    await flush();
    const updateCount = updates.length;
    t.mock.timers.tick(10 * 60_000);
    await flush();
    assert.equal(manager.getSession('guild-one'), session);
    assert.equal(manager.snapshot(session).status, 'idle');
    assert.equal(manager.snapshot(session).current, null);
    assert.deepEqual(manager.snapshot(session).queue.map(item => item.requestedBy), ['bob']);
    assert.equal(transports[0].disposeCount, 1);
    assert.equal(connections[0].destroyCount, 0);
    assert.ok(updates.length > updateCount, 'queued requester accounts still receive periodic presenter refreshes');
  } finally {
    await manager.close();
  }
});

test('disconnecting the bot still clears a persistent voice session and its resources', async () => {
  const { manager, connections, transports } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'requester');
    connections[0].emit(VoiceConnectionStatus.Disconnected);
    await flush();
    assert.equal(manager.getSession('guild-one'), null);
    assert.equal(manager.snapshot(session).status, 'stopped');
    assert.equal(session.controller.signal.aborted, true);
    assert.equal(connections[0].destroyCount, 1);
    assert.equal(transports[0].disposeCount, 1);
  } finally {
    await manager.close();
  }
});

test('stop aborts preparation and disposes a resource returned after cancellation', async () => {
  let release;
  let preparationSignal;
  let started;
  const preparing = new Promise((resolve) => { started = resolve; });
  const delayed = transportFor(track(1));
  let disposed = false;
  delayed.dispose = function () {
    if (!disposed) {
      disposed = true;
      this.disposeCount += 1;
    }
  };
  const { manager, players, connections } = fixture({
    createResource: async (_library, _track, options) => {
      preparationSignal = options.signal;
      started();
      return new Promise((resolve) => { release = () => resolve(delayed); });
    },
  });
  try {
    const session = await manager.connect(guild(), channel());
    const enqueueing = manager.enqueue(session, track(1), 'requester');
    await preparing;
    const stopping = manager.stop(session);
    assert.equal(preparationSignal.aborted, true);
    assert.equal(manager.getSession('guild-one'), null);
    release();
    await Promise.all([stopping, enqueueing]);
    assert.equal(delayed.disposeCount, 1);
    assert.equal(players[0].played.length, 0);
    assert.equal(connections[0].destroyCount, 1);
    assert.equal(manager.snapshot(session).status, 'stopped');
  } finally {
    release?.();
    await manager.close();
  }
});

test('stop and close wait for cancellation cleanup of a preparing resource', async () => {
  let releasePreparation;
  let releaseCleanup;
  let markPreparing;
  let markDisposing;
  let preparationSignal;
  let disposeCount = 0;
  let stoppingSettled = false;
  let closingSettled = false;
  const preparing = new Promise((resolve) => { markPreparing = resolve; });
  const disposing = new Promise((resolve) => { markDisposing = resolve; });
  const cleanup = new Promise((resolve) => { releaseCleanup = resolve; });
  const delayed = transportFor(track(1));
  delayed.dispose = () => {
    if (disposeCount === 0) {
      disposeCount += 1;
      markDisposing();
    }
    return cleanup;
  };
  const preparation = new Promise((resolve) => { releasePreparation = () => resolve(delayed); });
  const { manager, players, connections, library } = fixture({
    createResource: async (_library, _track, options) => {
      preparationSignal = options.signal;
      markPreparing();
      return preparation;
    },
  });
  try {
    const session = await manager.connect(guild(), channel());
    const enqueueing = manager.enqueue(session, track(1), 'requester');
    await preparing;
    const stopping = manager.stop(session).then(() => { stoppingSettled = true; });
    const closing = manager.close().then(() => { closingSettled = true; });
    assert.equal(preparationSignal.aborted, true);
    await flush();
    assert.equal(stoppingSettled, false);
    assert.equal(closingSettled, false);
    releasePreparation();
    await disposing;
    await flush();
    assert.equal(stoppingSettled, false);
    assert.equal(closingSettled, false);
    releaseCleanup();
    await Promise.all([enqueueing, stopping, closing]);
    assert.equal(disposeCount, 1);
    assert.equal(players[0].played.length, 0);
    assert.equal(connections[0].destroyCount, 1);
    assert.equal(library.closeCount, 1);
    assert.equal(manager.getSession('guild-one'), null);
  } finally {
    releasePreparation();
    releaseCleanup();
    await manager.close();
  }
});

test('close releases every voice, audio resource and library then rejects reconnecting', async () => {
  const { manager, connections, transports, preparations, library } = fixture();
  const sessions = await Promise.all([
    manager.connect(guild('one'), channel()),
    manager.connect(guild('two'), channel()),
  ]);
  for (const session of sessions) await manager.enqueue(session, track(1), 'requester');
  await manager.close();
  assert.equal(manager.getSession('one'), null);
  assert.equal(manager.getSession('two'), null);
  assert.ok(connections.every((connection) => connection.destroyCount === 1));
  assert.ok(transports.every((transport) => transport.disposeCount === 1));
  assert.ok(preparations.every((preparation) => preparation.options.signal.aborted));
  assert.equal(library.closeCount, 1);
  await assert.rejects(manager.connect(guild('three'), channel()), errorCode('MUSIC_ABORTED'));
  assert.equal(connections.length, 2);
});

test('each queued song resolves its requester account without exposing clients in snapshots', async () => {
  const accounts = new Map([['alice', { privateCookie: 'alice-cookie' }], ['bob', { privateCookie: 'bob-cookie' }]]);
  const selectedLibraries = [];
  const { manager, players } = fixture({
    library: undefined,
    resolveLibrary(session, selected) {
      assert.equal(session.guildId, 'guild-one');
      return accounts.get(selected.requestedBy);
    },
    async createResource(library, selected) {
      selectedLibraries.push(library);
      return transportFor(selected);
    },
  });
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'alice');
    await manager.enqueue(session, track(2), 'bob');
    players[0].finish();
    await flush();
    assert.deepEqual(selectedLibraries, [accounts.get('alice'), accounts.get('bob')]);
    assert.equal(manager.snapshot(session).current.requestedBy, 'bob');
    assert.equal(JSON.stringify(manager.snapshot(session)).includes('Cookie'), false);
  } finally { await manager.close(); }
});

test('logout removes only that requester queue while another requester keeps playing', async () => {
  const { manager, players, preparations, transports } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'bob');
    await manager.enqueue(session, track(2), 'alice');
    await manager.enqueue(session, track(3), 'bob');
    await manager.enqueue(session, track(4), 'alice');
    await manager.removeUserTracks(session, 'alice');
    assert.equal(manager.snapshot(session).current.id, track(1).id);
    assert.equal(manager.snapshot(session).status, 'playing');
    assert.deepEqual(manager.snapshot(session).queue.map(item => item.id), [track(3).id]);
    assert.equal(players[0].played.length, 1);
    assert.equal(preparations[0].options.signal.aborted, false);
    assert.equal(transports[0].disposeCount, 0);
  } finally { await manager.close(); }
});

test('NAS logout leaves the same requester YouTube playback and queued YouTube songs intact', async () => {
  const { manager, preparations, transports } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, youtubeTrack(1), 'alice');
    await manager.enqueue(session, track(2), 'alice');
    await manager.enqueue(session, youtubeTrack(3), 'alice');
    await manager.enqueue(session, { ...track(4), source: 'nas' }, 'alice');
    await manager.enqueue(session, track(5), 'bob');
    await manager.removeUserTracks(session, 'alice');
    assert.equal(manager.snapshot(session).current.source, 'youtube');
    assert.equal(manager.snapshot(session).current.requestedBy, 'alice');
    assert.equal(manager.snapshot(session).status, 'playing');
    assert.deepEqual(session.queue.map(item => item.id), [youtubeTrack(3).id, track(5).id]);
    assert.equal(preparations[0].options.signal.aborted, false);
    assert.equal(transports[0].disposeCount, 0);
  } finally { await manager.close(); }
});

test('NAS logout cancels current NAS audio and advances to the same requester YouTube song', async () => {
  const nas = {}, youtube = {}, providers = [];
  const { manager, players } = fixture({
    resolveLibrary(_session, selected) { return selected.source === 'youtube' ? youtube : nas; },
    async createResource(provider, selected) { providers.push(provider); return transportFor(selected); },
  });
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'alice');
    await manager.enqueue(session, youtubeTrack(2), 'alice');
    await manager.enqueue(session, track(3), 'alice');
    await manager.enqueue(session, { ...track(4), source: 'nas' }, 'bob');
    await manager.removeUserTracks(session, 'alice');
    assert.equal(session.current.id, youtubeTrack(2).id);
    assert.deepEqual(session.queue.map(item => item.id), [track(4).id]);
    players[0].finish();
    await flush();
    assert.equal(session.current.id, track(4).id);
    assert.deepEqual(providers, [nas, youtube, nas]);
  } finally { await manager.close(); }
});

test('YouTube loop and skip reopen provider audio and clean every previous downloader', async () => {
  const opened = [], disposed = [];
  const provider = { async openAudio(selected) {
    const token = opened.length;
    opened.push(selected.id);
    return {
      source: Readable.from([Buffer.from('synthetic-audio')]), mime: 'audio/webm',
      async dispose() { disposed.push(token); },
    };
  } };
  const { manager, players } = fixture({
    resolveLibrary: () => provider,
    createResource: (library, selected, options) => createMusicAudioResource(library, selected, {
      ...options, spawnImpl: () => audioChild(),
    }),
  });
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, youtubeTrack(1), 'alice');
    await manager.enqueue(session, youtubeTrack(2), 'alice');
    session.loop = 'track';
    players[0].finish();
    await flush();
    assert.deepEqual(opened, [youtubeTrack(1).id, youtubeTrack(1).id]);
    assert.deepEqual(disposed, [0]);
    await manager.control(session, 'skip');
    assert.deepEqual(opened, [youtubeTrack(1).id, youtubeTrack(1).id, youtubeTrack(2).id]);
    assert.deepEqual(disposed, [0, 1]);
    await manager.stop(session);
    assert.deepEqual(disposed, [0, 1, 2]);
  } finally { await manager.close(); }
});

test('logout cancels its current song, removes its queued songs and advances to another account', async () => {
  const { manager, players, preparations, transports } = fixture();
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'alice');
    await manager.enqueue(session, track(2), 'alice');
    await manager.enqueue(session, track(3), 'bob');
    await manager.removeUserTracks(session, 'alice');
    assert.equal(preparations[0].options.signal.aborted, true);
    assert.equal(transports[0].disposeCount, 1);
    assert.equal(manager.snapshot(session).current.id, track(3).id);
    assert.equal(manager.snapshot(session).status, 'playing');
    assert.deepEqual(manager.snapshot(session).queue, []);
    assert.deepEqual(players[0].played.map(item => item.trackId), [track(1).id, track(3).id]);
  } finally { await manager.close(); }
});

test('logout awaits a late preparing resource cleanup before starting the next account', async () => {
  let releasePreparation, releaseCleanup, markPreparing, markDisposing;
  let preparationSignal;
  let removingSettled = false;
  const preparing = new Promise(resolve => { markPreparing = resolve; });
  const disposing = new Promise(resolve => { markDisposing = resolve; });
  const cleanup = new Promise(resolve => { releaseCleanup = resolve; });
  const delayed = transportFor(track(1));
  delayed.dispose = () => { markDisposing(); return cleanup; };
  const resources = [];
  const { manager, players } = fixture({
    async createResource(_library, selected, options) {
      resources.push(selected.id);
      if (selected.id !== track(1).id) return transportFor(selected);
      preparationSignal = options.signal;
      markPreparing();
      return new Promise(resolve => { releasePreparation = () => resolve(delayed); });
    },
  });
  try {
    const session = await manager.connect(guild(), channel());
    const enqueueing = manager.enqueue(session, track(1), 'alice');
    await preparing;
    // Enqueue holds its exclusive lock while Alice's resource is preparing.
    session.queue.push({ ...track(2), requestedBy: 'alice' }, { ...track(3), requestedBy: 'bob' });
    const removing = manager.removeUserTracks(session, 'alice').then(() => { removingSettled = true; });
    assert.equal(preparationSignal.aborted, true);
    assert.equal(manager.snapshot(session).current, null);
    assert.deepEqual(manager.snapshot(session).queue.map(item => item.id), [track(3).id]);
    releasePreparation();
    await disposing;
    await flush();
    assert.equal(removingSettled, false);
    assert.deepEqual(resources, [track(1).id]);
    assert.deepEqual(players[0].played, []);
    releaseCleanup();
    await Promise.all([enqueueing, removing]);
    assert.deepEqual(resources, [track(1).id, track(3).id]);
    assert.deepEqual(players[0].played.map(item => item.trackId), [track(3).id]);
    assert.equal(manager.snapshot(session).current.requestedBy, 'bob');
  } finally {
    releasePreparation?.(); releaseCleanup();
    await manager.close();
  }
});

test('logout during natural-end cleanup prevents both loop modes from resurrecting its songs', async () => {
  for (const loop of ['track', 'queue']) {
    const { manager, players, transports } = fixture();
    let releaseCleanup;
    const cleanup = new Promise(resolve => { releaseCleanup = resolve; });
    try {
      const session = await manager.connect(guild(), channel());
      await manager.enqueue(session, track(1), 'alice');
      await manager.enqueue(session, track(2), 'bob');
      session.loop = loop;
      transports[0].dispose = function () { this.disposeCount += 1; return cleanup; };
      players[0].finish();
      const removing = manager.removeUserTracks(session, 'alice');
      releaseCleanup();
      await removing;
      await flush();
      assert.equal(manager.snapshot(session).current.requestedBy, 'bob');
      assert.equal(manager.snapshot(session).queue.some(item => item.requestedBy === 'alice'), false);
      assert.deepEqual(players[0].played.map(item => item.trackId), [track(1).id, track(2).id]);
      players[0].finish();
      await flush();
      assert.equal(manager.snapshot(session).current.requestedBy, 'bob');
      assert.equal(manager.snapshot(session).queue.some(item => item.requestedBy === 'alice'), false);
    } finally { releaseCleanup(); await manager.close(); }
  }
});

test('an unavailable requester account leaves a visible error and never uses a fallback account', async () => {
  const resolved = [];
  const { manager, players } = fixture({
    resolveLibrary(_session, selected) {
      resolved.push(selected.requestedBy);
      throw new MusicError('MUSIC_AUTH');
    },
    createResource() { assert.fail('a missing requester account cannot use the shared library'); },
  });
  try {
    const session = await manager.connect(guild(), channel());
    await assert.rejects(manager.enqueue(session, track(1), 'alice'), errorCode('MUSIC_AUTH'));
    await flush();
    assert.deepEqual(resolved, ['alice']);
    assert.equal(players[0].played.length, 0);
    assert.equal(manager.snapshot(session).current, null);
    assert.equal(manager.snapshot(session).status, 'idle');
    assert.equal(manager.snapshot(session).errorText, new MusicError('MUSIC_AUTH').message);
  } finally { await manager.close(); }
});

test('shutdown during logout cleanup never starts the remaining account', async () => {
  const { manager, players, transports } = fixture({ library: undefined });
  let releaseCleanup;
  const cleanup = new Promise(resolve => { releaseCleanup = resolve; });
  let closingSettled = false;
  try {
    const session = await manager.connect(guild(), channel());
    await manager.enqueue(session, track(1), 'alice');
    await manager.enqueue(session, track(2), 'bob');
    transports[0].dispose = () => cleanup;
    const removing = manager.removeUserTracks(session, 'alice');
    const closing = manager.close().then(() => { closingSettled = true; });
    await flush();
    assert.equal(closingSettled, false);
    releaseCleanup();
    await Promise.all([removing, closing]);
    assert.equal(manager.snapshot(session).status, 'stopped');
    assert.equal(manager.snapshot(session).current, null);
    assert.deepEqual(manager.snapshot(session).queue, []);
    assert.deepEqual(players[0].played.map(item => item.trackId), [track(1).id]);
  } finally { releaseCleanup(); await manager.close(); }
});

test('logout while resolving an account prevents late credentials from starting audio', async () => {
  let releaseAccount, markResolving;
  const resolving = new Promise(resolve => { markResolving = resolve; });
  const { manager, players } = fixture({
    resolveLibrary() {
      markResolving();
      return new Promise(resolve => { releaseAccount = () => resolve({ privateCookie: 'expired' }); });
    },
    createResource() { assert.fail('a cancelled account resolution must not open an audio stream'); },
  });
  try {
    const session = await manager.connect(guild(), channel());
    const enqueueing = manager.enqueue(session, track(1), 'alice');
    await resolving;
    const removing = manager.removeUserTracks(session, 'alice');
    releaseAccount();
    await Promise.all([enqueueing, removing]);
    assert.deepEqual(players[0].played, []);
    assert.equal(manager.snapshot(session).current, null);
    assert.equal(manager.snapshot(session).status, 'idle');
  } finally { releaseAccount?.(); await manager.close(); }
});
