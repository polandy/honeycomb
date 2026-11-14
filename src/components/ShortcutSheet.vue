<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { KeymapGroup } from '../logic/hotkeys.ts'

import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import { isMac } from '../hotkeys.ts'
import { formatCaps, KEYMAP } from '../logic/hotkeys.ts'

const props = defineProps<{
	/** The element the dialog opens in; the loupe's while it is open, as it lies above the page. */
	container?: string | undefined
}>()

const emit = defineEmits<{
	close: []
}>()

const GROUPS: Record<KeymapGroup, string> = {
	flags: t('honeycomb', 'Flags'),
	rating: t('honeycomb', 'Rating, colour label, Keep RAW'),
	views: t('honeycomb', 'Views and photos'),
	filter: t('honeycomb', 'Filter and selection'),
	undo: t('honeycomb', 'Undo, delete and help'),
	vi: t('honeycomb', 'Vi keys (Settings › Keyboard)'),
}

const LABELS: Readonly<Record<string, string>> = {
	pick: t('honeycomb', 'Pick (again: unflag)'),
	reject: t('honeycomb', 'Reject (again: unflag)'),
	unflag: t('honeycomb', 'Unflag'),
	'flag-next': t('honeycomb', 'Pick, reject or unflag and go to the next photo'),
	'auto-advance': t('honeycomb', 'Auto-advance: every decision goes to the next photo'),
	'toggle-pick': t('honeycomb', 'Toggle pick'),
	'flag-buttons': t('honeycomb', 'Show or hide the flag buttons'),
	'pick-rest': t('honeycomb', 'Series compare: pick this, reject the rest'),
	rating: t('honeycomb', 'Set rating'),
	'rating-next': t('honeycomb', 'Set rating and go to the next photo'),
	'star-down': t('honeycomb', 'One star down'),
	'star-up': t('honeycomb', 'One star up'),
	'colour-label': t('honeycomb', 'Label red / yellow / green / blue (toggle)'),
	'keep-raw': t('honeycomb', 'Keep RAW (toggle)'),
	tag: t('honeycomb', 'Tag entry: add or remove tags'),
	arrows: t('honeycomb', 'Grid and series compare: move focus. Loupe: switch photo'),
	'first-last': t('honeycomb', 'First photo, last photo'),
	open: t('honeycomb', 'Open the loupe; series compare: view full screen'),
	grid: t('honeycomb', 'Grid'),
	loupe: t('honeycomb', 'Loupe'),
	compare: t('honeycomb', 'Compare series'),
	zoom: t('honeycomb', 'Loupe: fit / 100 %'),
	'zoom-in': t('honeycomb', 'Zoom in'),
	'zoom-out': t('honeycomb', 'Zoom out'),
	fullscreen: t('honeycomb', 'Fullscreen'),
	header: t('honeycomb', 'Show or hide the header (loupe: the controls)'),
	info: t('honeycomb', 'Show or hide the info panel'),
	close: t('honeycomb', 'Close loupe / dialog / selection'),
	'filter-bar': t('honeycomb', 'Show or hide the filter bar'),
	'filters-off': t('honeycomb', 'Filters off / on'),
	'select-all': t('honeycomb', 'Select all (filtered)'),
	'select-none': t('honeycomb', 'Select none'),
	undo: t('honeycomb', 'Undo'),
	redo: t('honeycomb', 'Redo'),
	delete: t('honeycomb', 'Delete summary for the selection or focused tile'),
	'review-rejects': t('honeycomb', 'Review rejects'),
	move: t('honeycomb', 'Move dialog for the selection or focused tile'),
	shortcuts: t('honeycomb', 'This sheet'),
	'vi-sideways': t('honeycomb', 'Previous photo, next photo'),
	'vi-rows': t('honeycomb', 'Grid and series compare: one row down, one row up. Loupe: next photo, previous photo'),
	'vi-first': t('honeycomb', 'First photo'),
	'vi-last': t('honeycomb', 'Last photo'),
	'vi-filter': t('honeycomb', 'Open the filter bar'),
	'vi-grid': t('honeycomb', 'Back to the grid (g starts g g)'),
}

const mac = isMac()
const sections = (Object.keys(GROUPS) as KeymapGroup[]).map((group) => ({
	group,
	name: GROUPS[group],
	rows: KEYMAP.filter((entry) => entry.group === group).map((entry) => ({
		id: entry.id,
		caps: entry.caps.map((caps) => formatCaps(caps, mac)),
		range: entry.range === true,
		label: LABELS[entry.id],
	})),
}))

/** Closing the dialog by its close button or Escape closes the sheet. */
function onOpen(open: boolean) {
	if (!open) {
		emit('close')
	}
}
</script>

<template>
	<NcDialog
		:name="t('honeycomb', 'Keyboard shortcuts')"
		:container="props.container ?? 'body'"
		size="normal"
		@update:open="onOpen">
		<p class="shortcut-sheet__intro">
			{{ t('honeycomb', 'The Lightroom Classic keys, the same on every screen. They act on the selection or focused tile in the grid, and on the shown photo in the loupe.') }}
		</p>
		<table class="shortcut-sheet__table">
			<tbody v-for="section in sections" :key="section.group">
				<tr>
					<th class="shortcut-sheet__group" scope="rowgroup" colspan="2">
						{{ section.name }}
					</th>
				</tr>
				<tr v-for="row in section.rows" :key="row.id">
					<td class="shortcut-sheet__caps">
						<template v-for="(cap, at) in row.caps" :key="cap">
							<template v-if="at > 0">
								{{ row.range ? ' – ' : ' ' }}
							</template>
							<kbd>{{ cap }}</kbd>
						</template>
					</td>
					<td>{{ row.label }}</td>
				</tr>
			</tbody>
		</table>
		<template #actions>
			<NcButton variant="primary" @click="emit('close')">
				{{ t('honeycomb', 'Close') }}
			</NcButton>
		</template>
	</NcDialog>
</template>

<style scoped>
.shortcut-sheet__intro {
	margin-top: 0;
	color: var(--color-text-maxcontrast);
}

.shortcut-sheet__table {
	border-collapse: collapse;
}

.shortcut-sheet__group {
	padding: 14px 0 4px;
	font-weight: bold;
	text-align: start;
}

.shortcut-sheet__table td {
	padding: 2px 8px 2px 0;
	vertical-align: top;
}

.shortcut-sheet__caps {
	white-space: nowrap;
}

kbd {
	padding: 0 4px;
	border: 1px solid var(--color-border-dark);
	border-radius: var(--border-radius-small, 4px);
	background-color: var(--color-background-hover);
	font-family: inherit;
}
</style>
