import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { AREAS, MONSTERS, BOSSES, SUMMON_RECIPES, getItemDisplayName, ITEM_NAMES } from '../data/gameData.js';
import { getCharacter, createBattle, updateCharacter, getLearnedSkills, getEquipmentList, getInventory } from '../rpgDatabase.js';
import { rpgEmbed, rpgButton, areaSelectRows, hpBar, mpBar, backButton, charSummary, ansiText, safeReply, getStatusFields, calculateTotalStats } from '../rpgHelpers.js';
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
        const embed = rpgEmbed('🐕💀 你已經倒下了...', [
            '你的 HP 已經歸零！需要先回復才能繼續冒險。',
            '',
            `${hpBar(char.hp, total.max_hp)}`,
            '',
            '💡 使用商店購買藥水，或等待每日簽到回復！',
        ].join('\n')).setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });
        return safeReply(interaction, { embeds: [embed], components: [backButton()] });
    }

    const embed = rpgEmbed(
        '⚔️ 冒險 — 選擇目的地',
        [
            ansiText('2;32', '選擇你要前往的區域，本王會為你祈福的！汪！'),
            '**👤【當前勇者狀態】**',
            '```ansi\n' + charSummary(char) + '\n```',
            hpBar(char.hp, total.max_hp),
            mpBar(char.mp, total.max_mp),
            '',
            '💡 *區域難度隨顏色加深，請量力而行。*',
        ].join('\n'),
        0x2ECC71
    )
        .addFields(getStatusFields(char, total, { showResources: true, showCombat: false }))
        .setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });

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
        '請選擇你想連續探索的區域與次數。\n> ⚠️ 注意：自動探索將在背景瞬間完成多場戰鬥，期間如果生命值歸零會立即中斷並結算。',
        0x3498DB
    ).setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${userId}` });

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
    const header = ansiBlock([
        { color: COLORS.GOLD + ';' + COLORS.BOLD, text: ` 🏮 【 遠 古 祭 壇 — 靈 魂 喚 醒 】 🏮 ` },
        { color: COLORS.CYAN, text: ` 汪！供奉特定的怪物素材，就能強行喚醒該區域的領主！ ` }
    ]);

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

    let finalDesc = header + '\n';
    finalDesc += '```ansi\n';
    finalDesc += fmt(COLORS.WHITE, '💡 召喚後將立即進入首領戰，請做好準備！') + '\n';
    finalDesc += fmt(COLORS.GRAY, '═══ 目前可感應到的祭壇 ═══') + '\n';
    finalDesc += (areaListText || fmt(COLORS.RED, '汪嗚...目前沒有發現任何可召喚的首領祭壇。')) + '\n```';

    const embed = rpgEmbed(null, finalDesc, areaListText ? 0xE74C3C : 0x95A5A6)
        .setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });

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
            return interaction.followUp({ content: `🐕 汪嗚！召喚失敗：你還差一些 ${getItemDisplayName(ing.id)}！`, flags: ['Ephemeral'] });
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

    const header = ansiBlock([
        { color: COLORS.GOLD + ';' + COLORS.BOLD, text: ` 🎁 【驚喜發現！】 🎁 ` },
        { color: COLORS.CYAN, text: ` 汪！這是在角落發現的無主財寶！ ` }
    ]);

    const embed = rpgEmbed(null, header, 0xF1C40F);
    embed.setDescription('```ansi\n' + [
        `你在 ${AREAS.find(a => a.id === areaId)?.emoji} ${fmt(COLORS.WHITE, AREAS.find(a => a.id === areaId)?.name)} 發現了一個寶箱！`,
        '',
        `${fmt(COLORS.WHITE, '💰 獲得金幣:')} ${fmt(COLORS.GOLD + ';' + COLORS.BOLD, goldFound.toLocaleString())}`,
        '',
        `${fmt(COLORS.GREEN, '🐕 汪！運氣不錯嘛！繼續冒險吧！')}`
    ].join('\n') + '\n```');

    const row = new ActionRowBuilder().addComponents(
        rpgButton(`rpg_area_${areaId}`, '繼續冒險', undefined, '⚔️'),
        rpgButton('rpg_menu', '返回主選單', undefined, '🔙'),
    );

    await safeReply(interaction, { embeds: [embed], components: [row] });
}

async function randomEvent(interaction, char, areaId) {
    const eventPools = {
        outskirts: [
            { text: '一隻友善的吉娃娃農夫招待你吃了一頓豐盛的農家菜！', healHp: 30, healMp: 15 },
            { text: '你在草叢中發現了某個粗心冒險者遺落的錢袋。', gold: 50 },
            { text: '你幫忙找回了走失的小綿羊，獲得了一些謝禮。', gold: 30, healHp: 10 },
        ],
        dark_forest: [
            { text: '你發現了一處被遺棄的盜賊營地，搜刮了一些物資。', gold: 80 },
            { text: '你誤食了發光的詭異蘑菇... 雖然肚子很痛但魔力湧出來了！', healHp: -20, healMp: 40 },
            { text: '你在迷霧中迷路繞了半天，卻意外發現了隱藏的清泉。', healHp: 40, healMp: 40 },
        ],
        dragon_ridge: [
            { text: '找到了一處溫暖的岩穴，免受寒風侵襲，恢復了大量體力。', healHp: 60, healMp: 30 },
            { text: '在懸崖邊發現了一名遇難者的遺骸，你拿走了他身上的錢幣。', gold: 120 },
            { text: '躲過了一次突如其來的落石，驚嚇之餘也找到了碎金塊。', gold: 50, healHp: -10 },
        ],
        dark_swamp: [
            { text: '你不小心踩進了帶毒的沼澤... 失去了一些生命值！', healHp: -40 },
            { text: '撿到了不知名的發黑骸骨，似乎轉手能賣點錢。', gold: 150 },
            { text: '一名路過的神秘女巫賜予了你一瓶詭異的藥水。', healHp: -30, healMp: 80 },
        ],
        lava_waste: [
            { text: '高溫環境讓你幾乎中暑，但你咬牙前行。', healHp: -50 },
            { text: '你撿到一塊溫熱的火山岩晶體，似乎非常值錢！', gold: 250 },
            { text: '找到了一處難得的地底冷泉，宛如沙漠中的綠洲。', healHp: 100, healMp: 50 },
        ],
        void_rift: [
            { text: '次元裂縫中的虛空能量穿透了你！雖然痛苦但魔力充滿了！', healHp: -80, healMp: 150 },
            { text: '從次元裂縫中掉落了來自異世界的古幣。', gold: 400 },
            { text: '你觀察虛空的流動，感覺身心都被奇妙的重塑了。', healHp: 80, healMp: 80 },
        ],
        crystal_cave: [
            { text: '純淨水晶的共鳴能量完美修復了你的身心！', healHp: 200, healMp: 100 },
            { text: '你敲下了一小塊純淨的水晶碎片帶走。', gold: 600 },
            { text: '水晶迷宮中折射的強光讓你暫時失明，撞到了頭。', healHp: -100 },
        ],
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
        { color: COLORS.PURPLE + ';' + COLORS.BOLD, text: ` 🎲 【奇遇事件】 🎲 ` },
        { color: COLORS.CYAN, text: ` 汪！冒險途中總是一波三折呢！ ` }
    ]);

    const resultLines = [
        `你在探索途中的奇遇：`,
        '',
        `${fmt(COLORS.GRAY, `> ${event.text}`)}`,
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
