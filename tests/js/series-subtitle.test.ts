// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatTime } from '../../src/l10n.ts'
import { seriesSubtitle } from '../../src/series-subtitle.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from './l10n/marked-catalogue.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'

const MEMBERS = picturesOf([31, 52].map((time, index) => listingEntry(index + 1, `/P/IMG_${index}.JPG`, { captureTime: 50_000 + time }))) as Picture<ListingEntry>[]
const SPAN = `${formatTime(50_031)}–${formatTime(50_052)}`
const subtitle = (stored?: { readonly elsewhere: boolean }, members = MEMBERS) =>
	seriesSubtitle({ key: 1, members, ...(stored && { stored: { id: 7, status: 'open', ...stored } }) }).replaceAll(TRANSLATED_MARK, '')

describe('seriesSubtitle', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SERIES-005.17
	it('reads the first and last capture time, one time when they match, and adds edited by hand for a stored series', () => {
		expect(subtitle()).toBe(SPAN)
		expect(subtitle(undefined, [MEMBERS[0]!, MEMBERS[0]!])).toBe(formatTime(50_031))
		expect(subtitle({ elsewhere: false })).toBe(`${SPAN} · edited by hand`)
	})

	// spec: SERIES-005.18
	it('adds Also in other folders for a stored series with members outside the folder set', () => {
		expect(subtitle({ elsewhere: true })).toBe(`${SPAN} · edited by hand · Also in other folders`)
	})
})
