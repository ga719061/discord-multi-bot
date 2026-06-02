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
        luck: '✨ 皇家神蹟',
        text: '哇！這運勢簡直像剛開罐的頂級罐罐！有神風助陣，想做什麼就大膽衝吧！',
        color: UI_COLORS.SPECIAL,
        answers: [
            '本王覺得行！但拜託先喝水，如果連輸兩次就立刻給本王去躺平，不准硬撐！💢',
            '勇敢上吧！跨出那隻小爪子，就算只有前進一公分，也比坐在原地發呆有魔法！✨',
        ],
    },
    {
        min: 80,
        luck: '🐾 傲嬌大吉',
        text: '氣勢非常漂亮！本王封你為今日幸運星，做決定前喝口水，穩穩拿下勝利！',
        color: UI_COLORS.ROYAL,
        answers: [
            '國王的直覺告訴我是「Yes」！不過記得保持禮貌，別像沒禮貌的野狗一樣橫衝直撞喔。',
            '衝是可以，但必須裝上煞車！要是敢一頭熱莽到底，本王就咬你的拖鞋！停損要設好！🩴',
        ],
    },
    {
        min: 65,
        luck: '🍖 順風中吉',
        text: '好運正像點心一樣慢慢遞過來囉，保持你的節奏，準備張口咬住它！',
        color: UI_COLORS.SUCCESS,
        answers: [
            '勇敢上吧！跨出那隻小爪子，就算只有前進一公分，也比坐在原地發呆有魔法！✨',
            '衝是可以，但必須裝上煞車！要是敢一頭熱莽到底，本王就咬你的拖鞋！停損要設好！🩴',
        ],
    },
    {
        min: 50,
        luck: '☀️ 晴空小吉',
        text: '今天整體還算順手啦！適合把手邊的小事情清理乾淨，溫和地前進吧。',
        color: UI_COLORS.INFO,
        answers: [
            '可以是可以，但你確定事後有體力把弄亂的玩具和攤子收乾淨？想清楚就去吧！🧹',
            '勇敢上吧！跨出那隻小爪子，就算只有前進一公分，也比坐在原地發呆有魔法！✨',
        ],
    },
    {
        min: 35,
        luck: '☁️ 尾巴平穩',
        text: '今天不適合當拼命三郎，穩紮穩打守住基本盤，本王就覺得你很棒了！',
        color: UI_COLORS.MUTED,
        answers: [
            '一個人想破頭不如找盟友！召開皇家會議不丟臉，快去問問你信任的同伴！',
            '今天適合豎起耳朵暗中觀察，不適合大聲汪汪叫，先把局勢看清楚再說！',
        ],
    },
    {
        min: 20,
        luck: '🌀 爪子打結',
        text: '哎呀，事情好像有點亂成一團？先別慌，像解開牽繩一樣，一條一條理清楚。',
        color: UI_COLORS.FUN,
        answers: [
            '嗚汪……先等等！現在衝太危險了，等屁屁坐穩、心情平靜下來再出手也不遲。',
            '今天適合豎起耳朵暗中觀察，不適合大聲汪汪叫，先把局勢看清楚再說！',
        ],
    },
    {
        min: 8,
        luck: '💥 國王警告',
        text: '今天脾氣有點像被踩到尾巴的吉娃娃？先冷靜，少說兩句，晚點再做決定！',
        color: UI_COLORS.WARNING,
        answers: [
            '嗚汪……先等等！現在衝太危險了，等屁屁坐穩、心情平靜下來再出手也不遲。',
            '先不要！本王用雷達般的大耳朵探測過了，現在的迷霧太重，先按兵不動！👂',
        ],
    },
    {
        min: 4,
        luck: '🥩 急需牛排',
        text: '能量見底啦！快去吃點好吃的，本王特許你今天可以理直氣壯地偷懶！',
        color: UI_COLORS.FOOD,
        answers: [
            '唔，這題答案大概是「No」吧。聽本王的話，今天先乖乖躺下，把自己照顧好最重要！',
            '先不要！本王用雷達般的大耳朵探測過了，現在的迷霧太重，先按兵不動！👂',
        ],
    },
    {
        min: 1,
        luck: '💀 皇家大凶',
        text: '汪！！本王占出史上最黑暗的運勢！今天的你就像本王掉進浴缸……快逃回被窩，哪都別去！',
        color: UI_COLORS.DANGER,
        answers: [
            '先不要！本王用雷達般的大耳朵探測過了，現在的迷霧太重，先按兵不動！👂',
            '唔，這題答案大概是「No」吧。聽本王的話，今天先乖乖躺下，把自己照顧好最重要！',
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
