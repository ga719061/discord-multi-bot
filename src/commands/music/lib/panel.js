import { ComponentType } from 'discord.js';
import { v2EditPayload } from '../../../utils/componentsV2.js';
import { MusicError } from '../../../utils/musicLibrary.js';
import { buildMusicPlayerPayload, normalizeMusicCoverUrl } from './ui.js';

function uploadedCoverUrl(id, ...values) {
  return values.map(normalizeMusicCoverUrl).find(url => url?.startsWith('https://')
    && url.split('/')[5] === String(id));
}

function uploadedCover(message, filename) {
  // Component-referenced files may be absent from Message.attachments.
  for (const container of message.components || []) {
    for (const section of container.components || []) {
      if (section.type !== ComponentType.Section || section.accessory?.type !== ComponentType.Thumbnail) continue;
      const media = section.accessory.media.toJSON();
      if (/^\d{17,20}$/.test(String(media.attachment_id || ''))) {
        const url = uploadedCoverUrl(media.attachment_id, media.url, media.proxy_url);
        if (url) return { id: media.attachment_id, name: filename, url };
      }
    }
  }
  const attachment = message.attachments.find(item => item.name === filename);
  const url = attachment && uploadedCoverUrl(attachment.id, attachment.url, attachment.proxyURL);
  return url ? { id: attachment.id, name: attachment.name, url } : null;
}

// Cover requests never block audio preparation or ordinary panel updates.
export class MusicPanelPresenter {
  constructor({ manager, accounts, youtube, onCoverError, onPanelError }) {
    this.manager = manager;
    this.accounts = accounts;
    this.youtube = youtube;
    this.onCoverError = onCoverError;
    this.onPanelError = onPanelError;
    this.states = new WeakMap();
    this.controllers = new Set();
    this.tasks = new Set();
    this.closed = false;
  }

  trackTask(task) {
    this.tasks.add(task);
    task.then(() => this.tasks.delete(task), () => this.tasks.delete(task));
    return task;
  }

  update(session) {
    if (this.closed || !session.message) return Promise.resolve();
    for (const userId of new Set([session.current, ...session.queue].filter(track => track && track.source !== 'youtube').map(track => track.requestedBy))) {
      this.accounts.get(session.guildId, userId);
    }
    let state = this.states.get(session);
    if (!state) {
      state = { cover: null, editing: Promise.resolve(), failed: false };
      this.states.set(session, state);
    }
    if (state.removing) return Promise.resolve();
    this.syncCover(session, state);
    const edit = state.editing.catch(() => {}).then(async () => {
      if (this.closed || state.failed || state.removing) return;
      this.syncCover(session, state);
      const cover = state.cover;
      const image = cover?.image;
      const attachment = cover?.attachment;
      const filename = attachment?.name || (image ? cover.filename : null);
      const payload = v2EditPayload(buildMusicPlayerPayload(this.manager.snapshot(session), {
        thumbnail: attachment?.url || (image ? `attachment://${filename}` : undefined),
      }));
      payload.attachments = attachment ? [{ id: attachment.id }] : [];
      if (image && !attachment) payload.files = [{ attachment: image.buffer, name: filename }];
      try {
        const message = await session.message.edit(payload);
        if (image && !attachment && state.cover === cover) {
          const uploaded = uploadedCover(message, filename);
          if (!uploaded) {
            const error = new Error('Music cover attachment missing');
            error.code = 'MUSIC_COVER_ATTACHMENT';
            throw error;
          }
          cover.attachment = uploaded;
          cover.image = null;
        }
      } catch (error) {
        if (state.removing) return;
        if (!image && !attachment) throw error;
        cover.image = null;
        cover.attachment = null;
        this.onCoverError(error, 'upload');
        await session.message.edit({
          ...v2EditPayload(buildMusicPlayerPayload(this.manager.snapshot(session))), attachments: [],
        });
      }
    });
    state.editing = edit;
    return this.trackTask(edit);
  }

  remove(session) {
    if (!session.message) return Promise.resolve();
    let state = this.states.get(session);
    if (!state) {
      state = { cover: null, editing: Promise.resolve(), failed: false };
      this.states.set(session, state);
    }
    if (state.removal) return state.removal;
    state.removing = true;
    state.cover?.controller.abort();
    state.cover = null;
    const message = session.message;
    // Finish the in-flight edit before deleting; queued updates cannot revive the panel.
    state.removal = state.editing.catch(() => {}).then(async () => {
      try { await message.delete(); }
      catch (error) {
        if (error?.code !== 10008 && error?.code !== '10008') throw new MusicError('MUSIC_PANEL_DELETE');
      }
      if (session.message === message) session.message = null;
    });
    return this.trackTask(state.removal);
  }

  syncCover(session, state) {
    const track = session.status === 'stopped' ? null : session.current;
    const isYouTube = track?.source === 'youtube';
    const account = track && !isYouTube ? this.accounts.get(session.guildId, track.requestedBy) : null;
    const source = isYouTube ? this.youtube : account?.library;
    const existing = state.cover;
    if (existing && existing.track === track && existing.generation === session.generation
      && existing.accountId === account?.id && existing.source === source) return;
    existing?.controller.abort();
    state.cover = null;
    if (!track || !source || this.closed || state.failed || state.removing) return;
    const controller = new AbortController();
    const cover = {
      track, accountId: account?.id, source, generation: session.generation, controller,
      filename: `cover-${session.generation}.webp`, image: null, attachment: null,
    };
    state.cover = cover;
    this.controllers.add(controller);
    const signal = AbortSignal.any([
      controller.signal, session.controller.signal,
      ...(session.trackController ? [session.trackController.signal] : []),
    ]);
    const request = Promise.resolve().then(() => source.getCover(track.id, { signal }))
      .then(image => {
        if (!image || this.closed || signal.aborted || state.cover !== cover
          || session.current !== track || session.generation !== cover.generation
          || (!isYouTube && this.accounts.get(session.guildId, track.requestedBy)?.id !== account.id)) return;
        cover.image = image;
        return this.update(session).catch(() => {
          state.failed = true;
          return this.onPanelError(session);
        });
      }, error => {
        if (!signal.aborted && !this.closed) this.onCoverError(error, 'download');
      }).finally(() => this.controllers.delete(controller));
    this.trackTask(request);
  }

  invalidateOwner(session, userId) {
    const state = this.states.get(session);
    if (state?.cover?.track.source !== 'youtube' && state?.cover?.track.requestedBy === userId) {
      state.cover.controller.abort();
      state.cover = null;
    }
  }

  async close() {
    this.closed = true;
    for (const controller of this.controllers) controller.abort();
    await Promise.allSettled([...this.tasks]);
    this.controllers.clear();
    this.states = new WeakMap();
  }
}
