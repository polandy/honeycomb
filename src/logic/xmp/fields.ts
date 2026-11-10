// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel } from '../decision.ts'
import type { XmpPacket } from './model.ts'

import { COLOUR_LABELS } from '../decision.ts'
import { NAMESPACE, xmpKey } from './model.ts'

/** The properties honeycomb reads and writes (`docs/06-xmp-interop.md` Field mapping). */
export const PROPERTY = {
	rating: xmpKey(NAMESPACE.xmp, 'Rating'),
	label: xmpKey(NAMESPACE.xmp, 'Label'),
	pickLabel: xmpKey(NAMESPACE.digiKam, 'PickLabel'),
	colorLabel: xmpKey(NAMESPACE.digiKam, 'ColorLabel'),
	pick: xmpKey(NAMESPACE.xmpDM, 'pick'),
	good: xmpKey(NAMESPACE.xmpDM, 'good'),
	colorlabels: xmpKey(NAMESPACE.darktable, 'colorlabels'),
	darktableVersion: xmpKey(NAMESPACE.darktable, 'xmp_version'),
	keepRaw: xmpKey(NAMESPACE.honeycomb, 'KeepRaw'),
} as const

/** digiKam's pick labels (`digikam_globals.h`). */
export const PICK_LABEL = { none: 0, rejected: 1, pending: 2, accepted: 3 } as const

/** digiKam's `xmp:Label` texts by colour label index, 0 being none; magenta is `Purple`. */
export const LABEL_TEXTS = ['NoColor', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Gray', 'Black', 'White'] as const

/** darktable's colour labels by index (`colorlabels.h`). */
export const DARKTABLE_LABELS: readonly ColourLabel[] = ['red', 'yellow', 'green', 'blue', 'magenta']

/** True and false as `xmpDM:good` and `honeycomb:KeepRaw` write them. */
export const XMP_TRUE = 'True'
export const XMP_FALSE = 'False'

const INTEGER = /^[+-]?\d+$/
const REAL = /^[+-]?(?:\d+\.?\d*|\.\d+)$/

/** digiKam's colour label index of a colour label, 0 for none. */
export function colourLabelIndex(colourLabel: ColourLabel | null): number {
	return colourLabel === null ? 0 : COLOUR_LABELS.indexOf(colourLabel) + 1
}

/** The text of a simple property, or undefined when it is absent or not simple. */
export function simpleText(packet: XmpPacket, key: string): string | undefined {
	const node = packet.properties.get(key)
	return node?.value.kind === 'text' ? node.value.text : undefined
}

/** The whole number a text states, or null. */
export function integerOf(text: string | undefined): number | null {
	const trimmed = text?.trim() ?? ''
	return INTEGER.test(trimmed) ? Number(trimmed) : null
}

/** The real number a text states, or null. */
export function realOf(text: string | undefined): number | null {
	const trimmed = text?.trim() ?? ''
	return REAL.test(trimmed) ? Number(trimmed) : null
}
