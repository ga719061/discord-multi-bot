import { SlashCommandBuilder } from 'discord.js';
import { UI_COLORS } from '../../utils/style.js';
import { getTaiwanDateKey, seededRandom } from '../../utils/deterministicRandom.js';
import { renderFortuneCardImage } from './lib/funImage.js';

export const data = new SlashCommandBuilder()
    .setName('占卜')
    .setDescription('請吉吉國王替你抽一張皇家運勢')
    .setDescriptionLocalizations({ 'zh-TW': '請吉吉國王替你抽一張皇家運勢' })
    .addStringOption((opt) =>
        opt.setName('問題')
            .setDescription('想請吉吉國王判決的問題，不填則查看今日整體運勢')
            .setDescriptionLocalizations({ 'zh-TW': '想請吉吉國王判決的問題，不填則查看今日整體運勢' })
            .setRequired(false)
    );

const fortuneTiers = [
    { min: 95, luck: '皇家奇蹟', text: '今天有奇妙順風，適合把重要願望往前推一格。', color: UI_COLORS.ROYAL },
    { min: 80, luck: '大吉', text: '氣勢漂亮，做決定前補一口水就能穩穩出招。', color: UI_COLORS.ROYAL },
    { min: 65, luck: '中吉', text: '好運正在靠近，保持節奏就能接住機會。', color: UI_COLORS.SUCCESS },
    { min: 50, luck: '小吉', text: '整體順手，適合處理小任務與溫和推進。', color: UI_COLORS.INFO },
    { min: 35, luck: '平穩', text: '今天不必硬衝，穩穩完成基本盤就是勝利。', color: UI_COLORS.MUTED },
    { min: 20, luck: '混沌', text: '事情可能有點打結，先釐清順序再行動。', color: UI_COLORS.FUN },
    { min: 8, luck: '小凶', text: '先避開衝動與嘴快，晚點再做大決定。', color: UI_COLORS.WARNING },
    { min: 1, luck: '需要點心', text: '能量偏低，先補充體力，本王准你慢慢來。', color: UI_COLORS.DANGER },
];

const yesNoAnswers = [
    '可以，但記得先喝水。連敗兩場就休息，本王不准你硬拚。',
    '可以嘗試，小步開始比空想更有魔法。',
    '暫緩一下，等心情比較穩再出手。',
    '可以問問信任的人，王國會議不丟臉。',
    '先不要，現在的線索還不夠亮。',
    '有機會，但要設停損，不准一路莽到底。',
    '答案偏向是，不過要保持禮貌與界線。',
    '答案偏向否，先把自己照顧好。',
    '今天適合觀察，不適合衝動宣布。',
    '可以，前提是你願意承擔後續整理工作。',
];

export function buildFortuneCardData({
    userId = 'anonymous',
    question,
    date = new Date(),
    rng,
} = {}) {
    const dateKey = getTaiwanDateKey(date);
    const normalizedQuestion = String(question ?? '').trim();
    const roll = normalizedQuestion
        ? (rng || Math.random)
        : seededRandom(`fortune:${dateKey}:${userId}`);
    const aura = Math.floor(roll() * 100) + 1;
    const fortune = fortuneForAura(aura);
    const answer = normalizedQuestion
        ? pick(yesNoAnswers, roll)
        : fortune.text;

    return {
        date: dateKey,
        question: normalizedQuestion || '今日整體運勢',
        fortune: fortune.luck,
        answer,
        answerLabel: normalizedQuestion ? '本王判決' : '今日解讀',
        aura,
        color: fortune.color,
    };
}

export function fortuneForAura(aura) {
    const value = Math.max(1, Math.min(100, Number(aura) || 1));
    return fortuneTiers.find((tier) => value >= tier.min) || fortuneTiers.at(-1);
}

export async function execute(interaction) {
    const question = interaction.options.getString('問題');
    const cardData = buildFortuneCardData({
        userId: interaction.user.id,
        question,
    });
    const card = await renderFortuneCardImage({
        displayName: displayNameFor(interaction),
        ...cardData,
    });

    await interaction.reply({
        files: [card.attachment],
        allowedMentions: { parse: [] },
    });
}

function pick(items, rng) {
    return items[Math.floor(rng() * items.length)];
}

function displayNameFor(interaction) {
    return interaction.member?.displayName
        || interaction.user?.displayName
        || interaction.user?.globalName
        || interaction.user?.username
        || '神秘旅人';
}
