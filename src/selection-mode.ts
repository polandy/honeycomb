// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { WatchSource } from 'vue'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { Selection } from './logic/selection.ts'

import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { imageMember } from './logic/image-tiers.ts'
import { keepShown, NO_SELECTION, selectAll, selectionKey } from './logic/selection.ts'

/** Whether a key goes to a text field rather than to the grid. */
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/** Selection mode over the shown pictures; it ends when `reset` changes and the keys act while `active`. */
export function useSelectionMode(view: () => readonly Picture<ListingEntry>[], reset: WatchSource, active: () => boolean) {
	const selecting = ref(false)
	const selection = shallowRef<Selection>(NO_SELECTION)
	const order = computed(() => view().map((picture) => imageMember(picture).fileId))
	const selected = computed(() => view().filter((picture) => selection.value.ids.has(imageMember(picture).fileId)))

	/** Keeps the selection to the pictures the view shows, so a change never reaches a hidden one. */
	function select(next: Selection) {
		selection.value = keepShown(next, order.value)
	}

	/** Enters or leaves selection mode; leaving selects nothing. */
	function setSelecting(on: boolean) {
		selecting.value = on
		if (!on) {
			selection.value = NO_SELECTION
		}
	}

	const selectAllShown = () => {
		selecting.value = true
		selection.value = selectAll(selection.value, order.value)
	}
	const selectNone = () => select(NO_SELECTION)

	/** Ctrl+A, Ctrl+D and Escape (`docs/plan.md` Keyboard shortcuts). */
	function onKeydown(event: KeyboardEvent) {
		const action = active() && !typing(event.target) ? selectionKey(event) : null
		if (action === 'select-all') {
			event.preventDefault()
			selectAllShown()
		} else if (action === 'select-none' && selecting.value) {
			event.preventDefault()
			selectNone()
		} else if (action === 'leave' && selecting.value) {
			setSelecting(false)
		}
	}

	watch(order, () => select(selection.value))
	watch(reset, () => setSelecting(false))
	onMounted(() => window.addEventListener('keydown', onKeydown))
	onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

	return { selecting, selection, selected, select, setSelecting, selectAll: selectAllShown, selectNone }
}
