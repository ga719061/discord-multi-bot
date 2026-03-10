// ===== 世界觀畫面 =====
import { ActionRowBuilder } from 'discord.js';
import { rpgEmbed, rpgButton, safeReply } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';

const LORE_PAGES = [
    {
        title: '🐕👑 吉吉王國 — 世界觀',
        content: [
            '**📖 世界起源**',
            '',
            '在遙遠的時代，創世神犬 **「大吉」** 以一聲洪亮的吼叫，',
            '劈開了混沌，創造了這片名為 **吉吉大陸** 的土地。',
            '',
            '大吉將神力分成五道光芒，化為五個種族：',
            '🧑 **人族** — 繼承了大吉的適應力，遍布大陸各地',
            '🐕 **吉娃娃族** — 大吉最眷顧的子民，靈活敏捷',
            '🐉 **龍裔** — 繼承了大吉的力量，古老而強大',
            '🧝 **精靈** — 繼承了大吉的智慧，與自然共生',
            '⛏️ **矮人** — 繼承了大吉的堅韌，深居山脈之中',
            '',
            '在大吉的庇護下，這片大陸和平了數千年。',
            '直到有一天，**虛空裂隙** 悄然撕裂了世界的邊界……',
        ].join('\n'),
    },
    {
        title: '🏰 吉吉王國的歷史',
        content: [
            '**📜 王國的建立**',
            '',
            '千年前，第一代吉吉國王 **「吉吉一世」** 統一了大陸中央的平原，',
            '建立了偉大的 **吉吉王國**，定都於 **吉吉王城**。',
            '',
            '王國以騎士團制度聞名，任何種族的勇者都能在此研習成為正式騎士，',
            '以劍與魔法保衛王國的和平。',
            '',
            '🏛️ 四大騎士分團',
            '⚔️ **劍士分團** — 崇尚力量與榮譽的近戰勇士',
            '🏹 **遊俠分團** — 精通弓術與追蹤的遠程射手',
            '🔮 **法師分團** — 鑽研魔法奧義的神秘學者',
            '🛡️ **聖騎士分團** — 以信仰守護眾人的聖戰士',
            '',
            '如今，現任國王（吉吉三世 🐕👑）繼承了王位，',
            '率領騎士團抵禦來自虛空的威脅。',
        ].join('\n'),
    },
    {
        title: '🗺️ 大陸地理',
        content: [
            '**🌍 吉吉大陸地圖**',
            '',
            '🏝️ **說話之島** — 新手騎士的起點，平靜的海島農村',
            '　正式騎士的修練場，偶有巨大野豬出沒',
            '',
            '🌲 **妖精之森** — 精靈與守護神帕拉葛力歐棲息的聖域',
            '　汙濁精靈長於此墮落，需小心迷失',
            '',
            '🦴 **龍之谷** — 散布骸骨的荒蕪峽谷',
            '　黑長者統領著不死軍團，龍之氣息在此迴盪',
            '',
            '🐊 **奇岩沼澤** — 沼澤之主巨大鱷魚的領地',
            '　迷霧重重，稍有不慎便會沉入泥沼',
            '',
            '🌋 **火龍窟** — 火龍巴拉卡司甦醒前的焦暑之地',
            '　伊弗利特守候於此，唯有強者方能踏入',
            '',
            '💎 **水晶地監** — 巴風特邪教的首選祭壇',
            '　冰冷的水晶共鳴反照著入侵者的噩夢',
            '',
            '🐉 **安塔瑞斯巢穴** — 地底深處的次元裂縫',
            '　地龍 安塔瑞斯從此沉睡，是大陸最大的威脅',
        ].join('\n'),
    },
    {
        title: '⚠️ 地龍危機',
        content: [
            '**🌑 來自地底的威脅**',
            '',
            '近年來，大陸各地出現了不尋常的異變：',
            '妖精之森的精靈變得邪惡，龍之谷的死靈蠢蠢欲動，',
            '就連沉睡千年的地龍也隱隱發出低吼……',
            '',
            '一切的根源，來自大陸深處的 **安塔瑞斯巢穴**。',
            '',
            '那裡，古老的 **地龍 安塔瑞斯** 正在甦醒，',
            '試圖將整個吉吉大陸拉回黑暗的地底。',
            '',
            '作為吉吉王國的騎士，你的使命是：',
            '💪 磨練實力，逐步征服每一個區域',
            '⚔️ 擊敗各地守關的強大 Boss',
            '🌟 最終抵達安塔瑞斯巢穴，平息地龍之怒',
            '👑 守護吉吉王國的永恆聖光！',
            '',
            '🛡️ 吉吉王國的未來已託付於各位。',
        ].join('\n'),
    },
];

export async function showLore(interaction, page = 0) {
    if (page < 0) page = 0;
    if (page >= LORE_PAGES.length) page = LORE_PAGES.length - 1;

    const lore = LORE_PAGES[page];
    const ansiContent = '```ansi\n' + lore.content.replace(/\*\*(.*?)\*\*/g, (_, text) => fmt(COLORS.YELLOW + ';' + COLORS.BOLD, text))
        .split('\n')
        .map(line => line.startsWith('　') ? fmt(COLORS.GRAY, line) : line)
        .join('\n') + '\n```';

    const embed = rpgEmbed(lore.title, ansiContent, 0x8E44AD) // Dark purple for lore
        .setFooter({ text: `📖 ${page + 1}/${LORE_PAGES.length} | 🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

    const row = new ActionRowBuilder().addComponents(
        rpgButton('rpg_lore_prev', '上一頁', page === 0 ? 'Secondary' : 'Primary', '⬅️'),
        rpgButton('rpg_lore_next', '下一頁', page === LORE_PAGES.length - 1 ? 'Secondary' : 'Primary', '➡️'),
        rpgButton('rpg_menu', '返回主選單', undefined, '🔙'),
    );

    await safeReply(interaction, { embeds: [embed], components: [row] });
}

export async function handleLoreAction(interaction) {
    const id = interaction.customId;
    // 從 footer 讀取目前頁數
    const footer = interaction.message?.embeds?.[0]?.footer?.text || '';
    const match = footer.match(/📖 (\d+)\//);
    let page = match ? parseInt(match[1]) - 1 : 0;

    if (id === 'rpg_lore_prev') page = Math.max(0, page - 1);
    else if (id === 'rpg_lore_next') page = Math.min(LORE_PAGES.length - 1, page + 1);

    return showLore(interaction, page);
}
