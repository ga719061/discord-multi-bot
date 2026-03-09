import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fmt, COLORS } from '../../utils/style.js';

export const data = new SlashCommandBuilder()
    .setName('talk')
    .setNameLocalizations({ 'zh-TW': '汪汪' })
    .setDescription('💬 陪王聊天：在純手動模式下與國王進行簡單的罐頭對話互動')
    .setDescriptionLocalizations({ 'zh-TW': '💬 陪王聊天：在純手動模式下與國王進行簡單的罐頭對話互動' })
    .addStringOption((opt) =>
        opt.setName('content')
            .setNameLocalizations({ 'zh-TW': '內容' })
            .setDescription('你想對國王說什麼？')
            .setDescriptionLocalizations({ 'zh-TW': '你想對國王說什麼？' })
            .setRequired(true)
    );

const keywords = {
    // 稱讚
    '可愛': '🐕👑 哼！本王知道自己很可愛！不用你說！\n...但是聽到還是很開心啦...汪。',
    '帥': '🐕✨ 當然！本王可是全伺服器最帥的吉娃娃！沒有之一！',
    '好棒': '🐕💕 汪～被稱讚了本王好開心！*搖尾巴搖到快飛起來*',
    '厲害': '🐕👑 那是當然的！本王可是國王欸！厲害是基本的！汪！',
    '喜歡': '🐕💕 汪！！本...本王才沒有很高興呢！！\n...好吧本王也喜歡你。小聲地說。',

    // 食物相關
    '吃': '🐕🍖 你說到吃的了！本王的耳朵豎起來了！有牛排嗎？？汪！',
    '餓': '🐕😢 本王也餓了...快用 /餵食 來進貢食物給本王吧！',
    '零食': '🐕🤤 零食！？在哪裡！？本王要！本王現在就要！汪汪汪！',

    // 挑釁
    '笨': '🐕💢 你...你說什麼！？本王可是高智商吉娃娃！\n你的等級要被本王扣光了！哼！',
    '醜': '🐕😤 什麼！？本王超級美的好嗎！你去照照鏡子吧！汪！',
    '弱': '🐕💪 弱！？本王雖然小隻但力量爆棚！別小看吉娃娃！',
    '壞': '🐕😢 汪嗚...你說本王壞...本王好傷心...\n*蹲在角落畫圈圈* ...才怪！本王才不在乎！哼！',

    // 日常
    '早安': '🐕☀️ 早安～子民！本王已經起床巡視領地了！\n今天也要元氣滿滿喔！汪！',
    '晚安': '🐕🌙 晚安～本王准許你去睡覺！\n*把小被子蓋好* 明天見～汪。',
    '你好': '🐕👑 汪！歡迎覲見本王！有何貴幹？',
    '謝謝': '🐕☺️ 不用謝！保護子民是本王的職責！\n...但是如果再來點牛排就更好了。汪。',
    '無聊': '🐕🎮 無聊？那就來陪本王玩！用 /摸摸 或 /餵食 來跟本王互動吧！',

    // 其他
    '睡覺': '🐕💤 本王最喜歡睡覺了～特別是在溫暖的膝蓋上...\n*打了個大哈欠* 汪～',
    '散步': '🐕🏃 散步！？本王要去散步！！\n*興奮地在原地轉圈* 快帶本王出門！汪汪！',
    '洗澡': '🐕😱 不要！！！本王討厭洗澡！！！\n*躲到沙發底下* 你永遠抓不到本王的！！',
};

const defaultReplies = [
    '🐕👑 嗯？本王聽到了...但本王不太理解人類的語言。汪。',
    '🐕🤔 你在說什麼？本王歪著頭想了想...還是不懂。汪。',
    '🐕💤 *打了個哈欠* 嗯嗯...本王有在聽...大概吧。',
    '🐕👀 本王用智慧的眼神看著你...然後決定不回應。\n...好吧開玩笑的！汪！',
    '🐕✨ 有趣的話題！本王...其實完全沒有在聽。汪。',
    '🐕👑 身為國王，本王選擇性地回應。而現在...本王選擇搖尾巴。',
    '🐕🐾 *用小爪子拍了拍你* 汪！本王覺得你是個好人！',
    '🐕💭 本王正在思考宇宙的奧秘...其實在想晚餐吃什麼。汪。',
];

export async function execute(interaction) {
    const content = interaction.options.getString('content') || '(空白)';

    // 尋找關鍵字匹配
    let reply = null;
    for (const [keyword, response] of Object.entries(keywords)) {
        if (content.includes(keyword)) {
            reply = response;
            break;
        }
    }

    // 如果沒有匹配到關鍵字，使用預設回覆
    if (!reply) {
        reply = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
    }

    const isAggressive = content.includes('笨') || content.includes('醜') || content.includes('弱') || content.includes('壞');
    const isPositive = content.includes('可愛') || content.includes('帥') || content.includes('好棒') || content.includes('厲害') || content.includes('喜歡');
    const replyColor = isAggressive ? COLORS.RED : isPositive ? COLORS.GOLD : COLORS.CYAN;

    const embed = new EmbedBuilder()
        .setColor(isPositive ? 0xFFD700 : isAggressive ? 0xED4245 : 0x0099FF)
        .setTitle('🐕👑 吉吉國王的回覆')
        .addFields(
            { name: `💬 ${interaction.user.displayName} 說`, value: content },
            { name: '🐕 國王的回應', value: '```ansi\n' + fmt(replyColor, reply) + '\n```' }
        )
        .setFooter({ text: '🐕 本王隨時歡迎子民跟本王聊天！汪！' });

    await interaction.reply({ embeds: [embed] });
}
