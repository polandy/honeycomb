// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SidecarSaveAnswer, SidecarSaveItem } from '../../../src/logic/sidecar-sync.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SidecarDialogs from '../../../src/components/SidecarDialogs.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { serializeXmp } from '../../../src/logic/xmp/serialize.ts'
import { useSidecarFlow } from '../../../src/sidecar-flow.ts'
import { listingEntry, pictureOf } from '../logic/listing-entries.ts'
import { CANONICAL_TIME, packetOf } from '../logic/xmp/xmp-builders.ts'
import { DialogStub } from './stubs.ts'

const BYTES = serializeXmp(packetOf({ 'xmp:Rating': '1' }), CANONICAL_TIME)
const PICTURE = pictureOf(listingEntry(1, '/Trip/A/IMG_1.JPG'), listingEntry(2, '/Trip/A/IMG_1.JPG.xmp'))
const rated = () => ({ ...UNDECIDED, rating: 3 })

describe('SidecarDialogs', () => {
	// spec: XMP-003.13
	it('names each failed sidecar with its reason and offers only Close', async () => {
		const saves: SidecarSaveItem[][] = []
		const answer: SidecarSaveAnswer = { result: 'notPermitted' }
		const toasts: { run?: () => void }[] = []
		const flow = useSidecarFlow({
			lookupSidecars: async (fileIds) => fileIds.map(() => ({ result: 'read', bytes: BYTES, etag: 'e', size: BYTES.length, mtime: 1 })),
			lookupXmpCache: async () => [],
			saveXmpCache: async () => undefined,
			lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' })),
			saveSidecars: async (items) => {
				saves.push([...items])
				return items.map(() => answer)
			},
			now: () => CANONICAL_TIME,
		}, () => undefined, (_message, action) => void toasts.push(action?.run === undefined ? {} : { run: action.run }))
		const wrapper = mount(SidecarDialogs, { props: { flow, folderSet: { paths: ['/Trip'], subfolders: true } }, global: { stubs: { NcDialog: DialogStub } } })
		expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

		await flow.sync.write([PICTURE], rated)
		toasts[0]!.run!()
		await flushPromises()

		const report = wrapper.find('[role="dialog"][name="Some sidecars could not be written"]')
		expect(report.text()).toContain('A/IMG_1.JPG.xmp')
		expect(report.text()).toContain('You may not change this sidecar or create files in its folder')

		expect(report.findAll('button').map((button) => button.text())).toEqual(['Close'])
		await report.find('button').trigger('click')
		await flushPromises()

		expect(saves).toHaveLength(1)
		expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
	})
})
