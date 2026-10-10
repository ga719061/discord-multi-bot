import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { AudioPlayerStatus, createAudioPlayer, entersState } from '@discordjs/voice';
import { createMusicAudioResource } from '../src/utils/musicPlayback.js';

// Synthetic media only; no credentials, real library, or Discord connection.
const sampleRate = 48_000;
function syntheticWav(seconds) {
  const samples = sampleRate * seconds;
  const audio = Buffer.alloc(44 + samples * 2);
  audio.write('RIFF', 0);
  audio.writeUInt32LE(audio.length - 8, 4);
  audio.write('WAVEfmt ', 8);
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(sampleRate, 24);
  audio.writeUInt32LE(sampleRate * 2, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write('data', 36);
  audio.writeUInt32LE(audio.length - 44, 40);
  for (let i = 0; i < samples; i++) {
    audio.writeInt16LE(Math.round(Math.sin(i * 440 * 2 * Math.PI / sampleRate) * 4000), 44 + i * 2);
  }
  return audio;
}

const audio = syntheticWav(3);
const ffmpegPath = process.env.MUSIC_FFMPEG_PATH || 'ffmpeg';
async function verify(source, mime, minimumPackets, isCueTrack = false, youtube = false) {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 60_000);
  let transport;
  let preparedFile;
  let ffmpegStderr = '';
  let childExit = null;
  let sourceDisposed = 0;
  try {
    const library = youtube ? { openAudio: async (_track, options) => {
      assert.equal(options.signal, controller.signal);
      return { source, mime, async dispose() { sourceDisposed++; } };
    } } : { openStream: async (_id, options) => {
      assert.equal(options.isCueTrack, isCueTrack);
      return source;
    } };
    transport = await createMusicAudioResource(library, {
      id: 'synthetic', source: youtube ? 'youtube' : 'nas',
      mime: youtube ? 'audio/mpeg' : mime, isCueTrack,
    }, {
      signal: controller.signal, ffmpegPath,
      spawnImpl(file, args, options) {
        try {
          for (const [option, expected] of Object.entries({
            '-af': 'volume=0.5', '-ar': '48000', '-ac': '2', '-c:a': 'libopus', '-b:a': '128k',
            '-vbr': 'on', '-compression_level': '10', '-application': 'audio', '-frame_duration': '20',
            '-f': 'ogg', '-page_duration': '20000', '-flush_packets': '1',
          })) assert.equal(args[args.lastIndexOf(option) + 1], expected);
          const input = args[args.indexOf('-i') + 1];
          if (input !== 'pipe:0') preparedFile = input;
          const child = spawn(file, args, options);
          child.stderr.on('data', (chunk) => { ffmpegStderr += chunk.toString(); });
          child.on('close', (code, signal) => { childExit = { code, signal }; });
          return child;
        } catch (error) {
          ffmpegStderr += `spawn verification failed: ${error.message}`;
          throw error;
        }
      },
    });
    assert.deepEqual(transport.resource.edges.map((edge) => edge.type), ['ogg/opus demuxer']);
    assert.equal(transport.resource.encoder, undefined);
    assert.equal(transport.resource.volume, undefined);
    let packets = 0;
    let bytes = 0;
    for await (const packet of transport.resource.playStream) {
      assert.ok(Buffer.isBuffer(packet));
      packets++;
      bytes += packet.length;
    }
    assert.ok(packets >= minimumPackets, 'Synthetic audio did not produce enough Opus packets');
    assert.ok(bytes > 0);
    return packets;
  } catch (error) {
    console.error(`[音訊診斷] ${mime}:`, error instanceof Error ? error.stack : String(error), ffmpegStderr, childExit);
    throw error;
  } finally {
    clearTimeout(deadline);
    controller.abort();
    await transport?.dispose();
    if (preparedFile) await assert.rejects(access(preparedFile), { code: 'ENOENT' });
    assert.ok(source.destroyed);
    if (youtube) assert.equal(sourceDisposed, 1, 'YouTube provider must be disposed exactly once');
  }
}

async function verifyYouTubeCancellation(path, mime) {
  const controller = new AbortController();
  const source = createReadStream(path);
  let disposed = 0;
  let childClosed = false;
  let preparedFile;
  const transport = await createMusicAudioResource({ async openAudio() {
    return { source, mime, async dispose() { disposed++; } };
  } }, { source: 'youtube', id: 'synthetic-cancel' }, {
    signal: controller.signal, ffmpegPath,
    spawnImpl(file, args, options) {
      const input = args[args.indexOf('-i') + 1];
      if (input !== 'pipe:0') preparedFile = input;
      const child = spawn(file, args, options);
      child.once('close', () => { childClosed = true; });
      return child;
    },
  });
  // No player is needed: cancellation must still reap both producers and temporary files.
  transport.resource.playStream.on('error', () => {});
  controller.abort();
  await transport.dispose();
  assert.equal(childClosed, true, 'Cancellation must wait for FFmpeg close');
  assert.equal(source.destroyed, true);
  assert.equal(disposed, 1);
  assert.equal(transport.failure, null, 'Intentional cancellation must not report playback failure');
  if (preparedFile) await assert.rejects(access(preparedFile), { code: 'ENOENT' });
}

async function verifyRealtime(blockMs) {
  const controller = new AbortController();
  const source = Readable.from([syntheticWav(3)]);
  const transport = await createMusicAudioResource({ openStream: async () => source }, {
    id: 'synthetic-realtime', mime: 'audio/wav',
  }, { signal: controller.signal, ffmpegPath });
  const player = createAudioPlayer();
  const dispatchTimes = [];
  let preparedPackets = 0;
  const silencePacketPositions = [];
  let delayInterval;
  let timeout;
  let failure;
  const lag = monitorEventLoopDelay({ resolution: 10 });
  const connection = {
    state: { status: 'ready' },
    setSpeaking() {},
    onSubscriptionRemoved() {},
    prepareAudioPacket(packet) {
      if (packet.equals(Buffer.from([0xf8, 0xff, 0xfe]))) silencePacketPositions.push(preparedPackets);
      preparedPackets++;
    },
    dispatchAudio() { dispatchTimes.push(performance.now()); },
  };
  player.on('error', (error) => { failure = error; });
  const subscription = player.subscribe(connection);
  const finished = new Promise((resolve) => player.once(AudioPlayerStatus.Idle, resolve));
  try {
    player.play(transport.resource);
    await entersState(player, AudioPlayerStatus.Playing, 5000);
    lag.enable();
    if (blockMs) delayInterval = setInterval(() => {
      const end = performance.now() + blockMs;
      while (performance.now() < end) { /* controlled scheduling stall */ }
    }, 750);
    await Promise.race([
      finished,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Realtime playback timed out')), 7000); }),
    ]);
    if (failure) throw failure;
    const gaps = dispatchTimes.slice(1).map((time, index) => time - dispatchTimes[index]);
    assert.ok(dispatchTimes.length >= 135, 'Realtime Opus packets were not dispatched');
    return {
      injectedBlockMs: blockMs,
      packets: dispatchTimes.length,
      maxDispatchGapMs: Number(Math.max(...gaps).toFixed(1)),
      dispatchGapsOver60Ms: gaps.filter((gap) => gap > 60).length,
      silencePacketPositions,
      preparedPackets,
      maxEventLoopLagMs: Number((lag.max / 1e6).toFixed(1)),
    };
  } finally {
    clearTimeout(timeout);
    clearInterval(delayInterval);
    lag.disable();
    player.stop(true);
    subscription.unsubscribe();
    controller.abort();
    await transport.dispose();
  }
}

let temporaryDirectory;
try {
  const wavPackets = await verify(Readable.from([audio]), 'audio/wav', 40);
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'gigi-music-test-'));
  const flacPath = join(temporaryDirectory, 'cue-track.flac');
  await promisify(execFile)(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-c:a', 'flac', '-y', flacPath,
  ], { windowsHide: true, timeout: 15_000 });
  const cuePackets = await verify(createReadStream(flacPath), 'audio/flac', 135, true);
  const mp3Path = join(temporaryDirectory, 'tone.mp3');
  await promisify(execFile)(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=660:duration=3',
    '-c:a', 'libmp3lame', '-b:a', '192k', '-y', mp3Path,
  ], { windowsHide: true, timeout: 15_000 });
  const mp3Packets = await verify(createReadStream(mp3Path), 'audio/mpeg', 135);
  const webmPath = join(temporaryDirectory, 'tone.webm');
  await promisify(execFile)(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=3',
    '-c:a', 'libopus', '-b:a', '128k', '-y', webmPath,
  ], { windowsHide: true, timeout: 15_000 });
  const youtubeWebmPackets = await verify(createReadStream(webmPath), 'audio/webm', 135, false, true);
  const m4aPath = join(temporaryDirectory, 'tone.m4a');
  await promisify(execFile)(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=30',
    '-c:a', 'aac', '-b:a', '192k', '-y', m4aPath,
  ], { windowsHide: true, timeout: 15_000 });
  const m4a = await readFile(m4aPath);
  assert.ok(m4a.indexOf('moov') > m4a.indexOf('mdat'), 'M4A must have its index after the audio');
  const m4aPackets = await verify(createReadStream(m4aPath), 'audio/mp4', 1400);
  const youtubeM4aPackets = await verify(createReadStream(m4aPath), 'audio/mp4', 1400, false, true);
  await verifyYouTubeCancellation(webmPath, 'audio/webm');
  await verifyYouTubeCancellation(m4aPath, 'audio/mp4');
  const realtime = await verifyRealtime(0);
  const stalled = await verifyRealtime(70);
  assert.equal(realtime.silencePacketPositions.length, 5, 'Only the standard five tail-padding packets should be silent');
  assert.deepEqual(realtime.silencePacketPositions, [
    realtime.preparedPackets - 5, realtime.preparedPackets - 4, realtime.preparedPackets - 3,
    realtime.preparedPackets - 2, realtime.preparedPackets - 1,
  ]);
  assert.deepEqual(stalled.silencePacketPositions, [
    stalled.preparedPackets - 5, stalled.preparedPackets - 4, stalled.preparedPackets - 3,
    stalled.preparedPackets - 2, stalled.preparedPackets - 1,
  ], 'Scheduling stalls should not exhaust the buffered audio');
  assert.ok(stalled.dispatchGapsOver60Ms >= 3, 'Injected event-loop stalls should be visible in packet timing');
  console.log(JSON.stringify({
    audioPipeline: {
      wavPackets, cueFlacPackets: cuePackets, mp3Packets, tailIndexedM4aPackets: m4aPackets,
      youtubeWebmPackets, youtubeTailIndexedM4aPackets: youtubeM4aPackets, youtubeCancellation: 'passed',
    },
    realtimeBaseline: realtime,
    injectedSchedulingStalls: stalled,
  }, null, 2));
  console.log('音訊驗證通過：FFmpeg 直接輸出 Ogg Opus、各格式解封裝及 20ms 實際發送節奏均符合預期。');
} catch (error) {
  console.error('音訊驗證失敗：請確認 FFmpeg 可用、MUSIC_FFMPEG_PATH 正確，且已安裝音樂播放依賴。');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
}
