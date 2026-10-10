import test from 'node:test';
import assert from 'node:assert/strict';
import { ButtonStyle, ComponentType, MessageFlags, TextInputStyle } from 'discord.js';
import {
  buildMusicPlayerPayload,
  buildMusicLibraryPayload,
  buildMusicSearchModal,
  buildMusicQueuePayload,
  buildMusicLoginPayload,
  buildMusicLoginModal,
  buildMusicYouTubeModal,
} from '../src/commands/music/lib/ui.js';
import { countV2Components } from '../src/utils/componentsV2.js';
import { ANSI_TONES, UI_COLORS } from '../src/utils/style.js';

function withoutColors(value) {
  return value.replace(/\u001b\[[0-9;]+m/g, '');
}

function track(index = 1, extra = {}) {
  return { id: `track-${index}`, title: `歌曲 ${index}`, artist: '測試歌手', album: '測試專輯', duration: 180, requestedBy: '123456789012345678', ...extra };
}

function state(extra = {}) {
  return { id: 'session', voiceChannelId: '123456789012345678', status: 'playing', current: track(), positionSeconds: 45, loop: 'off', queue: [], ...extra };
}

function flatten(component) {
  return [component, ...(component.components ?? []).flatMap(flatten), ...(component.accessory ? flatten(component.accessory) : [])];
}

function elements(payload) {
  return payload.components.flatMap((component) => flatten(component.toJSON()));
}

function text(payload) {
  return withoutColors(rawText(payload));
}

function rawText(payload) {
  return elements(payload).filter((component) => component.type === ComponentType.TextDisplay).map((component) => component.content).join('\n');
}

function controls(payload) {
  return elements(payload).filter((component) => component.custom_id);
}

function byId(payload, customId) {
  return controls(payload).find((component) => component.custom_id === customId);
}

function buttonRows(payload) {
  return elements(payload).filter((component) => component.type === ComponentType.ActionRow
    && component.components.every((child) => child.type === ComponentType.Button));
}

function summary(payload) {
  return elements(payload).filter((component) => component.type === ComponentType.TextDisplay
    && component.content.startsWith('```ansi\n'));
}

function assertPayload(payload, ephemeral = false) {
  assert.ok(payload.flags & MessageFlags.IsComponentsV2);
  assert.equal(Boolean(payload.flags & MessageFlags.Ephemeral), ephemeral);
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  assert.equal('content' in payload, false);
  assert.equal('embeds' in payload, false);
  assert.ok(countV2Components(payload.components) <= 40);
  assert.ok(rawText(payload).length <= 4000, 'Discord text budgets must include generated ANSI escape codes');
  const ids = controls(payload).map((component) => component.custom_id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.length <= 100));
  for (const row of elements(payload).filter((component) => component.type === ComponentType.ActionRow)) {
    assert.ok(row.components.length <= 5);
    assert.ok(row.components.filter((component) => component.style === ButtonStyle.Primary).length <= 1);
  }
  assert.ok(summary(payload).length <= 1);
  const summaries = summary(payload);
  const allowedColors = new Set(Object.values(ANSI_TONES));
  for (const { content } of summaries) {
    assert.ok(content.endsWith('\n```'));
    const lines = content.slice('```ansi\n'.length, -'\n```'.length).split('\n');
    assert.ok(lines.length > 0 && lines.length <= 3);
    for (const line of lines) {
      const match = line.match(/^\u001b\[37m(\[[^\u001b\n`]+\])\u001b\[0m \u001b\[([0-9;]+)m([^\u001b\n`]*)\u001b\[0m$/);
      assert.ok(match, 'summary labels and values must use independently reset, controlled SGR sequences');
      assert.ok(allowedColors.has(match[2]), 'only the existing semantic palette is allowed');
      assert.doesNotMatch(withoutColors(line), /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/);
    }
  }
  function assertControlledEsc(value) {
    if (typeof value === 'string') {
      assert.doesNotMatch(value, /```ansi|\u001b|\\u001b/i, 'metadata and other payload fields cannot contain escape codes');
    } else if (Array.isArray(value)) value.forEach(assertControlledEsc);
    else if (value && typeof value === 'object') {
      const isSummary = value.type === ComponentType.TextDisplay && summaries.some(({ content }) => content === value.content);
      Object.entries(value).filter(([key]) => !isSummary || key !== 'content').forEach(([, child]) => assertControlledEsc(child));
    }
  }
  assertControlledEsc(payload.components.map((component) => component.toJSON()));
}

test('music player is public, highlights current playback and previews only the next three tracks', () => {
  const payload = buildMusicPlayerPayload(state({ queue: Array.from({ length: 100 }, (_, index) => track(index + 2)) }));
  assertPayload(payload);
  assert.match(text(payload), /歌曲 1/);
  assert.match(text(payload), /測試歌手/);
  assert.match(text(payload), /測試專輯/);
  assert.match(text(payload), /0:45 \/ 3:00/);
  assert.match(text(payload), /Discord 個人音量調整/);
  assert.match(text(payload), /循環：關閉/);
  assert.match(text(payload), /<#123456789012345678>/);
  assert.match(text(payload), /歌曲 4/);
  assert.doesNotMatch(text(payload), /歌曲 5/);
  assert.match(text(payload), /尚有 97 首/);
  assert.match(text(payload), /## 歌曲 1\n測試歌手 · 測試專輯/);
  assert.match(text(payload), /━━━●─────────/);
  assert.match(text(payload), /進度約每 15 秒更新，無法拖曳跳轉/);
  assert.deepEqual(controls(payload).map((component) => component.custom_id), [
    'music:session:pause', 'music:session:skip',
    'music:session:browse', 'music:session:youtube', 'music:session:queue',
    'music:session:loop', 'music:session:shuffle', 'music:session:stop',
  ]);
  assert.equal(byId(payload, 'music:session:browse').label, '點歌');
  assert.equal(byId(payload, 'music:session:browse').style, ButtonStyle.Primary);
  assert.equal(byId(payload, 'music:session:loop').label, '循環：關閉');
  assert.equal(byId(payload, 'music:session:stop').style, ButtonStyle.Secondary);
});

test('idle music panel keeps browsing available while pause and skip are disabled', () => {
  const payload = buildMusicPlayerPayload(state({ status: 'idle', current: null, queue: [] }));
  assertPayload(payload);
  assert.match(text(payload), /等待點歌/);
  assert.match(text(payload), /目前沒有播放中的歌曲/);
  assert.match(text(payload), /播放器會持續待命/);
  assert.match(text(payload), /停止並離開/);
  assert.equal(byId(payload, 'music:session:browse').disabled, false);
  assert.equal(byId(payload, 'music:session:pause').disabled, true);
  assert.equal(byId(payload, 'music:session:skip').disabled, true);
  assert.equal(byId(payload, 'music:session:shuffle').disabled, true);
  const recoverable = buildMusicPlayerPayload(state({ status: 'idle', current: null, queue: [track()] }));
  assert.equal(byId(recoverable, 'music:session:skip').disabled, false, 'remaining queue can resume after a failed song');
  const failed = buildMusicPlayerPayload(state({ status: 'idle', current: null, queue: [track()], errorText: 'MUSIC_PLAYBACK' }));
  assert.match(text(failed), /待播歌曲已保留；按「下一首」繼續/);
});

test('paused panel exposes resume and stopped panel disables every control', () => {
  const paused = buildMusicPlayerPayload(state({ status: 'paused', loop: 'track' }));
  assertPayload(paused);
  assert.equal(byId(paused, 'music:session:pause'), undefined);
  assert.equal(byId(paused, 'music:session:resume').disabled, false);
  assert.equal(byId(paused, 'music:session:resume').label, '繼續播放');
  assert.equal(byId(paused, 'music:session:loop').label, '循環：單曲循環');
  assert.match(text(paused), /單曲循環/);
  const stopped = buildMusicPlayerPayload(state({ status: 'stopped', loop: 'queue' }));
  assertPayload(stopped);
  assert.ok(controls(stopped).every((component) => component.disabled));
  assert.match(text(stopped), /佇列循環/);
  const ended = buildMusicPlayerPayload(state({ status: 'stopped', current: null }));
  assert.match(text(ended), /從 \/幫助重新開啟音樂播放器/);
  assert.doesNotMatch(text(ended), /按「點歌」/);
});

test('player handles connecting, loading and unknown duration without invalid progress', () => {
  for (const status of ['connecting', 'loading']) {
    assertPayload(buildMusicPlayerPayload(state({ status, current: null })));
  }
  const invalid = buildMusicPlayerPayload(state({ current: track(1, { duration: Number.NaN }), positionSeconds: -20 }));
  assert.match(text(invalid), /0:00 \/ 未知時長/);
  assert.doesNotMatch(text(invalid), /[━●─]/);
  const pastEnd = buildMusicPlayerPayload(state({ positionSeconds: 999 }));
  assert.match(text(pastEnd), /3:00 \/ 3:00/);
  assert.match(text(pastEnd), /━━━━━━━━━━━━●/);
});

test('royal player colors reflect lifecycle and failures with stopped taking precedence', () => {
  const scenarios = [
    { status: 'playing', color: UI_COLORS.ROYAL, label: '播放中' },
    { status: 'paused', color: UI_COLORS.ROYAL_SOFT, label: '已暫停' },
    { status: 'idle', current: null, color: UI_COLORS.ROYAL, label: '等待點歌' },
    { status: 'connecting', current: null, color: UI_COLORS.INFO, label: '連線中' },
    { status: 'loading', current: null, color: UI_COLORS.INFO, label: '載入中' },
    { status: 'idle', current: null, errorText: 'MUSIC_STREAM_STALLED', color: UI_COLORS.DANGER, label: '播放失敗' },
    { status: 'paused', errorText: 'MUSIC_FFMPEG', color: UI_COLORS.DANGER, label: '播放失敗' },
    { status: 'stopped', errorText: 'MUSIC_FFMPEG', color: UI_COLORS.MUTED, label: '已停止' },
  ];
  for (const { color, label, ...extra } of scenarios) {
    const payload = buildMusicPlayerPayload(state(extra));
    assertPayload(payload);
    assert.equal(payload.components[0].toJSON().accent_color, color, `${extra.status} ${extra.errorText ?? ''}`);
    assert.match(text(payload), new RegExp(label));
    assert.doesNotMatch(text(payload), /語音通訊正常/);
    if (extra.status === 'stopped') {
      assert.equal(summary(payload).length, 0);
    } else {
      assert.equal(summary(payload).length, 1);
      assert.match(withoutColors(summary(payload)[0].content), new RegExp(`\\[狀態\\] ${label}`));
    }
  }
  assert.match(text(buildMusicPlayerPayload(state({ status: 'connecting', current: null }))), /加入語音頻道/);
  assert.match(text(buildMusicPlayerPayload(state({ status: 'loading', current: null }))), /準備音訊/);
});

test('current playback has one readable summary without duplicated time or source rows', () => {
  for (const status of ['playing', 'paused']) {
    const payload = buildMusicPlayerPayload(state({ status, loop: 'track' }), { thumbnail: 'attachment://cover-1.webp' });
    assertPayload(payload);
    const hud = withoutColors(summary(payload)[0].content);
    assert.match(hud, /\[狀態\]/);
    assert.match(hud, /\[進度\] .*━━━●─────────.*0:45 \/ 3:00/);
    assert.match(hud, /\[模式\].*循環：單曲循環/);
    assert.equal((text(payload).match(/0:45 \/ 3:00/g) ?? []).length, 1);
    assert.equal((text(payload).match(/循環：單曲循環/g) ?? []).length, 1, 'button label is outside the text content');
    const heading = elements(payload).find((component) => component.type === ComponentType.TextDisplay).content;
    assert.match(heading, /吉吉王國.*音樂播放器/);
    assert.match(heading, /語音頻道/);
    assert.doesNotMatch(heading, /播放中|已暫停|0:45|循環/);
    const panelItems = payload.components[0].toJSON().components;
    const detailsIndex = panelItems.findIndex((component) => component.type === ComponentType.Section);
    const hudIndex = panelItems.findIndex((component) => component.content?.startsWith('```ansi\n'));
    const queueIndex = panelItems.findIndex((component) => component.content?.includes('接下來'));
    const controlsIndex = panelItems.findIndex((component) => component.type === ComponentType.ActionRow);
    assert.ok(detailsIndex > 0 && detailsIndex < hudIndex && hudIndex < queueIndex && queueIndex < controlsIndex);
  }
  const unknown = buildMusicPlayerPayload(state({ current: track(1, { duration: 0 }) }));
  assert.equal((text(unknown).match(/0:45 \/ 未知時長/g) ?? []).length, 1);
  assert.match(summary(unknown)[0].content, /\[進度\]/);
  assert.doesNotMatch(text(unknown), /[━●─]/);
});

test('player summary colors distinguish state, progress and loop without coloring metadata', () => {
  const scenarios = [
    { status: 'playing', label: '播放中', tone: 'royal' },
    { status: 'paused', label: '已暫停', tone: 'warning' },
    { status: 'idle', current: null, label: '等待點歌', tone: 'royal' },
    { status: 'connecting', current: null, label: '連線中', tone: 'info' },
    { status: 'loading', current: null, label: '載入中', tone: 'info' },
    { status: 'playing', errorText: 'MUSIC_PLAYBACK', label: '播放失敗', tone: 'danger' },
  ];
  for (const { label, tone, ...extra } of scenarios) {
    for (const loop of ['off', 'track', 'queue']) {
      const payload = buildMusicPlayerPayload(state({ ...extra, loop }));
      assertPayload(payload);
      const content = summary(payload)[0].content;
      assert.ok(content.includes(`\u001b[37m[狀態]\u001b[0m \u001b[${ANSI_TONES[tone]}m${label}\u001b[0m`));
      assert.ok(content.includes(`\u001b[37m[模式]\u001b[0m \u001b[${ANSI_TONES[loop === 'off' ? 'neutral' : 'special']}m循環：`));
      if (extra.current !== null) assert.ok(content.includes(`\u001b[37m[進度]\u001b[0m \u001b[${ANSI_TONES.info}m`));
      const metadata = elements(payload).filter(component => component.type === ComponentType.TextDisplay && !component.content.startsWith('```ansi\n'));
      assert.ok(metadata.every(component => !component.content.includes('\u001b')));
    }
  }
});

test('private summaries show colored page counts and service states exactly once', () => {
  const library = buildMusicLibraryPayload({ id: 'browser', query: '歌手', tracks: Array.from({ length: 100 }, (_, index) => track(index + 1)), page: 9 });
  const queue = buildMusicQueuePayload(state({ queue: Array.from({ length: 100 }, (_, index) => track(index + 1)) }), 9);
  for (const [payload, label, value] of [[library, '結果', '100 首搜尋結果'], [queue, '待播', '100 首']]) {
    assertPayload(payload, true);
    const content = summary(payload)[0].content;
    assert.equal(content.split('\n').length, 4, 'private lists have exactly two summary rows');
    assert.ok(content.includes(`\u001b[37m[頁碼]\u001b[0m \u001b[${ANSI_TONES.info}m第 10 / 10 頁\u001b[0m`));
    assert.ok(content.includes(`\u001b[37m[${label}]\u001b[0m \u001b[${ANSI_TONES.royal}m${value}\u001b[0m`));
    assert.equal((text(payload).match(/第 10 \/ 10 頁/g) ?? []).length, 1);
  }
  for (const loggedIn of [false, true]) {
    for (const nasConfigured of [false, true]) {
      for (const youtubeAvailable of [false, true]) {
        const payload = buildMusicLoginPayload({ id: 'auth', loggedIn, nasConfigured, youtubeAvailable });
        assertPayload(payload, true);
        const content = summary(payload)[0].content;
        assert.equal(content.split('\n').length, 5, 'login has exactly three summary rows');
        for (const [label, available, value] of [
          ['帳號', loggedIn, loggedIn ? '已登入' : '尚未登入'],
          ['NAS', nasConfigured, nasConfigured ? '可用' : '未設定'],
          ['YouTube', youtubeAvailable, youtubeAvailable ? '可用' : '無法使用'],
        ]) {
          assert.ok(content.includes(`\u001b[37m[${label}]\u001b[0m \u001b[${ANSI_TONES[available ? 'success' : 'warning']}m${value}\u001b[0m`));
        }
        assert.equal((text(payload).match(/已登入|尚未登入/g) ?? []).length, 1);
        assert.match(text(payload), /記憶體/);
        assert.match(text(payload), /不支援遮罩/);
      }
    }
  }
});

test('three player button groups preserve scoped IDs, labels, emojis, styles and disable rules', () => {
  for (const status of ['playing', 'paused', 'idle', 'connecting', 'loading', 'stopped']) {
    for (const loop of ['off', 'track', 'queue']) {
      const current = ['idle', 'connecting'].includes(status) ? null : track();
      const payload = buildMusicPlayerPayload(state({ status, current, loop, queue: [track(2)], youtubeAvailable: false }));
      assertPayload(payload);
      const pause = status === 'paused' ? 'resume' : 'pause';
      const expected = [
        [[pause, status === 'paused' ? '繼續播放' : '暫停', status === 'paused' ? '▶️' : '⏸️'], ['skip', '下一首', '⏭️']],
        [['browse', '點歌', '🎵'], ['youtube', 'YouTube 點播', '📺'], ['queue', '查看佇列', '📜']],
        [['loop', `循環：${{ off: '關閉', track: '單曲循環', queue: '佇列循環' }[loop]}`, loop === 'track' ? '🔂' : '🔁'], ['shuffle', '隨機排序', '🔀'], ['stop', '停止並離開', '⏹️']],
      ];
      const rows = buttonRows(payload);
      assert.equal(rows.length, 3);
      for (const [index, row] of rows.entries()) {
        assert.deepEqual(row.components.map((component) => [component.custom_id, component.label, component.emoji?.name]),
          expected[index].map(([action, label, emoji]) => [`music:session:${action}`, label, emoji]));
        for (const component of row.components) {
          assert.equal(component.style, component.custom_id.endsWith(':browse') ? ButtonStyle.Primary : ButtonStyle.Secondary);
        }
      }
      const stopped = status === 'stopped';
      assert.equal(byId(payload, `music:session:${pause}`).disabled, stopped || !current);
      assert.equal(byId(payload, 'music:session:skip').disabled, stopped);
      assert.equal(byId(payload, 'music:session:shuffle').disabled, true);
      assert.equal(byId(payload, 'music:session:youtube').disabled, true);
      for (const action of ['browse', 'queue', 'loop', 'stop']) {
        assert.equal(byId(payload, `music:session:${action}`).disabled, stopped);
      }
    }
  }
});

test('album cover uses a native section thumbnail with a descriptive attachment reference', () => {
  const payload = buildMusicPlayerPayload(state(), { thumbnail: 'attachment://cover-1.webp' });
  assertPayload(payload);
  const section = elements(payload).find((component) => component.type === ComponentType.Section);
  assert.ok(section);
  assert.match(section.components[0].content, /## 歌曲 1/);
  assert.equal(section.accessory.type, ComponentType.Thumbnail);
  assert.equal(section.accessory.media.url, 'attachment://cover-1.webp');
  assert.equal(section.accessory.description, '測試專輯的專輯封面 · 歌曲 1');
  assert.equal('files' in payload, false, 'attachment upload belongs to the panel lifecycle');
  const long = buildMusicPlayerPayload(state({ current: track(1, { title: '🎵'.repeat(200), album: '🎵'.repeat(200) }) }), { thumbnail: 'attachment://cover-1.webp' });
  assertPayload(long);
  assert.equal(elements(long).find((component) => component.type === ComponentType.Thumbnail).description.isWellFormed(), true);
});

test('signed cover CDN URLs are normalized to unsigned Discord attachment URLs', () => {
  for (const host of ['cdn.discordapp.com', 'media.discordapp.net']) {
    const url = `https://${host}/attachments/123456789012345678/523456789012345678/cover-1.webp`;
    const payload = buildMusicPlayerPayload(state(), { thumbnail: `${url}?ex=expired&is=old&hm=signature` });
    assertPayload(payload);
    assert.equal(elements(payload).find(component => component.type === ComponentType.Thumbnail).media.url, url);
    assert.doesNotMatch(text(payload), /https:\/\//, 'the CDN URL is only used by the image component');
  }
});

test('missing, unsafe and stale thumbnails keep the complete text player without exposing a URL', () => {
  for (const thumbnail of [undefined, '', 'https://nas.example.test/private', 'attachment://../private.webp', 'attachment://a\n.webp',
    'https://cdn.discordapp.com.evil.test/attachments/123456789012345678/523456789012345678/cover.webp',
    'https://private@cdn.discordapp.com/attachments/123456789012345678/523456789012345678/cover.webp',
    'http://cdn.discordapp.com/attachments/123456789012345678/523456789012345678/cover.webp',
    'https://cdn.discordapp.com/attachments/123456789012345678/523456789012345678/../private.webp',
    'https://cdn.discordapp.com/attachments/123456789012345678/523456789012345678/%2e%2e/private.webp']) {
    const payload = buildMusicPlayerPayload(state(), { thumbnail });
    assertPayload(payload);
    assert.equal(elements(payload).some((component) => component.type === ComponentType.Thumbnail), false);
    assert.doesNotMatch(JSON.stringify(payload.components.map((component) => component.toJSON())), /nas\.example|private\.webp/);
    assert.match(text(payload), /## 歌曲 1/);
  }
  for (const extra of [{ current: null, status: 'idle' }, { status: 'stopped' }]) {
    const payload = buildMusicPlayerPayload(state(extra), { thumbnail: 'attachment://cover-1.webp' });
    assertPayload(payload);
    assert.equal(elements(payload).some((component) => component.type === ComponentType.Thumbnail), false);
  }
});

test('CUE track number is visible in the player, private library and shared queue view', () => {
  const cue = track(1, { isCueTrack: true, trackNumber: 3 });
  const musicState = state({ current: cue, queue: [cue] });
  const library = buildMusicLibraryPayload({ id: 'browser', tracks: [cue], page: 0 });
  for (const payload of [buildMusicPlayerPayload(musicState), library, buildMusicQueuePayload(musicState)]) {
    assertPayload(payload, Boolean(payload.flags & MessageFlags.Ephemeral));
    assert.match(text(payload), /CUE 分軌 03/);
  }
  assert.match(byId(library, 'musiclib:browser:enqueue').options[0].description, /CUE 分軌 03/);
  assert.match(text(buildMusicQueuePayload(musicState)), /此畫面只有你能看見.*待播佇列.*共用/);
  const ordinary = buildMusicPlayerPayload(state({ current: track(1, { trackNumber: 3 }) }));
  assert.doesNotMatch(text(ordinary), /CUE 分軌/);
  const invalid = buildMusicPlayerPayload(state({ current: track(1, { isCueTrack: true, trackNumber: 100 }) }));
  assert.match(text(invalid), /CUE 分軌/);
  assert.doesNotMatch(text(invalid), /分軌 100/);
});

test('empty library is private and has no invalid empty select menu', () => {
  const payload = buildMusicLibraryPayload({ id: 'browser', query: '', tracks: [], page: 20 });
  assertPayload(payload, true);
  assert.match(text(payload), /找不到歌曲/);
  assert.match(text(payload), /1 \/ 1/);
  assert.equal(byId(payload, 'musiclib:browser:enqueue'), undefined);
  assert.equal(byId(payload, 'musiclib:browser:prev').disabled, true);
  assert.equal(byId(payload, 'musiclib:browser:next').disabled, true);
  assert.equal(byId(payload, 'musiclib:browser:search').disabled, false);
});

test('library pages contain ten stable track ids, preserve newest order and cap browsing at 100', () => {
  const tracks = Array.from({ length: 105 }, (_, index) => track(index + 1));
  const first = buildMusicLibraryPayload({ id: 'browser', query: '', tracks, page: -1 });
  assertPayload(first, true);
  const select = byId(first, 'musiclib:browser:enqueue');
  assert.equal(select.options.length, 10);
  assert.deepEqual(select.options.map((option) => option.value), tracks.slice(0, 10).map((item) => item.id));
  assert.equal(select.min_values, 1);
  assert.equal(select.max_values, 1);
  assert.equal(byId(first, 'musiclib:browser:prev').disabled, true);
  assert.equal(byId(first, 'musiclib:browser:next').disabled, false);
  const last = buildMusicLibraryPayload({ id: 'browser', query: '歌手', tracks, page: 999 });
  assertPayload(last, true);
  assert.match(text(last), /10 \/ 10/);
  assert.match(text(last), /100 首/);
  assert.match(text(last), /搜尋可找到其他曲目/);
  assert.equal(byId(last, 'musiclib:browser:enqueue').options.at(-1).value, 'track-100');
  assert.equal(byId(last, 'musiclib:browser:prev').disabled, false);
  assert.equal(byId(last, 'musiclib:browser:next').disabled, true);
  const partial = buildMusicLibraryPayload({ id: 'browser', tracks: tracks.slice(0, 11), page: 1 });
  assert.equal(byId(partial, 'musiclib:browser:enqueue').options.length, 1);
});

test('private library separates track metadata and account actions while preserving selection contract', () => {
  const cue = track(1, { isCueTrack: true, trackNumber: 3 });
  const unknown = track(2, { duration: 0, album: '' });
  const payload = buildMusicLibraryPayload({ id: 'browser', query: '歌手', tracks: [cue, unknown] });
  assertPayload(payload, true);
  assert.equal(payload.components[0].toJSON().accent_color, UI_COLORS.ROYAL);
  assert.match(text(payload), /搜尋：.*歌手/);
  assert.match(text(payload), /\[頁碼\] 第 1 \/ 1 頁\n\[結果\] 2 首搜尋結果/);
  assert.match(text(payload), /\*\*1\. 歌曲 1\*\* {2}\n[^\n]*測試歌手[^\n]*測試專輯[^\n]*3:00[^\n]*/);
  assert.match(text(payload), /\*\*2\. 歌曲 2\*\* {2}\n[^\n]*測試歌手[^\n]*未知專輯[^\n]*未知時長/);
  assert.match(text(payload), /CUE 分軌 03/);
  const rows = buttonRows(payload);
  assert.deepEqual(rows.map((row) => row.components.map((component) => component.custom_id)), [
    ['musiclib:browser:search', 'musiclib:browser:prev', 'musiclib:browser:next'],
    ['musiclib:browser:account', 'musiclib:browser:youtube'],
  ]);
  assert.deepEqual(rows.map((row) => row.components.map((component) => [component.label, component.emoji?.name])), [
    [['搜尋曲庫', '🔍'], ['上一頁', '◀️'], ['下一頁', '▶️']],
    [['帳號／登出', '👤'], ['YouTube 點播', '📺']],
  ]);
  const select = byId(payload, 'musiclib:browser:enqueue');
  assert.deepEqual(select.options.map((option) => option.value), ['track-1', 'track-2']);
  assert.equal(select.min_values, 1);
  assert.equal(select.max_values, 1);
});

test('private queue uses two-line mixed-source entries below current song and retains navigation', () => {
  const payload = buildMusicQueuePayload(state({ queue: [
    track(2), track(3, { source: 'youtube', artist: '影片頻道', album: '', duration: 0 }),
  ] }));
  assertPayload(payload, true);
  assert.equal(payload.components[0].toJSON().accent_color, UI_COLORS.ROYAL);
  const output = text(payload);
  assert.ok(output.indexOf('目前歌曲') < output.indexOf('**1. 歌曲 2**'));
  assert.match(output, /\[待播\] 2 首/);
  assert.match(output, /\*\*1\. 歌曲 2\*\* {2}\n[^\n]*測試歌手[^\n]*NAS[^\n]*3:00/);
  assert.match(output, /\*\*2\. 歌曲 3\*\* {2}\n[^\n]*影片頻道[^\n]*YouTube[^\n]*未知時長/);
  assert.deepEqual(buttonRows(payload).map((row) => row.components.map((component) => component.custom_id)), [
    ['music:session:qprev:0', 'music:session:qnext:0'],
  ]);
});

test('expired library disables every button and select, and invalid page starts at first page', () => {
  const payload = buildMusicLibraryPayload({ id: 'browser', query: '', tracks: [track()], page: Number.NaN, disabled: true });
  assertPayload(payload, true);
  assert.ok(controls(payload).every((component) => component.disabled));
  assert.match(text(payload), /1 \/ 1/);
});

test('private queue paginates 100 tracks with clamped target-page controls', () => {
  const musicState = state({ queue: Array.from({ length: 100 }, (_, index) => track(index + 1)) });
  const first = buildMusicQueuePayload(musicState, -5);
  assertPayload(first, true);
  assert.equal(byId(first, 'music:session:qprev:0').disabled, true);
  assert.equal(byId(first, 'music:session:qnext:1').disabled, false);
  const middle = buildMusicQueuePayload(musicState, 2);
  assertPayload(middle, true);
  assert.match(text(middle), /\*\*21\. 歌曲 21/);
  assert.match(text(middle), /\*\*30\. 歌曲 30/);
  assert.doesNotMatch(text(middle), /歌曲 31/);
  assert.equal(byId(middle, 'music:session:qprev:1').disabled, false);
  assert.equal(byId(middle, 'music:session:qnext:3').disabled, false);
  const last = buildMusicQueuePayload(musicState, 999);
  assertPayload(last, true);
  assert.match(text(last), /10 \/ 10/);
  assert.equal(byId(last, 'music:session:qnext:9').disabled, true);
});

test('empty and stopped queues keep valid boundaries and stop all navigation', () => {
  const empty = buildMusicQueuePayload(state({ current: null }));
  assertPayload(empty, true);
  assert.match(text(empty), /佇列目前是空的/);
  assert.ok(controls(empty).every((component) => component.disabled));
  const stopped = buildMusicQueuePayload(state({ status: 'stopped', queue: Array.from({ length: 20 }, (_, index) => track(index)) }));
  assert.ok(controls(stopped).every((component) => component.disabled));
});

test('untrusted metadata cannot inject Markdown, active mentions or control characters', () => {
  const malicious = track(1, { title: '**歌名** [連結](文字) `code` @everyone <@123456789012345678>\n\u001b[31m', artist: '<@&123456789012345678> @here\u0000', album: '<#123456789012345678> | ~album~' });
  const payload = buildMusicPlayerPayload(state({ current: malicious, queue: [malicious], voiceChannelId: 'invalid' }));
  assertPayload(payload);
  const output = text(payload);
  assert.ok(output.includes('\\*\\*歌名\\*\\*'));
  assert.ok(output.includes('\\[連結\\]\\(文字\\)'));
  assert.ok(output.includes('\\`code\\`'));
  assert.ok(output.includes('@\u200beveryone'));
  assert.ok(output.includes('@\u200bhere'));
  assert.doesNotMatch(output, /<[@#]|@everyone|@here|[\u0000\u001b]/);
  const library = buildMusicLibraryPayload({ id: 'browser', query: '@everyone', tracks: [malicious], page: 0 });
  assertPayload(library, true);
  const options = byId(library, 'musiclib:browser:enqueue').options;
  assert.ok(options[0].label.includes('@\u200beveryone'));
  assert.doesNotMatch(options[0].description, /<@|@here|\u0000/);
});

test('music views never expose NAS paths, URLs, cookies or backend failure detail', () => {
  const forbiddenValues = [
    '/volume1/music/private.mp3', 'C:\\music\\private.mp3', '\\\\nas\\private\\song.mp3',
    'https://nas.example.test/audio?token=private', 'Cookie: session=private', 'file:///volume1/music/private.mp3',
    '/共用資料夾/音樂/私人歌曲.mp3', 'https:\u200b//nas.example.test/audio?token=private',
  ];
  for (const value of forbiddenValues) {
    const item = track(1, { title: value, artist: value, album: value, path: value, url: value, cookie: value });
    const musicState = state({ current: item, queue: [item], errorText: value });
    for (const payload of [
      buildMusicPlayerPayload(musicState),
      buildMusicLibraryPayload({ id: 'browser', query: value, tracks: [item], page: 0 }),
      buildMusicQueuePayload(musicState),
    ]) {
      const serialized = JSON.stringify(payload.components.map((component) => component.toJSON()));
      assert.doesNotMatch(serialized, /volume1|private\.mp3|nas\.example|session=private|file:\/\/|https:\/\//);
      assert.ok(!text(payload).includes(value));
    }
  }
});

test('long metadata stays within Discord limits without splitting a surrogate pair', () => {
  const long = `${'🎵'.repeat(200)}${'*'.repeat(200)}`;
  const tracks = Array.from({ length: 100 }, (_, index) => track(index, { title: long, artist: long, album: long }));
  for (const payload of [
    buildMusicPlayerPayload(state({ current: tracks[0], queue: tracks })),
    buildMusicLibraryPayload({ id: 'browser', query: long, tracks, page: 0 }),
    buildMusicQueuePayload(state({ current: tracks[0], queue: tracks })),
  ]) {
    assertPayload(payload, Boolean(payload.flags & MessageFlags.Ephemeral));
    assert.equal(text(payload).isWellFormed(), true);
  }
  const library = buildMusicLibraryPayload({ id: 'browser', tracks, page: 0 });
  for (const option of byId(library, 'musiclib:browser:enqueue').options) {
    assert.ok(option.label.length <= 100);
    assert.ok(option.description.length <= 100);
    assert.equal(option.label.isWellFormed(), true);
    assert.equal(option.description.isWellFormed(), true);
  }
  const markdownTracks = Array.from({ length: 100 }, (_, index) => track(index, {
    title: '*'.repeat(200), artist: '_'.repeat(200), album: '#'.repeat(200),
  }));
  assertPayload(buildMusicPlayerPayload(state({ current: markdownTracks[0], queue: markdownTracks })));
  assertPayload(buildMusicLibraryPayload({ id: 'browser', query: '*'.repeat(200), tracks: markdownTracks, page: 0 }), true);
  assertPayload(buildMusicQueuePayload(state({ current: markdownTracks[0], queue: markdownTracks })), true);
});

test('search modal uses scoped ids and declares supported input limits', () => {
  const search = buildMusicSearchModal('browser').toJSON();
  assert.equal(search.custom_id, 'musiclib:browser:search_submit');
  const query = flatten(search).find((component) => component.custom_id === 'query');
  assert.equal(query.max_length, 120);
  assert.equal(query.required, false);
});

test('music login views remain private and provide scoped login or logout without credentials', () => {
  for (const loggedIn of [false, true]) {
    const payload = buildMusicLoginPayload({
      id: 'auth-session', loggedIn,
      email: 'private-account@example.test', password: 'private-password', cookie: 'private-cookie',
    });
    assertPayload(payload, true);
    assert.deepEqual(controls(payload).map((component) => component.custom_id), [
      ...(loggedIn ? ['musicauth:auth-session:open'] : []),
      `musicauth:auth-session:${loggedIn ? 'logout' : 'login'}`,
      'musicauth:auth-session:youtube',
    ]);
    assert.equal(payload.components[0].toJSON().accent_color, UI_COLORS.ROYAL);
    assert.match(text(payload), loggedIn ? /\[帳號\] 已登入/ : /\[帳號\] 尚未登入/);
    assert.deepEqual(buttonRows(payload).map((row) => row.components.map((component) => component.custom_id)), [
      [...(loggedIn ? ['musicauth:auth-session:open'] : []), `musicauth:auth-session:${loggedIn ? 'logout' : 'login'}`],
      ['musicauth:auth-session:youtube'],
    ]);
    assert.deepEqual(controls(payload).map((component) => component.emoji?.name), [
      ...(loggedIn ? ['📻'] : []), loggedIn ? '🚪' : '🔑', '📺',
    ]);
    if (loggedIn) {
      assert.match(text(payload), /先加入一般語音頻道/);
      assert.equal(byId(payload, 'musicauth:auth-session:open').label, '開啟音樂播放器');
      assert.equal(byId(payload, 'musicauth:auth-session:open').style, ButtonStyle.Primary);
      assert.equal(byId(payload, 'musicauth:auth-session:logout').style, ButtonStyle.Secondary);
    } else {
      assert.equal(byId(payload, 'musicauth:auth-session:open'), undefined);
      assert.equal(byId(payload, 'musicauth:auth-session:login').style, ButtonStyle.Primary);
    }
    assert.match(text(payload), /自己的.*帳號/);
    assert.match(text(payload), /記憶體/);
    assert.match(text(payload), /重啟後需重新登入/);
    assert.match(text(payload), /不支援遮罩/);
    assert.doesNotMatch(JSON.stringify(payload.components.map((component) => component.toJSON())),
      /private-account|private-password|private-cookie/);
  }
});

test('YouTube entry points are available without NAS login and remain scoped to each view', () => {
  const login = buildMusicLoginPayload({ id: 'auth-session', nasConfigured: false });
  assertPayload(login, true);
  assert.equal(byId(login, 'musicauth:auth-session:login').disabled, true);
  assert.equal(byId(login, 'musicauth:auth-session:youtube').disabled, false);
  assert.match(text(login), /NAS 曲庫尚未設定/);
  assert.match(text(login), /YouTube 點播不需要 NAS 登入/);
  const library = buildMusicLibraryPayload({ id: 'browser', tracks: [track()] });
  assertPayload(library, true);
  assert.equal(byId(library, 'musiclib:browser:youtube').style, ButtonStyle.Secondary);
  assert.equal(byId(library, 'musiclib:browser:youtube').disabled, false);
  const player = buildMusicPlayerPayload(state());
  assert.equal(byId(player, 'music:session:youtube').disabled, false);
  assert.equal(byId(player, 'music:session:youtube').style, ButtonStyle.Secondary);
});

test('unavailable YouTube tool disables only YouTube entry points', () => {
  const login = buildMusicLoginPayload({ id: 'auth-session', youtubeAvailable: false });
  assertPayload(login, true);
  assert.equal(byId(login, 'musicauth:auth-session:login').disabled, false);
  assert.equal(byId(login, 'musicauth:auth-session:youtube').disabled, true);
  assert.match(text(login), /YouTube 工具尚未安裝或無法使用/);
  const library = buildMusicLibraryPayload({ id: 'browser', tracks: [track()], youtubeAvailable: false });
  assert.equal(byId(library, 'musiclib:browser:youtube').disabled, true);
  assert.equal(byId(library, 'musiclib:browser:search').disabled, false);
  const player = buildMusicPlayerPayload(state({ youtubeAvailable: false }));
  assert.equal(byId(player, 'music:session:youtube').disabled, true);
  assert.equal(byId(player, 'music:session:browse').disabled, false);
});

test('mixed-source player and queue identify NAS and YouTube with native thumbnail description', () => {
  const video = track(2, { source: 'youtube', artist: '影片頻道', album: '' });
  const musicState = state({ current: video, queue: [track(), video] });
  const player = buildMusicPlayerPayload(musicState, { thumbnail: 'attachment://cover-1.webp' });
  assertPayload(player);
  assert.match(text(player), /影片頻道 · YouTube/);
  assert.match(text(player), /NAS/);
  assert.doesNotMatch(text(player), /未知專輯/);
  assert.equal(elements(player).find(component => component.type === ComponentType.Thumbnail).description, 'YouTube 影片縮圖 · 歌曲 2');
  const queue = buildMusicQueuePayload(musicState);
  assertPayload(queue, true);
  assert.match(text(queue), /NAS/);
  assert.match(text(queue), /YouTube/);
});

test('YouTube modal scopes submission and bounds the URL without prefilled data', () => {
  const modal = buildMusicYouTubeModal('youtube-nonce').toJSON();
  assert.equal(modal.custom_id, 'musicyoutube:youtube-nonce:submit');
  const inputs = flatten(modal).filter(component => component.type === ComponentType.TextInput);
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].custom_id, 'url');
  assert.equal(inputs[0].max_length, 2048);
  assert.equal(inputs[0].required, true);
  assert.equal(inputs[0].style, TextInputStyle.Short);
  assert.equal('value' in inputs[0], false);
});

test('music login modal declares scoped submission, bounded inputs and no prefilled credentials', () => {
  const modal = buildMusicLoginModal('auth-session').toJSON();
  assert.equal(modal.custom_id, 'musicauth:auth-session:login_submit');
  assert.equal(modal.components.length, 2);
  assert.ok(modal.custom_id.length <= 100);
  const inputs = flatten(modal).filter((component) => component.type === ComponentType.TextInput);
  assert.deepEqual(inputs.map((component) => component.custom_id), ['email', 'password']);
  for (const [index, input] of inputs.entries()) {
    assert.equal(input.style, TextInputStyle.Short);
    assert.equal(input.required, true);
    assert.equal(input.min_length, 1);
    assert.equal(input.max_length, index === 0 ? 254 : 256);
    assert.equal('value' in input, false);
  }
  assert.match(inputs[1].label, /不支援遮罩/);
});

test('account controls only appear in private library and obey browser disabled state', () => {
  for (const disabled of [false, true]) {
    const library = buildMusicLibraryPayload({ id: 'browser', tracks: [track()], page: 0, disabled });
    assertPayload(library, true);
    const account = byId(library, 'musiclib:browser:account');
    assert.equal(account.label, '帳號／登出');
    assert.equal(account.style, ButtonStyle.Secondary);
    assert.equal(account.disabled, disabled);
  }
  const player = buildMusicPlayerPayload(state({
    email: 'private-account@example.test', password: 'private-password', cookie: 'private-cookie',
  }));
  assertPayload(player);
  assert.ok(controls(player).every((component) => !component.custom_id.startsWith('musicauth:')));
  assert.doesNotMatch(JSON.stringify(player.components.map((component) => component.toJSON())),
    /private-account|private-password|private-cookie/);
});
