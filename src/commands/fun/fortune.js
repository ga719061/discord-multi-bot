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
    {
        min: 95,
        luck: '皇家奇蹟',
        text: '今天有奇妙順風，適合把重要願望往前推一格。',
        color: UI_COLORS.SPECIAL,
        answers: [
            '奇蹟順風汪！可以大膽推進，記得勝利後把尾巴收好。',
            '可以！今天願望會發亮，王冠替你開路，衝一格。',
        ],
    },
    {
        min: 80,
        luck: '大吉',
        text: '氣勢漂亮，做決定前補一口水就能穩穩出招。',
        color: UI_COLORS.ROYAL,
        answers: [
            '可以試試！氣勢漂亮，先喝水確認細節，再帥氣出招。',
            '順風在你這邊汪，但本王命令你別省略準備。',
        ],
    },
    {
        min: 65,
        luck: '中吉',
        text: '好運正在靠近，保持節奏就能接住機會。',
        color: UI_COLORS.SUCCESS,
        answers: [
            '可以小步開跑，好運正在靠近，尾巴穩住就接得到。',
            '可行汪！先做安全版本，風向漂亮再加一塊肉乾。',
        ],
    },
    {
        min: 50,
        luck: '小吉',
        text: '整體順手，適合處理小任務與溫和推進。',
        color: UI_COLORS.INFO,
        answers: [
            '可以溫和推進，先咬小任務，不必一口吞掉大骨頭。',
            '可以，但今天適合慢慢鋪路，別高調衝到滑倒。',
        ],
    },
    {
        min: 35,
        luck: '平穩',
        text: '今天不必硬衝，穩穩完成基本盤就是勝利。',
        color: UI_COLORS.MUTED,
        answers: [
            '先穩住基本盤，照計畫汪，不要臨時加一堆戲。',
            '普通但不壞，本王建議保守前進，把風險縮成小餅乾。',
        ],
    },
    {
        min: 20,
        luck: '混沌',
        text: '事情可能有點打結，先釐清順序再行動。',
        color: UI_COLORS.FUN,
        answers: [
            '先別急著定案，今天線團打結，梳一梳再出門。',
            '還霧霧的汪，先收集線索，別在混沌裡閉眼衝。',
        ],
    },
    {
        min: 8,
        luck: '小凶',
        text: '先避開衝動與嘴快，晚點再做大決定。',
        color: UI_COLORS.WARNING,
        answers: [
            '暫緩一下汪，小凶在門口探頭，嘴巴和手手都慢一點。',
            '偏向不要。若非做不可，先設停損，再找人幫你聞聞。',
        ],
    },
    {
        min: 1,
        luck: '大凶',
        text: '今日氣場偏低，先別硬拚重要決定；避開衝突、守住節奏，等風向轉好再出招。',
        color: UI_COLORS.DANGER,
        answers: [
            '先不要汪！大凶在門口蹲著，避開衝突，等風向轉好。',
            '偏向否。本王命令你先守成，低氣場時別用頭撞城門。',
        ],
    },
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
        ? pick(fortune.answers, roll)
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
