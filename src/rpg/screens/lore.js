// ===== 世界觀畫面 =====
import { ActionRowBuilder } from 'discord.js';
import { rpgEmbed, rpgButton } from '../rpgHelpers.js';
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
            '建立了偉大的 **吉吉王國**，定都於 **汪汪城**。',
            '',
            '王國以冒險者公會制度聞名，任何種族的勇者都能在此登記成為冒險者，',
            '以劍與魔法保衛王國的和平。',
            '',
            '**🏛️ 四大職業公會**',
            '⚔️ **劍士公會** — 崇尚力量與榮譽的近戰勇士',
            '🏹 **遊俠公會** — 精通弓術與追蹤的遠程射手',
            '🔮 **法師公會** — 鑽研魔法奧義的神秘學者',
            '🛡️ **聖騎士公會** — 以信仰守護眾人的聖戰士',
            '',
            '如今，現任國王（也就是本王！汪！🐕👑）繼承了王位，',
            '率領冒險者們抵禦來自虛空的威脅。',
        ].join('\n'),
    },
    {
        title: '🗺️ 大陸地理',
        content: [
            '**🌍 吉吉大陸地圖**',
            '',
            '🏡 **王國近郊** — 汪汪城外的和平草原與農田',
            '　新手冒險者的修煉場，偶有史萊姆和野豬出沒',
            '',
            '🌲 **黑霧森林** — 終年被魔霧籠罩的古老密林',
            '　哥布林部落盤踞於此，由哥布林酋長統領',
            '',
            '🏔️ **龍脊山脈** — 橫亙大陸的險峻山脈',
            '　傳說中龍族的故鄉，石巨人守護著遠古遺跡',
            '',
            '🌿 **幽暗沼澤** — 瘴氣瀰漫的死亡之地',
            '　骸骨領主率領不死軍團在此蠢蠢欲動',
            '',
            '🌋 **熔岩荒原** — 地底火山噴發形成的灼熱荒地',
            '　熔岩巨龍沉睡其中，蘊藏無盡的力量',
            '',
            '🌀 **虛空裂隙** — 次元裂縫中的異空間',
            '　虛空之主從此處入侵，是所有冒險者的最終挑戰',
        ].join('\n'),
    },
    {
        title: '⚠️ 虛空危機',
        content: [
            '**🌑 來自虛空的威脅**',
            '',
            '近年來，大陸各地出現了不尋常的異變：',
            '森林中的哥布林變得更加兇暴，沼澤裡的死靈蠢蠢欲動，',
            '就連沉睡千年的巨龍們也不安地甦醒了……',
            '',
            '一切的根源，來自大陸最東方的 **虛空裂隙**。',
            '',
            '那裡，一股名為 **「虛空之主」** 的邪惡力量正在甦醒，',
            '試圖將整個吉吉大陸拖入虛無之中。',
            '',
            '作為吉吉王國的冒險者，你的使命是：',
            '💪 磨練實力，逐步征服每一個區域',
            '⚔️ 擊敗各地守關的強大 Boss',
            '🌟 最終抵達虛空裂隙，擊敗虛空之主',
            '👑 守護吉吉王國的和平！',
            '',
            '🐕 本王相信你們！吉吉王國的命運就交給你了！汪！',
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
        .setFooter({ text: `📖 ${page + 1}/${LORE_PAGES.length} | 🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });

    const row = new ActionRowBuilder().addComponents(
        rpgButton('rpg_lore_prev', '上一頁', page === 0 ? 'Secondary' : 'Primary', '⬅️'),
        rpgButton('rpg_lore_next', '下一頁', page === LORE_PAGES.length - 1 ? 'Secondary' : 'Primary', '➡️'),
        rpgButton('rpg_menu', '返回主選單', undefined, '🔙'),
    );

    await interaction.update({ embeds: [embed], components: [row] });
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
