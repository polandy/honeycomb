<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { Filters, RatingComparison } from '../logic/picture-filter.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import { COLOUR_LABEL_SWATCHES, colourLabelName } from '../colour-labels.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { COLOUR_LABELS } from '../logic/decision.ts'
import { activeFilterCount, clearFilters, nextComparison, toggleChip } from '../logic/picture-filter.ts'

const props = defineProps<{
	filters: Filters
	/** The folders of the cull's pictures, in name order. */
	folders: readonly string[]
	folderSet: FolderSet
	shown: number
	total: number
}>()

const emit = defineEmits<{
	'update:filters': [filters: Filters]
}>()

/** The filter groups that select several chips by value. */
type ChipGroup = 'colourLabels' | 'flags' | 'pairings' | 'keepRaw' | 'folders'

const STARS = [0, 1, 2, 3, 4, 5]

const COMPARISONS: Record<RatingComparison, { symbol: string, name: () => string, stars: (count: number) => string }> = {
	'at-least': {
		symbol: '≥',
		name: () => t('honeycomb', 'At least'),
		stars: (count) => n('honeycomb', 'At least {count} star', 'At least {count} stars', count, { count: formatNumber(count) }),
	},
	'at-most': {
		symbol: '≤',
		name: () => t('honeycomb', 'At most'),
		stars: (count) => n('honeycomb', 'At most {count} star', 'At most {count} stars', count, { count: formatNumber(count) }),
	},
	exactly: {
		symbol: '=',
		name: () => t('honeycomb', 'Exactly'),
		stars: (count) => n('honeycomb', 'Exactly {count} star', 'Exactly {count} stars', count, { count: formatNumber(count) }),
	},
}

const comparison = computed(() => COMPARISONS[props.filters.comparison])
const comparisonLabel = computed(() => (props.filters.rating === null
	? t('honeycomb', 'Rating comparison: pick a star count first')
	: t('honeycomb', 'Rating comparison: {now}. Tap for: {next}', {
			now: comparison.value.name(),
			next: COMPARISONS[nextComparison(props.filters.comparison)].name(),
		}, undefined, PLAIN_TEXT)))

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

/** Sets the rating filter; the pressed star chip, like *Any*, turns it off. */
function setRating(rating: number | null) {
	update({ rating: rating === props.filters.rating ? null : rating })
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
		<div class="filter-bar__group" role="group" :aria-label="t('honeycomb', 'Rating')">
			<span class="filter-bar__label" aria-hidden="true">{{ t('honeycomb', 'Rating') }}</span>
			<div class="filter-bar__chips">
				<button
					type="button"
					class="filter-bar__chip filter-bar__comparison"
					:aria-label="comparisonLabel"
					:disabled="props.filters.rating === null"
					@click="update({ comparison: nextComparison(props.filters.comparison) })">
					{{ comparison.symbol }}
				</button>
				<button
					type="button"
					class="filter-bar__chip"
					:aria-pressed="props.filters.rating === null"
					@click="update({ rating: null })">
					{{ t('honeycomb', 'Any') }}
				</button>
				<button
					v-for="count in STARS"
					:key="count"
					type="button"
					class="filter-bar__chip filter-bar__star"
					:aria-label="comparison.stars(count)"
					:aria-pressed="props.filters.rating === count"
					@click="setRating(count)">
					{{ `${formatNumber(count)}★` }}
				</button>
			</div>
		</div>
		<div class="filter-bar__group" role="group" :aria-label="t('honeycomb', 'Colour')">
			<span class="filter-bar__label" aria-hidden="true">{{ t('honeycomb', 'Colour') }}</span>
			<div class="filter-bar__chips">
				<button
					v-for="label in COLOUR_LABELS"
					:key="label"
					type="button"
					class="filter-bar__chip filter-bar__swatch"
					:aria-label="colourLabelName(label)"
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
		<div class="filter-bar__end">
			<span class="filter-bar__hint">{{ t('honeycomb', 'Within a group: any. Across groups: all.') }}</span>
			<span class="filter-bar__count">
				{{ t('honeycomb', '{shown} of {total}', { shown: formatNumber(props.shown), total: formatNumber(props.total) }) }}
			</span>
			<NcButton :disabled="activeFilterCount(props.filters) === 0" @click="emit('update:filters', clearFilters(props.filters))">
				{{ t('honeycomb', 'Clear filters') }}
			</NcButton>
		</div>
	</div>
</template>

<style scoped>
.filter-bar {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	gap: calc(1.5 * var(--default-grid-baseline)) calc(4.5 * var(--default-grid-baseline));
	margin: calc(2 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline)) calc(1.5 * var(--default-grid-baseline));
	padding: calc(2 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-container);
	background: var(--color-main-background);
}

.filter-bar__group {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.filter-bar__label {
	color: var(--color-text-maxcontrast);
	font-size: 12px;
	font-weight: bold;
	letter-spacing: .4px;
	text-transform: uppercase;
}

.filter-bar__chips {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline);
}

.filter-bar__chip {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 34px;
	min-height: 34px;
	padding: 0 calc(3 * var(--default-grid-baseline));
	border: 1px solid var(--color-border-maxcontrast);
	border-radius: 17px;
	background: var(--color-background-hover);
	color: var(--color-main-text);
	cursor: pointer;
}

.filter-bar__chip[aria-pressed="true"] {
	border-color: var(--color-primary-element);
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-weight: bold;
}

.filter-bar__chip:disabled {
	opacity: .5;
	cursor: default;
}

.filter-bar__chip:focus-visible {
	outline: 2px solid var(--color-primary-element);
	outline-offset: 2px;
}

.filter-bar__swatch,
.filter-bar__swatch[aria-pressed="true"] {
	padding: 0;
	border-color: transparent;
	background: transparent;
}

.filter-bar__swatch[aria-pressed="true"] {
	box-shadow: inset 0 0 0 3px var(--color-primary-element);
}

.filter-bar__dot {
	width: 22px;
	height: 22px;
	border: 2px solid var(--color-border-maxcontrast);
	border-radius: 50%;
}

.filter-bar__end {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	align-self: flex-end;
	gap: calc(2 * var(--default-grid-baseline));
	margin-left: auto;
}

.filter-bar__hint {
	color: var(--color-text-maxcontrast);
}

.filter-bar__count {
	font-weight: bold;
	font-variant-numeric: tabular-nums;
}

@media (pointer: coarse) {
	.filter-bar__chip {
		min-width: 44px;
		min-height: 44px;
		border-radius: 22px;
	}
}
</style>
