// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { seededSidecar } from '../../../src/logic/jpeg-seed.ts'
import { readXmp } from '../../../src/logic/xmp/parse.ts'
import { read, xmp } from './sidecar-answers.ts'
import { CANONICAL_TIME, itemsOf, key, textOf } from './xmp/xmp-builders.ts'

const REGIONS = 'http://www.metadataworkinggroup.com/schemas/regions/'
const RAW_SIDECAR = new TextEncoder().encode(`<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:digiKam="http://www.digikam.org/ns/1.0/" xmlns:xmpDM="http://ns.adobe.com/xmp/1.0/DynamicMedia/"
 xmlns:darktable="http://darktable.sf.net/" xmlns:honeycomb="https://github.com/polandy/honeycomb/xmp/1.0/" xmlns:mwg-rs="${REGIONS}"
 xmp:Rating="3" xmp:Label="Red" digiKam:ColorLabel="1" digiKam:PickLabel="3" xmpDM:pick="1" xmpDM:good="True" honeycomb:KeepRaw="True" darktable:xmp_version="5">
<digiKam:TagsList><rdf:Seq><rdf:li>Places/Lisbon</rdf:li></rdf:Seq></digiKam:TagsList>
<mwg-rs:Regions rdf:parseType="Resource"><mwg-rs:RegionList><rdf:Bag><rdf:li rdf:parseType="Resource"><mwg-rs:Name>Ana</mwg-rs:Name><mwg-rs:Type>Face</mwg-rs:Type></rdf:li></rdf:Bag></mwg-rs:RegionList></mwg-rs:Regions>
</rdf:Description></rdf:RDF></x:xmpmeta>`)

describe('seededSidecar', () => {
	// spec: DELETE-003.12
	it('takes every field of the RAW sidecar, other programs\' too, but the flag fields and Keep RAW', () => {
		const seeded = seededSidecar(read(RAW_SIDECAR), CANONICAL_TIME)

		expect(seeded).not.toBeNull()
		const packet = readXmp((seeded as { bytes: Uint8Array }).bytes)
		expect(textOf(packet, 'xmp:Rating')).toBe('3')
		expect(textOf(packet, 'xmp:Label')).toBe('Red')
		expect(textOf(packet, 'digiKam:ColorLabel')).toBe('1')
		expect(itemsOf(packet, 'digiKam:TagsList')).toEqual(['Places/Lisbon'])
		expect(textOf(packet, 'darktable:xmp_version')).toBe('5')
		expect(packet.properties.get(`${REGIONS} Regions`)?.value.kind).toBe('struct')
		for (const flag of ['digiKam:PickLabel', 'xmpDM:pick', 'xmpDM:good', 'honeycomb:KeepRaw']) {
			expect(packet.properties.has(key(flag))).toBe(false)
		}
	})

	// spec: DELETE-003.12
	it('gives no sidecar for a RAW sidecar holding nothing but the flag fields and Keep RAW', () => {
		expect(seededSidecar(read(xmp({ 'digiKam:PickLabel': '3', 'honeycomb:KeepRaw': 'True' })), CANONICAL_TIME)).toBeNull()
	})

	// spec: DELETE-003.9
	it('says why a RAW sidecar that could not be read again or is refused seeds nothing', () => {
		expect(seededSidecar(undefined, CANONICAL_TIME)).toEqual({ reason: 'unreachable' })
		expect(seededSidecar({ result: 'locked' }, CANONICAL_TIME)).toEqual({ reason: 'locked' })
		expect(seededSidecar(read(new TextEncoder().encode('<x:xmpmeta')), CANONICAL_TIME)).toEqual({ reason: 'malformed' })
	})
})
