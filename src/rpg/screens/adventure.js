import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { AREAS, MONSTERS, BOSSES, SUMMON_RECIPES, getItemDisplayName, ITEM_NAMES } from '../data/gameData.js';
import { getCharacter, createBattle, updateCharacter, getLearnedSkills, getEquipmentList, getInventory } from '../rpgDatabase.js';
import { rpgEmbed, rpgButton, areaSelectRows, hpBar, mpBar, hpBarBare, mpBarBare, backButton, charSummary, ansiText, safeReply, getStatusFields, calculateTotalStats } from '../rpgHelpers.js';
import { renderBattle } from './battle.js';
import { activeMercenaries } from './mercenary.js';
import { fmt, COLORS, ansiBlock } from '../../utils/style.js';

export async function showAdventure(interaction, char) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);
    const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
    const total = calculateTotalStats(char, eqList);

    if (char.hp <= 0) {
        const embed = rpgEmbed('🛡️ 騎士已倒下...', [
            '你的體力已全然耗盡，靈魂正處於虛弱狀態。需要先進行冥想或休憩方可再次啟程。',
            '',
            `${hpBar(char.hp, total.max_hp)}`,
            '',
            '💡 於酒館稍作休息，或待能量自然匯聚。',
        ].join('\n')).setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });
        return safeReply(interaction, { embeds: [embed], components: [backButton()] });
    }

    const embed = rpgEmbed(
        '⚔️ 出征 — 選擇目的地',
        [
            '```ansi\n' + ansiText('2;32', '決定你要遠征的疆域，聖光將與你同在。') + '\n```',
            '**👤【當前騎士狀態】**',
            '```ansi\n' + [
                charSummary(char),
                hpBarBare(char.hp, total.max_hp),
                mpBarBare(char.mp, total.max_mp)
            ].join('\n') + '\n```',
            '',
            '💡 *區域難度隨顏色加深，請量力而行。*',
        ].join('\n'),
        0x2ECC71
    )
        .addFields(getStatusFields(char, total, { showResources: true, showCombat: false }))
        .setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

    const rows = areaSelectRows(char.level);
    const navRow = rows.pop(); // 先把 areaSelectRows 最後一行的返回按鈕拿出來

    // 將特殊功能合併到同一行以節省 ActionRow (上限 5 行)
    const specialRow = new ActionRowBuilder();
    specialRow.addComponents(
        rpgButton('rpg_shrine_menu', '🏮 祭壇召喚', 3, '🔥'),
        rpgButton('rpg_auto_farm_menu', '🔄 自動探索', 1, '🤖')
    );

    rows.push(specialRow);
    rows.push(navRow); // 最後補回返回按鈕

    await safeReply(interaction, { embeds: [embed], components: rows });
}

export async function showAutoFarmMenu(interaction, char) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    if (!char) char = getCharacter(guildId, userId);

    const availableAreas = AREAS.filter(a => char.level >= a.levelReq);

    const embed = rpgEmbed(
        '🤖 自動探索模式',
        '請選擇你想連續探索的區域與次數。\n> ⚠️ 注意：自動探索將模擬高強度的連續作戰，若生命值見底將會強制中斷遠征。',
        0x3498DB
    ).setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${userId}` });

    const options = availableAreas.map(a => ({
        label: `${a.emoji} ${a.name} (Lv.${a.levelReq}+)`,
        description: `自動周回 5 場`,
        value: `5_${a.id}`
    }));

    options.push(...availableAreas.map(a => ({
        label: `${a.emoji} ${a.name} (Lv.${a.levelReq}+)`,
        description: `自動周回 10 場`,
        value: `10_${a.id}`
    })));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('rpg_auto_farm_select')
        .setPlaceholder('選擇區域與次數...')
        .addOptions(options.slice(0, 25)); // Max 25 options

    const rows = [
        new ActionRowBuilder().addComponents(selectMenu),
        backButton()
    ];

    await safeReply(interaction, { embeds: [embed], components: rows });
}

export async function handleAutoFarmSelect(interaction, char) {
    // 立即回應，避免 3 秒超時
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }

    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);
    const val = interaction.values[0];
    const [roundsStr, ...areaParts] = val.split('_');
    const areaId = areaParts.join('_');
    const rounds = parseInt(roundsStr, 10);

    const { runAutoFarm } = await import('../engine/autoBattle.js');
    return runAutoFarm(interaction, char, areaId, rounds);
}

export async function handleAreaSelect(interaction, char) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);

    if (interaction.customId === 'rpg_shrine_menu') {
        return showShrineMenu(interaction, char);
    }

    const areaId = interaction.customId.replace('rpg_area_', '');
    const area = AREAS.find(a => a.id === areaId);
    if (!area || char.level < area.levelReq) return;

    // 追蹤任務進度：探索區域
    const { trackQuestProgress } = await import('../engine/questEngine.js');
    trackQuestProgress(interaction.guildId, interaction.user.id, 'explore_area', { areaId });

    // 隨機事件
    const roll = Math.random() * 100;
    if (roll < 70) {
        // 遇敵戰鬥
        return startBattle(interaction, char, areaId);
    } else if (roll < 85) {
        // 發現寶箱
        return foundTreasure(interaction, char, areaId);
    } else {
        // 隨機事件
        return randomEvent(interaction, char, areaId);
    }
}

export async function showShrineMenu(interaction, char) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);
    const { getInventory } = await import('../rpgDatabase.js');
    const inv = getInventory(interaction.guildId, interaction.user.id);

    // ANSI Header
    const headerContent = [
        { color: COLORS.GOLD + ';' + COLORS.BOLD, text: ` 🏮 【 遠 古 祭 壇 — 靈 魂 喚 醒 】 🏮 ` },
        { color: COLORS.CYAN, text: ` 於祭壇供奉特定的靈媒，喚醒潛藏於此地的強大存在。 ` }
    ];

    let areaListText = '';
    const options = [];

    for (const [areaId, recipe] of Object.entries(SUMMON_RECIPES)) {
        const area = AREAS.find(a => a.id === areaId);
        const boss = BOSSES[areaId];
        if (!area || !boss || char.level < area.levelReq) continue;

        let areaText = `\n${area.emoji} ${fmt(COLORS.GREEN + ';' + COLORS.BOLD, area.name)}：${fmt(COLORS.GOLD, `召喚 ${boss.name}`)}\n`;

        const ingredientsText = recipe.ingredients.map(ing => {
            const owned = inv.find(i => i.item_id === ing.id)?.quantity || 0;
            const isEnough = owned >= ing.count;
            const statusIcon = isEnough ? '✅' : '❌';
            const color = isEnough ? COLORS.GREEN : COLORS.RED;
            const itemDef = ITEM_NAMES[ing.id];
            const itemName = itemDef ? itemDef.name : ing.id;
            const itemEmoji = itemDef ? itemDef.emoji : '📦';
            return `   ${statusIcon} ${itemEmoji} ${fmt(color, itemName)}: ${fmt(COLORS.WHITE, `${owned}/${ing.count}`)}`;
        }).join('\n');

        areaText += ingredientsText + `\n${fmt(COLORS.GRAY, '──────────────────')}`;
        areaListText += areaText;

        options.push({
            label: `${area.emoji} ${area.name}：召喚 ${boss.name}`,
            description: `需求：${recipe.ingredients.map(ing => `${ing.count}x ${ITEM_NAMES[ing.id]?.name || ing.id}`).join(', ')}`,
            value: areaId,
            emoji: area.emoji
        });
    }

    let finalDesc = '```ansi\n';
    headerContent.forEach(h => {
        finalDesc += fmt(h.color, h.text) + '\n';
    });
    finalDesc += fmt(COLORS.WHITE, '💡 提示：喚醒後將立即面對首領挑戰。') + '\n';
    finalDesc += fmt(COLORS.GRAY, '═══ 目前可感應到的祭壇 ═══') + '\n';
    finalDesc += (areaListText || fmt(COLORS.RED, '目前尚未感應到任何祭壇的能量共鳴。')) + '\n```';

    const embed = rpgEmbed(null, finalDesc, areaListText ? 0xE74C3C : 0x95A5A6)
        .setFooter({ text: `🐕👑 吉吉王國騎士團 | uid:${interaction.user.id}` });

    if (options.length === 0) {
        return safeReply(interaction, { embeds: [embed], components: [backButton()] });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('rpg_shrine_summon_select')
        .setPlaceholder('🏮 選擇要喚醒的首領...')
        .addOptions(options.slice(0, 25));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await safeReply(interaction, { embeds: [embed], components: [row, backButton()] });
}

export async function handleSummonSelect(interaction, char) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);
    const areaId = interaction.values[0];
    const recipe = SUMMON_RECIPES[areaId];

    if (!recipe) return;

    const { getInventory, removeFromInventory } = await import('../rpgDatabase.js');
    const inv = getInventory(interaction.guildId, interaction.user.id);

    // 再次檢查素材
    for (const ing of recipe.ingredients) {
        const owned = inv.find(i => i.item_id === ing.id)?.quantity || 0;
        if (owned < ing.count) {
            return interaction.followUp({ content: `🚫 召喚失敗：你所持有的 ${getItemDisplayName(ing.id)} 數量不足以引發共鳴。`, flags: ['Ephemeral'] });
        }
    }

    // 扣除素材
    for (const ing of recipe.ingredients) {
        removeFromInventory(interaction.guildId, interaction.user.id, ing.id, ing.count);
    }

    return startBattle(interaction, char, areaId, true);
}

async function startBattle(interaction, char, areaId, forceBoss = false) {
    const monstersInArea = MONSTERS[areaId];
    if (!monstersInArea || monstersInArea.length === 0) return;

    const hiredMcs = activeMercenaries.get(interaction.user.id) || [];
    const partyIds = [interaction.user.id];

    const equipList = getEquipmentList(interaction.guildId, interaction.user.id);
    const total = calculateTotalStats(char, equipList);

    const playerState = {
        [interaction.user.id]: {
            id: interaction.user.id, // 新增 ID 以供戰鬥日誌標記
            hp: Math.min(char.hp, total.max_hp), max_hp: total.max_hp,
            mp: Math.min(char.mp, total.max_mp), max_mp: total.max_mp,
            atk: total.atk, matk: total.matk,
            def: total.def, mdef: total.mdef,
            spd: total.spd,
            crit: total.crit, crit_dmg: total.crit_dmg,
            dodge: total.dodge, lifesteal: total.lifesteal,
            penetration_pct: total.penetration_pct,
            echo_chance: total.echo_chance,
            b_atk: total.atk, b_matk: total.matk, b_def: total.def, b_mdef: total.mdef, b_spd: total.spd,
            class: char.class, level: char.level,
            buffs: [], debuffs: [],
            isMercenary: false,
            learnedSkills: getLearnedSkills(interaction.guildId, interaction.user.id),
        }
    };

    for (const mId of hiredMcs) {
        const mChar = getCharacter(interaction.guildId, mId);
        if (mChar && mChar.allow_mercenary === 1) {
            const mEquipList = getEquipmentList(interaction.guildId, mId);
            const mTotal = calculateTotalStats(mChar, mEquipList);
            partyIds.push(mId);
            playerState[mId] = {
                id: mId, // 新增 ID 以供戰鬥日誌標記
                hp: mTotal.max_hp, max_hp: mTotal.max_hp,
                mp: mTotal.max_mp, max_mp: mTotal.max_mp,
                atk: mTotal.atk, matk: mTotal.matk,
                def: mTotal.def, mdef: mTotal.mdef,
                spd: mTotal.spd,
                crit: mTotal.crit, crit_dmg: mTotal.crit_dmg,
                dodge: mTotal.dodge, lifesteal: mTotal.lifesteal,
                penetration_pct: mTotal.penetration_pct,
                echo_chance: mTotal.echo_chance,
                b_atk: mTotal.atk, b_matk: mTotal.matk, b_def: mTotal.def, b_mdef: mTotal.mdef, b_spd: mTotal.spd,
                class: mChar.class, level: mChar.level,
                learnedSkills: getLearnedSkills(interaction.guildId, mId),
                buffs: [], debuffs: [],
                isMercenary: true
            };
        }
    }

    const partySize = partyIds.length;
    const bossData = BOSSES[areaId];
    let monsterData = [];
    let isBossEncounter = false;

    if (forceBoss && bossData) {
        isBossEncounter = true;
        const baseHpMultiplier = 2.0;
        const baseStatMultiplier = 1.15;
        const partyScaleFactor = 1 + (partySize - 1) * 0.5;

        monsterData.push({
            ...bossData,
            hp: Math.round(bossData.hp * baseHpMultiplier * partyScaleFactor),
            atk: Math.round(bossData.atk * baseStatMultiplier * partyScaleFactor),
            matk: Math.round(bossData.matk * baseStatMultiplier * partyScaleFactor),
            def: Math.round(bossData.def * baseStatMultiplier * partyScaleFactor),
            mdef: Math.round(bossData.mdef * baseStatMultiplier * partyScaleFactor),
            b_atk: Math.round(bossData.atk * baseStatMultiplier * partyScaleFactor),
            b_matk: Math.round(bossData.matk * baseStatMultiplier * partyScaleFactor),
            b_def: Math.round(bossData.def * baseStatMultiplier * partyScaleFactor),
            b_mdef: Math.round(bossData.mdef * baseStatMultiplier * partyScaleFactor),
            b_spd: bossData.spd,
            currentHp: Math.round(bossData.hp * baseHpMultiplier * partyScaleFactor),
            currentMp: bossData.mp,
            isBoss: true,
            buffs: [], debuffs: [],
            instanceId: 'boss_0'
        });
    } else {
        const numMonsters = Math.min(Math.floor(Math.random() * 2) + 1 + Math.floor(partySize / 2), 4);
        for (let i = 0; i < numMonsters; i++) {
            const randomMonster = monstersInArea[Math.floor(Math.random() * monstersInArea.length)];
            monsterData.push({
                ...randomMonster,
                currentHp: randomMonster.hp,
                currentMp: randomMonster.mp,
                b_atk: randomMonster.atk,
                b_matk: randomMonster.matk,
                b_def: randomMonster.def,
                b_mdef: randomMonster.mdef,
                b_spd: randomMonster.spd,
                buffs: [], debuffs: [],
                instanceId: `${randomMonster.id}_${i}`
            });
        }
    }

    const battleId = createBattle(
        interaction.guildId,
        interaction.channelId,
        partyIds,
        monsterData,
        playerState,
        areaId
    );

    const battleMsg = isBossEncounter
        ? `⚠️ 警告！遭遇了首領 **${bossData.name}**！`
        : `⚔️ 戰鬥開始！遭遇了 ${monsterData.length} 隻怪物！${hiredMcs.length > 0 ? `\n🛡️ **你的傭兵小隊已加入戰鬥！**` : ''}`;

    await renderBattle(interaction, battleId, battleMsg);
}

async function foundTreasure(interaction, char, areaId) {
    const baseGold = Math.floor(Math.random() * 50 + 20);
    const areaIndex = AREAS.findIndex(a => a.id === areaId);
    const areaMultiplier = 1 + Math.floor(areaIndex * 0.5);
    const levelMultiplier = 1 + (char.level / 10);
    const goldFound = Math.floor(baseGold * areaMultiplier * levelMultiplier);

    const { addGold } = await import('../rpgDatabase.js');
    addGold(interaction.guildId, interaction.user.id, goldFound);

    const headerContent = [
        { color: COLORS.GOLD + ';' + COLORS.BOLD, text: ` 🎁 【驚喜發現！】 🎁 ` },
        { color: COLORS.CYAN, text: ` 📜 於瓦礫堆中發現了無主之財。 ` }
    ];

    let desc = '```ansi\n';
    headerContent.forEach(h => desc += fmt(h.color, h.text) + '\n');
    desc += [
        '',
        `你在 ${AREAS.find(a => a.id === areaId)?.emoji} ${fmt(COLORS.WHITE, AREAS.find(a => a.id === areaId)?.name)} 發現了一個寶箱！`,
        '',
        `${fmt(COLORS.WHITE, '💰 獲得金幣:')} ${fmt(COLORS.GOLD + ';' + COLORS.BOLD, goldFound.toLocaleString())}`,
        '',
        `${fmt(COLORS.GREEN, '📜 運氣不錯。繼續遠征。')}`
    ].join('\n') + '\n```';

    const embed = rpgEmbed(null, desc, 0xF1C40F);

    const row = new ActionRowBuilder().addComponents(
        rpgButton(`rpg_area_${areaId}`, '繼續冒險', undefined, '⚔️'),
        rpgButton('rpg_menu', '返回主選單', undefined, '🔙'),
    );

    await safeReply(interaction, { embeds: [embed], components: [row] });
}

async function randomEvent(interaction, char, areaId) {
    const eventPools = {
        talking_island: [
            { text: '一隻友善的吉娃娃農夫招待你吃了一頓豐盛的農家菜！', healHp: 30, healMp: 15 },
            { text: '你在島上的草叢中發現了某個粗心騎士遺落的錢袋。', gold: 50 },
            { text: '你幫忙找回了島民走失的小綿羊，獲得了一些謝禮。', gold: 30, healHp: 10 },
        ],
        elven_forest: [
            { text: '精靈之森的泉水甘甜無比，你感到體力得到了恢復。', healHp: 50, healMp: 20 },
            { text: '不慎踩到了森林中的獵人陷阱，受到了一點皮外傷。', hpDamage: 20 },
            { text: '你在妖精之森的老樹根部發現了一些被遺忘的銀幣。', gold: 40 },
        ],
        dragon_valley: [
            { text: '一股莫名的寒氣從龍骨中散發，你感到靈魂有些顫慄。', mpDamage: 10 },
            { text: '你採集到了一些稀有的龍脊藥草。', gold: 80, healHp: 20 },
            { text: '龍之谷一陣強風吹過，你差點被風沙迷了眼。', hpDamage: 15 },
        ],
        giran_swamp: [
            { text: '奇岩沼澤的毒氣讓你感到一陣暈眩。', hpDamage: 30, mpDamage: 10 },
            { text: '你在淤泥中挖出了一枚沾滿泥土的古幣。', gold: 100 },
        ],
        fire_dragon_cave: [
            { text: '火龍窟的高溫撲面而來，你的護甲感覺快要融化了。', hpDamage: 40 },
            { text: '在焦黑的岩石縫隙中發現了一顆微弱的紅水晶。', gold: 150 },
        ],
        crystal_cave: [
            { text: '水晶地監的共鳴能量修復了你的身心！', healHp: 200, healMp: 100 },
            { text: '你敲下了一小塊純淨的水晶碎片帶走。', gold: 600 },
            { text: '水晶迷宮中折射的強光讓你暫時失明。', hpDamage: 30 },
        ],
        ivory_tower: [
            { text: '象牙塔中的魔力波動讓你感到精神煥發。', healMp: 50 },
            { text: '在塔樓的夾層中發現了寫滿古代文字的錢袋。', gold: 200 },
        ],
        tower_of_insolence: [
            { text: '傲慢之塔的空氣沉重如石，每一口呼吸都感到體力流逝。', hpDamage: 50, mpDamage: 20 },
            { text: '在高塔的陰影中撿到了前人遺留的金幣袋。', gold: 300 },
        ],
        forgotten_island: [
            { text: '遺忘之島的遠古巨人氣息在空氣中迴盪。', hpDamage: 40 },
            { text: '在遺蹟的祭壇上發現了閃爍的古文明錢幣。', gold: 400 },
        ],
        antharas_lair: [
            { text: '地龍 安塔瑞斯的咆哮從地底深處傳來，大地在顫抖。', hpDamage: 60, mpDamage: 30 },
        ]
    };

    const events = eventPools[areaId] || eventPools['outskirts'];
    const event = events[Math.floor(Math.random() * events.length)];
    const { addGold } = await import('../rpgDatabase.js');

    const finalGold = event.gold ? Math.floor(event.gold * (1 + char.level / 10)) : 0;
    if (finalGold > 0) addGold(interaction.guildId, interaction.user.id, finalGold);

    const scaleFactor = 1 + (char.level / 20);
    const scaledHealHp = event.healHp ? Math.floor(event.healHp * scaleFactor) : 0;
    const scaledHealMp = event.healMp ? Math.floor(event.healMp * scaleFactor) : 0;

    if (scaledHealHp || scaledHealMp) {
        const { calculateTotalStats } = await import('../rpgHelpers.js');
        const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
        const total = calculateTotalStats(char, eqList);
        const updates = {};
        if (scaledHealHp) {
            let newHp = char.hp + scaledHealHp;
            if (newHp <= 0) newHp = 1;
            if (newHp > total.max_hp) newHp = total.max_hp;
            updates.hp = newHp;
        }
        if (scaledHealMp) {
            let newMp = char.mp + scaledHealMp;
            if (newMp < 0) newMp = 0;
            if (newMp > total.max_mp) newMp = total.max_mp;
            updates.mp = newMp;
        }
        updateCharacter(interaction.guildId, interaction.user.id, updates);
    }

    const header = ansiBlock([
        { color: COLORS.PURPLE + ';' + COLORS.BOLD, text: ` 🎲 【 奇 遇 之 刻 】 🎲 ` },
        { color: COLORS.CYAN, text: ` 遠征途中，命運的齒輪往往生出意外的轉折。 ` }
    ]);

    const resultLines = [
        `你在探索途中的奇遇：`,
        '',
        fmt(COLORS.GRAY, '「莫要以天價購得無用之物...」'),
        '',
        finalGold ? `${fmt(COLORS.WHITE, '💰 獲得金幣:')} ${fmt(COLORS.GOLD + ';' + COLORS.BOLD, finalGold.toLocaleString())}` : '',
        scaledHealHp ? `${scaledHealHp > 0 ? fmt(COLORS.GREEN, '💚') : fmt(COLORS.RED, '💔')} 生命周期 ${scaledHealHp > 0 ? fmt(COLORS.GREEN, '恢復') : fmt(COLORS.RED, '減少')} 了 ${fmt(COLORS.WHITE + ';' + COLORS.BOLD, Math.abs(scaledHealHp))} 點！` : '',
        scaledHealMp ? `${scaledHealMp > 0 ? fmt(COLORS.BLUE, '💙') : fmt(COLORS.BLUE, '💧')} 魔力值 ${scaledHealMp > 0 ? fmt(COLORS.BLUE, '恢復') : fmt(COLORS.BLUE, '減少')} 了 ${fmt(COLORS.WHITE + ';' + COLORS.BOLD, Math.abs(scaledHealMp))} 點！` : '',
    ].filter(Boolean);

    const embed = rpgEmbed(null, header, 0x9B59B6);
    embed.setDescription('```ansi\n' + resultLines.join('\n') + '\n```');

    const row = new ActionRowBuilder().addComponents(
        rpgButton(`rpg_area_${areaId}`, '繼續冒險', undefined, '⚔️'),
        rpgButton('rpg_menu', '返回主選單', undefined, '🔙'),
    );

    await safeReply(interaction, { embeds: [embed], components: [row] });
}
