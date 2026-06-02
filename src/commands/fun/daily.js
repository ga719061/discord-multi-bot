import { SlashCommandBuilder } from 'discord.js';
import { getTaiwanDateKey, hashString } from '../../utils/deterministicRandom.js';
import { renderDailyCardImage } from './lib/funImage.js';

export const data = new SlashCommandBuilder()
    .setName('每日一汪')
    .setDescription('抽取吉吉國王今日御言與幸運值')
    .setDescriptionLocalizations({ 'zh-TW': '抽取吉吉國王今日御言與幸運值' });

const quoteTiers = [
    {
        max: 20,
        quotes: [
            '本王特許你今天摸魚五分鐘！但要是敢摸一整天……本王就對你汪汪大叫喔！🐾',
            '喂，先去喝口水啦！本王看你急得尾巴都要打結了，喝完水問題就變小啦！💧',
            '本王准你慢慢磨蹭，但絕對不准小看自己！你可是本王尊貴的子民耶！👑',
        ],
    },
    {
        max: 40,
        quotes: [
            '今天遇到困難？把它當成潔牙骨！切成小碎塊，看本王一口一口咬碎牠！🦴',
            '急什麼急！路要一步一步走，肉要一口一口咬，先把眼前的骨頭啃完再說！',
            '你的努力本王都看在眼裡喔！……雖然本王剛才好像不小心睡著了，呼嚕……💤',
        ],
    },
    {
        max: 60,
        quotes: [
            '今天的勇氣不用太大，只要夠你踏出第一步、或者幫本王開個罐罐就行了！罐罐！🥫',
            '累了就原地躺平吧！這不叫認輸，這叫「國王式優雅充電」，順便整理一下歪掉的王冠！👑',
            '聽好了！先把最討厭的那件事咬碎丟掉，保證你整天尾巴搖得比誰都快！🐕💨',
        ],
    },
    {
        max: 80,
        quotes: [
            '場面越亂越不能慌！跟著本王的尾巴節奏搖擺～勝利遲早會乖乖送上門的！🎵',
            '今天適合對世界溫柔一點，但要是有人欺負你，本王第一時間衝上去幫你咬他！汪！👹',
            '幹嘛跟昨天的自己過不去？牠早就跟著昨天的夕陽下班去吃宵夜了啦！🌅',
        ],
    },
    {
        max: 100,
        quotes: [
            '這是至高無上的聖旨：立刻去吃飽！睡足！然後精神百倍地去征服今天！🔥',
            '就算是小碎步也是在前進！你看，本王腿這麼短，還不是把王國領土給踩遍了！🐾',
            '國王今日賜福：把擔心的能量分七成拿去大吃大喝，剩下的三成隨便動動就好啦！✨',
        ],
    },
];

export function buildDailyCardData(userId, date = new Date()) {
    const today = getTaiwanDateKey(date);
    const hash = hashString(`${today}${userId}`);
    const luckyNum = (hash % 100) + 1;
    const quotePool = quotesForLuck(luckyNum);

    return {
        date: today,
        quote: quotePool[hash % quotePool.length],
        luckyNum,
        luckyLabel: luckyLabelFor(luckyNum),
        luckyStars: luckyStarsFor(luckyNum),
    };
}

export function luckyLabelFor(luckyNum) {
    if (luckyNum <= 20) return '🔋 電量警告';
    if (luckyNum <= 40) return '🐢 慢速小步';
    if (luckyNum <= 60) return '🐾 尾巴平穩';
    if (luckyNum <= 80) return '↗️ 好運爆發';
    return '✨ 皇家聖光';
}

export function luckyStarCountFor(luckyNum) {
    const value = Math.max(1, Math.min(100, Number(luckyNum) || 1));
    if (value <= 20) return 1;
    if (value <= 40) return 2;
    if (value <= 60) return 3;
    if (value <= 80) return 4;
    return 5;
}

export function luckyStarsFor(luckyNum) {
    return '★'.repeat(luckyStarCountFor(luckyNum));
}

export function quotesForLuck(luckyNum) {
    const value = Math.max(1, Math.min(100, Number(luckyNum) || 1));
    return quoteTiers.find((tier) => value <= tier.max)?.quotes || quoteTiers.at(-1).quotes;
}

export async function execute(interaction) {
    const cardData = buildDailyCardData(interaction.user.id);
    const card = await renderDailyCardImage({
        displayName: displayNameFor(interaction),
        ...cardData,
    });

    await interaction.reply({
        files: [card.attachment],
        allowedMentions: { parse: [] },
    });
}

function displayNameFor(interaction) {
    return interaction.member?.displayName
        || interaction.user?.displayName
        || interaction.user?.globalName
        || interaction.user?.username
        || '皇家旅人';
}
