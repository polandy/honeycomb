// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichEntry } from './immich-asset.ts'

/** A pill on an Immich tile (IMMICH-002.37); components word them. */
export type AssetPill
	= | { readonly kind: 'live' }
		| { readonly kind: 'video', readonly duration: number | null }
		| { readonly kind: 'stack', readonly size: number }

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600

/** The asset's pills, its kind's before its stack's; a photo outside a stack has none. */
export function assetPills(entry: ImmichEntry): AssetPill[] {
	const kind: AssetPill[] = entry.kind === 'live' ? [{ kind: 'live' }] : entry.kind === 'video' ? [{ kind: 'video', duration: entry.duration }] : []
	return entry.stackSize !== null && entry.stackSize > 1 ? [...kind, { kind: 'stack', size: entry.stackSize }] : kind
}

/** Whole seconds as a clock says them: `m:ss`, from an hour `h:mm:ss`. */
export function clockDuration(seconds: number): string {
	const whole = Math.floor(seconds)
	const pad = (value: number) => String(value).padStart(2, '0')
	const [hours, minutes, rest] = [Math.floor(whole / SECONDS_PER_HOUR), Math.floor((whole % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE), whole % SECONDS_PER_MINUTE]
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}
