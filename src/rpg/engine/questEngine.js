import { getCharacter, updateCharacter, getQuestProgress, updateQuestProgress, completeQuest, addGold, addGems, addEquipment } from '../rpgDatabase.js';
import { MAIN_QUESTS } from '../data/gameData.js';
import { broadcastRpgEvent } from '../rpgHelpers.js';

/**
 * 觸發任務進度更新
 * @param {string} guildId
 * @param {string} userId
 * @param {string} eventType - 事件類型: create_character, win_battle, kill_monster, kill_boss, explore_area
 * @param {object} eventData - 額外資料: { monsterId, bossId, areaId }
 */
export function trackQuestProgress(guildId, userId, eventType, eventData = {}) {
    const char = getCharacter(guildId, userId);
    if (!char || !char.current_quest) return null;

    const quest = MAIN_QUESTS.find(q => q.id === char.current_quest);
    if (!quest) return null;

    const qp = getQuestProgress(guildId, userId, quest.id);
    const progress = { ...qp.progress };
    let updated = false;

    for (const obj of quest.objectives) {
        // 判斷事件是否符合此目標
        if (obj.type !== eventType) continue;

        // 若有 monsterId/bossId/areaId 限制，需比對
        if (obj.monsterId && eventData.monsterId !== obj.monsterId) continue;
        if (obj.bossId && eventData.bossId !== obj.bossId) continue;
        if (obj.areaId && eventData.areaId !== obj.areaId) continue;

        // 用 "type_specifId" 作為 key 以區分同類型不同目標
        const key = obj.monsterId ? `${obj.type}_${obj.monsterId}`
            : obj.bossId ? `${obj.type}_${obj.bossId}`
                : obj.areaId ? `${obj.type}_${obj.areaId}`
                    : obj.type;

        const current = progress[key] || 0;
        if (current < obj.count) {
            progress[key] = current + 1;
            updated = true;
        }
    }

    if (!updated) return null;
    updateQuestProgress(guildId, userId, quest.id, progress);

    // 檢查是否所有目標都完成
    const allDone = quest.objectives.every(obj => {
        const key = obj.monsterId ? `${obj.type}_${obj.monsterId}`
            : obj.bossId ? `${obj.type}_${obj.bossId}`
                : obj.areaId ? `${obj.type}_${obj.areaId}`
                    : obj.type;
        return (progress[key] || 0) >= obj.count;
    });

    if (allDone) {
        completeQuest(guildId, userId, quest.id);
        // 發放獎勵
        if (quest.rewards.gold) addGold(guildId, userId, quest.rewards.gold);
        if (quest.rewards.gems) addGems(guildId, userId, quest.rewards.gems);
        if (quest.rewards.equipment) addEquipment(guildId, userId, quest.rewards.equipment, 'epic', char.level);

        // 推進到下一任務
        const idx = MAIN_QUESTS.findIndex(q => q.id === quest.id);
        const next = MAIN_QUESTS[idx + 1];
        updateCharacter(guildId, userId, { current_quest: next ? next.id : null });

        // 主線章節突破的廣播需依賴 client，由呼叫端 (battle.js) 負責處理

        return { completed: true, quest, nextQuest: next || null };
    }

    return { completed: false, quest, progress };
}
