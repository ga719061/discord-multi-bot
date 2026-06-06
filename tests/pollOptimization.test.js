import assert from 'node:assert';
import test from 'node:test';
import { initTestDatabase, cleanupTestDatabase } from './helpers/database.js';
import { getDb } from '../src/utils/database.js';
import { openPollComposer } from '../src/commands/fun/poll.js';

test('Poll Creator Compensation Optimization', async (t) => {
  t.beforeEach(() => {
    initTestDatabase('poll-opt');
  });

  t.afterEach(() => {
    cleanupTestDatabase();
  });

  await t.test('Should delete published message if DB insertion fails', async () => {
    let deletedCount = 0;
    let replyNotice = null;
    let collectorCallback = null;
    let capturedSessionId = '';

    const mockMessage = {
      id: 'msg_123',
      delete: async () => {
        deletedCount++;
      }
    };

    const mockOptionsSubmit = {
      user: { id: 'user_123' },
      guildId: 'guild_123',
      channelId: 'channel_123',
      customId: '', // 將在後面動態設置
      fields: {
        getTextInputValue: (id) => `Option ${id}`
      },
      deferReply: async () => {},
      channel: {
        send: async () => mockMessage
      },
      editReply: async (payload) => {
        replyNotice = payload;
      }
    };

    const mockCollector = {
      on: (event, callback) => {
        if (event === 'collect') collectorCallback = callback;
      },
      stop: () => {}
    };

    const mockQuestionSubmit = {
      fields: {
        getTextInputValue: () => 'What to play?'
      },
      reply: async () => {},
      fetchReply: async () => ({
        createMessageComponentCollector: () => mockCollector
      })
    };

    // 1. 啟動 Poll Composer 並模擬第一步 (提問)
    // 透過 showModal 捕獲動態生成的 sessionId
    const mockInteraction = {
      user: { id: 'user_123' },
      showModal: async (modal) => {
        const customId = modal.customId || modal.data?.custom_id || '';
        const parts = customId.split(':');
        capturedSessionId = parts[1] || '';
      },
      awaitModalSubmit: async () => mockQuestionSubmit
    };

    // 執行 openPollComposer 並使其註冊好 collector 
    await openPollComposer(mockInteraction);

    // 確保 sessionId 已成功被捕獲
    assert.ok(capturedSessionId, 'Should capture sessionId from modal customId');

    // 2. 模擬第二步：點選選項數量 (例如 3 個選項)
    // 使用捕獲的 sessionId 來觸發 callback
    assert.ok(collectorCallback, 'Collector collect callback should be registered');
    
    const mockComponent = {
      user: { id: 'user_123' },
      customId: `poll:${capturedSessionId}:count:3`,
      showModal: async () => {},
      awaitModalSubmit: async () => {
        // 設定 optionsSubmit 的 customId 以符合 filter 規則
        mockOptionsSubmit.customId = `poll:${capturedSessionId}:options:3:attempt_1`;
        return mockOptionsSubmit;
      }
    };

    // 破壞 DB 以觸發 INSERT 錯誤
    const db = getDb();
    const originalPrepare = db.prepare;
    db.prepare = () => {
      throw new Error('Mock DB write failure');
    };

    try {
      // 觸發選項提交，這會執行發布邏輯 (包含 send 和 db 寫入)
      await collectorCallback(mockComponent);
    } finally {
      // 還原 DB prepared statement
      db.prepare = originalPrepare;
    }

    // 3. 驗證補償邏輯：Discord 訊息應被刪除
    assert.strictEqual(deletedCount, 1, 'Should call message.delete() exactly once when DB insertion fails');
    assert.ok(replyNotice, 'Should reply to user upon failure');
    assert.match(JSON.stringify(replyNotice), /國是會議頒布失敗/, 'Should show failure notice to user');
  });
});
