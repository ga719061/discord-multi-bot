export function scopedCustomId(scope, ownerId, ...parts) {
    return [scope, ownerId, ...parts].map((part) => String(part ?? '')).join(':');
}

export function parseScopedCustomId(customId, scope, ownerId) {
    const parts = String(customId ?? '').split(':');
    if (parts[0] !== scope || parts[1] !== ownerId) return null;
    return parts.slice(2);
}
