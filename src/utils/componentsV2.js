import {
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { UI_COLORS } from './style.js';

export function v2Panel(accentColor = UI_COLORS.ROYAL) {
    return new ContainerBuilder().setAccentColor(accentColor);
}

export function v2Text(content) {
    return new TextDisplayBuilder().setContent(content);
}

export function v2Divider() {
    return new SeparatorBuilder().setDivider(true);
}

export function ephemeralV2Payload(components) {
    return {
        components,
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    };
}
