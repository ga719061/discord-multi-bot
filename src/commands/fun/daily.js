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
            '今日先低速散步，補眠補水，重要戰役明天再汪。',
            '運勢在充電，本王准你縮成小麵包，把基本盤抱緊。',
            '先別硬拚，待辦切小塊，平安下庄本王就給摸摸。',
        ],
    },
    {
        max: 40,
        quotes: [
            '今天慢慢汪比較順，先咬小骨頭，別急著衝王城。',
            '腳步放輕、話說慢點，麻煩看到本王就會繞路。',
            '運勢還在整隊，本王命令你留體力，穩穩前進一格。',
        ],
    },
    {
        max: 60,
        quotes: [
            '今日平穩汪，例行任務做漂亮，尾巴小搖就好。',
            '風向普通但可控，照計畫走，本王看你穩穩收工。',
            '守住節奏就是好運，不必轟轟烈烈也能累積功勳。',
        ],
    },
    {
        max: 80,
        quotes: [
            '好運正在上升，尾巴開始轉圈，主動開口試試看。',
            '今天勇氣加一顆肉乾，準備好就漂亮出招。',
            '本王聞到順風，卡住的事可以推一推，但留條退路。',
        ],
    },
    {
        max: 100,
        quotes: [
            '皇家賜福到位！今天可以大膽汪一聲，把大事往前推。',
            '氣勢正旺，機會亮晶晶，衝吧，但勝利後記得收尾。',
            '今日王冠發光，適合宣布、開始、爭取，好運替你開門。',
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
    if (luckyNum <= 20) return '充電日';
    if (luckyNum <= 40) return '慢慢來';
    if (luckyNum <= 60) return '平穩日';
    if (luckyNum <= 80) return '好運上升';
    return '皇家賜福';
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
