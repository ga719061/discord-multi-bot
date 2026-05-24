import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fmt, COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('占卜')
    .setDescription('🔮 皇家占卜：讓國王透過神秘的狗骨頭為你卜算吉凶')
    .setDescriptionLocalizations({ 'zh-TW': '🔮 皇家占卜：讓國王透過神秘的狗骨頭為你卜算吉凶' })
    .addStringOption((opt) =>
        opt.setName('問題')
            .setDescription('想問國王什麼？（選填）')
            .setDescriptionLocalizations({ 'zh-TW': '想問國王什麼？（選填）' })
            .setRequired(false)
    );

const fortunes = [
    { luck: '🌟 大吉', text: '汪！！本王感應到你今天會超級幸運！去買彩券吧子民！', color: 0xFFD700 },
    { luck: '✨ 中吉', text: '嗯～本王覺得你今天運氣不錯！會有好事發生喔～汪！', color: 0x57F287 },
    { luck: '☀️ 小吉', text: '本王占卜的結果是...還不錯啦！平穩的一天～', color: 0x3498DB },
    { luck: '🌤️ 吉', text: '普普通通的運勢，但本王相信你可以靠實力創造好運！汪！', color: 0x99AAB5 },
    { luck: '☁️ 末吉', text: '嗯...運氣普通，但只要有本王在就沒問題！放心吧子民～', color: 0xB0BEC5 },
    { luck: '🌧️ 凶', text: '汪...本王覺得你今天要小心一點...不過別怕！本王會保護你的！', color: 0xE67E22 },
    { luck: '⛈️ 大凶', text: '汪嗚...本王感應到不好的氣息...今天最好待在家裡摸本王就好！', color: 0xED4245 },
    { luck: '🐕👑 國王特別獎', text: '汪汪汪！！本王特別賜予你今天的好運！你是本王最愛的子民！\n*開心地轉了三圈*', color: 0xFF69B4 },
];

const yesNoAnswers = [
    '🐕 汪！本王覺得可以！去做吧！',
    '🐕 嗯...本王的直覺說不太妙...',
    '🐕 本王正在考慮...再問一次吧！汪！',
    '🐕 當然可以！本王支持你！',
    '🐕 本王建議你三思而後行...汪。',
    '🐕 汪汪！毫無疑問！衝就對了！',
    '🐕 本王的水晶球說...明天再決定吧！',
    '🐕 哼！這還用問嗎？答案很明顯吧！...好吧本王也不知道。汪。',
    '🐕 本王占卜的結果是...YES！大膽去做吧子民！',
    '🐕 汪...最好不要...本王有不好的預感...',
];

export async function execute(interaction) {
    const question = interaction.options.getString('問題');
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];

    const embed = new EmbedBuilder()
        .setColor(fortune.color)
        .setTitle('🐕🔮 吉吉國王的占卜')
        .setDescription(`*國王閉上眼睛，搖了搖小尾巴...*\n*水晶球發出了光芒...*`);

    if (question) {
        const answer = yesNoAnswers[Math.floor(Math.random() * yesNoAnswers.length)];
        embed.addFields(
            { name: '❓ 你的問題', value: question },
            { name: '🐕 國王的回答', value: answer }
        );
    }

    const luckColor = fortune.luck.includes('大吉') || fortune.luck.includes('獎') ? COLORS.GOLD :
        fortune.luck.includes('凶') ? COLORS.RED : COLORS.CYAN;

    embed.addFields(
        { name: '🔮 今日運勢', value: '```ansi\n' + fmt(luckColor, fortune.luck) + '\n```' },
        { name: '👑 國王的話', value: fortune.text }
    );

    embed.setFooter({ text: `🐕 本王的占卜準確率高達... 嗯... 汪！` });

    await interaction.reply({ embeds: [embed] });
}
