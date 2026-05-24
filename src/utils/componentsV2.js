import {
    ContainerBuilder,
    MediaGalleryBuilder,
    MessageFlags,
    SeparatorBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from 'discord.js';
import { UI_COLORS } from './style.js';

export function v2Panel(accentColor = UI_COLORS.ROYAL) {
    return new ContainerBuilder().setAccentColor(accentColor);
}

export function v2Text(content) {
    return new TextDisplayBuilder().setContent(truncateV2Text(content));
}

export function truncateV2Text(content, maxLength = 4000) {
    const text = String(content ?? '').trim() || '-';
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function v2Divider() {
    return new SeparatorBuilder().setDivider(true);
}

export function v2Payload(components, options = {}) {
    assertValidV2Components(components);
    return {
        allowedMentions: { parse: [] },
        ...options,
        components,
        flags: mergeFlags(options.flags, MessageFlags.IsComponentsV2),
    };
}

export function ephemeralV2Payload(components, options = {}) {
    return v2Payload(components, {
        ...options,
        flags: mergeFlags(options.flags, MessageFlags.Ephemeral),
    });
}

export function v2EditPayload(payload) {
    const { flags, ...editable } = payload;
    return editable;
}

export function v2Notice(title, message, accentColor = UI_COLORS.INFO, options = {}) {
    const panel = v2Panel(accentColor)
        .addTextDisplayComponents(v2Text(`## ${title}\n${message}`));
    return options.ephemeral === false
        ? v2Payload([panel], omitEphemeralOption(options))
        : ephemeralV2Payload([panel], omitEphemeralOption(options));
}

export function v2Card({
    title,
    description,
    accentColor = UI_COLORS.ROYAL,
    fields = [],
    thumbnail,
    images = [],
    footer,
    actionRows = [],
}) {
    const panel = v2Panel(accentColor);
    const heading = [title ? `# ${title}` : null, description].filter(Boolean).join('\n');

    if (thumbnail && heading) {
        panel.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(v2Text(heading))
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(thumbnail).setDescription(title || '圖片')
                )
        );
    } else if (heading) {
        panel.addTextDisplayComponents(v2Text(heading));
    }

    for (const field of fields) {
        panel.addSeparatorComponents(v2Divider());
        panel.addTextDisplayComponents(v2Text([
            field.name ? `## ${field.name}` : null,
            field.value,
        ].filter(Boolean).join('\n')));
    }

    if (images.length > 0) {
        panel.addSeparatorComponents(v2Divider());
        panel.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                ...images.map((url, index) => ({
                    media: { url },
                    description: `${title || '圖片'} ${index + 1}`,
                }))
            )
        );
    }

    if (footer) {
        panel.addSeparatorComponents(v2Divider());
        panel.addTextDisplayComponents(v2Text(`-# ${footer}`));
    }

    if (actionRows.length > 0) {
        panel.addActionRowComponents(...actionRows);
    }

    return panel;
}

export function embedToV2Container(embed, actionRows = []) {
    const data = typeof embed?.toJSON === 'function' ? embed.toJSON() : (embed?.data ?? embed ?? {});
    const author = data.author?.name ? `**${data.author.name}**` : null;
    const linkedTitle = data.title && data.url ? `[${data.title}](${data.url})` : data.title;
    return v2Card({
        title: linkedTitle,
        description: [author, data.description].filter(Boolean).join('\n'),
        accentColor: data.color ?? UI_COLORS.ROYAL,
        fields: data.fields ?? [],
        thumbnail: data.thumbnail?.url,
        images: data.image?.url ? [data.image.url] : [],
        footer: data.footer?.text,
        actionRows,
    });
}

export function embedsToV2Payload(embeds, options = {}) {
    const actionRows = options.actionRows ?? options.components ?? [];
    const panels = embeds.map((embed, index) =>
        embedToV2Container(embed, index === embeds.length - 1 ? actionRows : [])
    );
    const payloadOptions = { ...options };
    delete payloadOptions.components;
    delete payloadOptions.actionRows;
    const isEphemeral = payloadOptions.ephemeral === true;
    delete payloadOptions.ephemeral;
    return isEphemeral
        ? ephemeralV2Payload(panels, payloadOptions)
        : v2Payload(panels, payloadOptions);
}

export function isV2Message(message) {
    return Boolean(message?.flags?.has?.(MessageFlags.IsComponentsV2)
        || (Number(message?.flags?.bitfield ?? message?.flags ?? 0) & MessageFlags.IsComponentsV2));
}

export function countV2Components(components) {
    return components.reduce((count, component) => count + countComponent(component.toJSON?.() ?? component), 0);
}

export function assertValidV2Components(components) {
    const count = countV2Components(components);
    if (count > 40) throw new Error(`Components V2 元件數超過限制：${count} / 40`);

    const ids = [];
    for (const component of components) collectCustomIds(component.toJSON?.() ?? component, ids);
    if (new Set(ids).size !== ids.length) {
        throw new Error('Components V2 含有重複的 custom_id。');
    }
}

function countComponent(component) {
    return 1
        + (component.components ?? []).reduce((sum, child) => sum + countComponent(child), 0)
        + (component.accessory ? countComponent(component.accessory) : 0);
}

function collectCustomIds(component, ids) {
    if (component.custom_id) ids.push(component.custom_id);
    for (const child of component.components ?? []) collectCustomIds(child, ids);
    if (component.accessory) collectCustomIds(component.accessory, ids);
}

function mergeFlags(flags, addedFlag) {
    if (Array.isArray(flags)) {
        return [...flags, addedFlag];
    }
    return Number(flags ?? 0) | addedFlag;
}

function omitEphemeralOption(options) {
    const next = { ...options };
    delete next.ephemeral;
    return next;
}
