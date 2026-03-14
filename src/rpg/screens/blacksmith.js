import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { 
    getCharacter, getEquipmentList, getEquipment, removeEquipment, addToInventory, removeFromInventory, 
    deductGold, updateEquipment, updateCharacter, getDb, getInventory, addAuction, getAuctions, 
    getAuctionById, deleteAuction, getAuctionsBySeller, getTotalAuctionsCount, addGold, addEquipment, 
    addAuctionHistory, getPersonalAuctionHistory, getQuestProgress, getLearnedSkills, setAutoSkills,
    getStashedEquipmentList, getStashedInventory, stashEquipment, unstashEquipment, resetCharacterStats,
    stashItem, unstashItem
} from '../rpgDatabase.js';
import { rpgEmbed, rpgButton, safeReply, formatItemName, backButton, generateRandomAffixes, getEquipCategory, getScrollForCategory, ENHANCEMENT_CONFIG, broadcastRpgEvent, calculateTotalStats } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';
import { EQUIPMENT, QUALITY_MULTIPLIER } from '../data/gameData.js';

/**
 * 顯示鐵匠鋪主畫面
 */
export async function showBlacksmith(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const char = getCharacter(guildId, userId);

    const embed = rpgEmbed(
        '⚒️ 鐵匠鋪 — 葛魯尼的工坊',
        '```ansi\n' + [
            fmt(COLORS.WHITE, '「歡迎來到鐵匠鋪！勇者，你是要打造神兵利器，還是要把那些破爛回收掉？」'),
            '',
            fmt(COLORS.YELLOW + ';' + COLORS.BOLD, '⚒️ 服務項目：'),
            fmt(COLORS.WHITE, '1. 裝備強化：消耗強化卷軸提升裝備基礎屬性。'),
            fmt(COLORS.WHITE, '2. 裝備拆解：將多餘的裝備拆解為素材。'),
            fmt(COLORS.WHITE, '3. 屬性洗煉：消耗素材重新隨機抽取裝備詞條。'),
            '',
            `${fmt(COLORS.WHITE, '💰 目前金幣')}: ${fmt(COLORS.GOLD + ';' + COLORS.BOLD, char.gold.toLocaleString())}`,
        ].join('\n') + '\n```'
    );

    const row = new ActionRowBuilder().addComponents(
        rpgButton(`rpg_bs_enhance_list_${userId}`, '裝備強化', undefined, '⚒️'),
        rpgButton(`rpg_bs_dismantle_list_${userId}`, '裝備拆解', undefined, '♻️'),
        rpgButton(`rpg_bs_reforge_list_${userId}`, '屬性洗煉', undefined, '🌀'),
    );

    await safeReply(interaction, { embeds: [embed], components: [row, backButton()] });
}

/**
 * 顯示可拆解/洗煉的裝備清單
 */
export async function showBlacksmithList(interaction, actionType) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    // 強化允許顯示已裝備物品；拆解與洗煉僅限未裝備物品
    const eqList = getEquipmentList(guildId, userId).filter(eq => {
        if (actionType === 'enhance') {
            const def = EQUIPMENT[eq.item_id];
            return def && getEquipCategory(def.type) && (eq.enhancement || 0) < 9;
        }
        return !eq.equipped;
    });

    if (eqList.length === 0) {
        return safeReply(interaction,{ content: '🐕 你背包裡沒有多餘的（未裝備）裝備可以操作喔！', flags: ['Ephemeral'] });
    }

    const titles = {
        dismantle: '♻️ 選擇要拆解的裝備',
        reforge: '🌀 選擇要洗煉的裝備',
        enhance: '⚒️ 選擇要強化的裝備'
    };
    const embed = rpgEmbed(titles[actionType] || '鐵匠鋪', '請從下方選單選擇一件裝備。' + (actionType === 'dismantle' ? '注意：拆解後的裝備將會永久消失！' : ''));

    const options = eqList.map(eq => {
        const def = EQUIPMENT[eq.item_id];
        const quality = QUALITY_MULTIPLIER[eq.quality]?.label || eq.quality;
        const namePart = `${def.name} (+${eq.enhancement || 0})`;
        const descPart = `[${quality}] ${def.type}${eq.equipped ? ' (裝備中)' : ''}`;
        return {
            label: namePart,
            description: descPart.slice(0, 100),
            value: `rpg_bs_select_${actionType}_${eq.id}`,
            emoji: def.emoji || '📦'
        };
    });

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`rpg_bs_select_${userId}`)
            .setPlaceholder('選擇裝備...')
            .addOptions(options.slice(0, 25))
    );

    const backRow = new ActionRowBuilder().addComponents(
        rpgButton(`rpg_blacksmith`, '返回', undefined, '🔙')
    );

    await safeReply(interaction, { embeds: [embed], components: [row, backRow] });
}

/**
 * 處理拆解確認
 */
export async function handleDismantle(interaction, eqId) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const eq = getEquipment(eqId);
    if (!eq || eq.user_id !== userId) return;

    const def = EQUIPMENT[eq.item_id];
    
    // 計算產出
    let shardCount = 0;
    let essenceCount = 0;
    
    switch(eq.quality) {
        case 'common': shardCount = Math.floor(Math.random() * 4) + 5; break; // 5-8
        case 'fine': shardCount = Math.floor(Math.random() * 7) + 12; break; // 12-18
        case 'rare': shardCount = Math.floor(Math.random() * 11) + 25; break; // 25-35
        case 'epic': essenceCount = Math.floor(Math.random() * 2) + 2; break; // 2-3
        case 'mythic': essenceCount = Math.floor(Math.random() * 4) + 5; break; // 5-8
        case 'legendary': essenceCount = Math.floor(Math.random() * 5) + 8; break; // 8-12
    }

    // 執行刪除與增加道具
    removeEquipment(eqId);
    if (shardCount > 0) addToInventory(guildId, userId, 'magic_shard', shardCount);
    if (essenceCount > 0) addToInventory(guildId, userId, 'chaos_essence', essenceCount);

    const embed = rpgEmbed(
        '♻️ 拆解成功',
        '```ansi\n' + [
            fmt(COLORS.GREEN, `你將 ${def.name} 投入了熔爐...`),
            '',
            shardCount > 0 ? fmt(COLORS.CYAN, `✨ 獲得 魔力碎片 x${shardCount}`) : '',
            essenceCount > 0 ? fmt(COLORS.PURPLE, `🌀 獲得 混沌精華 x${essenceCount}`) : '',
            '',
            fmt(COLORS.GRAY, '裝備已化為原始能量，存入你的背包。')
        ].filter(Boolean).join('\n') + '\n```',
        0x2ECC71
    );

    await safeReply(interaction, { embeds: [embed], components: [backButton()] });
}

/**
 * 處理洗煉確認
 */
export async function handleReforge(interaction, eqId) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const eq = getEquipment(eqId);
    if (!eq || eq.user_id !== userId) return;

    const def = EQUIPMENT[eq.item_id];
    const char = getCharacter(guildId, userId);
    
    // 洗煉成本
    const goldCost = 500;
    const materialId = (eq.quality === 'epic' || eq.quality === 'legendary') ? 'chaos_essence' : 'magic_shard';
    const materialName = materialId === 'chaos_essence' ? '🌀 混沌精華' : '✨ 魔力碎片';
    const materialCost = 10;

    if (char.gold < goldCost) return safeReply(interaction,{ content: `🐕 金幣不足！洗煉需要 ${goldCost} 金幣。`, flags: ['Ephemeral'] });
    
    // 檢查材料
    const inv = getInventory(guildId, userId);
    const material = inv.find(i => i.item_id === materialId && i.quantity >= materialCost);
    if (!material) {
        return safeReply(interaction, { content: `🐕 材料不足！需要 ${materialCost} 個 ${materialName}。`, flags: ['Ephemeral'] });
    }
    
    // 實際洗煉邏輯：移除舊詞條，生成新詞條
    const newAffixes = generateRandomAffixes(eq.item_id, eq.quality, char.level);
    updateEquipment(eqId, { bonus_stats: JSON.stringify(newAffixes) });
    deductGold(guildId, userId, goldCost);
    removeFromInventory(guildId, userId, materialId, materialCost);

    const { AFFIX_REGISTRY } = await import('../data/gameData.js');
    const affixLines = (newAffixes.affixes || []).map(aff => {
        const reg = AFFIX_REGISTRY[aff.id];
        if (!reg) return '';
        const statsStr = Object.entries(reg.stats).map(([k, v]) => `${k.toUpperCase()} +${Math.floor(v * aff.roll)}`).join(', ');
        return `• ${fmt(COLORS.CYAN, reg.name)}: ${fmt(COLORS.WHITE, statsStr)}`;
    }).filter(Boolean);

    const embed = rpgEmbed(
        '🌀 洗煉成功！',
        '```ansi\n' + [
            fmt(COLORS.GREEN, `你消耗了 ${goldCost} 金幣 與 ${materialCost} 個 ${materialName}，`),
            fmt(COLORS.WHITE, `成功為 **${def.name}** 重塑了靈魂屬性：`),
            '',
            ...affixLines,
            '',
            fmt(COLORS.GRAY, '若對新屬性不滿意，可再次進行洗煉。')
        ].join('\n') + '\n```',
        0x9B59B6
    );

    await safeReply(interaction, { embeds: [embed], components: [backButton()] });
}

/**
 * 處理強化邏輯 (遷移自 inventory.js)
 */
export async function handleEnhance(interaction, eqId) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const char = getCharacter(guildId, userId);
    const eq = getEquipment(eqId);
    
    if (!eq || eq.user_id !== userId) return;
    const def = EQUIPMENT[eq.item_id];
    if (!def) return;

    const category = getEquipCategory(def.type);
    if (!category) return safeReply(interaction,{ content: '🐕 此裝備無法強化！', flags: ['Ephemeral'] });

    const scrollId = getScrollForCategory(category);
    const db = getDb();
    const invItem = db.prepare('SELECT quantity FROM rpg_inventory WHERE guild_id = ? AND user_id = ? AND item_id = ? AND stashed = 0').get(guildId, userId, scrollId);
    
    if (!invItem || invItem.quantity <= 0) {
        const scrollNames = { weapon: '⚔️ 對武器施法的卷軸', armor: '🛡️ 對防具施法的卷軸', accessory: '💍 對飾品施法的卷軸' };
        return safeReply(interaction,{ content: `🐕 需要 **${scrollNames[category]}** 才能強化此裝備！`, flags: ['Ephemeral'] });
    }

    const currentEnh = eq.enhancement || 0;
    if (currentEnh >= 9) return safeReply(interaction,{ content: '🐕 此裝備已達最高強化等級 +9！', flags: ['Ephemeral'] });

    const cfg = ENHANCEMENT_CONFIG[category];
    const failRate = cfg.failRates[currentEnh + 1] || 0;
    const breakRate = cfg.breakRates[currentEnh + 1] || 0;
    const safe = currentEnh < cfg.safeZone;

    // 消耗卷軸
    removeFromInventory(guildId, userId, scrollId, 1);

    let msg;
    if (safe || Math.random() * 100 >= failRate) {
        // 成功
        const newEnh = currentEnh + 1;
        updateEquipment(eqId, { enhancement: newEnh });

        // 超過安定值的廣播
        if (newEnh > cfg.safeZone) {
            const categoryNames = { weapon: '武器', armor: '防具', accessory: '飾品' };
            await broadcastRpgEvent(interaction.client, guildId, {
                title: '神兵誕生：強化突破！',
                description: [
                    `奇蹟發生了！冒險者 ${fmt(COLORS.BLUE, interaction.user.displayName)} `,
                    `成功將其${categoryNames[category]} 「${fmt(COLORS.WHITE, def.name)}」`,
                    `從 +${currentEnh} 強烈衝擊至 ${fmt(COLORS.GOLD, '+' + newEnh)} 的驚人境界！`,
                    '',
                    `${fmt(COLORS.GOLD, '「這份勇氣與運氣，將被王國歌頌！」')}`
                ].join('\n'),
                color: 0xFFAA00,
                type: 'enhancement'
            });
        }

        // 如果裝備中，更新角色屬性
        if (eq.equipped) {
            recalcAndSaveStats(guildId, userId);
        }
        msg = `✨ 強化成功！**${def.emoji} ${def.name}** +${currentEnh} → **+${newEnh}**！`;
    } else if (Math.random() * 100 < breakRate) {
        // 失敗且消失
        if (eq.equipped) {
            const SLOT_KEYS = ['head_id', 'body_id', 'hands_id', 'legs_id', 'feet_id', 'main_hand_id', 'off_hand_id', 'acc1_id', 'acc2_id', 'acc3_id', 'acc4_id'];
            const updates = {};
            for (const slot of SLOT_KEYS) {
                if (char[slot] == eqId) updates[slot] = null;
            }
            updateCharacter(guildId, userId, updates);
            recalcAndSaveStats(guildId, userId);
        }
        removeEquipment(eqId);
        msg = `💥 強化失敗！**${def.emoji} ${def.name}** 在魔力衝擊中化為塵埃...`;

        if (!safe) {
            const categoryNames = { weapon: '武器', armor: '防具', accessory: '飾品' };
            await broadcastRpgEvent(interaction.client, guildId, {
                title: '哀報：強化慘案',
                description: [
                    `痛徹心扉！冒險者 ${fmt(COLORS.BLUE, interaction.user.displayName)} `,
                    `在嘗試將其${categoryNames[category]} 「${fmt(COLORS.WHITE, def.name)}」`,
                    `從 +${currentEnh} 追求更高層次時，裝備因承受不住魔力衝擊而${fmt(COLORS.RED, '徹底粉碎')}了！`,
                    '',
                    `${fmt(COLORS.GRAY, '「路過的冒險者紛紛流下了同情的淚水...」')}`
                ].join('\n'),
                color: 0x880000,
                type: 'enhancement'
            });
        }
    } else {
        // 失敗但保留
        msg = `💔 強化失敗... **${def.emoji} ${def.name}** 維持 +${currentEnh}。`;
        if (!safe) {
            const categoryNames = { weapon: '武器', armor: '防具', accessory: '飾品' };
            await broadcastRpgEvent(interaction.client, guildId, {
                title: '強化失利：功虧一簣',
                description: [
                    `惜敗！冒險者 ${fmt(COLORS.BLUE, interaction.user.displayName)} `,
                    `在對其${categoryNames[category]} 「${fmt(COLORS.WHITE, def.name)}」`,
                    `進行強化的最後一刻，魔力發生了紊亂！`,
                    `雖然裝備${fmt(COLORS.GREEN, '僥倖保住')}了，但等級依然停留在 +${currentEnh}。`,
                    '',
                    `${fmt(COLORS.GRAY, '「至少裝備還在，下次一定會成功的！汪！」')}`
                ].join('\n'),
                color: 0x7F8C8D,
                type: 'enhancement'
            });
        }
    }

    const embed = rpgEmbed('⚒️ 強化結果', msg);
    await safeReply(interaction, { embeds: [embed], components: [backButton()] });
}

/**
 * 內部輔助：重算屬性 (輔助 handleEnhance)
 */
function recalcAndSaveStats(guildId, userId) {
    const char = getCharacter(guildId, userId);
    const eqList = getEquipmentList(guildId, userId);
    const total = calculateTotalStats(char, eqList);
    const DB_STAT_FIELDS = ['hp', 'max_hp', 'mp', 'max_mp', 'atk', 'matk', 'def', 'mdef', 'spd'];
    const updates = {};
    DB_STAT_FIELDS.forEach(f => { if (total[f] !== undefined) updates[f] = total[f]; });
    updateCharacter(guildId, userId, updates);
}
