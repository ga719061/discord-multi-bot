import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fmt, COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('每日一汪')
    .setDescription('📜 每日一汪：領取吉吉國王為你準備的專屬祈福與金句')
    .setDescriptionLocalizations({ 'zh-TW': '📜 每日一汪：領取吉吉國王為你準備的專屬祈福與金句' });

const quotes = [
    '「身為國王最重要的事情就是...午睡。」— 吉吉國王',
    '「體型不代表一切！本王雖小但心很大！」— 吉吉國王',
    '「人生就像一根骨頭，要好好把握才行！」— 吉吉國王',
    '「忠誠是最珍貴的品質，就像本王對牛排的忠誠一樣。」— 吉吉國王',
    '「每一天都是新的冒險！特別是散步的時候！」— 吉吉國王',
    '「別害怕展現真實的自己，就算脖子上掛著皇冠也要搖尾巴！」— 吉吉國王',
    '「快樂其實很簡單：一個溫暖的懷抱、一塊好吃的肉、一個搖尾巴的理由。」— 吉吉國王',
    '「遇到困難就汪汪叫！...好吧這不是什麼好建議。但至少要發出聲音！」— 吉吉國王',
    '「本王的御用哲學：吃飽了就睡，睡飽了就玩，玩累了再吃。完美。」— 吉吉國王',
    '「就算全世界都看不起你，本王也會站在你腳邊支持你！...然後咬你的鞋帶。」— 吉吉國王',
    '「成功的秘訣就是：永遠保持旺盛的好奇心！還有旺盛的食慾！」— 吉吉國王',
    '「壓力大的時候怎麼辦？本王的建議是：去追自己的尾巴轉三圈。保證忘記煩惱。」— 吉吉國王',
    '「愛是什麼？愛就是有人願意在你面前丟出球，然後等你叼回來。一次又一次。」— 吉吉國王',
    '「本王教你一個人生哲理：遇到討厭的人就對他吠！...不對，文明一點。遠離他就好。」— 吉吉國王',
    '「今天的你比昨天更進步了嗎？本王覺得有！因為你今天來看本王了！汪！」— 吉吉國王',
];

export async function execute(interaction) {
    // 根據日期和用戶 ID 生成固定的每日結果
    const today = new Date().toISOString().split('T')[0];
    const seed = today + interaction.user.id;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % quotes.length;
    const quote = quotes[index];

    const luckyNum = (Math.abs(hash) % 100) + 1;

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🐕👑 吉吉國王的每日金句')
        .setDescription('```ansi\n' + fmt(COLORS.CYAN, quote) + '\n```')
        .addFields(
            { name: '🍀 今日幸運指數', value: `${'⭐'.repeat(Math.ceil(luckyNum / 20))} **${luckyNum}**/100`, inline: true },
            { name: '🐕 國王的話', value: '```ansi\n' + (luckyNum > 80 ? fmt(COLORS.GREEN, '今天超級幸運！本王賜福於你！汪！') : luckyNum > 50 ? '不錯的一天！好好努力吧子民～' : luckyNum > 20 ? '普通的一天，摸摸本王會帶來好運喔！' : fmt(COLORS.RED, '今天要小心...多來找本王就對了！')) + '\n```', inline: false }
        )
        .setFooter({ text: `每天只有一句金句喔！明天再來找本王吧～` });

    await interaction.reply({ embeds: [embed] });
}
