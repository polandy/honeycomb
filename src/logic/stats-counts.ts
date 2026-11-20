// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, Flag } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { PlannedSave, SidecarSaveAnswer } from './sidecar-sync.ts'
import type { XmpPacket } from './xmp/model.ts'

import { memberIds } from './pairing.ts'
import { PROPERTY } from './xmp/fields.ts'
import { NAMESPACE, xmpKey, xmpName } from './xmp/model.ts'

/** The metrics the browser counts and sends with a flag or sidecar save (STATS-001). */
export type CountMetric = 'pictures_decided' | 'pictures_picked' | 'pictures_rejected' | 'ratings_set' | 'colour_labels_set' | 'tags_set'

/** What one change counts per metric, +1 forward and -1 when undone. */
export type StatsCounts = Readonly<Partial<Record<CountMetric, number>>>

/** +1 for a change, -1 for its undo. */
export type CountSign = 1 | -1

/** The digiKam properties honeycomb writes itself; any other marks a sidecar from digiKam. */
const OWN_DIGIKAM = new Set([PROPERTY.pickLabel, PROPERTY.colorLabel, xmpKey(NAMESPACE.digiKam, 'TagsList')])

/** What a flag change counts: the state it enters minus the state it leaves. */
export function flagCounts(before: Flag, after: Flag): StatsCounts {
	const of = (flag: Flag): StatsCounts => ({ pictures_decided: flag === 'unflagged' ? 0 : 1, pictures_picked: flag === 'picked' ? 1 : 0, pictures_rejected: flag === 'rejected' ? 1 : 0 })
	return summedCounts(of(after), negated(of(before)))
}

/** What a decision change counts for its rating and colour label, each changed one by the sign. */
export function fieldCounts(before: Decision, after: Decision, sign: CountSign): StatsCounts {
	return summedCounts({ ratings_set: before.rating === after.rating ? 0 : sign, colour_labels_set: before.colourLabel === after.colourLabel ? 0 : sign })
}

/** The counts added per metric, without the metrics that sum to nothing. */
export function summedCounts(...counts: readonly StatsCounts[]): StatsCounts {
	const sums = new Map<CountMetric, number>()
	counts.flatMap((each) => Object.entries(each) as [CountMetric, number][]).forEach(([metric, value]) => sums.set(metric, (sums.get(metric) ?? 0) + value))
	return Object.fromEntries([...sums].filter(([, value]) => value !== 0))
}

/** Whether a sidecar holds data darktable or digiKam wrote: darktable's version or a digiKam property honeycomb does not write. */
export function holdsForeignData(packet: XmpPacket): boolean {
	return [...packet.properties.keys()].some((key) => key === PROPERTY.darktableVersion || (xmpName(key).namespace === NAMESPACE.digiKam && !OWN_DIGIKAM.has(key)))
}

/** The saves with each picture's counts on its first save, none where it counts nothing. */
export function withCounts(saves: readonly PlannedSave[], countsOf: (picture: Picture<ListingEntry>) => StatsCounts): PlannedSave[] {
	const seen = new Set<Picture<ListingEntry>>()
	return saves.map((save) => {
		const counts = seen.has(save.picture) ? {} : countsOf(save.picture)
		seen.add(save.picture)
		return Object.keys(counts).length === 0 ? save : { ...save, item: { ...save.item, counts } }
	})
}

/** The pictures whose counts rode on a save the answers say was saved; `null` answers a failed request. */
export function countedPictures(saves: readonly PlannedSave[], answers: readonly SidecarSaveAnswer[] | null): Set<Picture<ListingEntry>> {
	return new Set(saves.filter((save, index) => 'counts' in save.item && answers?.[index]?.result === 'saved').map(({ picture }) => picture))
}

/** Each picture's counts by the file id of its first row, which a flag save carries them on; a picture that counts nothing has none. */
export function countsByRow(pictures: readonly Picture<ListingEntry>[], rows: readonly { readonly fileId: number }[], countsOf: (picture: Picture<ListingEntry>) => StatsCounts): Map<number, StatsCounts> {
	return new Map(pictures.flatMap((picture) => {
		const members = new Set(memberIds(picture))
		const first = rows.find(({ fileId }) => members.has(fileId))
		const counts = countsOf(picture)
		return first === undefined || Object.keys(counts).length === 0 ? [] : [[first.fileId, counts] as const]
	}))
}

/** The counts with each value's sign turned. */
function negated(counts: StatsCounts): StatsCounts {
	return Object.fromEntries(Object.entries(counts).map(([metric, value]) => [metric, -value]))
}
