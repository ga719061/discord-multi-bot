import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getInventory, getEquipmentList, getCharacter, updateCharacter, removeFromInventory, learnSkill, hasLearnedSkill, getEquipment, updateEquipment, getDb } from '../rpgDatabase.js';
import { rpgEmbed, rpgButton, qualityLabel, backButton, getActualStats, ENHANCEMENT_CONFIG, getEquipCategory, getScrollForCategory, ansiText, broadcastRpgEvent, safeReply, formatItemName, getEquipFullName, calculateTotalStats, getQualityColor } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';
import { EQUIPMENT, SHOP_ITEMS, getItemDisplayName, SKILL_BOOKS, getSkillDef, CLASSES, QUALITY_MULTIPLIER, AFFIX_REGISTRY, SET_REGISTRY, STAT_LABELS } from '../data/gameData.js';

const TYPE_TRANSLATIONS = {
    'head': '頭部', 'body': '身體', 'hands': '手部', 'legs': '腿部', 'feet': '足部',
    'weapon_1h': '單手武器', 'weapon_2h': '雙手武器', 'shield': '盾牌', 'accessory': '飾品'
};

const SLOT_NAMES = {
    head_id: '頭部', body_id: '身體', hands_id: '手部', legs_id: '腿部', feet_id: '足部',
    main_hand_id: '主手', off_hand_id: '副手',
    acc1_id: '飾品1', acc2_id: '飾品2', acc3_id: '飾品3', acc4_id: '飾品4'
};

// 共用：重算裝備後的屬性並寫入 DB（避免 3 處重複邏輯）
const DB_STAT_FIELDS = ['hp', 'max_hp', 'mp', 'max_mp', 'atk', 'matk', 'def', 'mdef', 'spd'];
function recalcAndSaveStats(guildId, userId) {
    const freshChar = getCharacter(guildId, userId);
    const eqList = getEquipmentList(guildId, userId);
    const total = calculateTotalStats(freshChar, eqList);
    const updates = {};
    DB_STAT_FIELDS.forEach(f => { if (total[f] !== undefined) updates[f] = total[f]; });
    updateCharacter(guildId, userId, updates);
    return getCharacter(guildId, userId);
}

export async function showInventory(interaction, char) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);
    await showInventoryWithMessage(interaction, char, null);
}

export async function handleInventoryUse(interaction, char) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }
    if (!char) char = getCharacter(interaction.guildId, interaction.user.id);
    if (!interaction.isStringSelectMenu()) return;

    const value = interaction.values[0];

    // ===== 使用消耗品 =====
    if (interaction.customId === 'rpg_inv_use' && value.startsWith('use_')) {
        const itemId = value.replace('use_', '');
        const shopDef = SHOP_ITEMS.consumables.find(s => s.id === itemId);
        if (!shopDef) return safeReply(interaction, { content: '🐕 找不到該道具資料！', flags: ['Ephemeral'] });

        const ok = removeFromInventory(interaction.guildId, interaction.user.id, itemId, 1);
        if (!ok) return safeReply(interaction, { content: '🐕 道具不足！', flags: ['Ephemeral'] });

        let msg = '';
        if (shopDef.effect.type === 'heal_hp') {
            const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
            const total = calculateTotalStats(char, eqList);
            const heal = Math.floor(total.max_hp * (shopDef.effect.percent / 100));
            const newHp = Math.min(total.max_hp, char.hp + heal);
            updateCharacter(interaction.guildId, interaction.user.id, { hp: newHp });
            msg = `${shopDef.emoji} 使用了 ** ${shopDef.name}**！回復了 ${heal} HP！(${char.hp} → ${newHp})`;
        } else if (shopDef.effect.type === 'heal_mp') {
            const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
            const total = calculateTotalStats(char, eqList);
            const heal = Math.floor(total.max_mp * (shopDef.effect.percent / 100));
            const newMp = Math.min(total.max_mp, char.mp + heal);
            updateCharacter(interaction.guildId, interaction.user.id, { mp: newMp });
            msg = `${shopDef.emoji} 使用了 ** ${shopDef.name}**！回復了 ${heal} MP！(${char.mp} → ${newMp})`;
        }

        const updated = getCharacter(interaction.guildId, interaction.user.id);
        return showInventoryWithMessage(interaction, updated, msg);
    }

    // ===== 學習技能書 =====
    if (interaction.customId === 'rpg_inv_use' && value.startsWith('learn_')) {
        const bookId = value.replace('learn_', '');
        const book = SKILL_BOOKS[bookId];
        if (!book) return safeReply(interaction, { content: '🐕 找不到該技能書資料！', flags: ['Ephemeral'] });

        const skill = getSkillDef(book.skillId);
        if (!skill) return safeReply(interaction, { content: '🐕 找不到該技能定義！', flags: ['Ephemeral'] });

        if (book.forClass !== null && book.forClass !== char.class) {
            return safeReply(interaction, { content: `🐕 這是 ${CLASSES[book.forClass]?.name || book.forClass} 的技能書，你的職業無法學習！`, flags: ['Ephemeral'] });
        }
        if (char.level < book.levelReq) {
            return safeReply(interaction, { content: `🐕 等級不足！需要 Lv.${book.levelReq}，你目前 Lv.${char.level} `, flags: ['Ephemeral'] });
        }
        if (hasLearnedSkill(interaction.guildId, interaction.user.id, book.skillId)) {
            return safeReply(interaction, { content: `🐕 你已經學會 ${skill.name} 了！`, flags: ['Ephemeral'] });
        }

        const ok = removeFromInventory(interaction.guildId, interaction.user.id, bookId, 1);
        if (!ok) return safeReply(interaction, { content: '🐕 技能書不足！', flags: ['Ephemeral'] });

        learnSkill(interaction.guildId, interaction.user.id, book.skillId);
        const msg = `📕✨ 學會了新技能！${skill.emoji} ** ${skill.name}**！`;
        const updated = getCharacter(interaction.guildId, interaction.user.id);
        return showInventoryWithMessage(interaction, updated, msg);
    }

    // ===== 卸下物品 =====
    if (interaction.customId === 'rpg_inv_unequip' && value.startsWith('uneq_')) {
        const lastUnderscoreStr = value.lastIndexOf('_');
        const slotKey = value.substring(5, lastUnderscoreStr);
        const eqId = Number(value.substring(lastUnderscoreStr + 1));

        const oldEqId = char[slotKey];
        if (!oldEqId) return safeReply(interaction, { content: '🐕 該欄位沒有裝備可以卸下！', flags: ['Ephemeral'] });

        const oldEq = getEquipment(oldEqId);

        // 1. 更新裝備狀態為未穿戴
        if (oldEq) updateEquipment(oldEqId, { equipped: 0 });

        // 2. 更新角色槽位為空
        updateCharacter(interaction.guildId, interaction.user.id, { [slotKey]: null });

        // 3. 重算屬性並寫入 DB
        const finalChar = recalcAndSaveStats(interaction.guildId, interaction.user.id);
        const def = oldEq ? EQUIPMENT[oldEq.item_id] : null;
        return showInventoryWithMessage(interaction, finalChar, `⬇️ 卸下了 ** ${def ? def.name : '裝備'}**！`);
    }

    // ===== 裝備物品 =====
    if (interaction.customId === 'rpg_inv_equip' && value.startsWith('equip_')) {
        const eqId = Number(value.replace('equip_', ''));
        const eq = getEquipment(eqId);
        if (!eq) return interaction.reply({ content: '🐕 找不到該裝備！', flags: ['Ephemeral'] });

        const def = EQUIPMENT[eq.item_id];
        if (!def) return interaction.reply({ content: '🐕 裝備庫中無此定義！', flags: ['Ephemeral'] });

        if (def.forClass && def.forClass !== char.class) {
            return interaction.reply({ content: `🐕 此裝備僅限 ${CLASSES[def.forClass]?.name || def.forClass} 使用！`, flags: ['Ephemeral'] });
        }

        let targetSlotKey = '';
        let extraUnequipSlot = null; // for 2h and dual wield overrides

        if (def.type === 'head') targetSlotKey = 'head_id';
        else if (def.type === 'body') targetSlotKey = 'body_id';
        else if (def.type === 'hands') targetSlotKey = 'hands_id';
        else if (def.type === 'legs') targetSlotKey = 'legs_id';
        else if (def.type === 'feet') targetSlotKey = 'feet_id';
        else if (def.type === 'shield') {
            targetSlotKey = 'off_hand_id';
            // check main hand doesn't have 2H weapon
            if (char.main_hand_id) {
                const mhEq = getEquipment(char.main_hand_id);
                const mhDef = mhEq ? EQUIPMENT[mhEq.item_id] : null;
                if (mhDef && mhDef.type === 'weapon_2h') {
                    return interaction.reply({ content: '🐕 雙手武器裝備中！無法拿盾。請先卸下主手武器。', flags: ['Ephemeral'] });
                }
            }
        }
        else if (def.type === 'weapon_1h') {
            if (!char.main_hand_id) {
                targetSlotKey = 'main_hand_id';
            } else if (!char.off_hand_id) {
                // Check if main hand is 2h -> if so, override main hand
                const mhEq = getEquipment(char.main_hand_id);
                const mhDef = mhEq ? EQUIPMENT[mhEq.item_id] : null;
                if (mhDef && mhDef.type === 'weapon_2h') targetSlotKey = 'main_hand_id';
                else targetSlotKey = 'off_hand_id';
            } else {
                targetSlotKey = 'main_hand_id'; // default replaces main
            }
        }
        else if (def.type === 'weapon_2h') {
            targetSlotKey = 'main_hand_id';
            if (char.off_hand_id) extraUnequipSlot = 'off_hand_id'; // MUST unequip off_hand
        }
        else if (def.type === 'accessory') {
            if (!char.acc1_id) targetSlotKey = 'acc1_id';
            else if (!char.acc2_id) targetSlotKey = 'acc2_id';
            else if (!char.acc3_id) targetSlotKey = 'acc3_id';
            else if (!char.acc4_id) targetSlotKey = 'acc4_id';
            else targetSlotKey = 'acc1_id';
        }

        if (!targetSlotKey) return interaction.reply({ content: '🐕 無法決定裝備位置！', flags: ['Ephemeral'] });

        let updates = {};

        // Helper to unequip a slot
        const doUnequip = (slot) => {
            const oldId = char[slot];
            if (oldId) {
                updates[slot] = null;
                updateEquipment(oldId, { equipped: 0 });
            }
        };

        doUnequip(targetSlotKey);
        if (extraUnequipSlot) {
            doUnequip(extraUnequipSlot);
        }

        updates[targetSlotKey] = eq.id;
        updateEquipment(eq.id, { equipped: 1 });
        updateCharacter(interaction.guildId, interaction.user.id, updates);

        const msg = `⚔️ 成功裝備了 ** ${def.emoji} ${def.name}**！`;
        const updated = getCharacter(interaction.guildId, interaction.user.id);
        return showInventoryWithMessage(interaction, updated, msg);
    }

    // ===== 強化裝備 =====
    if (interaction.customId === 'rpg_inv_enhance' && value.startsWith('enhance_')) {
        const eqId = Number(value.replace('enhance_', ''));
        const eq = getEquipment(eqId);
        if (!eq) return interaction.reply({ content: '🐕 找不到該裝備！', flags: ['Ephemeral'] });
        const def = EQUIPMENT[eq.item_id];
        if (!def) return interaction.reply({ content: '🐕 裝備庫中無此定義！', flags: ['Ephemeral'] });

        const category = getEquipCategory(def.type);
        if (!category) return interaction.reply({ content: '🐕 此裝備無法強化！', flags: ['Ephemeral'] });

        const scrollId = getScrollForCategory(category);
        const inv = getInventory(interaction.guildId, interaction.user.id);
        const hasScroll = inv.find(i => i.item_id === scrollId && i.quantity > 0);
        if (!hasScroll) {
            const scrollName = { weapon: '⚔️ 對武器施法的卷軸', armor: '🛡️ 對防具施法的卷軸', accessory: '💍 對飾品施法的卷軸' }[category];
            return interaction.reply({ content: `🐕 需要 ** ${scrollName}** 才能強化此裝備！`, flags: ['Ephemeral'] });
        }

        const currentEnh = eq.enhancement || 0;
        if (currentEnh >= 9) return interaction.reply({ content: '🐕 此裝備已達最高強化等級 +9！', flags: ['Ephemeral'] });

        const cfg = ENHANCEMENT_CONFIG[category];
        const failRate = cfg.failRates[currentEnh + 1] || 0;
        const breakRate = cfg.breakRates[currentEnh + 1] || 0;
        const safe = currentEnh < cfg.safeZone;

        // 消耗卷軸
        removeFromInventory(interaction.guildId, interaction.user.id, scrollId, 1);

        let msg;
        if (safe || Math.random() * 100 >= failRate) {
            // 成功
            const newEnh = currentEnh + 1;
            updateEquipment(eqId, { enhancement: newEnh });

            // 超過安定值的廣播
            if (newEnh > cfg.safeZone) {
                const categoryNames = { weapon: '武器', armor: '防具', accessory: '飾品' };
                await broadcastRpgEvent(interaction.client, interaction.guildId, {
                    title: '神兵誕生：強化突破！',
                    description: [
                        `奇蹟發生了！冒險者 ${fmt(COLORS.BLUE, interaction.member.displayName)} `,
                        `成功將其${categoryNames[category]} 「${fmt(COLORS.WHITE, def.name)}」`,
                        `從 + ${currentEnh} 強烈衝擊至 ${fmt(COLORS.GOLD, '+' + newEnh)} 的驚人境界！`,
                        '',
                        `${fmt(COLORS.GOLD, '「這份勇氣與運氣，將被王國歌頌！」')} `
                    ].join('\n'),
                    color: 0xFFAA00
                });
            }

            // 如果裝備中，更新角色屬性 (重算確保資料表欄位正確)
            if (eq.equipped) {
                recalcAndSaveStats(interaction.guildId, interaction.user.id);
            }
            msg = `✨ 強化成功！** ${def.emoji} ${def.name}** +${currentEnh} → ** +${newEnh}**！`;
        } else if (Math.random() * 100 < breakRate) {
            // 失敗且消失 - 若裝備中先卸下屬性
            if (eq.equipped) {
                // 清除裝備槽
                const SLOT_KEYS = ['head_id', 'body_id', 'hands_id', 'legs_id', 'feet_id', 'main_hand_id', 'off_hand_id', 'acc1_id', 'acc2_id', 'acc3_id', 'acc4_id'];
                const updates = {};
                for (const slot of SLOT_KEYS) {
                    if (char[slot] == eqId) updates[slot] = null;
                }
                updateCharacter(interaction.guildId, interaction.user.id, updates);

                // 重算屬性
                recalcAndSaveStats(interaction.guildId, interaction.user.id);
            }
            // 刪除裝備
            getDb().prepare('DELETE FROM rpg_equipment WHERE id = ?').run(eqId);
            msg = `💥 強化失敗！** ${def.emoji} ${def.name}** 在魔力衝擊中化為塵埃...`;

            // 失敗廣播
            if (!safe) {
                const categoryNames = { weapon: '武器', armor: '防具', accessory: '飾品' };
                await broadcastRpgEvent(interaction.client, interaction.guildId, {
                    title: '哀報：強化慘案',
                    description: [
                        `痛徹心扉！冒險者 ${fmt(COLORS.BLUE, interaction.member.displayName)} `,
                        `在嘗試將其${categoryNames[category]} 「${fmt(COLORS.WHITE, def.name)}」`,
                        `從 + ${currentEnh} 追求更高層次時，裝備因承受不住魔力衝擊而${fmt(COLORS.RED, '徹底粉碎')} 了！`,
                        '',
                        `${fmt(COLORS.GRAY, '「路過的冒險者紛紛流下了同情的淚水...」')} `
                    ].join('\n'),
                    color: 0x880000
                });
            }
        } else {
            // 失敗但保留
            msg = `💔 強化失敗... ** ${def.emoji} ${def.name}** 維持 + ${currentEnh}。`;

            // 失敗廣播
            if (!safe) {
                const categoryNames = { weapon: '武器', armor: '防具', accessory: '飾品' };
                await broadcastRpgEvent(interaction.client, interaction.guildId, {
                    title: '強化失利：功虧一簣',
                    description: [
                        `惜敗！冒險者 ${fmt(COLORS.BLUE, interaction.member.displayName)} `,
                        `在對其${categoryNames[category]} 「${fmt(COLORS.WHITE, def.name)}」`,
                        `進行強化的最後一刻，魔力發生了紊亂！`,
                        `雖然裝備${fmt(COLORS.GREEN, '僥倖保住')} 了，但等級依然停留在 + ${currentEnh}。`,
                        '',
                        `${fmt(COLORS.GRAY, '「至少裝備還在，下次一定會成功的！汪！」')} `
                    ].join('\n'),
                    color: 0x7F8C8D
                });
            }
        }

        const updated = getCharacter(interaction.guildId, interaction.user.id);
        return showInventoryWithMessage(interaction, updated, msg);
    }

    // 保險：如果沒有任何匹配，給予基本回應防止超時
    if (!interaction.replied && !interaction.deferred) {
        return safeReply(interaction, { content: '🐕 汪嗚？此項操作無效。', flags: ['Ephemeral'] });
    }
}

async function showInventoryWithMessage(interaction, char, message) {
    // 輔助函式：確保字串不超出 Discord 欄位限制 (1024 字元)
    const limitField = (lines, limit = 1000) => {
        let res = '';
        for (const line of lines) {
            if ((res + line + '\n').length > limit) {
                res += '... (項目過多，僅顯示部分項目)';
                break;
            }
            res += line + '\n';
        }
        return res || '（無）';
    };

    const inv = getInventory(interaction.guildId, interaction.user.id);
    const eqList = getEquipmentList(interaction.guildId, interaction.user.id);

    const equippedIds = [
        char.head_id, char.body_id, char.hands_id, char.legs_id, char.feet_id,
        char.main_hand_id, char.off_hand_id,
        char.acc1_id, char.acc2_id, char.acc3_id, char.acc4_id
    ].filter(Boolean).map(x => Number(x));

    const consumables = [];
    const skillBooks = [];
    const materials = [];

    for (const i of inv) {
        const shopDef = SHOP_ITEMS.consumables.find(s => s.id === i.item_id);
        if (shopDef) {
            consumables.push({ ...i, display: `${shopDef.emoji} ${shopDef.name} x${i.quantity} ` });
        } else if (SKILL_BOOKS[i.item_id]) {
            const book = SKILL_BOOKS[i.item_id];
            const skill = getSkillDef(book.skillId);
            const cls = CLASSES[book.forClass];
            skillBooks.push({
                ...i,
                display: `📕 ${skill?.name || i.item_id} [${qualityLabel(book.quality)}](${cls?.name || book.forClass} Lv${book.levelReq}) x${i.quantity} `,
            });
        } else {
            materials.push({ ...i, display: `${getItemDisplayName(i.item_id)} x${i.quantity} ` });
        }
    }

    const equipLines = eqList.filter(e => !equippedIds.includes(e.id)).map(e => {
        const def = EQUIPMENT[e.item_id];
        if (!def) return `📦 ${e.item_id} [${qualityLabel(e.quality)}]`;
        const enh = e.enhancement || 0;
        const enhStr = enh > 0 ? ` ** +${enh}** ` : '';

        const bonusData = typeof e.bonus_stats === 'string' ? JSON.parse(e.bonus_stats || '{}') : (e.bonus_stats || {});
        const actualStats = getActualStats(e.item_id, e.quality, enh, bonusData);

        const statsText = Object.entries(actualStats)
            .filter(([k]) => k !== 'hp' && k !== 'mp') // 隱藏當前值，只顯示最大值和百分比
            .map(([k, v]) => {
                const cleanKey = k.replace('max_', '');
                const label = STAT_LABELS[cleanKey] || cleanKey.toUpperCase();
                return `${label}${v >= 0 ? '+' : ''}${v} `;
            }).join(' ');

        const fullName = getEquipFullName(e, def);
        const coloredName = formatItemName(fullName, e.quality);
        let line = `${def.emoji} ${coloredName}${enhStr} — ${statsText} `;

        // 顯示詞條詳細數值
        if (bonusData.affixes && bonusData.affixes.length > 0) {
            const affTexts = bonusData.affixes.map(a => {
                const reg = AFFIX_REGISTRY[a.id];
                if (!reg) return a.id;
                const isActivated = !reg.activationLevel || enh >= reg.activationLevel;
                if (!isActivated) return `🔒 ${reg.name} (需+${reg.activationLevel})`;
                return `${reg.name} (${Math.round(a.roll * 100)}%)`;
            });
            line += `\n   └ ✨ ${affTexts.join(', ')} `;
        }
        return line;
    });

    const embed = rpgEmbed(`🧳 ${interaction.user.displayName} 的背包`, null, 0x9B59B6);

    let desc = ansiText('2;35', '小心翻看，這些都是你在大陸各處搜刮來的寶物。');
    if (message) {
        desc += `\n **✅ ${message}** `;
    }
    embed.setDescription(desc);

    embed.addFields(
        {
            name: '💰 財金',
            value: `> ** ${char.gold.toLocaleString()}** 金幣　💎 ** ${char.gems}** 寶石`,
            inline: false
        }
    );

    // 已裝備清單
    const equippedLines = [];
    const setCounts = {};

    for (const [slotKey, labelName] of Object.entries(SLOT_NAMES)) {
        if (char[slotKey]) {
            const eqId = Number(char[slotKey]);
            const eq = eqList.find(x => x.id === eqId);
            if (eq) {
                const def = EQUIPMENT[eq.item_id];
                if (def && def.set_id) setCounts[def.set_id] = (setCounts[def.set_id] || 0) + 1;

                const enh = eq.enhancement || 0;
                const enhStr = enh > 0 ? ` + ${enh} ` : '';
                const bonusData = typeof eq.bonus_stats === 'string' ? JSON.parse(eq.bonus_stats || '{}') : (eq.bonus_stats || {});
                const actualStats = getActualStats(eq.item_id, eq.quality, enh, bonusData);

                const statsText = Object.entries(actualStats)
                    .filter(([k]) => k !== 'hp' && k !== 'mp')
                    .map(([k, v]) => {
                        const cleanKey = k.replace('max_', '');
                        const label = STAT_LABELS[cleanKey] || cleanKey.toUpperCase();
                        return `${label}${v >= 0 ? '+' : ''}${v} `;
                    }).join(' ');

                const fullName = getEquipFullName(eq, def);
                const coloredName = formatItemName(fullName, eq.quality);
                let eqLine = `🔹 **${labelName}:** ${def.emoji} ${coloredName}${enhStr} — ${statsText} `;

                // 在裝備欄也顯示詞條狀態
                if (bonusData.affixes && bonusData.affixes.length > 0) {
                    const affTexts = bonusData.affixes.map(a => {
                        const reg = AFFIX_REGISTRY[a.id];
                        if (!reg) return a.id;
                        const isActivated = !reg.activationLevel || enh >= reg.activationLevel;
                        if (!isActivated) return `🔒 ${reg.name}`;
                        return `${reg.name}`;
                    });
                    eqLine += `\n   └ ✨ ${affTexts.join(', ')} `;
                }
                equippedLines.push(eqLine);
            }
        }
    }

    // 套裝資訊顯示
    if (Object.keys(setCounts).length > 0) {
        const setLines = [];
        for (const [setId, count] of Object.entries(setCounts)) {
            const setDef = SET_REGISTRY[setId];
            if (!setDef) continue;

            let setLine = `🧩 ** ${setDef.name}** (${count} 件已激活)`;
            const activeBonuses = [];
            const thresholds = Object.keys(setDef.bonuses).map(Number).sort((a, b) => a - b);

            for (const req of thresholds) {
                const bonus = setDef.bonuses[req];
                const isActive = count >= req;

                let bonusDescArr = [];
                if (bonus.stats) {
                    Object.entries(bonus.stats).forEach(([k, v]) => {
                        const label = STAT_LABELS[k] || k.toUpperCase();
                        const sign = v >= 0 ? '+' : '';
                        const unit = k.includes('_pct') ? '%' : '';
                        bonusDescArr.push(`${label}${sign}${v}${unit} `);
                    });
                }
                if (bonus.hooks) bonusDescArr.push('特殊能力');

                const bonusDesc = bonusDescArr.join(', ');
                activeBonuses.push(`${isActive ? '✅' : '🔒'} ** ${req} 件:** ${bonusDesc} `);
            }

            if (activeBonuses.length > 0) {
                setLine += '\n' + activeBonuses.map(b => `   └ ${b} `).join('\n');
            }
            setLines.push(setLine);
        }
        if (setLines.length > 0) {
            embed.addFields({ name: '💎 套裝共鳴', value: setLines.join('\n'), inline: false });
        }
    }

    // 飾品位階共鳴顯示
    const accSlots = ['acc1_id', 'acc2_id', 'acc3_id', 'acc4_id'];
    const accCount = accSlots.filter(s => char[s] != null).length;
    if (accCount >= 2) {
        const resValue = accCount >= 4
            ? '✅ **(4/4) 大師共鳴**: 全攻擊+8%, 速度+5%\n   └ ✅ **(2/4) 基礎共鳴**: 生命/魔力上限+5%'
            : '✅ **(2/4) 基礎共鳴**: 生命/魔力上限+5%\n   └ 🔒 **(4/4) 大師共鳴**: 全攻擊+8%, 速度+5%';
        embed.addFields({ name: '💍 飾品能量共鳴', value: resValue, inline: false });
    }

    if (equippedLines.length > 0) {
        embed.addFields({ name: '🛡️ 已裝備', value: '```ansi\n' + limitField(equippedLines, 950) + '\n```', inline: false });
    }

    if (consumables.length > 0) {
        embed.addFields({
            name: '💼 消耗品',
            value: limitField(consumables.map(i => `${getItemDisplayName(i.item_id)} x${i.quantity} `), 1000),
            inline: true
        });
    }

    if (materials.length > 0) {
        embed.addFields({
            name: '📦 素材與雜物',
            value: limitField(materials.map(i => `${getItemDisplayName(i.item_id)} x${i.quantity} `), 1000),
            inline: true
        });
    }

    if (skillBooks.length > 0) {
        const bookLines = skillBooks.map(i => {
            const bookDef = SKILL_BOOKS[i.item_id];
            const skill = bookDef ? getSkillDef(bookDef.skillId) : null;
            // 縮短名稱避免 Discord 行動版 ansi 換行跑位
            const nameStr = skill ? `📖 ${skill.name}` : `📖 ${i.item_id.replace('book_', '')}`;
            const colorId = bookDef ? getQualityColor(bookDef.quality) : '0;37';
            return fmt(colorId, `${nameStr} x${i.quantity}`);
        });

        embed.addFields({
            name: '📕 技能書',
            value: '```ansi\n' + limitField(bookLines, 950) + '\n```',
            inline: false
        });
    }

    if (equipLines.length > 0) {
        embed.addFields({
            name: '⚔️ 裝備 (未裝備)',
            value: '```ansi\n' + limitField(equipLines, 950) + '\n```',
            inline: false
        });
    } else {
        embed.addFields({
            name: '⚔️ 裝備 (未裝備)',
            value: '（空）',
            inline: false
        });
    }

    embed.setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id} ` });

    const rows = [];
    const useOptions = [];
    const equipOptions = [];
    const unequipOptions = [];

    // 裝備選單
    for (const e of eqList) {
        if (equippedIds.includes(e.id)) continue;
        const def = EQUIPMENT[e.item_id];
        if (!def) continue;
        equipOptions.push({
            label: `穿戴 ${def.name} `,
            description: `${qualityLabel(e.quality)} | ${TYPE_TRANSLATIONS[def.type] || def.type} `,
            value: `equip_${e.id} `,
            emoji: def.emoji,
        });
    }

    // 卸下選單
    for (const [slotKey, labelName] of Object.entries(SLOT_NAMES)) {
        if (char[slotKey]) {
            const eqId = Number(char[slotKey]);
            const eq = eqList.find(x => x.id === eqId);
            if (eq) {
                const def = EQUIPMENT[eq.item_id];
                unequipOptions.push({
                    label: `卸下 ${labelName} `,
                    description: def ? def.name : '未知裝備',
                    value: `uneq_${slotKey}_${eqId} `,
                    emoji: def ? def.emoji : '📦',
                });
            }
        }
    }

    for (const i of consumables) {
        const shopDef = SHOP_ITEMS.consumables.find(s => s.id === i.item_id);
        if (!shopDef || !shopDef.effect) continue;
        if (shopDef.effect.type === 'heal_hp' || shopDef.effect.type === 'heal_mp') {
            useOptions.push({ label: `使用 ${shopDef.name} `, description: shopDef.desc, value: `use_${i.item_id} `, emoji: shopDef.emoji });
        }
    }
    for (const i of skillBooks) {
        const book = SKILL_BOOKS[i.item_id];
        const skill = getSkillDef(book.skillId);
        useOptions.push({ label: `學習 ${skill?.name || i.item_id} `, description: `${CLASSES[book.forClass]?.name || ''} Lv${book.levelReq} `, value: `learn_${i.item_id} `, emoji: '📕' });
    }

    if (equipOptions.length > 0) {
        // limit options to 25 due to discord limits
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('rpg_inv_equip').setPlaceholder('選擇要穿戴的裝備...').addOptions(equipOptions.slice(0, 25)),
        ));
    }

    if (unequipOptions.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('rpg_inv_unequip').setPlaceholder('選擇要卸下的裝備...').addOptions(unequipOptions.slice(0, 25)),
        ));
    }

    if (useOptions.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('rpg_inv_use').setPlaceholder('選擇要使用的道具...').addOptions(useOptions.slice(0, 25)),
        ));
    }

    // 強化選單（任何有裝備的 slot 或未裝備的裝備都可選）
    const enhanceOptions = eqList.filter(e => {
        const def = EQUIPMENT[e.item_id];
        return def && getEquipCategory(def.type) && (e.enhancement || 0) < 9;
    }).map(e => {
        const def = EQUIPMENT[e.item_id];
        const enh = e.enhancement || 0;
        const cat = getEquipCategory(def.type);
        return {
            label: `⚒️ ${def.name} +${enh} `,
            description: `${qualityLabel(e.quality)} | ${equippedIds.includes(e.id) ? '已裝備' : '背包中'} `,
            value: `enhance_${e.id} `,
            emoji: def.emoji,
        };
    });
    if (enhanceOptions.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('rpg_inv_enhance').setPlaceholder('⚒️ 選擇要強化的裝備...').addOptions(enhanceOptions.slice(0, 25)),
        ));
    }

    rows.push(new ActionRowBuilder().addComponents(rpgButton('rpg_menu', '返回主選單', undefined, '🔙')));

    await safeReply(interaction, { embeds: [embed], components: rows });
}
