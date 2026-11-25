<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderFilter, FolderSort } from '../logic/folder-list.ts'

import { t } from '@nextcloud/l10n'
import { filterLabel, sortLabel } from '../folders/folders-text.ts'
import { formatNumber } from '../shared/l10n.ts'

const filter = defineModel<FolderFilter>('filter', { required: true })

const sort = defineModel<FolderSort>('sort', { required: true })

const props = defineProps<{
	/** How many rows each filter keeps. */
	counts: Record<FolderFilter, number>
}>()

const FILTERS: readonly FolderFilter[] = ['all', 'suggested', 'new']
const SORTS: readonly FolderSort[] = ['suggested', 'undecided', 'largest', 'oldest', 'newest', 'name']
</script>

<template>
	<div class="folder-filters">
		<div class="filter-bar__group" role="group" :aria-label="t('honeycomb', 'Filter')">
			<span class="filter-bar__label" aria-hidden="true">{{ t('honeycomb', 'Filter') }}</span>
			<div class="filter-bar__chips">
				<button
					v-for="each in FILTERS"
					:key="each"
					type="button"
					class="filter-bar__chip"
					:aria-pressed="filter === each"
					@click="filter = each">
					{{ filterLabel(each) }}
					<span class="folder-filters__count" translate="no">{{ formatNumber(props.counts[each]) }}</span>
				</button>
			</div>
		</div>
		<label v-if="filter !== 'all'" class="folder-filters__sort">
			<span>{{ t('honeycomb', 'Sort') }}</span>
			<select v-model="sort">
				<option v-for="each in SORTS" :key="each" :value="each">{{ sortLabel(each) }}</option>
			</select>
		</label>
	</div>
</template>

<style scoped src="./filter-bar.css" />

<style scoped>
.folder-filters {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline)) calc(4 * var(--default-grid-baseline));
}

.folder-filters__count {
	margin-inline-start: var(--default-grid-baseline);
	color: var(--color-text-maxcontrast);
	font-variant-numeric: tabular-nums;
}

.folder-filters__sort {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	margin-inline-start: auto;
	color: var(--color-text-maxcontrast);
}

.folder-filters__sort select {
	min-height: var(--default-clickable-area);
	margin: 0;
}
</style>
