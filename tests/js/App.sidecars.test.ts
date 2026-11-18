// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StoredDecision } from '../../src/logic/decision.ts'
import type { SidecarWrite } from '../../src/logic/settings.ts'
import type { SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { StoredTags } from '../../src/logic/tag.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import GridToolbar from '../../src/components/GridToolbar.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { sidecarDecision } from '../../src/logic/xmp/decision.ts'
import { readXmp } from '../../src/logic/xmp/parse.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { ENTRIES, mountApp, NO_LEGACY, openCull, SET, sharedAccess, stored, toolbarProps } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'
import { fakeScheduler } from './fake-scheduler.ts'
import { listingEntry } from './logic/listing-entries.ts'
import { CANONICAL_TIME, fixtureBytes, itemsOf, packetOf, seq, textOf } from './logic/xmp/xmp-builders.ts'

enableAutoUnmount(afterEach)

const WITH_SIDECARS = [...ENTRIES, listingEntry(5, '/Trip/A/IMG_9.JPG.xmp'), listingEntry(6, '/Trip/A/IMG_10.CR3.xmp')]
const GOOD = serializeXmp(packetOf({ 'xmp:Rating': '1' }), CANONICAL_TIME)
const RATED_AND_TAGGED = serializeXmp(packetOf({ 'xmp:Rating': '1', 'digiKam:TagsList': seq(['Ben']) }), CANONICAL_TIME)
const UNRATED = serializeXmp(packetOf({}), CANONICAL_TIME)
const DECIDED: StoredDecision = { fileId: 2, rating: 4, colourLabel: 'green', flag: 'picked', keepRaw: true }

/** The app on a cull whose folders in `shared` are shared, with the stored rows given; the sidecar endpoints answer as told. */
async function openWith(options: { lookup: (fileId: number) => SidecarLookupAnswer, save: (item: SidecarSaveItem) => SidecarSaveAnswer, decisions?: StoredDecision[], tags?: StoredTags[], sidecarWrite?: SidecarWrite, shared?: string[] }) {
	const lookups: number[][] = []
	const saves: SidecarSaveItem[][] = []
	const acknowledged: number[][] = []
	const sidecars = {
		lookupSidecars: async (fileIds: readonly number[]) => {
			lookups.push([...fileIds])
			return fileIds.map(options.lookup)
		},
		lookupEmbeddedXmp: async (fileIds: readonly number[]) => fileIds.map(() => ({ result: 'none' as const })),
		saveSidecars: async (items: readonly SidecarSaveItem[]) => {
			saves.push([...items])
			return items.map(options.save)
		},
		now: () => CANONICAL_TIME,
	}
	const storedTags = options.tags ?? []
	const tags = { lookupTags: async (fileIds: readonly number[]) => storedTags.filter((row) => fileIds.includes(row.fileId)), saveTags: async () => undefined, loadTagList: async () => [] }
	const legacy = { ...NO_LEGACY, acknowledge: async (fileIds: readonly number[]) => void acknowledged.push([...fileIds]) }
	const loadSettings = async () => ({ sidecarWrite: options.sidecarWrite ?? 'on' })
	const mounted = mountApp({ sidecars, tags, legacy, loadSettings, schedule: fakeScheduler().schedule }, options.decisions ?? [stored(2, 'picked'), stored(4, 'rejected')], { NcDialog: DialogStub })
	await flushPromises()
	await openCull(mounted.wrapper, SET, WITH_SIDECARS, sharedAccess(options.shared ?? ['/Trip/A']))
	return { ...mounted, lookups, saves, acknowledged }
}

const read = (bytes: Uint8Array): SidecarLookupAnswer => ({ result: 'read', bytes, etag: 'e', size: bytes.length, mtime: 1 })
const unratedNine = (fileId: number) => read(fileId === 5 ? UNRATED : GOOD)
const saved = (): SidecarSaveAnswer => ({ result: 'saved', fileId: 50, etag: 's', size: 1, mtime: 2 })
const dialog = (wrapper: AppWrapper, name: string) => wrapper.find(`[role="dialog"][name="${name}"]`)
const button = (wrapper: AppWrapper, text: string) => wrapper.findAll('button').find((each) => each.text() === text)!
const toastText = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).text()
const savedPaths = (items: readonly SidecarSaveItem[]) => items.map((item) => ('path' in item ? item.path : item.fileId))

/** Opens *Write decisions to sidecars…* from the More menu. */
async function askToWrite(wrapper: AppWrapper) {
	wrapper.findComponent(GridToolbar).vm.$emit('writeSidecars')
	await flushPromises()
}

describe('App: migrating the stored decisions and tags to sidecars', () => {
	// spec: XMP-007.5
	it('asks first, then writes the stored decision over the sidecar\'s and adds the stored tags', async () => {
		const { wrapper, saves, acknowledged } = await openWith({
			lookup: (fileId) => read(fileId === 5 ? RATED_AND_TAGGED : GOOD),
			save: saved,
			decisions: [DECIDED],
			tags: [{ fileId: 4, tags: ['Anna'] }],
			shared: [],
		})
		expect(toolbarProps(wrapper).legacyRows).toBe(true)
		expect(saves).toEqual([])

		await askToWrite(wrapper)
		const asked = dialog(wrapper, 'Write decisions to sidecars')
		expect(asked.text()).toContain('Where a sidecar says otherwise, the stored value wins; stored tags are added to the sidecar\'s.')
		expect(asked.text()).not.toContain('not confirmed')
		expect(asked.text()).toContain('2 photos in A')
		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()

		expect(dialog(wrapper, 'Write decisions to sidecars').exists()).toBe(false)
		expect(saves.map(savedPaths)).toEqual([[6, '/Trip/A/IMG_10.JPG.xmp', 5]])
		const [raw, rendered, tagged] = saves[0]!.map((item) => readXmp(item.bytes))
		const { fileId: _fileId, ...decision } = DECIDED
		expect([sidecarDecision(raw!, true), sidecarDecision(rendered!, true)]).toEqual([decision, decision])
		expect([textOf(tagged!, 'xmp:Rating'), itemsOf(tagged!, 'digiKam:TagsList')]).toEqual(['1', ['Anna', 'Ben']])
		expect(toastText(wrapper)).toBe('Wrote the decisions of 2 photos to sidecars')
		expect(acknowledged).toEqual([[2, 3, 4]])
	})

	// spec: XMP-007.6, XMP-003.13
	it('acknowledges no picture with a failed sidecar, and reports and retries them', async () => {
		const { wrapper, saves, lookups, acknowledged } = await openWith({
			lookup: (fileId) => read(fileId === 5 ? fixtureBytes('refused/unclosed.xmp') : GOOD),
			save: (item) => ('path' in item ? { result: 'notPermitted' } : saved()),
			shared: [],
		})

		await askToWrite(wrapper)
		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()
		expect(saves.map(savedPaths)).toEqual([[6, '/Trip/A/IMG_10.JPG.xmp']])
		expect(toastText(wrapper)).toBe('Could not write 2 of 2 photos. The sidecar is not well-formed XML; honeycomb leaves it as it is. More reasons in Details.·Details')
		expect(acknowledged).toEqual([])

		await wrapper.findComponent(UndoToast).find('button').trigger('click')
		const report = dialog(wrapper, 'Some sidecars could not be written')
		expect(report.text()).toContain('A/IMG_9.JPG.xmp')
		expect(report.text()).toContain('The sidecar is not well-formed XML; honeycomb leaves it as it is')
		expect(report.text()).toContain('A/IMG_10.JPG.xmp')
		expect(report.text()).toContain('You may not change this sidecar or create files in its folder')

		await button(wrapper, 'Retry failed sidecars').trigger('click')
		await flushPromises()
		expect(lookups.at(-1)).toEqual([5])
		expect(saves.at(-1)!.map((item) => ('path' in item ? item.path : item.fileId))).toEqual(['/Trip/A/IMG_10.JPG.xmp'])
		expect(dialog(wrapper, 'Some sidecars could not be written').exists()).toBe(false)
	})

	// spec: XMP-007.11
	it('keeps the dialog open with its progress and without Cancel while it writes', async () => {
		const seen: string[] = []
		let mounted: AppWrapper | null = null
		const { wrapper } = await openWith({
			lookup: () => read(GOOD),
			save: () => {
				seen.push(`${dialog(mounted!, 'Write decisions to sidecars').text()} ${String(button(mounted!, 'Cancel') !== undefined)}`)
				return saved()
			},
			shared: [],
		})
		mounted = wrapper

		await askToWrite(wrapper)
		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()

		expect(seen[0]).toContain('0 of 2 photos sent')
		expect(seen[0]).toMatch(/false$/)
		expect(dialog(wrapper, 'Write decisions to sidecars').exists()).toBe(false)
	})

	// spec: XMP-007.6
	it('acknowledges the saved picture beside a failed one', async () => {
		const { wrapper, acknowledged } = await openWith({
			lookup: () => read(GOOD),
			save: (item) => ('path' in item ? { result: 'notPermitted' } : saved()),
			shared: [],
		})

		await askToWrite(wrapper)
		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()

		expect(acknowledged).toEqual([[4]])
	})

	// spec: XMP-007.7
	it('needs writing on: with it off it says so and writes nothing', async () => {
		const { wrapper, saves } = await openWith({ lookup: () => read(GOOD), save: saved, sidecarWrite: 'off', shared: [] })

		await askToWrite(wrapper)
		const asked = dialog(wrapper, 'Write decisions to sidecars')
		expect(asked.text()).toContain('Turn on Write decisions to XMP sidecars in the settings first.')
		expect(asked.text()).not.toContain('not confirmed')
		expect(button(wrapper, 'Write to sidecars').attributes('disabled')).toBeDefined()
		await button(wrapper, 'Cancel').trigger('click')
		await flushPromises()
		expect(dialog(wrapper, 'Write decisions to sidecars').exists()).toBe(false)
		expect(saves).toEqual([])
	})

	// spec: XMP-007.7
	it('offers nothing in a cull without legacy rows', async () => {
		const { wrapper } = await openWith({ lookup: () => ({ result: 'notFound' }), save: saved, decisions: [], shared: [] })

		expect(toolbarProps(wrapper).legacyRows).toBe(false)
	})

	// spec: XMP-007.13
	it('skips a shared folder not confirmed, and writes it in the next run once confirmed', async () => {
		const { wrapper, saves, acknowledged, savedSettings } = await openWith({ lookup: unratedNine, save: saved, decisions: [stored(1, 'picked'), stored(2, 'picked')] })

		await askToWrite(wrapper)
		expect(dialog(wrapper, 'Write decisions to sidecars').text()).toContain('1 photo in a shared folder you have not confirmed is skipped.')
		expect(button(wrapper, 'Confirm Trip').exists()).toBe(true)
		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()
		expect(saves.map(savedPaths)).toEqual([['/Trip/B/IMG_2.JPG.xmp']])
		expect(acknowledged).toEqual([[1]])
		expect(toastText(wrapper)).toBe('Wrote the decisions of 1 photo to sidecars; skipped 1 photo in a shared folder not confirmed')

		await askToWrite(wrapper)
		await button(wrapper, 'Confirm Trip').trigger('click')
		await flushPromises()
		expect(savedSettings.at(-1)).toMatchObject({ confirmedSharedFolders: [7] })
		expect(dialog(wrapper, 'Write decisions to sidecars').text()).not.toContain('not confirmed')
		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()
		expect(saves.slice(1).flatMap(savedPaths)).toEqual(expect.arrayContaining([6, '/Trip/A/IMG_10.JPG.xmp']))
		expect(acknowledged.at(-1)).toEqual([1, 2, 3])
	})

	// spec: XMP-007.13
	it('cannot write when every picture lies in a shared folder not confirmed', async () => {
		const { wrapper, saves } = await openWith({ lookup: unratedNine, save: saved, decisions: [stored(2, 'picked')] })

		await askToWrite(wrapper)
		expect(dialog(wrapper, 'Write decisions to sidecars').text()).toContain('1 photo in a shared folder you have not confirmed is skipped.')
		expect(button(wrapper, 'Write to sidecars').attributes('disabled')).toBeDefined()
		expect(saves).toEqual([])
	})
})
