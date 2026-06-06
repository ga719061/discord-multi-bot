import assert from 'node:assert';
import test from 'node:test';
import { initTestDatabase, cleanupTestDatabase } from './helpers/database.js';
import { getDb, addGiveaway } from '../src/utils/database.js';
import { openGiveawayComposer } from '../src/commands/fun/giveaway.js';
import { endGiveaway, stopPolling } from '../src/utils/giveawayManager.js';

test('Giveaway Logic & Reliability Optimization', async (t) => {
  t.beforeEach(() => {
    initTestDatabase('giveaway-opt');
  });

  t.afterEach(() => {
    stopPolling();
    cleanupTestDatabase();
  });

  await t.test('1. Should delete published message if DB insertion fails during creation', async () => {
    let deletedCount = 0;
    let replyNotice = null;

    const mockMessage = {
      id: 'msg_123',
      react: async () => {},
      delete: async () => {
        deletedCount++;
      }
    };

    const mockSubmit = {
      user: { id: 'user_123' },
      guildId: 'guild_123',
      channelId: 'channel_123',
      customId: 'giveaway:session_123:submit',
      fields: {
        getTextInputValue: (id) => {
          if (id === 'prize') return 'Steam Gift Card';
          if (id === 'duration') return '60';
          if (id === 'winners') return '1';
          return '';
        }
      },
      deferReply: async () => {},
      channel: {
        send: async () => mockMessage
      },
      editReply: async (payload) => {
        replyNotice = payload;
      }
    };

    const mockInteraction = {
      user: { id: 'user_123' },
      showModal: async () => {},
      awaitModalSubmit: async () => mockSubmit
    };

    // 破壞 DB 以觸發 addGiveaway 錯誤
    const db = getDb();
    const originalPrepare = db.prepare;
    db.prepare = () => {
      throw new Error('Mock DB write failure');
    };

    try {
      await openGiveawayComposer(mockInteraction);
    } finally {
      db.prepare = originalPrepare;
    }

    assert.strictEqual(deletedCount, 1, 'Should call message.delete() exactly once when DB insertion fails');
    assert.ok(replyNotice, 'Should reply to user upon failure');
    assert.match(JSON.stringify(replyNotice), /皇家抽獎建立失敗/, 'Should show failure notice to user');
  });

  await t.test('2. Should keep the same drawn winners pending if Discord announcement fails', async () => {
    // 建立一個 pending 的 giveaway
    const now = Date.now();
    addGiveaway('guild_1', 'channel_1', 'msg_1', 'Prize', 1, now + 1000);
    const db = getDb();
    const giveaway = db.prepare("SELECT * FROM giveaways WHERE message_id = 'msg_1'").get();
    
    // Mock discord message, channel, guild, client
    let randomCalls = 0;
    const winner = { id: 'user_1', username: 'lucky_user', toString: () => '<@user_1>' };
    const mockUsers = {
      filter: () => ({
        size: 1,
        random: () => {
          randomCalls++;
          return winner;
        }
      })
    };
    
    const mockReaction = {
      users: {
        fetch: async () => mockUsers
      }
    };

    const mockMessage = {
      reactions: {
        cache: {
          get: (emoji) => emoji === '🎉' ? mockReaction : null
        }
      }
    };

    let sendCalls = 0;
    const mockChannel = {
      isTextBased: () => true,
      messages: {
        fetch: async () => mockMessage
      },
      send: async () => {
        sendCalls++;
        if (sendCalls === 1) {
          throw new Error('Discord Send Message Rate Limit or Blocked');
        }
      }
    };

    const mockGuild = {
      channels: {
        fetch: async () => mockChannel
      },
      members: {
        fetch: async () => ({ displayName: 'Lucky User' })
      }
    };

    const mockClient = {
      guilds: {
        fetch: async () => mockGuild
      },
      users: {
        fetch: async () => winner
      },
    };

    const { initGiveawayManager } = await import('../src/utils/giveawayManager.js');
    initGiveawayManager(mockClient);

    await endGiveaway(giveaway);

    // 檢查 DB 中的狀態
    const updated = db.prepare("SELECT * FROM giveaways WHERE message_id = 'msg_1'").get();
    assert.strictEqual(updated.ended, 0, 'Should remain unfinished until the public result is sent');
    assert.strictEqual(updated.status, 'drawn_pending_notify', 'Should keep the drawn result pending for retry');
    assert.strictEqual(updated.attempts, 1, 'Should record 1 attempt');
    assert.strictEqual(updated.last_error, 'Discord Send Message Rate Limit or Blocked');
    assert.deepStrictEqual(JSON.parse(updated.winner_ids), ['user_1']);

    await endGiveaway(updated);
    const completed = db.prepare("SELECT * FROM giveaways WHERE message_id = 'msg_1'").get();
    assert.strictEqual(completed.ended, 1);
    assert.strictEqual(completed.status, 'completed');
    assert.strictEqual(randomCalls, 1, 'Retry must reuse persisted winners instead of drawing again');
    assert.strictEqual(sendCalls, 2);
  });

  await t.test('3. Should mark DB failed if attempts reach 5 times', async () => {
    // 建立一個 attempts = 4 的 pending giveaway
    const now = Date.now();
    const db = getDb();
    db.prepare(`
      INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winners, end_time, attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('guild_1', 'channel_1', 'msg_retry', 'Prize', 1, now + 1000, 4);

    const giveaway = db.prepare("SELECT * FROM giveaways WHERE message_id = 'msg_retry'").get();

    // 模擬 Guild Fetch 拋出 unexpected 異常以觸發 outer catch
    const mockClient = {
      guilds: {
        fetch: () => {
          throw new Error('Unexpected Discord API breakdown');
        }
      }
    };

    const { initGiveawayManager } = await import('../src/utils/giveawayManager.js');
    initGiveawayManager(mockClient);

    await endGiveaway(giveaway);

    const updated = db.prepare("SELECT * FROM giveaways WHERE message_id = 'msg_retry'").get();
    assert.strictEqual(updated.ended, 1, 'Should mark as ended (ended = 1)');
    assert.strictEqual(updated.status, 'failed', 'Should mark status as failed when attempts reach 5');
    assert.strictEqual(updated.attempts, 5, 'Should increment attempts to 5');
    assert.strictEqual(updated.last_error, 'Unexpected Discord API breakdown');
  });

  await t.test('4. Should mark completed only after the public result is sent', async () => {
    addGiveaway('guild_1', 'channel_1', 'msg_success', 'Prize', 1, Date.now());
    const db = getDb();
    const giveaway = db.prepare("SELECT * FROM giveaways WHERE message_id = 'msg_success'").get();
    let stateDuringSend;

    const winner = { id: 'user_1', username: 'lucky_user', toString: () => '<@user_1>' };
    const mockMessage = {
      reactions: {
        cache: {
          get: () => ({
            users: {
              fetch: async () => ({
                filter: () => ({ size: 1, random: () => winner })
              })
            }
          })
        }
      },
      embeds: []
    };
    const mockChannel = {
      isTextBased: () => true,
      messages: { fetch: async () => mockMessage },
      send: async () => {
        stateDuringSend = db.prepare("SELECT ended, status, winner_ids FROM giveaways WHERE id = ?").get(giveaway.id);
      }
    };
    const mockGuild = {
      channels: { fetch: async () => mockChannel },
      members: { fetch: async () => ({ displayName: 'Lucky User' }) }
    };
    const mockClient = {
      guilds: { fetch: async () => mockGuild },
      users: { fetch: async () => winner }
    };

    const { initGiveawayManager } = await import('../src/utils/giveawayManager.js');
    initGiveawayManager(mockClient);
    await endGiveaway(giveaway);

    assert.strictEqual(stateDuringSend.ended, 0);
    assert.strictEqual(stateDuringSend.status, 'drawn_pending_notify');
    assert.deepStrictEqual(JSON.parse(stateDuringSend.winner_ids), ['user_1']);

    const completed = db.prepare("SELECT ended, status FROM giveaways WHERE id = ?").get(giveaway.id);
    assert.strictEqual(completed.ended, 1);
    assert.strictEqual(completed.status, 'completed');
  });
});
