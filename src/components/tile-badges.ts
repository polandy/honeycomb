// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IconName } from './AppIcon.vue'

/** A pill at a tile's top left: an icon and a short text, which may be empty. */
export interface TilePill {
	readonly icon: IconName
	readonly text: string
}

/** What a source without pairs shows on a tile in place of the pair badge, and its label (IMMICH-002.37). */
export interface TileBadges {
	readonly label: string
	readonly pills: readonly TilePill[]
}
