import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { rpgEmbed, rpgButton, ansiText, safeReply, calculateTotalStats } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';
import { getItemDisplayName } from '../data/gameData.js';
import { TAVERN_NPC, LORE_RUMORS, TAVERN_REWARDS } from '../data/loreData.js';
import { updateCharacter, getCharacter, deductGold, addToInventory, getEquipmentList, getStashedEquipmentList, stashEquipment, unstashEquipment, resetCharacterStats, getInventory, getStashedInventory, stashItem, unstashItem } from '../rpgDatabase.js';
export async function showTavern(interaction, char, dialogue = null, activeNpc = null) {
    let mainDescription = '```ansi\n' + [
        fmt(COLORS.WHITE, '「願閣下在此獲得片刻安寧。請問有什麼可以為你服務的？」'),
        '',
        fmt(COLORS.YELLOW + ';' + COLORS.BOLD, '【停留於此的神祕客】'),
        `${fmt(COLORS.WHITE, `👨‍🍳 ${TAVERN_NPC['bartender'].name}`)} — 吧檯之後的酒館主人。`,
        `${fmt(COLORS.WHITE, `🧔 ${TAVERN_NPC['veteran'].name}`)} — 知曉無數舊事的老騎士。`,
        `${fmt(COLORS.WHITE, `👤 ${TAVERN_NPC['traveler'].name}`)} — 身上帶著星空與虛空的氣息。`
    ].join('\n') + '\n```';

    if (activeNpc) {
        const npc = TAVERN_NPC[activeNpc];
        const greeting = dialogue || npc.greetings[Math.floor(Math.random() * npc.greetings.length)];
        mainDescription = '```ansi\n' + [
            ansiText('0;36', `【與 ${npc.name} 交談中...】`),
            `> ${greeting}`,
            '',
            ansiText('0;33', '【其他神祕客】'),
            activeNpc !== 'bartender' ? `👨‍🍳 ${TAVERN_NPC['bartender'].name}` : '',
            activeNpc !== 'veteran' ? `🧔 ${TAVERN_NPC['veteran'].name}` : '',
            activeNpc !== 'traveler' ? `👤 ${TAVERN_NPC['traveler'].name}` : '',
        ].filter(Boolean).join('\n') + '\n```';
    } else if (dialogue) {
        mainDescription = '```ansi\n' + [
            ansiText('0;32', '【系統提示】'),
            `> ${dialogue}`,
            '',
            ansiText('0;33', '【可互動的神祕客】'),
            `👨‍🍳 ${TAVERN_NPC['bartender'].name}`,
            `🧔 ${TAVERN_NPC['veteran'].name}`,
            `👤 ${TAVERN_NPC['traveler'].name}`
        ].join('\n') + '\n```';
    }

    const embed = rpgEmbed(
        '🏰 王國酒館 — 亞丁分店',
        mainDescription,
        0xDC7633 // Orange/Brown tavern color
    ).setFooter({ text: `💰 持有金幣: ${char.gold.toLocaleString()} | uid:${interaction.user.id}` });

    const rows = [];

    // NPC 選擇按鈕列
    rows.push(new ActionRowBuilder().addComponents(
        rpgButton('rpg_tavern_npc_bartender', '找老狄恩', activeNpc === 'bartender' ? 'Success' : 'Primary', '👨‍🍳'),
        rpgButton('rpg_tavern_npc_veteran', '找亞伯', activeNpc === 'veteran' ? 'Success' : 'Primary', '🧔'),
        rpgButton('rpg_tavern_npc_traveler', '找賽恩', activeNpc === 'traveler' ? 'Success' : 'Primary', '👤'),
    ));

    // 依據選擇的 NPC 顯示獨立的動作按鈕列
    if (activeNpc === 'bartender') {
        rows.push(new ActionRowBuilder().addComponents(
            rpgButton('rpg_tavern_drink', '請客喝酒 (30💰)', 'Secondary', '🍻'),
            rpgButton('rpg_tavern_rest', '休息一晚 (200💰)', 'Secondary', '💤'),
            rpgButton('rpg_tavern_stash', '裝備保險箱', 'Secondary', '🧰')
        ));
    } else if (activeNpc === 'veteran') {
        rows.push(new ActionRowBuilder().addComponents(
            rpgButton('rpg_tavern_rumor', '打聽傳聞 (100💰)', 'Secondary', '👂'),
            rpgButton('rpg_tavern_respec', `屬性重置 (${char.level * 100}💰)`, 'Danger', '🔄')
        ));
    } else if (activeNpc === 'traveler') {
        rows.push(new ActionRowBuilder().addComponents(
            rpgButton('rpg_tavern_bribe', '賄賂情報 (500💰)', 'Danger', '💰')
        ));
    }

    // 返回按鈕列
    rows.push(new ActionRowBuilder().addComponents(
        rpgButton('rpg_menu', '離開酒館返回首頁', 'Secondary', '🔙')
    ));

    const updateOptions = { embeds: [embed], components: rows };
    await safeReply(interaction, updateOptions);
}

export async function handleTavernAction(interaction, char) {
    const id = interaction.customId;

    // 處理 NPC 選單
    if (id.startsWith('rpg_tavern_npc_')) {
        const npcType = id.replace('rpg_tavern_npc_', '');
        return showTavern(interaction, char, null, npcType);
    }

    // 處理具體動作
    if (id === 'rpg_tavern_drink') {
        if (char.gold < 30) return safeReply(interaction, { content: '🚫 金幣不足。這裡不招待沒有錢的過客。', flags: ['Ephemeral'] });
        deductGold(interaction.guildId, interaction.user.id, 30);
        const rand = Math.random();
        let msg = '';
        if (rand < 0.2) {
            msg = TAVERN_NPC.bartender.drink_success[Math.floor(Math.random() * TAVERN_NPC.bartender.drink_success.length)];
        } else {
            msg = TAVERN_NPC.bartender.drink_normal[Math.floor(Math.random() * TAVERN_NPC.bartender.drink_normal.length)];
        }
        return showTavern(interaction, getCharacter(interaction.guildId, interaction.user.id), msg, 'bartender');
    }

    if (id === 'rpg_tavern_rest') {
        if (char.gold < 200) return safeReply(interaction, { content: '🚫 金幣不足。騎士不能在長椅上過夜。', flags: ['Ephemeral'] });
        deductGold(interaction.guildId, interaction.user.id, 200);

        const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
        const total = calculateTotalStats(char, eqList);
        updateCharacter(interaction.guildId, interaction.user.id, { hp: total.max_hp, mp: total.max_mp });
        const msg = TAVERN_NPC.bartender.rest_success[Math.floor(Math.random() * TAVERN_NPC.bartender.rest_success.length)];
        return showTavern(interaction, getCharacter(interaction.guildId, interaction.user.id), msg, 'bartender');
    }

    if (id === 'rpg_tavern_rumor') {
        if (char.gold < 100) return safeReply(interaction, { content: '🐕 凱叔不收免費的聽眾，金幣拿來！', flags: ['Ephemeral'] });
        deductGold(interaction.guildId, interaction.user.id, 100);
        let pool = LORE_RUMORS.novice;
        if (char.level > 40) pool = LORE_RUMORS.advanced;
        else if (char.level > 10) pool = LORE_RUMORS.intermediate;
        const rumor = pool[Math.floor(Math.random() * pool.length)];
        const intro = `🧔 「既然金幣給了，那我就說個消息：\n${rumor}」`;
        return showTavern(interaction, getCharacter(interaction.guildId, interaction.user.id), intro, 'veteran');
    }

    if (id === 'rpg_tavern_bribe') {
        if (char.gold < 500) return safeReply(interaction, { content: '🐕 神秘人看了看你乾癟的錢包，發出了輕蔑的笑聲。', flags: ['Ephemeral'] });
        deductGold(interaction.guildId, interaction.user.id, 500);
        const rand = Math.random();
        let resultMsg = '';
        if (rand < 0.5) {
            resultMsg = `👤 「既然有金幣...我就說一點你可能感興趣的祕密：\n${LORE_RUMORS.secrets[Math.floor(Math.random() * LORE_RUMORS.secrets.length)]}」`;
        } else if (rand < 0.9) {
            const reward = TAVERN_REWARDS[Math.floor(Math.random() * TAVERN_REWARDS.length)];
            addToInventory(interaction.guildId, interaction.user.id, reward.id, 1);
            const rewardIntro = TAVERN_NPC.traveler.bribe_reward[Math.floor(Math.random() * TAVERN_NPC.traveler.bribe_reward.length)];
            resultMsg = `${rewardIntro}\n(獲得物品: ${getItemDisplayName(reward.id)})`;
        } else {
            resultMsg = '👤 「虛空之主...其實是創世神大吉的一根掉落的毛髮所化。這是我最後一次說這件事。汪。」';
        }
        return showTavern(interaction, getCharacter(interaction.guildId, interaction.user.id), resultMsg, 'traveler');
    }

    if (id === 'rpg_tavern_stash') {
        const eqList = getEquipmentList(interaction.guildId, interaction.user.id).filter(e => e.equipped === 0);
        const invList = getInventory(interaction.guildId, interaction.user.id);
        const stashedEq = getStashedEquipmentList(interaction.guildId, interaction.user.id);
        const stashedInv = getStashedInventory(interaction.guildId, interaction.user.id);

        let msg = TAVERN_NPC.bartender.stash_greetings[Math.floor(Math.random() * TAVERN_NPC.bartender.stash_greetings.length)];
        msg += `\n> 📦 **裝備寄存**: ${stashedEq.length} / 50`;
        msg += `\n> 🎒 **道具寄存**: ${stashedInv.length} 種類`;

        const rows = [];

        // 存入選單 (優先處理裝備，剩餘空間給道具)
        const storeOptions = [];

        // 排序裝備: 強化等級 -> ID
        const sortedEq = [...eqList].sort((a, b) => b.enhancement - a.enhancement || a.item_id.localeCompare(b.item_id));
        sortedEq.slice(0, 15).forEach(e => storeOptions.push({
            label: `[存入裝備] ${getItemDisplayName(e.item_id)}`,
            description: `品質: ${e.quality} | 強化: +${e.enhancement}`,
            value: `store_eq_${e.id}`
        }));

        // 排序道具: 名稱
        const sortedInv = [...invList].sort((a, b) => a.item_id.localeCompare(b.item_id));
        const remainingSpace = 25 - storeOptions.length;
        sortedInv.slice(0, remainingSpace).forEach(i => storeOptions.push({
            label: `[存入道具] ${getItemDisplayName(i.item_id)} (x${i.quantity})`,
            description: `存入此格所有道具`,
            value: `store_inv_${i.item_id}`
        }));

        if (storeOptions.length > 0) {
            rows.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('rpg_tavern_stash_store')
                    .setPlaceholder('選擇要存入的物品...')
                    .addOptions(storeOptions)
            ));
        }

        // 取出選單 (裝備)
        if (stashedEq.length > 0) {
            const sortedStashedEq = [...stashedEq].sort((a, b) => b.enhancement - a.enhancement || a.item_id.localeCompare(b.item_id));
            const takeEqOptions = sortedStashedEq.slice(0, 25).map(e => ({
                label: `[取出裝備] ${getItemDisplayName(e.item_id)}`,
                description: `品質: ${e.quality} | +${e.enhancement}`,
                value: `take_eq_${e.id}`
            }));
            rows.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('rpg_tavern_stash_take_eq')
                    .setPlaceholder('從保險箱取出裝備...')
                    .addOptions(takeEqOptions)
            ));
        }

        // 取出選單 (道具)
        if (stashedInv.length > 0) {
            const sortedStashedInv = [...stashedInv].sort((a, b) => a.item_id.localeCompare(b.item_id));
            const takeInvOptions = sortedStashedInv.slice(0, 25).map(i => ({
                label: `[取出道具] ${getItemDisplayName(i.item_id)} (x${i.quantity})`,
                description: `取回此疊道具`,
                value: `take_inv_${i.item_id}`
            }));
            rows.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('rpg_tavern_stash_take_inv')
                    .setPlaceholder('從保險箱取出道具...')
                    .addOptions(takeInvOptions)
            ));
        }

        rows.push(new ActionRowBuilder().addComponents(
            rpgButton('rpg_tavern_npc_bartender', '返回吧檯', 'Secondary', '🔙')
        ));

        const embed = rpgEmbed('🧰 老狄恩的保險箱', msg, 0xDC7633);
        return safeReply(interaction, { embeds: [embed], components: rows });
    }

    if (id === 'rpg_tavern_respec') {
        const cost = char.level * 100;
        if (char.gold < cost) return safeReply(interaction, { content: `🐕 你的金幣不夠喔！洗點需要 ${cost} 金幣。`, flags: ['Ephemeral'] });

        deductGold(interaction.guildId, interaction.user.id, cost);
        resetCharacterStats(interaction.guildId, interaction.user.id);

        const msg = `🧔 「收下了你的 ${cost} 金幣。深呼吸...你覺得這具軀體的舊枷鎖已被打破。」\n(所有基礎屬性已重置為 10，點數已重歸靈魂庫)`;
        return showTavern(interaction, getCharacter(interaction.guildId, interaction.user.id), msg, 'veteran');
    }

    if (id === 'rpg_tavern_stash_store' || id === 'rpg_tavern_stash_take_eq' || id === 'rpg_tavern_stash_take_inv') {
        const value = interaction.values[0];
        const parts = value.split('_');
        const action = parts[0]; // store or take
        const type = parts[1];   // eq or inv
        // 修正 ID 解析，因為 item_id 可能帶有底線 (例如 book_agility_boost)
        const targetId = parts.slice(2).join('_');

        if (action === 'store') {
            if (type === 'eq') {
                const stashedEq = getStashedEquipmentList(interaction.guildId, interaction.user.id);
                if (stashedEq.length < 50) stashEquipment(parseInt(targetId));
                else return safeReply(interaction, { content: '🧰 裝備保險箱已滿！', flags: ['Ephemeral'] });
            } else {
                const inv = getInventory(interaction.guildId, interaction.user.id);
                const item = inv.find(i => i.item_id === targetId);
                if (item) stashItem(interaction.guildId, interaction.user.id, targetId, item.quantity);
            }
        } else {
            if (type === 'eq') unstashEquipment(parseInt(targetId));
            else {
                const stashedInv = getStashedInventory(interaction.guildId, interaction.user.id);
                const item = stashedInv.find(i => i.item_id === targetId);
                if (item) unstashItem(interaction.guildId, interaction.user.id, targetId, item.quantity);
            }
        }

        // 更新畫面
        const updatedChar = getCharacter(interaction.guildId, interaction.user.id);
        interaction.customId = 'rpg_tavern_stash';
        return handleTavernAction(interaction, updatedChar);
    }
}
