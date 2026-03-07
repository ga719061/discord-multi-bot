// ===== RPG 專用資料庫操作函數 =====
import { getDb as _getDb, getGuildSettings } from '../utils/database.js';
import { generateRandomAffixes } from './rpgHelpers.js';
export const getDb = _getDb;

// ---------- 初始化 RPG 表 ----------
export function initRpgTables() {
    const db = getDb();
    db.exec(`
    CREATE TABLE IF NOT EXISTS rpg_characters (
      guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
      race TEXT NOT NULL, class TEXT NOT NULL,
      level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0,
      hp INTEGER NOT NULL, max_hp INTEGER NOT NULL,
      mp INTEGER NOT NULL, max_mp INTEGER NOT NULL,
      atk INTEGER NOT NULL, matk INTEGER NOT NULL,
      def INTEGER NOT NULL, mdef INTEGER NOT NULL, spd INTEGER NOT NULL,
      free_points INTEGER DEFAULT 0,
      gold INTEGER DEFAULT 100, gems INTEGER DEFAULT 0,
      weapon_id TEXT DEFAULT NULL, armor_id TEXT DEFAULT NULL, accessory_id TEXT DEFAULT NULL,
      wins INTEGER DEFAULT 0, boss_kills INTEGER DEFAULT 0,
      current_quest TEXT DEFAULT 'prologue', quest_progress TEXT DEFAULT '{}',
      daily_quests TEXT DEFAULT '[]', daily_quest_date TEXT DEFAULT NULL,
      last_daily_claim TEXT DEFAULT NULL, daily_streak INTEGER DEFAULT 0,
      deaths INTEGER DEFAULT 0, lose_streak INTEGER DEFAULT 0,
      auto_skills TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS rpg_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
      item_id TEXT NOT NULL, quantity INTEGER DEFAULT 1,
      stashed INTEGER DEFAULT 0,
      UNIQUE(guild_id, user_id, item_id, stashed)
    );
    CREATE TABLE IF NOT EXISTS rpg_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
      item_id TEXT NOT NULL, quality TEXT DEFAULT 'common',
      bonus_stats TEXT DEFAULT '{}', equipped INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS rpg_parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL, leader_id TEXT NOT NULL,
      member_ids TEXT DEFAULT '[]', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rpg_battles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, message_id TEXT,
      player_ids TEXT NOT NULL, monster_data TEXT NOT NULL,
      player_states TEXT NOT NULL, turn INTEGER DEFAULT 1,
      current_turn_player TEXT DEFAULT NULL, status TEXT DEFAULT 'active',
      area_id TEXT DEFAULT NULL, ally_summons TEXT DEFAULT '[]', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rpg_quest_progress (
      guild_id TEXT NOT NULL, user_id TEXT NOT NULL, quest_id TEXT NOT NULL,
      progress TEXT DEFAULT '{}', completed INTEGER DEFAULT 0, completed_at INTEGER DEFAULT NULL,
      PRIMARY KEY (guild_id, user_id, quest_id)
    );
    CREATE TABLE IF NOT EXISTS rpg_boss_kills (
      guild_id TEXT NOT NULL, boss_id TEXT NOT NULL,
      first_kill_user_ids TEXT NOT NULL, killed_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, boss_id)
    );
    CREATE TABLE IF NOT EXISTS rpg_learned_skills (
      guild_id TEXT NOT NULL, user_id TEXT NOT NULL, skill_id TEXT NOT NULL,
      learned_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id, skill_id)
    );
    CREATE TABLE IF NOT EXISTS rpg_auctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      quality TEXT DEFAULT 'common',
      enhancement INTEGER DEFAULT 0,
      price INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rpg_auction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER,
      quality TEXT,
      enhancement INTEGER,
      price INTEGER NOT NULL,
      sold_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rpg_mercenary_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      mercenary_id TEXT NOT NULL,
      employer_id TEXT NOT NULL,
      monster_name TEXT NOT NULL,
      reward_gold INTEGER NOT NULL,
      reward_xp INTEGER NOT NULL,
      fought_at INTEGER NOT NULL
    );
  `);
    // 確保 guild_settings 有 rpg_enabled 欄位
    const info = db.pragma('table_info(guild_settings)');
    if (!info.map(c => c.name).includes('rpg_enabled')) {
        db.prepare('ALTER TABLE guild_settings ADD COLUMN rpg_enabled INTEGER DEFAULT 0').run();
    }

    const charInfo = db.pragma('table_info(rpg_characters)');
    const charCols = charInfo.map(c => c.name);

    // 確保 rpg_characters 有 allow_mercenary 欄位
    if (!charCols.includes('allow_mercenary')) {
        db.prepare('ALTER TABLE rpg_characters ADD COLUMN allow_mercenary INTEGER DEFAULT 1').run();
    }
    // 確保 rpg_characters 有 auto_skills 欄位
    if (!charCols.includes('auto_skills')) {
        db.prepare('ALTER TABLE rpg_characters ADD COLUMN auto_skills TEXT DEFAULT \'[]\'').run();
    }
    // 確保 rpg_characters 有 last_active 欄位
    if (!charCols.includes('last_active')) {
        db.prepare('ALTER TABLE rpg_characters ADD COLUMN last_active INTEGER DEFAULT 0').run();
    }
    // 連敗與死亡紀錄
    if (!charCols.includes('deaths')) {
        db.prepare('ALTER TABLE rpg_characters ADD COLUMN deaths INTEGER DEFAULT 0').run();
    }
    if (!charCols.includes('lose_streak')) {
        db.prepare('ALTER TABLE rpg_characters ADD COLUMN lose_streak INTEGER DEFAULT 0').run();
    }
    // 裝備欄位擴充
    const newEqCols = [
        'head_id', 'body_id', 'hands_id', 'legs_id', 'feet_id',
        'main_hand_id', 'off_hand_id',
        'acc1_id', 'acc2_id', 'acc3_id', 'acc4_id'
    ];
    for (const col of newEqCols) {
        if (!charCols.includes(col)) {
            db.prepare(`ALTER TABLE rpg_characters ADD COLUMN ${col} TEXT DEFAULT NULL`).run();
        }
    }
    // 強化系統與倉庫
    const eqInfo = db.pragma('table_info(rpg_equipment)');
    const eqCols = eqInfo.map(c => c.name);
    if (!eqCols.includes('enhancement')) {
        db.prepare('ALTER TABLE rpg_equipment ADD COLUMN enhancement INTEGER DEFAULT 0').run();
    }
    if (!eqCols.includes('equipped')) {
        db.prepare('ALTER TABLE rpg_equipment ADD COLUMN equipped INTEGER DEFAULT 0').run();
    }
    if (!eqCols.includes('stashed')) {
        console.log('🔄 Migrating rpg_equipment: adding stashed column');
        db.prepare('ALTER TABLE rpg_equipment ADD COLUMN stashed INTEGER DEFAULT 0').run();
    }
    // 自動販售設定
    if (!charCols.includes('auto_sell_prefs')) {
        db.prepare("ALTER TABLE rpg_characters ADD COLUMN auto_sell_prefs TEXT DEFAULT '[]'").run();
    }
    // 核心屬性系統 (STR, INT, VIT, AGI, LUK)
    const attrCols = ['str', 'int', 'vit', 'agi', 'luk'];
    for (const col of attrCols) {
        if (!charCols.includes(col)) {
            db.prepare(`ALTER TABLE rpg_characters ADD COLUMN ${col} INTEGER DEFAULT 10`).run();
        }
    }
    // 選用技能欄位
    if (!charCols.includes('equipped_skills')) {
        db.prepare("ALTER TABLE rpg_characters ADD COLUMN equipped_skills TEXT DEFAULT '[]'").run();
    }
    // 傭兵出勤計數
    if (!charCols.includes('mercenary_count')) {
        db.prepare('ALTER TABLE rpg_characters ADD COLUMN mercenary_count INTEGER DEFAULT 0').run();
    }

    const battleInfo = db.pragma('table_info(rpg_battles)');
    const battleCols = battleInfo.map(c => c.name);
    if (!battleCols.includes('ally_summons')) {
        console.log('🔄 Migrating rpg_battles: adding ally_summons column');
        db.prepare('ALTER TABLE rpg_battles ADD COLUMN ally_summons TEXT DEFAULT \'[]\'').run();
    }

    // 背包倉庫擴充 (含 UNIQUE 約束更新)
    const invInfo = db.pragma('table_info(rpg_inventory)');
    const invCols = invInfo.map(c => c.name);

    // 檢查 index 確保 UNIQUE 包含 stashed
    const invIndexes = db.pragma('index_list(rpg_inventory)');
    const hasCorrectUnique = invIndexes.some(idx => {
        const info = db.pragma(`index_info(${idx.name})`);
        return info.some(c => c.name === 'stashed');
    });

    if (!invCols.includes('stashed') || !hasCorrectUnique) {
        console.log('🔄 Migrating rpg_inventory: updating schema and constraints');
        db.exec(`
            CREATE TABLE rpg_inventory_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
                item_id TEXT NOT NULL, quantity INTEGER DEFAULT 1,
                stashed INTEGER DEFAULT 0,
                UNIQUE(guild_id, user_id, item_id, stashed)
            );
            INSERT INTO rpg_inventory_new (guild_id, user_id, item_id, quantity, stashed)
            SELECT guild_id, user_id, item_id, quantity, 0 FROM rpg_inventory;
            DROP TABLE rpg_inventory;
            ALTER TABLE rpg_inventory_new RENAME TO rpg_inventory;
        `);
    }
}

// ---------- RPG 開關 ----------
export function isRpgEnabled(guildId) {
    const s = getGuildSettings(guildId);
    return !!s.rpg_enabled;
}
export function setRpgEnabled(guildId, enabled) {
    const db = getDb();
    getGuildSettings(guildId);
    db.prepare('UPDATE guild_settings SET rpg_enabled = ? WHERE guild_id = ?').run(enabled ? 1 : 0, guildId);
}

// ---------- 角色 ----------

// 被動回復速率：每分鐘回復 max 的 1%
const REGEN_PERCENT_PER_MIN = 1;

export function getCharacter(guildId, userId) {
    const db = getDb();
    const char = db.prepare('SELECT * FROM rpg_characters WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    if (!char) return null;

    // 計算離線被動回復
    const now = Date.now();
    const lastActive = char.last_active || char.created_at || now;
    const elapsedMin = Math.floor((now - lastActive) / 60000);

    if (elapsedMin > 0 && (char.hp < char.max_hp || char.mp < char.max_mp)) {
        const hpRegenAmt = Math.floor(char.max_hp * (REGEN_PERCENT_PER_MIN / 100) * elapsedMin);
        const mpRegenAmt = Math.floor(char.max_mp * (REGEN_PERCENT_PER_MIN / 100) * elapsedMin);
        const newHp = Math.min(char.max_hp, char.hp + hpRegenAmt);
        const newMp = Math.min(char.max_mp, char.mp + mpRegenAmt);

        if (newHp !== char.hp || newMp !== char.mp) {
            db.prepare('UPDATE rpg_characters SET hp = ?, mp = ?, last_active = ? WHERE guild_id = ? AND user_id = ?')
                .run(newHp, newMp, now, guildId, userId);
            char.hp = newHp;
            char.mp = newMp;
            char.last_active = now;
        }
    } else if (elapsedMin > 0) {
        // 即使不需要回復也更新 last_active
        db.prepare('UPDATE rpg_characters SET last_active = ? WHERE guild_id = ? AND user_id = ?').run(now, guildId, userId);
        char.last_active = now;
    }

    return char;
}
export function createCharacter(guildId, userId, data) {
    const db = getDb();
    const now = Date.now();
    db.prepare(`INSERT INTO rpg_characters(guild_id, user_id, race, class, hp, max_hp, mp, max_mp, atk, matk, def, mdef, spd, str, int, vit, agi, luk, last_active, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(guildId, userId, data.race, data.class, data.hp, data.max_hp, data.mp, data.max_mp, data.atk, data.matk, data.def, data.mdef, data.spd, data.str || 10, data.int || 10, data.vit || 10, data.agi || 10, data.luk || 10, now, now);
    return getCharacter(guildId, userId);
}
export function updateCharacter(guildId, userId, updates) {
    const db = getDb();
    const keys = Object.keys(updates);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE rpg_characters SET ${sets} WHERE guild_id = ? AND user_id = ? `).run(...keys.map(k => updates[k]), guildId, userId);
}
export function addGold(guildId, userId, amount) {
    getDb().prepare('UPDATE rpg_characters SET gold = gold + ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, userId);
}
export function deductGold(guildId, userId, amount) {
    if (amount <= 0) return;
    getDb().prepare('UPDATE rpg_characters SET gold = MAX(0, gold - ?) WHERE guild_id = ? AND user_id = ?').run(amount, guildId, userId);
}
export function addGems(guildId, userId, amount) {
    getDb().prepare('UPDATE rpg_characters SET gems = gems + ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, userId);
}

export function resetCharacterStats(guildId, userId) {
    const db = getDb();
    const char = getCharacter(guildId, userId);
    if (!char) return false;

    // 計算總投入的屬性點 = 目前各項總和 - 預設(每一項10*5 = 50) + 當下沒用掉的點數
    const totalSpent = (char.str + char.int + char.vit + char.agi + char.luk) - 50;
    const newFreePoints = char.free_points + Math.max(0, totalSpent);

    db.prepare(`UPDATE rpg_characters 
        SET str = 10, int = 10, vit = 10, agi = 10, luk = 10, free_points = ?
        WHERE guild_id = ? AND user_id = ? `).run(newFreePoints, guildId, userId);
    return true;
}

// ---------- 背包 ----------
export function getInventory(guildId, userId) {
    return getDb().prepare('SELECT * FROM rpg_inventory WHERE guild_id = ? AND user_id = ? AND stashed = 0').all(guildId, userId);
}
export function getStashedInventory(guildId, userId) {
    return getDb().prepare('SELECT * FROM rpg_inventory WHERE guild_id = ? AND user_id = ? AND stashed = 1').all(guildId, userId);
}
export function addToInventory(guildId, userId, itemId, qty = 1, stashed = 0) {
    const db = getDb();
    const ex = db.prepare('SELECT * FROM rpg_inventory WHERE guild_id = ? AND user_id = ? AND item_id = ? AND stashed = ?').get(guildId, userId, itemId, stashed);
    if (ex) db.prepare('UPDATE rpg_inventory SET quantity = quantity + ? WHERE guild_id = ? AND user_id = ? AND item_id = ? AND stashed = ?').run(qty, guildId, userId, itemId, stashed);
    else db.prepare('INSERT INTO rpg_inventory (guild_id, user_id, item_id, quantity, stashed) VALUES (?, ?, ?, ?, ?)').run(guildId, userId, itemId, qty, stashed);
}
export function removeFromInventory(guildId, userId, itemId, qty = 1, stashed = 0) {
    const db = getDb();
    const ex = db.prepare('SELECT * FROM rpg_inventory WHERE guild_id = ? AND user_id = ? AND item_id = ? AND stashed = ?').get(guildId, userId, itemId, stashed);
    if (!ex || ex.quantity < qty) return false;
    if (ex.quantity === qty) db.prepare('DELETE FROM rpg_inventory WHERE guild_id = ? AND user_id = ? AND item_id = ? AND stashed = ?').run(guildId, userId, itemId, stashed);
    else db.prepare('UPDATE rpg_inventory SET quantity = quantity - ? WHERE guild_id = ? AND user_id = ? AND item_id = ? AND stashed = ?').run(qty, guildId, userId, itemId, stashed);
    return true;
}
export function stashItem(guildId, userId, itemId, qty = 1) {
    if (removeFromInventory(guildId, userId, itemId, qty, 0)) {
        addToInventory(guildId, userId, itemId, qty, 1);
        return true;
    }
    return false;
}
export function unstashItem(guildId, userId, itemId, qty = 1) {
    if (removeFromInventory(guildId, userId, itemId, qty, 1)) {
        addToInventory(guildId, userId, itemId, qty, 0);
        return true;
    }
    return false;
}

// ---------- 裝備 ----------
export function getEquipmentList(guildId, userId) {
    return getDb().prepare('SELECT * FROM rpg_equipment WHERE guild_id = ? AND user_id = ? AND stashed = 0').all(guildId, userId);
}
export function getStashedEquipmentList(guildId, userId) {
    return getDb().prepare('SELECT * FROM rpg_equipment WHERE guild_id = ? AND user_id = ? AND stashed = 1').all(guildId, userId);
}
export function stashEquipment(eqId) {
    getDb().prepare('UPDATE rpg_equipment SET stashed = 1, equipped = 0 WHERE id = ?').run(eqId);
}
export function unstashEquipment(eqId) {
    getDb().prepare('UPDATE rpg_equipment SET stashed = 0 WHERE id = ?').run(eqId);
}
export function addEquipment(guildId, userId, itemId, quality = 'common', charLevel = 1) {
    const db = getDb();
    const bonusStats = generateRandomAffixes(itemId, quality, charLevel);
    const bonusStatsStr = JSON.stringify(bonusStats);

    db.prepare('INSERT INTO rpg_equipment (guild_id, user_id, item_id, quality, bonus_stats) VALUES (?, ?, ?, ?, ?)').run(guildId, userId, itemId, quality, bonusStatsStr);
    return db.prepare('SELECT last_insert_rowid() as id').get().id;
}
export function removeEquipment(equipmentId) {
    getDb().prepare('DELETE FROM rpg_equipment WHERE id = ?').run(equipmentId);
}
export function getEquipment(eqId) {
    return getDb().prepare('SELECT * FROM rpg_equipment WHERE id = ?').get(eqId);
}
export function updateEquipment(eqId, updates) {
    const db = getDb();
    const keys = Object.keys(updates);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE rpg_equipment SET ${sets} WHERE id = ? `).run(...keys.map(k => updates[k]), eqId);
}

// ---------- 戰鬥 ----------
export function createBattle(guildId, channelId, playerIds, monsterData, playerStates, areaId) {
    const db = getDb();
    db.prepare(`INSERT INTO rpg_battles(guild_id, channel_id, player_ids, monster_data, player_states, current_turn_player, area_id, ally_summons, created_at) VALUES(?,?,?,?,?,?,?,?,?)`)
        .run(guildId, channelId, JSON.stringify(playerIds), JSON.stringify(monsterData), JSON.stringify(playerStates), playerIds[0], areaId, '[]', Date.now());
    return db.prepare('SELECT last_insert_rowid() as id').get().id;
}
export function getBattle(battleId) {
    const row = getDb().prepare('SELECT * FROM rpg_battles WHERE id = ?').get(battleId);
    if (!row) return null;
    return {
        ...row,
        player_ids: JSON.parse(row.player_ids),
        monster_data: JSON.parse(row.monster_data),
        player_states: JSON.parse(row.player_states),
        ally_summons: JSON.parse(row.ally_summons || '[]')
    };
}
export function updateBattle(battleId, updates) {
    const db = getDb();
    const processed = {};
    for (const k of Object.keys(updates)) processed[k] = typeof updates[k] === 'object' ? JSON.stringify(updates[k]) : updates[k];
    const sets = Object.keys(processed).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE rpg_battles SET ${sets} WHERE id = ? `).run(...Object.values(processed), battleId);
}
export function deleteBattle(battleId) {
    getDb().prepare('DELETE FROM rpg_battles WHERE id = ?').run(battleId);
}

// ---------- 排行榜 ----------
export function getRpgLeaderboard(guildId, limit = 10) {
    return getDb().prepare('SELECT * FROM rpg_characters WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT ?').all(guildId, limit);
}

// ---------- 任務進度 ----------
export function getQuestProgress(guildId, userId, questId) {
    const db = getDb();
    let row = db.prepare('SELECT * FROM rpg_quest_progress WHERE guild_id = ? AND user_id = ? AND quest_id = ?').get(guildId, userId, questId);
    if (!row) {
        db.prepare('INSERT INTO rpg_quest_progress (guild_id, user_id, quest_id) VALUES (?, ?, ?)').run(guildId, userId, questId);
        row = db.prepare('SELECT * FROM rpg_quest_progress WHERE guild_id = ? AND user_id = ? AND quest_id = ?').get(guildId, userId, questId);
    }
    return { ...row, progress: JSON.parse(row.progress || '{}') };
}
export function updateQuestProgress(guildId, userId, questId, progress) {
    getDb().prepare('UPDATE rpg_quest_progress SET progress = ? WHERE guild_id = ? AND user_id = ? AND quest_id = ?')
        .run(JSON.stringify(progress), guildId, userId, questId);
}
export function completeQuest(guildId, userId, questId) {
    getDb().prepare('UPDATE rpg_quest_progress SET completed = 1, completed_at = ? WHERE guild_id = ? AND user_id = ? AND quest_id = ?')
        .run(Date.now(), guildId, userId, questId);
}

// ---------- 已學技能 ----------
export function getLearnedSkills(guildId, userId) {
    return getDb().prepare('SELECT skill_id FROM rpg_learned_skills WHERE guild_id = ? AND user_id = ?').all(guildId, userId).map(r => r.skill_id);
}
export function hasLearnedSkill(guildId, userId, skillId) {
    return !!getDb().prepare('SELECT 1 FROM rpg_learned_skills WHERE guild_id = ? AND user_id = ? AND skill_id = ?').get(guildId, userId, skillId);
}
export function learnSkill(guildId, userId, skillId) {
    const db = getDb();
    const exists = db.prepare('SELECT 1 FROM rpg_learned_skills WHERE guild_id = ? AND user_id = ? AND skill_id = ?').get(guildId, userId, skillId);
    if (exists) return false;
    db.prepare('INSERT INTO rpg_learned_skills (guild_id, user_id, skill_id, learned_at) VALUES (?, ?, ?, ?)').run(guildId, userId, skillId, Date.now());
    return true;
}

// ---------- 首殺榜 ----------
/**
 * 試圖登記王國首殺
 * @returns {boolean} true: 成功拿到首殺, false: 已經被別人首殺過了
 */
export function registerFirstKill(guildId, bossId, playerIds) {
    const db = getDb();
    const ex = db.prepare('SELECT * FROM rpg_boss_kills WHERE guild_id = ? AND boss_id = ?').get(guildId, bossId);
    if (ex) return false;
    try {
        db.prepare('INSERT INTO rpg_boss_kills (guild_id, boss_id, first_kill_user_ids, killed_at) VALUES (?, ?, ?, ?)').run(
            guildId, bossId, JSON.stringify(playerIds), Date.now()
        );
        return true;
    } catch {
        return false;
    }
}

// ---------- 拍賣場 ----------
export function addAuction(guildId, sellerId, itemType, itemId, quantity, quality, enhancement, price) {
    const db = getDb();
    const result = db.prepare(`
        INSERT INTO rpg_auctions(guild_id, seller_id, item_type, item_id, quantity, quality, enhancement, price, created_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(guildId, sellerId, itemType, itemId, quantity, quality, enhancement, price, Date.now());
    return result.lastInsertRowid;
}

export function getAuctions(guildId, limit = 25, offset = 0) {
    const db = getDb();
    // 依據時間反序排列 (最新的在前)
    return db.prepare('SELECT * FROM rpg_auctions WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .all(guildId, limit, offset);
}

export function getAuctionById(auctionId) {
    const db = getDb();
    return db.prepare('SELECT * FROM rpg_auctions WHERE id = ?').get(auctionId);
}

export function deleteAuction(auctionId) {
    const db = getDb();
    db.prepare('DELETE FROM rpg_auctions WHERE id = ?').run(auctionId);
}

export function getAuctionsBySeller(guildId, sellerId) {
    const db = getDb();
    return db.prepare('SELECT * FROM rpg_auctions WHERE guild_id = ? AND seller_id = ? ORDER BY created_at DESC')
        .all(guildId, sellerId);
}

export function getTotalAuctionsCount(guildId) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM rpg_auctions WHERE guild_id = ?').get(guildId);
    return row ? row.count : 0;
}

// ---------- 拍賣場歷史紀錄 ----------
export function addAuctionHistory(guildId, sellerId, buyerId, itemType, itemId, quantity, quality, enhancement, price) {
    const db = getDb();
    db.prepare(`
        INSERT INTO rpg_auction_history(guild_id, seller_id, buyer_id, item_type, item_id, quantity, quality, enhancement, price, sold_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(guildId, sellerId, buyerId, itemType, itemId, quantity, quality, enhancement, price, Date.now());
}

export function getPersonalAuctionHistory(guildId, userId, limit = 20) {
    const db = getDb();
    return db.prepare(`
    SELECT * FROM rpg_auction_history 
        WHERE guild_id = ? AND(seller_id = ? OR buyer_id = ?) 
        ORDER BY sold_at DESC
    LIMIT ?
        `).all(guildId, userId, userId, limit);
}

// ---------- 傭兵系統 ----------
export function toggleMercenaryStatus(guildId, userId) {
    const db = getDb();
    const char = getCharacter(guildId, userId);
    if (!char) return null;
    const newStatus = char.allow_mercenary ? 0 : 1;
    db.prepare('UPDATE rpg_characters SET allow_mercenary = ? WHERE guild_id = ? AND user_id = ?').run(newStatus, guildId, userId);
    return newStatus;
}

export function getAvailableMercenaries(guildId, minLevel = 1, excludeUserId = null, limit = 50) {
    const db = getDb();
    return db.prepare(`
        SELECT * FROM rpg_characters 
        WHERE guild_id = ? AND allow_mercenary = 1 AND level >= ? AND user_id != ?
        ORDER BY last_active DESC, level DESC
    LIMIT ?
        `).all(guildId, minLevel, excludeUserId || '', limit);
}

export function addMercenaryHistory(guildId, mercenaryId, employerId, monsterName, rewardGold, rewardXp) {
    const db = getDb();
    db.prepare(`
        INSERT INTO rpg_mercenary_history(guild_id, mercenary_id, employer_id, monster_name, reward_gold, reward_xp, fought_at)
    VALUES(?, ?, ?, ?, ?, ?, ?)
        `).run(guildId, mercenaryId, employerId, monsterName, rewardGold, rewardXp, Date.now());

    // 增加累計出勤次數
    db.prepare('UPDATE rpg_characters SET mercenary_count = mercenary_count + 1 WHERE guild_id = ? AND user_id = ?').run(guildId, mercenaryId);
}

export function getPersonalMercenaryHistory(guildId, userId, limit = 20) {
    const db = getDb();
    return db.prepare(`
    SELECT * FROM rpg_mercenary_history 
        WHERE guild_id = ? AND mercenary_id = ?
        ORDER BY fought_at DESC
    LIMIT ?
        `).all(guildId, userId, limit);
}

export function setAutoSkills(guildId, userId, skillIds) {
    const db = getDb();
    db.prepare('UPDATE rpg_characters SET auto_skills = ? WHERE guild_id = ? AND user_id = ?').run(JSON.stringify(skillIds), guildId, userId);
}

export function setEquippedSkills(guildId, userId, skillIds) {
    const db = getDb();
    db.prepare('UPDATE rpg_characters SET equipped_skills = ? WHERE guild_id = ? AND user_id = ?').run(JSON.stringify(skillIds), guildId, userId);
}
