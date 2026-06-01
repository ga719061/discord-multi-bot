import { SlashCommandBuilder } from 'discord.js';
import { getTaiwanDateKey, hashString } from '../../utils/deterministicRandom.js';
import { renderDailyCardImage } from './lib/funImage.js';

export const data = new SlashCommandBuilder()
    .setName('每日一汪')
    .setDescription('抽取吉吉國王今日御言與幸運值')
    .setDescriptionLocalizations({ 'zh-TW': '抽取吉吉國王今日御言與幸運值' });

const quotes = [
    '今天可以偷懶五分鐘，但不准偷懶一整天。汪。',
    '先喝水，再煩惱。很多問題都會自己縮小一點。',
    '本王准你慢慢來，但不准你看不起自己。',
    '今日適合把困難切小塊，一口一口咬掉。',
    '不要急著證明全部，先完成眼前這一步。',
    '你的努力本王有看到，雖然本王正在午睡。',
    '今天的勇氣不用很大，夠推開一扇門就好。',
    '累了就坐下，不是投降，是整理王冠。',
    '先把最麻煩的一件事處理掉，尾巴會輕很多。',
    '遇到混亂時，先守住節奏，勝利會自己露頭。',
    '今天適合溫柔，但不是委屈自己。',
    '不要跟昨天的自己吵架，牠已經下班了。',
    '本王命令你：吃飽、睡好、再去打怪。',
    '小小前進也是前進，王國地圖就是這樣畫大的。',
    '本王今日賜福：把擔心留三成，剩下拿去行動。',
];

export function buildDailyCardData(userId, date = new Date()) {
    const today = getTaiwanDateKey(date);
    const hash = hashString(`${today}${userId}`);
    const luckyNum = (hash % 100) + 1;

    return {
        date: today,
        quote: quotes[hash % quotes.length],
        luckyNum,
        luckyLabel: luckyLabelFor(luckyNum),
    };
}

export function luckyLabelFor(luckyNum) {
    if (luckyNum <= 20) return '充電日';
    if (luckyNum <= 40) return '慢慢來';
    if (luckyNum <= 60) return '平穩日';
    if (luckyNum <= 80) return '好運上升';
    return '皇家賜福';
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
