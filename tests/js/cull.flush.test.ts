// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { useCull } from '../../src/cull.ts'
import { useBundledSidecars } from '../../src/sidecar-bundle.ts'
import { ENTRIES, fakeStorage, NO_SERIES, NO_SIDECARS, NO_TAGS, SAVED_SERIES, SET, WRITING_ON } from './app-cull.ts'
import { access } from './cull-sidecars-fake.ts'
import { fakeScheduler } from './fake-scheduler.ts'

/** A cull over bundled sidecars whose decision and tag saves wait until the test settles them, and the names of the pictures each sidecar write got. */
async function bundledCull() {
	const settle: (() => void)[] = []
	const writes: string[][] = []
	const save = () => new Promise<void>((resolve) => settle.push(resolve))
	const record = async (pictures: readonly { baseName: string }[]) => {
		writes.push(pictures.map((picture) => picture.baseName))
		return { written: pictures.length, failed: [] }
	}
	const sidecars = useBundledSidecars({
		...NO_SIDECARS,
		write: record,
		writeTags: record,
	}, fakeScheduler().schedule, () => () => {})
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		saveVisualHashes: async () => undefined,
		wait: async () => {},
		warmPreviews: async () => undefined,
		lookupDecisions: async () => [],
		saveDecisions: save,
		lookupSeries: NO_SERIES,
		saveSeries: SAVED_SERIES,
		tags: { ...NO_TAGS, saveTags: save },
	}, fakeStorage(), () => WRITING_ON, sidecars, () => undefined)
	cull.open(SET, ENTRIES, access())
	await flushPromises()
	return { cull, sidecars, settle, writes, picture: (name: string) => cull.pictures.value.find((picture) => picture.baseName === name)! }
}

describe('useCull: flushing the sidecar writes', () => {
	// spec: XMP-003.30
	it('waits for the sidecar write of a decision whose save is still on the way', async () => {
		const { cull, sidecars, settle, writes, picture } = await bundledCull()
		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_9'), picture('IMG_2')])
		let flushed = false
		const flush = sidecars.flush().then(() => (flushed = true))

		await flushPromises()
		expect(flushed).toBe(false)

		settle[0]!()
		await flush
		expect(writes).toEqual([['IMG_2', 'IMG_9']])
	})

	// spec: XMP-003.30
	it('waits for the sidecar write of a tag change whose save is still on the way', async () => {
		const { cull, sidecars, settle, writes, picture } = await bundledCull()
		cull.tag({ added: ['Anna'], removed: [] }, [picture('IMG_9'), picture('IMG_2')])
		let flushed = false
		const flush = sidecars.flush().then(() => (flushed = true))

		await flushPromises()
		expect(flushed).toBe(false)

		settle[0]!()
		await flush
		expect(writes).toEqual([['IMG_9', 'IMG_2']])
	})
})
