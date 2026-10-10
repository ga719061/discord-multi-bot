import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus,
  createAudioPlayer, createAudioResource, entersState, joinVoiceChannel,
} from '@discordjs/voice';
import { MusicError } from './musicLibrary.js';

export const MUSIC_QUEUE_LIMIT = 100;

export async function createMusicAudioResource(library, track, {
  signal, ffmpegPath = 'ffmpeg', spawnImpl = spawn,
} = {}) {
  const opened = track.source === 'youtube' ? await library.openAudio(track, { signal }) : {
    source: await library.openStream(track.id, { signal, isCueTrack: track.isCueTrack === true }),
    mime: track.mime,
  };
  const source = opened.source;
  const disposeSource = async () => { source.destroy(); await opened.dispose?.(); };
  if (signal?.aborted) {
    await disposeSource();
    throw new MusicError('MUSIC_ABORTED');
  }
  const seekable = /^(?:audio\/(?:mp4|x-m4a)|video\/mp4)$/i.test(opened.mime || '');
  let temporaryDirectory;
  let input = 'pipe:0';
  if (seekable) {
    try {
      temporaryDirectory = await mkdtemp(join(tmpdir(), 'gigi-music-'));
      input = join(temporaryDirectory, 'audio.m4a');
      await pipeline(source, createWriteStream(input, { mode: 0o600 }), {
        signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(60_000)]),
      });
    } catch (error) {
      await disposeSource();
      if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
      throw signal?.aborted ? new MusicError('MUSIC_ABORTED')
        : error instanceof MusicError ? error : new MusicError('MUSIC_PLAYBACK');
    }
  }
  let disposed = false;
  let failure = null;
  let child;
  try { child = spawnImpl(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-nostdin',
    '-protocol_whitelist', seekable ? 'file,pipe,crypto,data' : 'pipe,crypto,data',
    // Force the MOV demuxer and disable external references for local seekable input.
    ...(seekable ? ['-f', 'mov', '-enable_drefs', '0', '-use_absolute_path', '0'] : []),
    '-i', input,
    '-vn', '-sn', '-dn', '-af', 'volume=0.5',
    '-ar', '48000', '-ac', '2', '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on',
    '-compression_level', '10', '-application', 'audio', '-frame_duration', '20',
    '-f', 'ogg', '-page_duration', '20000', '-flush_packets', '1', 'pipe:1',
  ], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch {
    await disposeSource();
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
    throw new MusicError('MUSIC_PLAYBACK');
  }
  let childClosed = false;
  const closed = new Promise(resolve => child.once('close', () => { childClosed = true; resolve(); }));
  let cleanup;
  const dispose = () => {
    if (disposed) return cleanup;
    disposed = true;
    signal?.removeEventListener('abort', abort);
    const sourceCleanup = disposeSource();
    child.stdin.destroy();
    child.stdout.destroy();
    let forceKill;
    if (!childClosed) {
      child.kill();
      if (!childClosed) {
        forceKill = setTimeout(() => { if (!childClosed) child.kill('SIGKILL'); }, 2000);
        forceKill.unref?.();
      }
    }
    cleanup = Promise.all([closed, sourceCleanup]).then(async () => {
      if (temporaryDirectory) await rm(temporaryDirectory, {
        recursive: true, force: true, maxRetries: 5, retryDelay: 100,
      });
    }).finally(() => clearTimeout(forceKill));
    return cleanup;
  };
  const fail = error => {
    if (!disposed) {
      failure ||= error instanceof MusicError ? error : new MusicError('MUSIC_PLAYBACK');
      child.stdout.destroy(failure);
    }
  };
  child.on('error', () => fail(new MusicError('MUSIC_FFMPEG')));
  child.on('exit', (code, signal) => {
    if (signal || (code !== 0 && code !== null)) fail(new MusicError('MUSIC_FFMPEG'));
  });
  child.stderr.resume();
  const abort = () => { dispose().catch(fail); };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) {
    await dispose();
    throw new MusicError('MUSIC_ABORTED');
  }
  try {
    const resource = createAudioResource(child.stdout, { inputType: StreamType.OggOpus });
    if (seekable) child.stdin.end();
    else pipeline(source, child.stdin).catch(error => { if (!disposed) fail(error); });
    return { resource, dispose, get failure() { return failure; } };
  } catch {
    await dispose();
    throw new MusicError('MUSIC_PLAYBACK');
  }
}

export class MusicPlaybackManager {
  constructor({
    library, resolveLibrary = () => library, ffmpegPath = 'ffmpeg', onUpdate = () => {}, onPlaybackError = () => {}, onStop = () => {}, maxSessions = 2,
    playbackTimeoutMs = 15_000,
    voice = { createAudioPlayer, entersState, joinVoiceChannel },
    createResource = createMusicAudioResource,
  }) {
    this.library = library;
    this.resolveLibrary = resolveLibrary;
    this.ffmpegPath = ffmpegPath;
    this.onUpdate = onUpdate;
    this.onPlaybackError = onPlaybackError;
    this.onStop = onStop;
    this.maxSessions = maxSessions;
    this.playbackTimeoutMs = playbackTimeoutMs;
    this.voice = voice;
    this.createResource = createResource;
    this.sessions = new Map();
    this.pendingStops = new Set();
    this.closed = false;
  }

  getSession(guildId) { return this.sessions.get(guildId) || null; }

  snapshot(session) {
    return {
      id: session.id, voiceChannelId: session.voiceChannelId, status: session.status,
      current: session.current ? { ...session.current } : null,
      positionSeconds: Math.max(0, (session.transport?.resource.playbackDuration || 0) / 1000),
      loop: session.loop, queue: session.queue.map(track => ({ ...track })),
      errorText: session.errorText, youtubeAvailable: session.youtubeAvailable,
    };
  }

  async connect(guild, channel) {
    if (this.closed) throw new MusicError('MUSIC_ABORTED');
    const existing = this.getSession(guild.id);
    if (existing) {
      if (existing.voiceChannelId !== channel.id) throw new MusicError('MUSIC_CHANNEL');
      await existing.ready;
      return existing;
    }
    if (this.sessions.size >= this.maxSessions) throw new MusicError('MUSIC_CAPACITY');
    const session = {
      id: randomUUID(), guildId: guild.id, voiceChannelId: channel.id,
      status: 'connecting', current: null, queue: [], loop: 'off',
      controller: new AbortController(), transport: null, trackController: null,
      generation: 0, locked: false, updateTimer: null,
      errorText: '', message: null, textChannelId: null, publishPromise: null,
    };
    this.sessions.set(guild.id, session);
    session.ready = this.initialize(session, guild, channel);
    try { await session.ready; return session; }
    catch { await this.stop(session); throw new MusicError('MUSIC_VOICE'); }
  }

  async initialize(session, guild, channel) {
    session.player = this.voice.createAudioPlayer({ behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause, maxMissedFrames: 50,
    } });
    session.player.on('error', error => this.playbackFailed(session, error));
    session.player.on(AudioPlayerStatus.Idle, oldState => {
      if (session.status !== 'playing' && session.status !== 'paused') return;
      // SDK destroys the stream before emitting Idle, even when it has not reached EOF.
      if (oldState?.resource === session.transport?.resource && oldState?.resource?.playStream?.readableEnded === false) {
        this.playbackFailed(session, new MusicError('MUSIC_STREAM_STALLED'));
      } else this.trackEnded(session);
    });
    session.connection = this.voice.joinVoiceChannel({
      guildId: guild.id, channelId: channel.id, adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true, selfMute: false,
    });
    session.connection.on('error', () => {
      session.errorText = new MusicError('MUSIC_VOICE').message;
      this.stop(session);
    });
    session.connection.on(VoiceConnectionStatus.Disconnected, () => {
      session.errorText = new MusicError('MUSIC_VOICE').message;
      this.stop(session);
    });
    session.connection.subscribe(session.player);
    await this.voice.entersState(session.connection, VoiceConnectionStatus.Ready,
      AbortSignal.any([session.controller.signal, AbortSignal.timeout(15_000)]));
    if (session.controller.signal.aborted) throw new MusicError('MUSIC_ABORTED');
    session.status = 'idle';
    session.updateTimer = setInterval(() => {
      if (session.status !== 'idle' || session.queue.length) this.notify(session);
    }, 15_000);
    session.updateTimer.unref?.();
  }

  notify(session) {
    return Promise.resolve().then(() => this.onUpdate(session)).catch(() => {
      // A stale or deleted panel must not leave an uncontrolled voice session running.
      if (session.status !== 'stopped') return this.stop(session);
    });
  }

  async exclusive(session, run) {
    if (session.status === 'stopped' || this.closed) throw new MusicError('MUSIC_EXPIRED');
    if (session.locked) throw new MusicError('MUSIC_BUSY');
    session.locked = true;
    try { return await run(); } finally { session.locked = false; }
  }

  async enqueue(session, track, requestedBy) {
    return this.exclusive(session, async () => {
      if (session.queue.length >= MUSIC_QUEUE_LIMIT) throw new MusicError('MUSIC_QUEUE_FULL');
      session.queue.push({ ...track, requestedBy });
      if (!session.current) await this.startNext(session);
      this.notify(session);
    });
  }

  disposeTrack(session) {
    session.generation++;
    session.trackController?.abort();
    session.trackController = null;
    const cleanup = session.transport?.dispose();
    session.cleanupPromise = Promise.all([session.cleanupPromise, cleanup]).then(() => undefined);
    session.transport = null;
    session.player?.stop(true);
    return session.cleanupPromise;
  }

  async removeUserTracks(session, requestedBy) {
    const ownsNasTrack = track => track?.requestedBy === requestedBy && track.source !== 'youtube';
    session.queue = session.queue.filter(track => !ownsNasTrack(track));
    if (session.status === 'stopped' || !ownsNasTrack(session.current)) {
      await this.notify(session);
      return;
    }
    // Invalidate before awaiting so an Idle event or late preparation cannot replay this user.
    session.status = 'loading';
    session.current = null;
    const preparation = session.preparation;
    const cleanup = this.disposeTrack(session);
    const generation = session.generation;
    session.cleanupPromise = Promise.all([
      cleanup, preparation?.then(transport => transport.dispose(), () => undefined),
    ]).then(() => undefined);
    await session.cleanupPromise;
    if (generation !== session.generation || session.status === 'stopped') return;
    try { await this.startNext(session); } catch { /* startNext preserves a visible error state. */ }
  }

  async startNext(session) {
    const cleanup = this.disposeTrack(session);
    const generation = session.generation;
    await cleanup;
    if (generation !== session.generation || session.status === 'stopped') return;
    session.current = session.queue.shift() || null;
    if (!session.current) {
      session.status = 'idle';
      this.notify(session);
      return;
    }
    session.status = 'loading';
    session.errorText = '';
    const trackController = new AbortController();
    session.trackController = trackController;
    this.notify(session);
    const preparingTrack = session.current;
    const preparation = Promise.resolve().then(async () => {
      const library = await this.resolveLibrary(session, preparingTrack);
      const signal = AbortSignal.any([session.controller.signal, trackController.signal]);
      if (signal.aborted) throw new MusicError('MUSIC_ABORTED');
      return this.createResource(library, preparingTrack, {
        signal, ffmpegPath: this.ffmpegPath,
      });
    });
    session.preparation = preparation;
    try {
      const transport = await preparation;
      if (generation !== session.generation || session.status === 'stopped') {
        await transport.dispose();
        return;
      }
      session.transport = transport;
      session.player.play(transport.resource);
      await this.voice.entersState(session.player, AudioPlayerStatus.Playing,
        AbortSignal.any([trackController.signal, AbortSignal.timeout(this.playbackTimeoutMs)]));
      if (generation !== session.generation || session.status === 'stopped') return;
      session.status = 'playing';
      this.notify(session);
    } catch (error) {
      if (generation !== session.generation || session.status === 'stopped') return;
      const failure = this.reportPlaybackError(session, error, 'prepare');
      session.status = 'idle';
      const cleanup = this.disposeTrack(session);
      const cleanupGeneration = session.generation;
      await cleanup;
      if (cleanupGeneration !== session.generation || session.status === 'stopped') return;
      session.current = null;
      session.errorText = failure.message;
      this.notify(session);
      throw new MusicError(failure.code);
    } finally {
      if (session.preparation === preparation) session.preparation = null;
    }
  }

  async trackEnded(session) {
    const finished = session.current;
    session.status = 'loading';
    // Requeue before selecting the next track so a full pending queue still loops.
    if (finished && session.loop !== 'off') {
      if (session.loop === 'track') session.queue.unshift(finished);
      else session.queue.push(finished);
    }
    try { await this.startNext(session); } catch { /* startNext preserves a visible error state. */ }
  }

  reportPlaybackError(session, error, stage) {
    const transport = session.transport;
    // AudioPlayerError wraps stream errors without retaining their code or cause.
    const cause = error instanceof MusicError ? error
      : transport && error?.resource === transport.resource ? transport.failure : error?.cause;
    const failure = cause instanceof MusicError ? cause : new MusicError('MUSIC_PLAYBACK');
    this.onPlaybackError({
      stage, code: failure.code,
      playedSeconds: Math.max(0, (session.transport?.resource.playbackDuration || 0) / 1000),
    });
    return failure;
  }

  async playbackFailed(session, error) {
    if (session.status === 'loading' || session.status === 'stopped') return;
    const failure = this.reportPlaybackError(session, error, 'audio');
    session.status = 'idle';
    const cleanup = this.disposeTrack(session);
    const generation = session.generation;
    await cleanup;
    if (generation !== session.generation || session.status === 'stopped') return;
    session.current = null;
    session.errorText = failure.message;
    this.notify(session);
  }

  async control(session, action) {
    if (action === 'stop') return this.stop(session);
    return this.exclusive(session, async () => {
      if (action === 'pause') {
        if (session.status !== 'playing') throw new MusicError('MUSIC_BUSY');
        session.player.pause(); session.status = 'paused';
      } else if (action === 'resume') {
        if (session.status !== 'paused') throw new MusicError('MUSIC_BUSY');
        session.player.unpause(); session.status = 'playing';
      } else if (action === 'skip') {
        if (!session.current && !session.queue.length) throw new MusicError('MUSIC_BUSY');
        session.status = 'loading';
        await this.startNext(session);
      } else if (action === 'loop') {
        session.loop = { off: 'track', track: 'queue', queue: 'off' }[session.loop];
      } else if (action === 'shuffle') {
        for (let i = session.queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [session.queue[i], session.queue[j]] = [session.queue[j], session.queue[i]];
        }
      } else throw new MusicError('MUSIC_RESPONSE');
      this.notify(session);
    });
  }

  stop(session) {
    if (session.stopPromise) return session.stopPromise;
    session.stopPromise = this.stopSession(session);
    this.pendingStops.add(session.stopPromise);
    session.stopPromise.then(() => this.pendingStops.delete(session.stopPromise),
      () => this.pendingStops.delete(session.stopPromise));
    return session.stopPromise;
  }

  async stopSession(session) {
    if (session.status === 'stopped') return;
    session.status = 'stopped';
    this.onStop(session);
    session.controller.abort();
    clearInterval(session.updateTimer);
    const cleanup = this.disposeTrack(session);
    const preparation = session.preparation;
    session.queue = [];
    session.current = null;
    if (this.sessions.get(session.guildId) === session) this.sessions.delete(session.guildId);
    if (session.connection && session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      session.connection.destroy();
    }
    try {
      await Promise.all([cleanup, preparation?.then(transport => transport.dispose(), () => undefined)]);
    } finally { await this.notify(session); }
  }

  async close() {
    this.closed = true;
    this.library?.close();
    await Promise.all([...this.sessions.values()].map(session => this.stop(session)));
    await Promise.all([...this.pendingStops]);
  }
}
