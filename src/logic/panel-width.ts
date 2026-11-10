// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The limits of a resizable panel's width, in CSS pixels. */
export interface PanelLimits {
	readonly min: number
	readonly max: number
	readonly initial: number
	/** How far an arrow key moves the divider. */
	readonly step: number
}

/** The loupe's info panel, as in the mockup. */
export const INFO_PANEL: PanelLimits = { min: 220, max: 480, initial: 300, step: 16 }

/** A stored width within the limits, else the initial width. */
export function parsePanelWidth(stored: string | null, limits: PanelLimits): number {
	const width = Number.parseInt(stored ?? '', 10)
	return Number.isFinite(width) ? clampWidth(width, limits) : limits.initial
}

/** The width of a panel on the right whose divider went from `startX` to `x`. */
export function dragWidth(startWidth: number, startX: number, x: number, limits: PanelLimits): number {
	return clampWidth(startWidth - (x - startX), limits)
}

/** The width after a key on the divider, or null for a key it does not take. */
export function keyWidth(width: number, key: string, limits: PanelLimits): number | null {
	switch (key) {
		case 'ArrowLeft':
			return clampWidth(width + limits.step, limits)
		case 'ArrowRight':
			return clampWidth(width - limits.step, limits)
		case 'Home':
			return limits.min
		case 'End':
			return limits.max
		default:
			return null
	}
}

/** `width` within the limits. */
function clampWidth(width: number, limits: PanelLimits): number {
	return Math.min(limits.max, Math.max(limits.min, width))
}
