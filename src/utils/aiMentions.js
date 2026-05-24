function uniqueIds(ids) {
    return [...new Set(ids.filter(Boolean).map(String))];
}

export function buildAiMentionPolicy({
    botUserId,
    userIds = [],
    roleIds = [],
    allowRoleMentions = false,
}) {
    return {
        users: uniqueIds(userIds).filter(id => id !== String(botUserId)),
        roles: allowRoleMentions ? uniqueIds(roleIds) : [],
    };
}

export function sanitizeAiReplyMentions(content, policy) {
    const allowedUsers = new Set(policy.users);
    const allowedRoles = new Set(policy.roles);

    return String(content)
        .replace(/@(everyone|here)/gi, '@\u200b$1')
        .replace(/<@!?(\d+)>/g, (_match, id) => (
            allowedUsers.has(id) ? `<@${id}>` : '@\u200b使用者'
        ))
        .replace(/<@&(\d+)>/g, (_match, id) => (
            allowedRoles.has(id) ? `<@&${id}>` : '@\u200b身分組'
        ));
}

export function buildAllowedMentions(policy) {
    return {
        parse: [],
        users: policy.users,
        roles: policy.roles,
        repliedUser: false,
    };
}
