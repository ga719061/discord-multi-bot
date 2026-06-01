import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildDailyCardData, execute as executeDaily, luckyLabelFor } from '../src/commands/fun/daily.js';
import { buildFortuneCardData, execute as executeFortune, fortuneForAura } from '../src/commands/fun/fortune.js';
import { renderDailyCardImage, renderFortuneCardImage } from '../src/commands/fun/lib/funImage.js';
import { getTaiwanDateKey } from '../src/utils/deterministicRandom.js';

const missingAvatarPath = path.join(process.cwd(), 'assets', 'missing-king-chihuahua.png');

test('daily image renderer returns a non-empty PNG attachment', async () => {
    const card = await renderDailyCardImage({
        displayName: '測試旅人',
        quote: '今天可以偷懶五分鐘，但不准偷懶一整天。汪。',
        luckyNum: 88,
        luckyLabel: '皇家賜福',
        date: '2026-06-02',
        avatarPath: missingAvatarPath,
    });

    assert.equal(card.filename, 'daily-card.png');
    assert.equal(card.attachment.name, 'daily-card.png');
    assert.equal(Buffer.isBuffer(card.buffer), true);
    assert.equal(card.buffer.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(card.buffer.length > 1000, true);
});

test('fortune image renderer returns a non-empty PNG attachment', async () => {
    const card = await renderFortuneCardImage({
        displayName: '測試旅人',
        question: '今天適合打 ranked 嗎？',
        fortune: '大吉',
        answer: '可以，但記得先喝水。連敗兩場就休息，本王不准你硬拚。',
        aura: 76,
        avatarPath: missingAvatarPath,
    });

    assert.equal(card.filename, 'fortune-card.png');
    assert.equal(card.attachment.name, 'fortune-card.png');
    assert.equal(Buffer.isBuffer(card.buffer), true);
    assert.equal(card.buffer.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(card.buffer.length > 1000, true);
});

test('image renderers tolerate missing avatar and long text', async () => {
    const longText = '這是一段非常長的文字，用來確認圖片模板會自動截斷或換行，不會把卡片撐爆，也不會讓 Discord 附件產生失敗。'.repeat(5);
    const [daily, fortune] = await Promise.all([
        renderDailyCardImage({
            displayName: longText,
            quote: longText,
            luckyNum: 101,
            luckyLabel: longText,
            date: '2026-06-02',
            avatarPath: missingAvatarPath,
        }),
        renderFortuneCardImage({
            displayName: longText,
            question: longText,
            fortune: longText,
            answer: longText,
            aura: -8,
            avatarPath: missingAvatarPath,
        }),
    ]);

    assert.equal(daily.buffer.length > 1000, true);
    assert.equal(fortune.buffer.length > 1000, true);
});

test('daily card data is stable for the same user on the same day', () => {
    const date = new Date('2026-06-01T16:30:00.000Z');
    const first = buildDailyCardData('user-123', date);
    const second = buildDailyCardData('user-123', date);

    assert.deepEqual(first, second);
    assert.equal(first.date, '2026-06-02');
    assert.equal(first.luckyNum >= 1 && first.luckyNum <= 100, true);
    assert.equal(first.luckyLabel, luckyLabelFor(first.luckyNum));
});

test('daily card data uses Taiwan date boundaries', () => {
    assert.equal(getTaiwanDateKey(new Date('2026-06-01T15:59:59.000Z')), '2026-06-01');
    assert.equal(getTaiwanDateKey(new Date('2026-06-01T16:00:00.000Z')), '2026-06-02');
    assert.equal(buildDailyCardData('user-123', new Date('2026-06-01T16:00:00.000Z')).date, '2026-06-02');
});

test('daily lucky labels match their configured ranges', () => {
    assert.equal(luckyLabelFor(1), '充電日');
    assert.equal(luckyLabelFor(20), '充電日');
    assert.equal(luckyLabelFor(21), '慢慢來');
    assert.equal(luckyLabelFor(40), '慢慢來');
    assert.equal(luckyLabelFor(41), '平穩日');
    assert.equal(luckyLabelFor(60), '平穩日');
    assert.equal(luckyLabelFor(61), '好運上升');
    assert.equal(luckyLabelFor(80), '好運上升');
    assert.equal(luckyLabelFor(81), '皇家賜福');
    assert.equal(luckyLabelFor(100), '皇家賜福');
});

test('fortune card data with a question uses random rolls', () => {
    const rolls = [0.75, 0.2];
    const data = buildFortuneCardData({
        question: '今天適合打 ranked 嗎？',
        rng: () => rolls.shift() ?? 0,
    });

    assert.equal(data.question, '今天適合打 ranked 嗎？');
    assert.equal(data.fortune, '中吉');
    assert.equal(data.aura, 76);
    assert.equal(data.answer, '暫緩一下，等心情比較穩再出手。');
    assert.equal(data.answerLabel, '本王判決');
});

test('fortune card data without a question is stable for the same user on the same Taiwan day', () => {
    const date = new Date('2026-06-01T16:30:00.000Z');
    const first = buildFortuneCardData({ userId: 'user-123', date });
    const second = buildFortuneCardData({ userId: 'user-123', date });

    assert.deepEqual(first, second);
    assert.equal(first.date, '2026-06-02');
    assert.equal(first.question, '今日整體運勢');
    assert.equal(first.answer, fortuneForAura(first.aura).text);
    assert.equal(first.answerLabel, '今日解讀');
});

test('fortune aura ranges always match the displayed fortune', () => {
    const cases = [
        [1, '需要點心'],
        [7, '需要點心'],
        [8, '小凶'],
        [19, '小凶'],
        [20, '混沌'],
        [34, '混沌'],
        [35, '平穩'],
        [49, '平穩'],
        [50, '小吉'],
        [64, '小吉'],
        [65, '中吉'],
        [79, '中吉'],
        [80, '大吉'],
        [94, '大吉'],
        [95, '皇家奇蹟'],
        [100, '皇家奇蹟'],
    ];

    for (const [aura, fortune] of cases) {
        assert.equal(fortuneForAura(aura).luck, fortune);
    }
});

test('daily and fortune commands reply with image files only and safe mentions', async () => {
    const dailyReply = await captureReply(executeDaily, { question: null });
    const fortuneReply = await captureReply(executeFortune, { question: '今天適合打 ranked 嗎？' });

    assert.equal(dailyReply.components, undefined);
    assert.equal(fortuneReply.components, undefined);
    assert.equal(dailyReply.flags, undefined);
    assert.equal(fortuneReply.flags, undefined);
    assert.deepEqual(dailyReply.allowedMentions, { parse: [] });
    assert.deepEqual(fortuneReply.allowedMentions, { parse: [] });
    assert.equal(dailyReply.files[0].name, 'daily-card.png');
    assert.equal(fortuneReply.files[0].name, 'fortune-card.png');
});

async function captureReply(execute, { question }) {
    let payload;
    await execute({
        user: {
            id: 'user-123',
            username: 'tester',
            displayName: '測試旅人',
        },
        member: {
            displayName: '測試旅人',
        },
        options: {
            getString: () => question,
        },
        reply: async (nextPayload) => {
            payload = nextPayload;
        },
    });
    return payload;
}
