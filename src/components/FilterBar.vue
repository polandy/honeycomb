<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { Filters } from '../logic/picture-filter.ts'
import type { Tag } from '../logic/tag.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import RatingFilter from './RatingFilter.vue'
import TagFilter from './TagFilter.vue'
import { COLOUR_LABEL_SWATCHES, colourLabelName } from '../cull/colour-labels.ts'
import { folderLabel } from '../logic/cull.ts'
import { COLOUR_LABELS } from '../logic/decision.ts'
import { activeFilterCount, DEFAULT_FILTERS, toggleChip } from '../logic/picture-filter.ts'
import { formatNumber } from '../shared/l10n.ts'
import { tip } from '../shared/tooltip.ts'

const props = defineProps<{
	filters: Filters
	/** The folders of the cull's pictures, in name order. */
	folders: readonly string[]
	folderSet: FolderSet
	shown: number
	total: number
	/** The tags the tag filter offers. */
	known: readonly Tag[]
}>()

const emit = defineEmits<{
	'update:filters': [filters: Filters]
}>()

/** The filter groups that select several chips by value. */
type ChipGroup = 'colourLabels' | 'flags' | 'pairings' | 'keepRaw' | 'folders' | 'hints'

const textGroups = computed(() => {
	const groups: { group: ChipGroup, label: string, chips: { value: string, label: string }[] }[] = [
		{ group: 'flags', label: t('honeycomb', 'Flag'), chips: [
			{ value: 'picked', label: t('honeycomb', 'Picked') },
			{ value: 'rejected', label: t('honeycomb', 'Rejected') },
			{ value: 'unflagged', label: t('honeycomb', 'Unflagged') },
		] },
		{ group: 'pairings', label: t('honeycomb', 'Pairing'), chips: [
			{ value: 'pair', label: t('honeycomb', 'Pairs') },
			{ value: 'rendered-only', label: t('honeycomb', 'JPEG only') },
			{ value: 'raw-only', label: t('honeycomb', 'RAW only') },
		] },
		{ group: 'keepRaw', label: t('honeycomb', 'Keep RAW'), chips: [
			{ value: 'marked', label: t('honeycomb', 'Marked') },
			{ value: 'not-marked', label: t('honeycomb', 'Not marked') },
		] },
		{ group: 'hints', label: t('honeycomb', 'Hints'), chips: [
			{ value: 'shake-risk', label: t('honeycomb', 'Shake risk') },
		] },
	]
	if (props.folders.length > 1) {
		const chips = props.folders.map((folder) => ({ value: folder, label: folderLabel(folder, props.folderSet) }))
		groups.push({ group: 'folders', label: t('honeycomb', 'Folder'), chips })
	}
	return groups
})

/** Emits the filters with the changes applied. */
function update(changes: Partial<Filters>) {
	emit('update:filters', { ...props.filters, ...changes })
}

/** Whether the chip of the group is pressed. */
function pressed(group: ChipGroup, value: string): boolean {
	return (props.filters[group] as ReadonlySet<string>).has(value)
}

/** Switches the chip of the group. */
function toggle(group: ChipGroup, value: string) {
	update({ [group]: toggleChip(props.filters[group] as ReadonlySet<string>, value) })
}
</script>

<template>
	<div class="filter-bar">
		<RatingFilter :rating="props.filters.rating" :comparison="props.filters.comparison" @update="update" />
		<div class="filter-bar__group" role="group" :aria-label="t('honeycomb', 'Colour')">
			<span class="filter-bar__label" aria-hidden="true">{{ t('honeycomb', 'Colour') }}</span>
			<div class="filter-bar__chips">
				<button
					v-for="label in COLOUR_LABELS"
					:key="label"
					type="button"
					class="filter-bar__chip filter-bar__swatch"
					:aria-label="colourLabelName(label)"
					v-bind="tip(colourLabelName(label))"
					:aria-pressed="pressed('colourLabels', label)"
					@click="toggle('colourLabels', label)">
					<span class="filter-bar__dot" :style="{ background: COLOUR_LABEL_SWATCHES[label] }" />
				</button>
			</div>
		</div>
		<div
			v-for="group in textGroups"
			:key="group.group"
			class="filter-bar__group"
			role="group"
			:aria-label="group.label">
			<span class="filter-bar__label" aria-hidden="true">{{ group.label }}</span>
			<div class="filter-bar__chips">
				<button
					v-for="chip in group.chips"
					:key="chip.value"
					type="button"
					class="filter-bar__chip"
					:aria-pressed="pressed(group.group, chip.value)"
					@click="toggle(group.group, chip.value)">
					{{ chip.label }}
				</button>
			</div>
		</div>
		<TagFilter :tags="props.filters.tags" :known="props.known" @update:tags="update({ tags: $event })" />
		<div class="filter-bar__end">
			<span class="filter-bar__hint">{{ t('honeycomb', 'Within a group: any. Across groups: all.') }}</span>
			<span class="filter-bar__count">
				{{ t('honeycomb', '{shown} of {total}', { shown: formatNumber(props.shown), total: formatNumber(props.total) }) }}
			</span>
			<NcButton :disabled="activeFilterCount(props.filters) === 0" @click="emit('update:filters', DEFAULT_FILTERS)">
				{{ t('honeycomb', 'Clear filters') }}
			</NcButton>
		</div>
	</div>
</template>

<style scoped src="./filter-bar.css" />
