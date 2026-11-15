// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { LegacyExport, LegacyInventory } from '../../src/logic/legacy.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { LEGACY_EXPORT_NAME, useLegacy } from '../../src/legacy.ts'
import { logger } from '../../src/logger.ts'

const INVENTORY: LegacyInventory = { folders: [{ path: '/Photos/A', files: 2 }, { path: '/Photos/B', files: 1 }], unreachable: 3 }
const EXPORTED: LegacyExport = { decisions: [{ fileId: 7, rating: 1, colourLabel: null, flag: 'picked', keepRaw: false }], tags: [{ fileId: 8, tags: ['Anna'] }, { fileId: 9, tags: ['Ben'] }] }

afterEach(() => {
	vi.restoreAllMocks()
})

/** The legacy rows over fake endpoints; `active` as the writing setting says. */
function legacyWith(options: { inventory?: () => Promise<LegacyInventory>, exportFails?: boolean, acknowledgeFails?: boolean, active?: boolean } = {}) {
	const active = shallowRef(options.active ?? true)
	const reads: number[] = []
	const acknowledged: number[][] = []
	const saved: { name: string, text: string }[] = []
	const toasts: string[] = []
	const legacy = useLegacy({
		loadInventory: options.inventory ?? (async () => {
			reads.push(1)
			return INVENTORY
		}),
		loadExport: async () => {
			if (options.exportFails) {
				throw new Error('offline')
			}
			return EXPORTED
		},
		acknowledge: async (fileIds) => {
			if (options.acknowledgeFails) {
				throw new Error('offline')
			}
			acknowledged.push([...fileIds])
		},
	}, (name, text) => void saved.push({ name, text }), (message) => void toasts.push(message), () => active.value)
	return { legacy, active, reads, acknowledged, saved, toasts }
}

describe('useLegacy', () => {
	// spec: XMP-007.8
	it('reads the inventory while writing creates new sidecars, and shows it while rows remain', async () => {
		const { legacy, active, reads } = legacyWith({ active: false })
		await flushPromises()
		expect(reads).toEqual([])
		expect(legacy.shown.value).toBe(false)

		active.value = true
		await flushPromises()
		expect(reads).toEqual([1])
		expect(legacy.inventory.value).toEqual(INVENTORY)
		expect(legacy.shown.value).toBe(true)

		active.value = false
		await flushPromises()
		expect(legacy.shown.value).toBe(false)
	})

	// spec: XMP-007.8
	it('shows nothing once no rows remain', async () => {
		const { legacy } = legacyWith({ inventory: async () => ({ folders: [], unreachable: 0 }) })
		await flushPromises()

		expect(legacy.shown.value).toBe(false)
	})

	// spec: XMP-007.9
	it('logs a failed read and shows nothing', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const failure = new Error('offline')
		const { legacy } = legacyWith({ inventory: async () => {
			throw failure
		} })
		await flushPromises()

		expect(legacy.shown.value).toBe(false)
		expect(error).toHaveBeenCalledWith('Could not read which folders hold stored decisions', { error: failure })
	})

	// spec: XMP-007.8
	it('saves the export as a file and reads the inventory again', async () => {
		const { legacy, saved, reads } = legacyWith()
		await flushPromises()

		await legacy.exportRows()

		expect(saved).toEqual([{ name: LEGACY_EXPORT_NAME, text: JSON.stringify(EXPORTED, null, '\t') }])
		expect(LEGACY_EXPORT_NAME).toBe('honeycomb-legacy-rows.json')
		expect(reads).toEqual([1, 1])
	})

	// spec: XMP-007.8
	it('discards the exported file ids only on confirm', async () => {
		const { legacy, acknowledged, reads } = legacyWith()
		await flushPromises()

		legacy.askDiscard()
		expect(legacy.discarding.value).toBe(true)
		legacy.cancelDiscard()
		expect(legacy.discarding.value).toBe(false)
		expect(acknowledged).toEqual([])

		legacy.askDiscard()
		await legacy.discard()
		expect(legacy.discarding.value).toBe(false)
		expect(acknowledged).toEqual([[7, 8, 9]])
		expect(reads).toEqual([1, 1])
	})

	// spec: XMP-007.5
	it('acknowledges the file ids and reads the inventory again', async () => {
		const { legacy, acknowledged, reads } = legacyWith()
		await flushPromises()

		await legacy.acknowledge([3, 4])

		expect(acknowledged).toEqual([[3, 4]])
		expect(reads).toEqual([1, 1])
	})

	// spec: XMP-007.6
	it('logs and tells when the rows could not be removed or exported', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { legacy, toasts, saved } = legacyWith({ acknowledgeFails: true, exportFails: true })
		await flushPromises()

		await legacy.acknowledge([3])
		await legacy.exportRows()
		legacy.askDiscard()
		await legacy.discard()

		expect(saved).toEqual([])
		expect(toasts).toEqual([
			'Could not remove the stored decisions; run it again later.',
			'Could not export the stored decisions.',
			'Could not export the stored decisions.',
		])
		expect(error).toHaveBeenCalledTimes(3)
	})
})
