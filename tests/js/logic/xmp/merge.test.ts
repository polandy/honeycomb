// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, Decision } from '../../../../src/logic/decision.ts'
import type { XmpPacket } from '../../../../src/logic/xmp/model.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../../src/logic/decision.ts'
import { sidecarDecision } from '../../../../src/logic/xmp/decision.ts'
import { mergeDecision, mergeDelta, writeSidecar } from '../../../../src/logic/xmp/merge.ts'
import { XmpError } from '../../../../src/logic/xmp/model.ts'
import { readXmp } from '../../../../src/logic/xmp/parse.ts'
import { CANONICAL_TIME, fixtureBytes, itemsOf, key, packetOf, textOf } from './xmp-builders.ts'

const CHANGED = { isPair: false, colourLabelChanged: true }
const UNCHANGED = { isPair: false, colourLabelChanged: false }

/** The properties honeycomb writes, which a merge may change. */
const WRITTEN = ['xmp:Rating', 'xmp:Label', 'xmp:MetadataDate', 'digiKam:PickLabel', 'digiKam:ColorLabel', 'xmpDM:pick', 'xmpDM:good', 'darktable:colorlabels', 'honeycomb:KeepRaw'].map(key)

/** A decision differing from undecided in the given fields. */
function decided(fields: Partial<Decision>): Decision {
	return { ...UNDECIDED, ...fields }
}

/** The packet of a fixture. */
function fixture(name: string): XmpPacket {
	return readXmp(fixtureBytes(name))
}

/** The properties honeycomb does not write. */
function untouched(packet: XmpPacket): Map<string, unknown> {
	return new Map([...packet.properties].filter(([name]) => !WRITTEN.includes(name)))
}

describe('mergeDecision', () => {
	// spec: XMP-001.13
	it.each([
		['picked', '3', '1', 'True', '2'],
		['rejected', '1', '-1', 'False', '2'],
		['unflagged', undefined, undefined, undefined, '2'],
	] as const)('writes the flag %s for digiKam, darktable and Lightroom', (flag, pickLabel, pick, good, rating) => {
		const merged = mergeDecision(fixture('digikam.xmp'), decided({ flag, rating: 2 }), UNCHANGED)
		expect(textOf(merged, 'digiKam:PickLabel')).toBe(pickLabel)
		expect(textOf(merged, 'xmpDM:pick')).toBe(pick)
		expect(textOf(merged, 'xmpDM:good')).toBe(good)
		expect(textOf(merged, 'xmp:Rating')).toBe(rating)
	})

	// spec: XMP-001.13
	it('keeps an existing PickLabel 2 when unflagged and replaces it when picked', () => {
		const pending = fixture('digikam-pending.xmp')
		const rated = mergeDecision(pending, decided({ rating: 4, colourLabel: 'magenta' }), UNCHANGED)
		expect(textOf(rated, 'xmp:Rating')).toBe('4')
		expect(textOf(rated, 'digiKam:PickLabel')).toBe('2')
		expect(textOf(mergeDecision(pending, decided({ flag: 'picked' }), UNCHANGED), 'digiKam:PickLabel')).toBe('3')
	})

	// spec: XMP-001.14
	it.each([
		['red', '1', 'Red'],
		['orange', '2', 'Orange'],
		['magenta', '6', 'Purple'],
		['white', '9', 'White'],
		[null, '0', undefined],
	] as const)('writes the colour label %s to a digiKam sidecar', (colourLabel, index, label) => {
		const merged = mergeDecision(fixture('digikam.xmp'), decided({ colourLabel }), CHANGED)
		expect(textOf(merged, 'digiKam:ColorLabel')).toBe(index)
		expect(textOf(merged, 'xmp:Label')).toBe(label)
		expect(itemsOf(merged, 'darktable:colorlabels')).toBeUndefined()
	})

	// spec: XMP-001.14
	it.each([
		['green', true, ['2']],
		['magenta', true, ['4']],
		['green', false, ['3', '0']],
		['orange', true, undefined],
		[null, true, undefined],
	] as const)('writes %s (changed: %s) to a darktable sidecar without xmp:Label', (colourLabel, colourLabelChanged, colorlabels) => {
		const merged = mergeDecision(fixture('darktable.xmp'), decided({ colourLabel }), { isPair: false, colourLabelChanged })
		expect(textOf(merged, 'digiKam:ColorLabel')).toBeDefined()
		expect(itemsOf(merged, 'darktable:colorlabels')).toEqual(colorlabels)
		expect(textOf(merged, 'xmp:Label')).toBeUndefined()
	})

	// spec: XMP-001.14
	it.each([
		['blue', 'Blue', ['3']],
		[null, undefined, undefined],
	] as const)('keeps xmp:Label in step in a darktable sidecar that has it, for %s', (colourLabel: ColourLabel | null, label, colorlabels) => {
		const merged = mergeDecision(fixture('darktable-label-precedence.xmp'), decided({ colourLabel }), CHANGED)
		expect(textOf(merged, 'xmp:Label')).toBe(label)
		expect(itemsOf(merged, 'darktable:colorlabels')).toEqual(colorlabels)
	})

	// spec: XMP-001.15
	it.each([
		['a pair marked Keep RAW', {}, true, true, 'True'],
		['a pair not marked', { 'honeycomb:KeepRaw': 'True' }, false, true, undefined],
		['a single, marked', { 'honeycomb:KeepRaw': 'False' }, true, false, 'False'],
		['a single without KeepRaw', {}, true, false, undefined],
	] as const)('writes KeepRaw for %s', (_, properties, keepRaw, isPair, written) => {
		const merged = mergeDecision(packetOf(properties), decided({ keepRaw }), { isPair, colourLabelChanged: false })
		expect(textOf(merged, 'honeycomb:KeepRaw')).toBe(written)
	})

	it('keeps the qualifiers of a property it sets', () => {
		const packet = packetOf({ 'xmp:Rating': { value: { kind: 'text', text: '1' }, qualifiers: new Map([[key('dc:source'), { value: { kind: 'text', text: 'camera' }, qualifiers: new Map() }]]) } })
		expect(mergeDecision(packet, decided({ rating: 5 }), UNCHANGED).properties.get(key('xmp:Rating'))?.qualifiers).toEqual(packet.properties.get(key('xmp:Rating'))?.qualifiers)
	})
})

describe('mergeDelta', () => {
	const REJECTION = ['xmp:Rating', 'digiKam:PickLabel', 'xmpDM:pick', 'xmpDM:good', 'honeycomb:RejectedRating']
	const rejection = (packet: XmpPacket) => REJECTION.map((name) => textOf(packet, name))

	// spec: XMP-001.23
	it('applies the delta to the decision the sidecar states and writes the whole set from it', () => {
		const sidecar = packetOf({ 'xmp:Rating': '2', 'digiKam:ColorLabel': '4', 'digiKam:PickLabel': '3' })

		const merged = mergeDelta(sidecar, { flag: 'rejected' }, false)

		expect(sidecarDecision(merged, false)).toEqual(decided({ rating: 2, colourLabel: 'green', flag: 'rejected' }))
		expect(textOf(merged, 'xmp:Label')).toBe('Green')
	})

	// spec: XMP-001.24
	it.each([
		[{ rating: 3 }, ['3', '1', '-1', 'False', undefined], 'rejected'],
		[{ flag: 'unflagged' }, ['0', undefined, undefined, undefined, undefined], 'unflagged'],
		[{ colourLabel: 'green' }, ['0', '1', '-1', 'False', undefined], 'rejected'],
	] as const)('turns darktable\'s −1 into stars and digiKam\'s reject on %o', (delta, written, flag) => {
		const merged = mergeDelta(fixture('darktable.xmp'), delta, false)

		expect(rejection(merged)).toEqual(written)
		expect(sidecarDecision(merged, false).flag).toBe(flag)
	})

	// spec: XMP-001.24
	it('rejects in a darktable sidecar with stars the digiKam way', () => {
		const rated = packetOf({ 'darktable:xmp_version': '5', 'xmp:Rating': '4' })

		expect(rejection(mergeDelta(rated, { flag: 'rejected' }, false))).toEqual(['4', '1', '-1', 'False', undefined])
	})

	it('changes darktable\'s colour labels only when the delta changes the colour label', () => {
		expect(itemsOf(mergeDelta(fixture('darktable.xmp'), { rating: 1 }, false), 'darktable:colorlabels')).toEqual(['3', '0'])
		expect(itemsOf(mergeDelta(fixture('darktable.xmp'), { colourLabel: 'green' }, false), 'darktable:colorlabels')).toEqual(['2'])
	})
})

describe('writeSidecar', () => {
	// spec: XMP-001.16
	it('keeps darktable\'s history and tags value for value when rejecting and then picking', () => {
		const original = fixture('darktable.xmp')
		const rejected = writeSidecar(fixtureBytes('darktable.xmp'), decided({ flag: 'rejected', colourLabel: 'red' }), false, CANONICAL_TIME)
		const picked = readXmp(writeSidecar(rejected, decided({ flag: 'picked', colourLabel: 'red' }), false, CANONICAL_TIME))
		expect(picked.properties.has(key('darktable:history'))).toBe(true)
		expect(itemsOf(picked, 'darktable:colorlabels')).toEqual(['3', '0'])
		expect(untouched(picked)).toEqual(untouched(original))
	})

	// spec: XMP-001.16
	it('keeps unknown namespaces, struct qualifiers and language alternatives', () => {
		const written = readXmp(writeSidecar(fixtureBytes('unknown-fields.xmp'), decided({ rating: 5, colourLabel: 'green' }), false, CANONICAL_TIME))
		expect(textOf(written, 'xmp:Rating')).toBe('5')
		expect(untouched(written)).toEqual(untouched(fixture('unknown-fields.xmp')))
	})

	it('creates a new sidecar that reads back as the decision', () => {
		const decision = decided({ rating: 3, flag: 'picked', colourLabel: 'yellow', keepRaw: true })
		const written = readXmp(writeSidecar(null, decision, true, CANONICAL_TIME))
		expect(sidecarDecision(written, true)).toEqual(decision)
	})

	// spec: XMP-001.21
	it('fails with the reason and no bytes when the target cannot be read', () => {
		expect(() => writeSidecar(fixtureBytes('conflict.xmp'), decided({ rating: 1 }), UNCHANGED, CANONICAL_TIME)).toThrow(XmpError)
		expect(() => writeSidecar(fixtureBytes('conflict.xmp'), decided({ rating: 1 }), UNCHANGED, CANONICAL_TIME)).toThrow('conflicting values for xmp:Rating')
	})
})
