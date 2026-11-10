// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PairingEntry, Picture } from './pairing.ts'

import { parseFileName } from './file-name.ts'

/** Extensions the badge shortens to the name photographers know. */
const SHORT_EXTENSIONS = new Map([['jpeg', 'jpg']])

/** What a tile's badge says about its members; components word the singles. */
export type PairBadge
	= | { readonly kind: 'pair', readonly label: string }
		| { readonly kind: 'rendered-only', readonly extension: string }
		| { readonly kind: 'raw-only', readonly extension: string }

/** The badge of a picture: both extensions of a pair, else the single's extension, in upper case. */
export function pairBadge(picture: Picture<PairingEntry>): PairBadge {
	if (picture.raw === null) {
		return { kind: 'rendered-only', extension: badgeExtension(picture.rendered) }
	}
	return picture.rendered === null
		? { kind: 'raw-only', extension: badgeExtension(picture.raw) }
		: { kind: 'pair', label: `${badgeExtension(picture.rendered)}+${badgeExtension(picture.raw)}` }
}

/** The member's extension as the badge shows it. */
function badgeExtension(member: PairingEntry): string {
	const { extension } = parseFileName(member.path)
	return (SHORT_EXTENSIONS.get(extension) ?? extension).toUpperCase()
}
