// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'
import type { SourceKind } from './immich-source.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ImmichOnlyOffer } from './logic/immich-only.ts'

import { ref, watch } from 'vue'
import { startSource } from './logic/immich-only.ts'

/** The seams *I only use Immich* works through. */
export interface ImmichOnlyContext {
	/** The stored choice, null while the settings are read. */
	readonly stored: () => boolean | null
	readonly offer: () => ImmichOnlyOffer | null
	readonly store: (immichOnly: boolean) => void
	readonly chooseSource: (kind: SourceKind) => void
	readonly folderSet: () => FolderSet | null
	/** Whether no folder set is open or being listed. */
	readonly idle: () => boolean
	readonly pickerOpen: Ref<boolean>
}

/** *I only use Immich*: the start without the folder picker, the choice and its end with a folder set (IMMICH-001.22 to .25). */
export function useImmichOnly(context: ImmichOnlyContext) {
	/** Whether the start has decided between the folder picker and Immich. */
	const started = ref(false)

	/** Closes the folder picker and shows the Immich source. */
	function openImmich() {
		context.pickerOpen.value = false
		context.chooseSource('immich')
	}

	watch(() => startSource(context.stored(), context.offer()), (source) => {
		if (started.value || source === 'undecided') {
			return
		}
		started.value = true
		if (source === 'immich' && context.idle()) {
			openImmich()
		}
	}, { immediate: true })
	watch(context.folderSet, (set) => set !== null && context.stored() === true && context.store(false))

	/** Stores the choice and opens the Immich source. */
	function choose() {
		context.store(true)
		openImmich()
	}

	return { started, choose }
}
