// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { immichBadges } from '../../src/immich/immich-pills.ts'
import { assetPicture } from '../../src/logic/immich-asset.ts'
import { installMarkedCatalogue, TRANSLATED_MARK as MARK, uninstallMarkedCatalogue } from './l10n/marked-catalogue.ts'
import { immichEntry } from './logic/immich-fixtures.ts'

const badgesOf = (...overrides: Parameters<typeof immichEntry>[1][]) => overrides.map((fields) => immichBadges(assetPicture(immichEntry('a1', fields), 1, 'day')))

describe('immichBadges', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: IMMICH-002.37
	it('words each kind\'s pills and names the kind and the stack in the label', () => {
		expect(badgesOf({}, { kind: 'live' }, { kind: 'video', duration: 12.5 }, { stackSize: 3 }, { kind: 'video' })).toEqual([
			{ label: `${MARK}Photo`, pills: [] },
			{ label: `${MARK}Motion photo`, pills: [{ icon: 'live', text: `${MARK}LIVE` }] },
			{ label: `${MARK}Video, 0:12`, pills: [{ icon: 'play', text: '0:12' }] },
			{ label: `${MARK}Photo, ${MARK}${MARK}Stack of 3 photos`, pills: [{ icon: 'stack', text: '3' }] },
			{ label: `${MARK}Video`, pills: [{ icon: 'play', text: '' }] },
		])
	})
})
