<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcPopover from '@nextcloud/vue/components/NcPopover'
import AppIcon from './AppIcon.vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { MAX_TILE_SIZE, MIN_TILE_SIZE } from '../logic/tile-size.ts'

const props = defineProps<{
	folderSet: FolderSet
	/** How many folders the cull's pictures are in. */
	folders: number
	tileSize: number
	groupByFolder: boolean
}>()

const emit = defineEmits<{
	changeFolders: []
	'update:tileSize': [size: number]
	'update:groupByFolder': [group: boolean]
}>()

const setName = computed(() => {
	const { paths, subfolders } = props.folderSet
	if (paths.length === 1) {
		const name = paths[0]!.split('/').pop()!
		return subfolders ? t('honeycomb', '{name} + subfolders', { name }, undefined, PLAIN_TEXT) : name
	}
	const count = formatNumber(paths.length)
	return subfolders
		? n('honeycomb', '{count} folder + subfolders', '{count} folders + subfolders', paths.length, { count })
		: n('honeycomb', '{count} folder', '{count} folders', paths.length, { count })
})
</script>

<template>
	<div class="grid-toolbar">
		<nav class="grid-toolbar__crumbs" :aria-label="t('honeycomb', 'Breadcrumb')">
			<NcButton variant="tertiary" :ariaLabel="t('honeycomb', 'Change folders')" @click="emit('changeFolders')">
				<template #icon>
					<AppIcon name="home" />
				</template>
			</NcButton>
			<span class="grid-toolbar__separator" aria-hidden="true">/</span>
			<button
				type="button"
				class="grid-toolbar__set"
				:aria-label="t('honeycomb', 'Change folders: {paths}', { paths: props.folderSet.paths.join(', ') }, undefined, PLAIN_TEXT)"
				@click="emit('changeFolders')">
				{{ setName }}
			</button>
		</nav>
		<NcPopover>
			<template #trigger>
				<NcButton variant="tertiary" :ariaLabel="t('honeycomb', 'More')">
					<template #icon>
						<AppIcon name="more" />
					</template>
				</NcButton>
			</template>
			<div class="grid-toolbar__menu">
				<label class="grid-toolbar__size">
					<span>{{ t('honeycomb', 'Thumbnail size') }}</span>
					<input
						type="range"
						:min="MIN_TILE_SIZE"
						:max="MAX_TILE_SIZE"
						step="1"
						:value="Math.round(props.tileSize)"
						:aria-label="t('honeycomb', 'Thumbnail size')"
						@input="emit('update:tileSize', Number(($event.target as HTMLInputElement).value))">
				</label>
				<NcCheckboxRadioSwitch
					v-if="props.folders > 1"
					:modelValue="props.groupByFolder"
					@update:modelValue="emit('update:groupByFolder', $event)">
					{{ t('honeycomb', 'Group by folder') }}
				</NcCheckboxRadioSwitch>
			</div>
		</NcPopover>
	</div>
</template>

<style scoped>
.grid-toolbar {
	display: flex;
	align-items: center;
	gap: var(--default-grid-baseline);
	padding: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
}

.grid-toolbar__crumbs {
	display: flex;
	flex: 1;
	align-items: center;
	gap: var(--default-grid-baseline);
	min-width: 0;
}

.grid-toolbar__separator {
	color: var(--color-text-maxcontrast);
}

.grid-toolbar__set {
	overflow: hidden;
	min-height: 34px;
	padding: 0 calc(2 * var(--default-grid-baseline));
	border: none;
	border-radius: var(--border-radius-element);
	background: none;
	color: var(--color-main-text);
	font-weight: bold;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: pointer;
}

.grid-toolbar__set:focus-visible {
	outline: 2px solid var(--color-primary-element);
}

.grid-toolbar__menu {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(2 * var(--default-grid-baseline));
}

.grid-toolbar__size {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
}

.grid-toolbar__size input {
	min-height: 34px;
	accent-color: var(--color-primary-element);
}

@media (pointer: coarse) {
	.grid-toolbar__set,
	.grid-toolbar__size input {
		min-height: 44px;
	}
}
</style>
