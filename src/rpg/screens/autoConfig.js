import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { rpgEmbed, rpgButton, backButton, getUnlockedSkills, safeReply, ansiText, getQualityColor } from '../rpgHelpers.js';
import { fmt } from '../../utils/style.js';
import { getCharacter, setAutoSkills, getLearnedSkills } from '../rpgDatabase.js';
import { getSkillDef, SKILL_BOOKS } from '../data/gameData.js';

export async function showAutoConfig(interaction, char = null) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    if (!char) char = getCharacter(guildId, userId);

    let autoSkills = [];
    try {
        if (char.auto_skills) autoSkills = JSON.parse(char.auto_skills);
    } catch (e) {
        autoSkills = [];
    }

    const learnedIds = getLearnedSkills(guildId, userId);
    const skills = getUnlockedSkills(char.class || 'warrior', char.level || 1, learnedIds);

    const validAutoSkills = autoSkills.filter(id => skills.some(s => s.id === id));
    if (validAutoSkills.length !== autoSkills.length) {
        autoSkills = validAutoSkills;
        setAutoSkills(guildId, userId, autoSkills);
    }

    const lines = [
        ansiText('2;36', '配置自動探索時的技能施放順序'),
        '當你進行「自動探索 (多場周回)」或是「單局自動結算」時，系統會依照你設定的順序施放技能。',
        '如果 **第一個技能** 的魔力足夠就施放，不夠則看 **第二個技能**，以此類推。如果所有技能都不能放，就會發動 **普通攻擊**。',
        '',
        '**【目前的技能施放順序】** (最多設定 4 個)'
    ];

    if (autoSkills.length === 0) {
        lines.push('> 尚未設定任何技能，自動戰鬥時將只會使用 [普攻]。');
    } else {
        const skillLines = [];
        autoSkills.forEach((id, index) => {
            const def = getSkillDef(id);
            if (def) {
                // 輔助函式：取得技能對應的等級需求 (從 SKILL_BOOKS 找)
                const bookEntry = Object.entries(SKILL_BOOKS).find(([, b]) => b.skillId === id);
                const lv = bookEntry ? bookEntry[1].levelReq : 0;
                const color = bookEntry ? getQualityColor(bookEntry[1].quality) : '0;37';
                skillLines.push(fmt(color, `> ${index + 1}. ${def.emoji} [ ${def.name} ] (Lv.${lv}) (${def.mp} MP)`));
            }
        });
        lines.push('```ansi\n' + skillLines.join('\n') + '\n```');
    }

    const embed = rpgEmbed(
        '⚙️ 自動戰鬥設定',
        '```ansi\n' + lines.join('\n') + '\n```',
        0x1ABC9C // Turquoise
    ).setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${userId}` });

    // 組建技能選擇下拉選單
    let components = [];
    if (skills.length > 0) {
        const options = skills.map(s => {
            const bookEntry = Object.entries(SKILL_BOOKS).find(([, b]) => b.skillId === s.id);
            const lv = bookEntry ? bookEntry[1].levelReq : 0;
            return {
                label: `${s.name} (Lv.${lv}) (${s.mp} MP)`,
                description: s.desc.slice(0, 50),
                value: s.id,
                emoji: s.emoji || '✨'
            };
        });

        // 加入一個「清除」選項
        options.unshift({
            label: '清除所有設定',
            description: '自動戰鬥將只會使用普通攻擊',
            value: 'clear',
            emoji: '🗑️'
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('rpg_auto_skill_select')
            .setPlaceholder(autoSkills.length >= 4 ? '技能槽已滿，請先清除' : '➕ 選擇要加入序列的技能...')
            .addOptions(options)
            .setDisabled(autoSkills.length >= 4 && !autoSkills.includes('clear'));

        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    components.push(backButton());

    await safeReply(interaction, { embeds: [embed], components });
}

export async function handleAutoConfigSelect(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const selection = interaction.values[0];

    let char = getCharacter(guildId, userId);
    let autoSkills = char.auto_skills ? JSON.parse(char.auto_skills) : [];

    if (selection === 'clear') {
        autoSkills = [];
    } else {
        if (autoSkills.length >= 4) {
            return interaction.reply({ content: '🐕 排列順序最多只能設定 4 個技能！請先清除重設。', flags: ['Ephemeral'] });
        }
        if (autoSkills.includes(selection)) {
            return interaction.reply({ content: '🐕 這個技能已經在序列裡囉！', flags: ['Ephemeral'] });
        }
        autoSkills.push(selection);
    }

    setAutoSkills(guildId, userId, autoSkills);

    return showAutoConfig(interaction);
}
