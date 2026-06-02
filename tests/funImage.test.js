import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildDailyCardData, execute as executeDaily, luckyLabelFor, luckyStarCountFor, luckyStarsFor, quotesForLuck } from '../src/commands/fun/daily.js';
import { buildFortuneCardData, execute as executeFortune, fortuneForAura } from '../src/commands/fun/fortune.js';
import { renderDailyCardImage, renderFortuneCardImage } from '../src/commands/fun/lib/funImage.js';
import { getTaiwanDateKey } from '../src/utils/deterministicRandom.js';

const missingAvatarPath = path.join(process.cwd(), 'assets', 'missing-king-chihuahua.png');

test('daily image renderer returns a non-empty PNG attachment', async () => {
    const card = await renderDailyCardImage({
        displayName: '測試旅人',
        quote: '今天可以偷懶五分鐘，但不准偷懶一整天。汪。',
        luckyNum: 88,
        luckyLabel: '✨ 皇家聖光',
        luckyStars: '★★★★★',
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
        fortune: '🐾 傲嬌大吉',
        answer: '可以，但記得先喝水。連敗兩場就休息，本王不准你硬拚。',
        aura: 76,
        color: fortuneForAura(80).color,
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
            luckyStars: longText,
            date: '2026-06-02',
            avatarPath: missingAvatarPath,
        }),
        renderFortuneCardImage({
            displayName: longText,
            question: longText,
            fortune: longText,
            answer: longText,
            aura: -8,
            color: '#e74c3c',
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
    assert.equal(first.luckyStars, luckyStarsFor(first.luckyNum));
});

test('daily card data uses Taiwan date boundaries', () => {
    assert.equal(getTaiwanDateKey(new Date('2026-06-01T15:59:59.000Z')), '2026-06-01');
    assert.equal(getTaiwanDateKey(new Date('2026-06-01T16:00:00.000Z')), '2026-06-02');
    assert.equal(buildDailyCardData('user-123', new Date('2026-06-01T16:00:00.000Z')).date, '2026-06-02');
});

test('daily lucky labels match their configured ranges', () => {
    assert.equal(luckyLabelFor(1), '🔋 電量警告');
    assert.equal(luckyLabelFor(20), '🔋 電量警告');
    assert.equal(luckyLabelFor(21), '🐢 慢速小步');
    assert.equal(luckyLabelFor(40), '🐢 慢速小步');
    assert.equal(luckyLabelFor(41), '🐾 尾巴平穩');
    assert.equal(luckyLabelFor(60), '🐾 尾巴平穩');
    assert.equal(luckyLabelFor(61), '↗️ 好運爆發');
    assert.equal(luckyLabelFor(80), '↗️ 好運爆發');
    assert.equal(luckyLabelFor(81), '✨ 皇家聖光');
    assert.equal(luckyLabelFor(100), '✨ 皇家聖光');
});

test('daily lucky stars match their configured ranges', () => {
    const cases = [
        [1, 1, '★'],
        [20, 1, '★'],
        [21, 2, '★★'],
        [40, 2, '★★'],
        [41, 3, '★★★'],
        [60, 3, '★★★'],
        [61, 4, '★★★★'],
        [80, 4, '★★★★'],
        [81, 5, '★★★★★'],
        [100, 5, '★★★★★'],
    ];

    for (const [luck, count, stars] of cases) {
        assert.equal(luckyStarCountFor(luck), count);
        assert.equal(luckyStarsFor(luck), stars);
    }
});

test('daily quotes match the lucky range tone', () => {
    assert.match(quotesForLuck(1).join('\n'), /摸魚|喝口水|小看自己/);
    assert.match(quotesForLuck(60).join('\n'), /勇氣|充電|咬碎/);
    assert.match(quotesForLuck(80).join('\n'), /尾巴節奏|溫柔|昨天/);
    assert.match(quotesForLuck(100).join('\n'), /聖旨|小碎步|國王今日賜福/);
});

test('fortune card data with a question uses random rolls', () => {
    const rolls = [0.75, 0.2];
    const data = buildFortuneCardData({
        question: '今天適合打 ranked 嗎？',
        rng: () => rolls.shift() ?? 0,
    });

    assert.equal(data.question, '今天適合打 ranked 嗎？');
    assert.equal(data.fortune, '🍖 順風中吉');
    assert.equal(data.aura, 76);
    assert.equal(data.answer, '勇敢上吧！跨出那隻小爪子，就算只有前進一公分，也比坐在原地發呆有魔法！✨');
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
        [1, '💀 皇家大凶'],
        [3, '💀 皇家大凶'],
        [4, '🥩 急需牛排'],
        [7, '🥩 急需牛排'],
        [8, '💥 國王警告'],
        [19, '💥 國王警告'],
        [20, '🌀 爪子打結'],
        [34, '🌀 爪子打結'],
        [35, '☁️ 尾巴平穩'],
        [49, '☁️ 尾巴平穩'],
        [50, '☀️ 晴空小吉'],
        [64, '☀️ 晴空小吉'],
        [65, '🍖 順風中吉'],
        [79, '🍖 順風中吉'],
        [80, '🐾 傲嬌大吉'],
        [94, '🐾 傲嬌大吉'],
        [95, '✨ 皇家神蹟'],
        [100, '✨ 皇家神蹟'],
    ];

    for (const [aura, fortune] of cases) {
        assert.equal(fortuneForAura(aura).luck, fortune);
    }
});

test('fortune tiers use distinct colors and major bad luck wording', () => {
    const cases = [1, 4, 8, 20, 35, 50, 65, 80, 95].map((aura) => fortuneForAura(aura));
    const colors = new Set(cases.map((fortune) => fortune.color));

    assert.equal(colors.size, cases.length);
    assert.equal(cases[0].luck, '💀 皇家大凶');
    assert.match(cases[0].text, /史上最黑暗|浴缸|被窩/);
    assert.match(cases[0].answers.join('\n'), /先不要|No|乖乖躺下/);
    assert.equal(cases[1].luck, '🥩 急需牛排');
    assert.doesNotMatch(cases[0].text, /需要點心|補充體力/);
});

test('fortune question answers follow the rolled fortune tone', () => {
    const bad = buildFortuneCardData({
        question: '今天適合硬衝嗎？',
        rng: (() => {
            const rolls = [0.01, 0];
            return () => rolls.shift() ?? 0;
        })(),
    });
    const great = buildFortuneCardData({
        question: '今天適合推進嗎？',
        rng: (() => {
            const rolls = [0.99, 0];
            return () => rolls.shift() ?? 0;
        })(),
    });

    assert.equal(bad.fortune, '💀 皇家大凶');
    assert.match(bad.answer, /先不要|迷霧|按兵不動/);
    assert.equal(great.fortune, '✨ 皇家神蹟');
    assert.match(great.answer, /本王覺得行|躺平|不准硬撐/);
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
