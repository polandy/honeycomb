// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The loupe's snapshot narrowed to the pictures that still pass, keeping the shown one, with its index there. */
export function narrowSnapshot<P>(pictures: readonly P[], index: number, passes: (picture: P) => boolean): { pictures: P[], index: number } {
	const narrowed = pictures.filter((picture, at) => at === index || passes(picture))
	return { pictures: narrowed, index: narrowed.indexOf(pictures[index]!) }
}

/** The snapshot index of the narrowed list's picture at the index. */
export function snapshotIndex<P>(pictures: readonly P[], narrowed: readonly P[], index: number): number {
	return pictures.indexOf(narrowed[index]!)
}
