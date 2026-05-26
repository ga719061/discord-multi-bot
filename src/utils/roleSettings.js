import { PermissionFlagsBits } from 'discord.js';
import { parseJsonArray } from './jsonUtils.js';

const DANGEROUS_ROLE_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
];

export function normalizeSelfRoleSettings(value) {
  return parseJsonArray(value, [])
    .map((entry) => typeof entry === 'string' ? { id: entry, requirement: null } : entry)
    .filter((entry) => entry?.id)
    .map((entry) => ({ id: String(entry.id), requirement: entry.requirement ? String(entry.requirement) : null }));
}

export function validateAssignableRole(guild, role) {
  if (!role || role.id === guild.id || role.managed) {
    return '不能選擇 @everyone 或由整合服務管理的身分組。';
  }
  if (DANGEROUS_ROLE_PERMISSIONS.some((permission) => role.permissions.has(permission))) {
    return '不能將具備管理權限的身分組提供給成員自行領取。';
  }
  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return '機器人缺少管理身分組權限，無法提供此功能。';
  }
  if (botMember.roles.highest.position <= role.position) {
    return '機器人的最高身分組必須高於要發放的身分組。';
  }
  return null;
}
