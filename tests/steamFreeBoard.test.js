import assert from 'node:assert/strict';
import test from 'node:test';
import {
  refreshDueSteamFreeBoards,
  refreshSteamFreeBoardNow,
} from '../src/utils/steamFreeBoard.js';

const NOW = new Date('2026-08-09T13:30:00.000Z');

test('creates the first managed board and persists its full snapshot', async () => {
  const db = new FakeDb([setting('guild-1', 'channel-1')]);
  const { guild, channels } = createGuild('guild-1', ['channel-1']);

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(1)));

  assert.equal(result.status, 'created');
  assert.equal(channels.get('channel-1').sent.length, 1);
  assert.equal(db.boards.get('guild-1').message_id, 'message-1');
  assert.deepEqual(JSON.parse(db.boards.get('guild-1').snapshot_json).map((game) => game.id), [1]);
  assert.equal(db.boards.get('guild-1').last_refresh_date, '2026-08-09');
});

test('still publishes the board when Steam search succeeds but browse enrichment is unavailable', async () => {
  const db = new FakeDb([setting('guild-1', 'channel-1')]);
  const { guild, channels } = createGuild('guild-1', ['channel-1']);
  const warnings = [];

  const result = await refreshSteamFreeBoardNow(guild, {
    db,
    now: NOW,
    logger: { ...silentLogger, warn: (...args) => warnings.push(args) },
    fetchImpl: async (url) => {
      const requestUrl = new URL(url);
      if (requestUrl.hostname === 'store.steampowered.com') {
        return {
          ok: true,
          json: async () => ({
            total_count: 1,
            results_html: '<a data-ds-appid="77" data-price-final="0" data-discount="100">' +
              '<img src="https://cdn.example.test/free-77.jpg">' +
              '<span class="title">Fallback Game</span>' +
              '<div class="discount_original_price">NT$ 500</div></a>',
          }),
        };
      }
      return { ok: false, status: 503 };
    },
  });

  assert.equal(result.status, 'created');
  assert.equal(channels.get('channel-1').sent.length, 1);
  assert.match(JSON.stringify(channels.get('channel-1').sent[0]), /Fallback Game/);
  assert.equal(warnings.length, 1);
});

test('keeps the current board when Steam reports results that cannot be parsed', async () => {
  const db = seededDb(games(1));
  const { guild, channels, messages } = createGuild('guild-1', ['channel-1'], boardSeed());

  const result = await refreshSteamFreeBoardNow(guild, {
    db,
    now: NOW,
    logger: silentLogger,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        total_count: 1,
        results_html: '<a class="search_result_row"><span>changed markup</span></a>',
      }),
    }),
  });

  assert.equal(result.status, 'failed');
  assert.equal(channels.get('channel-1').sent.length, 0);
  assert.equal(messages.get('message-old').edits.length, 0);
  assert.equal(db.boards.get('guild-1').last_refresh_date, '2026-08-08');
});

test('edits the current message when the app set is unchanged', async () => {
  const db = seededDb(games(1));
  const { guild, messages } = createGuild('guild-1', ['channel-1'], boardSeed());

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(1)));

  assert.equal(result.status, 'updated');
  assert.equal(messages.get('message-old').edits.length, 1);
  assert.equal(messages.get('message-old').edits[0].withComponents, true);
});

test('publishes a new full board for an added app and deletes the old board afterward', async () => {
  const db = seededDb(games(1));
  const { guild, channels, messages, events } = createGuild('guild-1', ['channel-1'], boardSeed());

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(1, 2)));

  assert.equal(result.status, 'published');
  assert.deepEqual(result.addedIds, ['2']);
  assert.equal(channels.get('channel-1').sent.length, 1);
  assert.equal(messages.get('message-old').edits.length, 0);
  assert.equal(messages.get('message-old').deletes, 1);
  assert.equal(result.previousMessageDeleted, true);
  assert.deepEqual(events, ['send:message-1', 'delete:message-old']);
  assert.deepEqual(JSON.parse(db.boards.get('guild-1').snapshot_json).map((game) => game.id), [1, 2]);
});

test('keeps the new board current and reports cleanup failure when the old board cannot be deleted', async () => {
  const db = seededDb(games(1));
  const { guild, messages } = createGuild('guild-1', ['channel-1'], boardSeed());
  const warnings = [];
  messages.get('message-old').delete = async () => {
    throw new Error('Missing Access');
  };

  const result = await refreshSteamFreeBoardNow(guild, {
    ...options(db, games(1, 2)),
    logger: { ...silentLogger, warn: (...args) => warnings.push(args) },
  });

  assert.equal(result.status, 'published');
  assert.equal(result.previousMessageDeleted, false);
  assert.equal(db.boards.get('guild-1').message_id, 'message-1');
  assert.equal(warnings.length, 1);
});

test('keeps the old board and state when publishing the new board fails', async () => {
  const db = seededDb(games(1));
  const { guild, channels, messages } = createGuild('guild-1', ['channel-1'], boardSeed());
  channels.get('channel-1').send = async () => {
    throw new Error('Discord unavailable');
  };

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(1, 2)));

  assert.equal(result.status, 'failed');
  assert.equal(messages.get('message-old').deletes, 0);
  assert.equal(messages.get('message-old').edits.length, 0);
  assert.equal(db.boards.get('guild-1').message_id, 'message-old');
  assert.deepEqual(JSON.parse(db.boards.get('guild-1').snapshot_json).map((game) => game.id), [1]);
});

test('deletes the newly sent board when persisting its state fails', async () => {
  const db = seededDb(games(1));
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const statement = prepare(sql);
    if (!sql.replace(/\s+/g, ' ').trim().startsWith('INSERT INTO steam_free_boards')) return statement;
    return { run: () => { throw new Error('Database unavailable'); } };
  };
  const { guild, messages, events } = createGuild('guild-1', ['channel-1'], boardSeed());

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(1, 2)));

  assert.equal(result.status, 'failed');
  assert.equal(messages.get('message-1').deletes, 1);
  assert.equal(messages.get('message-old').deletes, 0);
  assert.equal(db.boards.get('guild-1').message_id, 'message-old');
  assert.deepEqual(events, ['send:message-1', 'delete:message-1']);
});

test('edits the current board when an app is only removed', async () => {
  const db = seededDb(games(1, 2));
  const { guild, channels, messages } = createGuild('guild-1', ['channel-1'], boardSeed());

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(2)));

  assert.equal(result.status, 'updated');
  assert.equal(channels.get('channel-1').sent.length, 0);
  assert.equal(messages.get('message-old').edits.length, 1);
  assert.equal(messages.get('message-old').deletes, 0);
});

test('edits the current board when only a deadline changes', async () => {
  const db = seededDb(games(1));
  const { guild, channels, messages } = createGuild('guild-1', ['channel-1'], boardSeed());
  const changedDeadline = games(1);
  changedDeadline[0].free_until += 3_600;

  const result = await refreshSteamFreeBoardNow(guild, options(db, changedDeadline));

  assert.equal(result.status, 'updated');
  assert.equal(channels.get('channel-1').sent.length, 0);
  assert.equal(messages.get('message-old').edits.length, 1);
  assert.equal(messages.get('message-old').deletes, 0);
  assert.equal(JSON.parse(db.boards.get('guild-1').snapshot_json)[0].free_until, changedDeadline[0].free_until);
});

test('recreates a deleted current message without treating it as new Steam content', async () => {
  const db = seededDb(games(1));
  const { guild, channels } = createGuild('guild-1', ['channel-1']);

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(1)));

  assert.equal(result.status, 'created');
  assert.equal(result.replacedMissing, true);
  assert.equal(channels.get('channel-1').sent.length, 1);
  assert.equal(db.boards.get('guild-1').message_id, 'message-1');
});

test('does not recreate the board when Discord message lookup fails transiently', async () => {
  const db = seededDb(games(1));
  const { guild, channels } = createGuild('guild-1', ['channel-1'], boardSeed());
  channels.get('channel-1').messages.fetch = async () => {
    throw Object.assign(new Error('Missing Access'), { code: 50001 });
  };

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(1)));

  assert.equal(result.status, 'failed');
  assert.equal(channels.get('channel-1').sent.length, 0);
  assert.equal(db.boards.get('guild-1').message_id, 'message-old');
});

test('reports a transient configured channel fetch failure instead of not found', async () => {
  const db = seededDb(games(1));
  const { guild } = createGuild('guild-1', ['channel-1'], boardSeed());
  guild.channels.fetch = async () => {
    throw Object.assign(new Error('Missing Access'), { code: 50001 });
  };

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(1)));

  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 50001);
  assert.equal(db.boards.get('guild-1').last_refresh_date, '2026-08-08');
});

test('fails safely without overwriting a malformed stored snapshot', async () => {
  const db = seededDb(games(1));
  db.boards.get('guild-1').snapshot_json = '{broken';
  const { guild, channels, messages } = createGuild('guild-1', ['channel-1'], boardSeed());

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(1, 2)));

  assert.equal(result.status, 'failed');
  assert.equal(channels.get('channel-1').sent.length, 0);
  assert.equal(messages.get('message-old').edits.length, 0);
  assert.equal(db.boards.get('guild-1').snapshot_json, '{broken');
});

test('edits the current board to an empty state', async () => {
  const db = seededDb(games(1));
  const { guild, channels, messages } = createGuild('guild-1', ['channel-1'], boardSeed());

  const result = await refreshSteamFreeBoardNow(guild, options(db, []));

  assert.equal(result.status, 'empty');
  assert.equal(result.action, 'updated');
  assert.equal(channels.get('channel-1').sent.length, 0);
  assert.equal(messages.get('message-old').edits.length, 1);
  assert.deepEqual(JSON.parse(db.boards.get('guild-1').snapshot_json), []);
});

test('moves the managed board to a newly configured channel and deletes the old message afterward', async () => {
  const db = seededDb(games(1), setting('guild-1', 'channel-2'));
  const { guild, channels, messages, events } = createGuild('guild-1', ['channel-1', 'channel-2'], boardSeed());

  const result = await refreshSteamFreeBoardNow(guild, options(db, games(1)));

  assert.equal(result.status, 'moved');
  assert.equal(channels.get('channel-2').sent.length, 1);
  assert.equal(messages.get('message-old').edits.length, 0);
  assert.equal(messages.get('message-old').deletes, 1);
  assert.deepEqual(events, ['send:message-1', 'delete:message-old']);
  assert.equal(db.boards.get('guild-1').channel_id, 'channel-2');
});

test('fetches one Steam snapshot for all guilds due in the same scheduled pass', async () => {
  const db = new FakeDb([
    setting('guild-1', 'channel-1'),
    setting('guild-2', 'channel-2'),
  ]);
  const first = createGuild('guild-1', ['channel-1']);
  const second = createGuild('guild-2', ['channel-2']);
  const guilds = new Map([['guild-1', first.guild], ['guild-2', second.guild]]);
  let fetches = 0;

  const results = await refreshDueSteamFreeBoards({
    guilds: { fetch: async (guildId) => guilds.get(guildId) },
  }, {
    db,
    now: NOW,
    logger: silentLogger,
    fetchGames: async () => {
      fetches += 1;
      return games(1);
    },
  });

  assert.equal(fetches, 1);
  assert.deepEqual(results.map((result) => result.status), ['created', 'created']);
  assert.equal(db.boards.size, 2);
});

test('honors the legacy same-day post date before the first managed board exists', async () => {
  const legacySetting = {
    ...setting('guild-1', 'channel-1'),
    steam_free_last_post_date: '2026-08-09',
  };
  const db = new FakeDb([legacySetting]);
  let fetches = 0;

  const results = await refreshDueSteamFreeBoards({
    guilds: { fetch: async () => { throw new Error('should not fetch guild'); } },
  }, {
    db,
    now: NOW,
    logger: silentLogger,
    fetchGames: async () => { fetches += 1; return games(1); },
  });

  assert.deepEqual(results, []);
  assert.equal(fetches, 0);
});

test('does not advance board state when the shared Steam fetch fails', async () => {
  const db = seededDb(games(1));
  db.boards.get('guild-1').last_refresh_date = '2026-08-08';
  const { guild } = createGuild('guild-1', ['channel-1'], boardSeed());

  const [result] = await refreshDueSteamFreeBoards({
    guilds: { fetch: async () => guild },
  }, {
    db,
    now: NOW,
    logger: silentLogger,
    fetchGames: async () => { throw new Error('Steam unavailable'); },
  });

  assert.equal(result.status, 'failed');
  assert.equal(db.boards.get('guild-1').last_refresh_date, '2026-08-08');
  assert.deepEqual(JSON.parse(db.boards.get('guild-1').snapshot_json).map((game) => game.id), [1]);
});

test('reports a transient scheduled guild fetch failure instead of not found', async () => {
  const db = seededDb(games(1));
  db.boards.get('guild-1').last_refresh_date = '2026-08-08';
  const errors = [];

  const [result] = await refreshDueSteamFreeBoards({
    guilds: {
      fetch: async () => { throw Object.assign(new Error('Discord unavailable'), { code: 500 }); },
    },
  }, {
    db,
    now: NOW,
    logger: { ...silentLogger, error: (...args) => errors.push(args) },
    fetchGames: async () => games(1),
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 500);
  assert.equal(errors.length, 1);
  assert.equal(db.boards.get('guild-1').last_refresh_date, '2026-08-08');
});

test('marks an existing board disabled without fetching or advancing its refresh date', async () => {
  const db = seededDb(games(1));
  db.boards.get('guild-1').last_refresh_date = '2026-08-08';
  const { guild, messages } = createGuild('guild-1', ['channel-1'], boardSeed());
  let fetches = 0;

  const result = await refreshSteamFreeBoardNow(guild, {
    db,
    now: NOW,
    disabled: true,
    logger: silentLogger,
    fetchGames: async () => { fetches += 1; return games(2); },
  });

  assert.equal(result.status, 'disabled');
  assert.equal(fetches, 0);
  assert.equal(messages.get('message-old').edits.length, 1);
  assert.equal(db.boards.get('guild-1').last_refresh_date, '2026-08-08');
});

test('serializes concurrent refreshes for the same guild', async () => {
  const db = new FakeDb([setting('guild-1', 'channel-1')]);
  const { guild, channels } = createGuild('guild-1', ['channel-1']);
  let releaseFirst;
  let markFirstStarted;
  let fetches = 0;
  const firstStarted = new Promise((resolve) => { markFirstStarted = resolve; });
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const concurrentOptions = {
    db,
    now: NOW,
    logger: silentLogger,
    fetchGames: async () => {
      fetches += 1;
      if (fetches === 1) {
        markFirstStarted();
        await firstGate;
      }
      return games(1);
    },
  };

  const first = refreshSteamFreeBoardNow(guild, concurrentOptions);
  const second = refreshSteamFreeBoardNow(guild, concurrentOptions);
  await firstStarted;
  assert.equal(fetches, 1);
  releaseFirst();

  const results = await Promise.all([first, second]);
  assert.deepEqual(results.map((result) => result.status), ['created', 'updated']);
  assert.equal(fetches, 2);
  assert.equal(channels.get('channel-1').sent.length, 1);
});

function options(db, snapshot) {
  return {
    db,
    now: NOW,
    logger: silentLogger,
    fetchGames: async () => snapshot,
  };
}

function setting(guildId, channelId) {
  return {
    guild_id: guildId,
    steam_free_channel: channelId,
    steam_free_time: '21:00',
    steam_free_enabled: 1,
  };
}

function games(...ids) {
  return ids.map((id) => ({
    id,
    name: `Free Game ${id}`,
    discount_percent: 100,
    original_price: 50000,
    final_price: 0,
    free_until: 1_786_300_000 + id,
  }));
}

function boardSeed() {
  return { channelId: 'channel-1', messageId: 'message-old' };
}

function seededDb(snapshot, configuredSetting = setting('guild-1', 'channel-1')) {
  const db = new FakeDb([configuredSetting]);
  db.boards.set('guild-1', {
    guild_id: 'guild-1',
    channel_id: 'channel-1',
    message_id: 'message-old',
    snapshot_json: JSON.stringify(snapshot),
    last_refresh_date: '2026-08-08',
    last_checked_at: NOW.getTime() - 86_400_000,
  });
  return db;
}

function createGuild(guildId, channelIds, seededMessage) {
  const channels = new Map();
  const messages = new Map();
  const events = [];
  let nextMessage = 1;

  for (const channelId of channelIds) {
    const channelMessages = new Map();
    const channel = {
      id: channelId,
      sent: [],
      isTextBased: () => true,
      messages: {
        fetch: async (messageId) => {
          const message = channelMessages.get(String(messageId));
          if (!message) throw Object.assign(new Error('Unknown Message'), { code: 10008 });
          return message;
        },
      },
      send: async (payload) => {
        const message = makeMessage(`message-${nextMessage++}`, guildId, channelId, payload, events);
        channel.sent.push(payload);
        channelMessages.set(message.id, message);
        messages.set(message.id, message);
        events.push(`send:${message.id}`);
        return message;
      },
    };
    channels.set(channelId, channel);
  }

  if (seededMessage) {
    const message = makeMessage(seededMessage.messageId, guildId, seededMessage.channelId, undefined, events);
    channels.get(seededMessage.channelId).messages.fetch = async (messageId) => {
      if (String(messageId) !== message.id) throw Object.assign(new Error('Unknown Message'), { code: 10008 });
      return message;
    };
    messages.set(message.id, message);
  }

  return {
    guild: {
      id: guildId,
      channels: { fetch: async (channelId) => channels.get(String(channelId)) || null },
    },
    channels,
    messages,
    events,
  };
}

function makeMessage(id, guildId, channelId, payload, events = []) {
  return {
    id,
    url: `https://discord.com/channels/${guildId}/${channelId}/${id}`,
    payload,
    edits: [],
    deletes: 0,
    async edit(nextPayload) {
      this.edits.push(nextPayload);
      this.payload = nextPayload;
      return this;
    },
    async delete() {
      this.deletes += 1;
      events.push(`delete:${this.id}`);
      return this;
    },
  };
}

class FakeDb {
  constructor(settings) {
    this.settings = new Map(settings.map((row) => [row.guild_id, { ...row }]));
    this.boards = new Map();
  }

  prepare(sql) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM guild_settings AS settings')) {
      return {
        all: () => [...this.settings.values()]
          .filter((row) => row.steam_free_enabled === 1 && row.steam_free_channel && row.steam_free_time)
          .map((row) => ({
            ...row,
            last_refresh_date: this.boards.get(row.guild_id)?.last_refresh_date
              ?? row.steam_free_last_post_date
              ?? null,
          })),
      };
    }
    if (normalized.startsWith('SELECT guild_id, steam_free_channel')) {
      return { get: (guildId) => this.settings.get(String(guildId)) };
    }
    if (normalized.startsWith('SELECT * FROM steam_free_boards')) {
      return { get: (guildId) => this.boards.get(String(guildId)) };
    }
    if (normalized.startsWith('INSERT INTO steam_free_boards')) {
      return {
        run: (guildId, channelId, messageId, snapshotJson, lastRefreshDate, lastCheckedAt) => {
          this.boards.set(String(guildId), {
            guild_id: String(guildId),
            channel_id: String(channelId),
            message_id: String(messageId),
            snapshot_json: snapshotJson,
            last_refresh_date: lastRefreshDate,
            last_checked_at: lastCheckedAt,
          });
        },
      };
    }
    throw new Error(`Unexpected SQL in fake DB: ${normalized}`);
  }
}

const silentLogger = {
  info() {},
  warn() {},
  error() {},
};
