<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { SortOrder } from '../logic/picture-order.ts'

import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import GridMoreGroup from './GridMoreGroup.vue'
import GridViewOptions from './GridViewOptions.vue'
import { keyCap } from '../shared/hotkeys.ts'
import { formatNumber } from '../shared/l10n.ts'
import { tip } from '../shared/tooltip.ts'

defineProps<{
	/** How many folders the cull's pictures are in. */
	folders: number
	tileSize: number
	groupByFolder: boolean
	fileNames: boolean
	sortOrder: SortOrder
	/** How many pictures of the view would lose their RAW to *Remove RAWs*. */
	rawRemovable: number
	/** How many rateable pictures *Clear picks/rejects* resets. */
	clearable: number
	/** How many XMP files *Write picks/rejects to XMP* writes. */
	xmpToWrite: number
	/** How many pictures the move item opens the move dialog on. */
	movable: number
	/** How many pictures of the folder set *Move all* opens the move dialog on. */
	allMovable: number
	/** Whether a filter is on, which makes *Move picks* *Move filtered*. */
	moveFiltered: boolean
	/** The base name of the picture *Resume* opens the loupe at, null when there is none. */
	resumeName: string | null
	/** How many pictures are rejected. */
	rejected: number
	/** How many series are left to compare. */
	series: number
	/** How many series *Reduce series to the sharpest* decides. */
	reducible: number
}>()

const emit = defineEmits<{
	'update:tileSize': [size: number]
	'update:groupByFolder': [group: boolean]
	'update:fileNames': [shown: boolean]
	'update:sortOrder': [order: SortOrder]
	removeRaws: []
	clearFlags: []
	writeXmp: []
	move: []
	moveAll: []
	resume: []
	reviewRejects: []
	compareSeries: []
	reduceSeries: []
	openSettings: []
}>()
</script>

<template>
	<div class="grid-more-menu">
		<GridViewOptions
			:folders="folders"
			:tileSize="tileSize"
			:groupByFolder="groupByFolder"
			:fileNames="fileNames"
			:sortOrder="sortOrder"
			@update:tileSize="emit('update:tileSize', $event)"
			@update:groupByFolder="emit('update:groupByFolder', $event)"
			@update:fileNames="emit('update:fileNames', $event)"
			@update:sortOrder="emit('update:sortOrder', $event)" />
		<hr class="grid-more-menu__separator">
		<GridMoreGroup :heading="t('honeycomb', 'Cull')">
			<NcButton
				v-if="resumeName !== null"
				variant="tertiary"
				alignment="start"
				wide
				@click="emit('resume')">
				<template #icon>
					<AppIcon name="folder" />
				</template>
				{{ t('honeycomb', 'Resume at {name}', { name: resumeName }) }}
			</NcButton>
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				:disabled="rejected === 0"
				@click="emit('reviewRejects')">
				<template #icon>
					<AppIcon name="review" />
				</template>
				{{ t('honeycomb', 'Review rejects') }}
				<span class="grid-more-menu__count">{{ formatNumber(rejected) }}</span>
				<kbd class="grid-more-menu__key" translate="no">{{ keyCap('review-rejects') }}</kbd>
			</NcButton>
			<NcButton
				class="grid-more-menu__narrow"
				variant="tertiary"
				alignment="start"
				wide
				:disabled="series === 0"
				@click="emit('compareSeries')">
				<template #icon>
					<AppIcon name="compare" />
				</template>
				{{ t('honeycomb', 'Compare series') }}
				<span class="grid-more-menu__count">{{ formatNumber(series) }}</span>
			</NcButton>
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				:disabled="reducible === 0"
				@click="emit('reduceSeries')">
				<template #icon>
					<AppIcon name="sharp" />
				</template>
				{{ t('honeycomb', 'Reduce series to the sharpest…') }}
				<span class="grid-more-menu__count">{{ formatNumber(reducible) }}</span>
			</NcButton>
		</GridMoreGroup>
		<hr class="grid-more-menu__separator">
		<GridMoreGroup :heading="t('honeycomb', 'Files')">
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				:disabled="rawRemovable === 0"
				@click="emit('removeRaws')">
				<template #icon>
					<AppIcon name="trash" />
				</template>
				{{ t('honeycomb', 'Remove RAWs…') }}
				<span class="grid-more-menu__count">{{ formatNumber(rawRemovable) }}</span>
			</NcButton>
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				:disabled="movable === 0"
				@click="emit('move')">
				<template #icon>
					<AppIcon name="folder" />
				</template>
				{{ moveFiltered ? t('honeycomb', 'Move filtered…') : t('honeycomb', 'Move picks…') }}
				<span class="grid-more-menu__count">{{ formatNumber(movable) }}</span>
			</NcButton>
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				:disabled="allMovable === 0"
				@click="emit('moveAll')">
				<template #icon>
					<AppIcon name="folder" />
				</template>
				{{ t('honeycomb', 'Move all…') }}
				<span class="grid-more-menu__count">{{ formatNumber(allMovable) }}</span>
			</NcButton>
		</GridMoreGroup>
		<hr class="grid-more-menu__separator">
		<GridMoreGroup :heading="t('honeycomb', 'Picks and rejects')">
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				:disabled="clearable === 0"
				@click="emit('clearFlags')">
				<template #icon>
					<AppIcon name="undo" />
				</template>
				{{ t('honeycomb', 'Clear picks/rejects') }}
				<span class="grid-more-menu__count">{{ formatNumber(clearable) }}</span>
			</NcButton>
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				:disabled="xmpToWrite === 0"
				v-bind="tip(t('honeycomb', 'Saves your picks, rejects and Keep RAW in the .xmp files next to the photos, so digiKam and darktable show them too.'))"
				@click="emit('writeXmp')">
				<template #icon>
					<AppIcon name="flagPick" />
				</template>
				{{ t('honeycomb', 'Write picks/rejects to XMP') }}
				<span class="grid-more-menu__count">{{ formatNumber(xmpToWrite) }}</span>
			</NcButton>
		</GridMoreGroup>
		<hr class="grid-more-menu__separator">
		<NcButton
			variant="tertiary"
			alignment="start"
			wide
			@click="emit('openSettings')">
			<template #icon>
				<AppIcon name="settings" />
			</template>
			{{ t('honeycomb', 'Settings') }}
		</NcButton>
	</div>
</template>

<style scoped>
.grid-more-menu {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(2 * var(--default-grid-baseline));
	max-height: calc(100dvh - 8 * var(--default-clickable-area));
	overflow-y: auto;
}

.grid-more-menu__count {
	margin-inline-start: calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
}

.grid-more-menu__key {
	margin-inline-start: calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
	font-family: inherit;
}

.grid-more-menu__separator {
	width: 100%;
	margin: 0;
	border: none;
	border-top: 1px solid var(--color-border);
}

/* From 900 px the toolbar shows these itself (GridToolbar). */
@media (min-width: 900px) {
	.grid-more-menu__narrow {
		display: none;
	}
}
</style>
