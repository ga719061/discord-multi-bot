import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { getAiSettings } from './database.js';

const MEMBER_LOOKUP_TIMEOUT_MS = 8_000;

function hasAdministrator(permissions) {
    if (permissions == null) return false;
    try {
        return new PermissionsBitField(permissions).has(PermissionFlagsBits.Administrator);
    } catch {
        return false;
    }
}

export function hasNasMusicAccess({ guildId, userId, isAdministrator }, settings = getAiSettings(guildId)) {
    if (!guildId || !userId || !settings || settings.guild_id && settings.guild_id !== guildId) return false;
    const whitelist = Array.isArray(settings.nas_music_whitelist) ? settings.nas_music_whitelist : [];
    const admins = Array.isArray(settings.admin_ids) ? settings.admin_ids : [];
    return whitelist.includes(userId) || (isAdministrator === true && admins.includes(userId));
}

export function hasNasMusicInteractionAccess(interaction, settings) {
    const guildId = interaction.guildId;
    const userId = interaction.user?.id;
    if (!guildId || !userId) return false;
    return hasNasMusicAccess({
        guildId,
        userId,
        isAdministrator: hasAdministrator(interaction.memberPermissions ?? interaction.member?.permissions),
    }, settings);
}

export async function resolveNasMusicAccess(guild, userId) {
    if (!guild?.id || !userId) return false;
    const settings = getAiSettings(guild.id);
    if (hasNasMusicAccess({ guildId: guild.id, userId, isAdministrator: false }, settings)) return true;
    if (!settings.admin_ids.includes(userId) || !guild.members?.fetch) return false;

    const isAdministrator = await resolveNasMusicAdministrator(guild, userId);
    return hasNasMusicAccess({ guildId: guild.id, userId, isAdministrator }, getAiSettings(guild.id));
}

export async function resolveNasMusicAdministrator(guild, userId) {
    if (!guild?.id || !userId || !guild.members?.fetch) return false;

    let timer;
    try {
        const member = await Promise.race([
            guild.members.fetch({ user: userId, force: true }),
            new Promise(resolve => {
                timer = setTimeout(() => resolve(null), MEMBER_LOOKUP_TIMEOUT_MS);
                timer.unref?.();
            }),
        ]);
        if (!member) return false;
        return hasAdministrator(member.permissions);
    } catch {
        // Discord lookup failures deny access without exposing the upstream response.
        return false;
    } finally {
        clearTimeout(timer);
    }
}
