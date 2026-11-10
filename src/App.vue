<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from './api.ts'
import type { BrowserStorage } from './cull.ts'
import type { ListEntries } from './folder-count.ts'
import type { StoredDecision } from './logic/decision.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcContent from '@nextcloud/vue/components/NcContent'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import ActionBar from './components/ActionBar.vue'
import FilterBar from './components/FilterBar.vue'
import FolderPicker from './components/FolderPicker.vue'
import GridToolbar from './components/GridToolbar.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import { listEntries as apiListEntries, listFolders as apiListFolders, lookupDecisions as apiLookupDecisions, saveDecisions as apiSaveDecisions, warmPreviews as apiWarmPreviews } from './api.ts'
import { useCull } from './cull.ts'
import { clearFilters } from './logic/picture-filter.ts'
import { useSelectionMode } from './selection-mode.ts'

const props = withDefaults(defineProps<{
	listFolders?: (path: string) => Promise<Folder[]>
	listEntries?: ListEntries
	warmPreviews?: (fileIds: readonly number[]) => Promise<void>
	lookupDecisions?: (fileIds: readonly number[]) => Promise<StoredDecision[]>
	saveDecisions?: (decisions: readonly StoredDecision[]) => Promise<void>
	storage?: BrowserStorage
}>(), {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	warmPreviews: apiWarmPreviews,
	lookupDecisions: apiLookupDecisions,
	saveDecisions: apiSaveDecisions,
	storage: () => () => window.localStorage,
})

const cull = useCull({ warmPreviews: props.warmPreviews, lookupDecisions: props.lookupDecisions, saveDecisions: props.saveDecisions }, props.storage)
const { folderSet, pictures, folderPaths, folders, grouped, view, progress, filters, activeFilters, empty, sortOrder, filtersOpen, pickerOpen, groupByFolder, tileSize, saveFailed } = cull
const selection = useSelectionMode(() => view.value, pictures, () => folderSet.value !== null && !pickerOpen.value)
const { selecting, selected } = selection
const common = computed(() => cull.common(selected.value))
</script>

<template>
	<NcContent appName="honeycomb">
		<NcAppContent class="honeycomb">
			<template v-if="folderSet !== null">
				<GridToolbar
					:folderSet="folderSet"
					:folders="folders"
					:tileSize="tileSize"
					:groupByFolder="groupByFolder"
					:scope="filters.scope"
					:scopeLocked="filters.flags.size > 0"
					:decided="progress.decided"
					:total="progress.total"
					:activeFilters="activeFilters"
					:filtersOpen="filtersOpen"
					:sortOrder="sortOrder"
					:selecting="selecting"
					:selected="selected.length"
					@changeFolders="pickerOpen = true"
					@update:tileSize="cull.setTileSize"
					@update:groupByFolder="groupByFolder = $event"
					@update:scope="cull.setScope"
					@update:filtersOpen="filtersOpen = $event"
					@update:sortOrder="sortOrder = $event"
					@update:selecting="selection.setSelecting"
					@selectAll="selection.selectAll"
					@selectNone="selection.selectNone" />
				<FilterBar
					v-if="filtersOpen"
					:filters="filters"
					:folders="folderPaths"
					:folderSet="folderSet"
					:shown="view.length"
					:total="pictures.length"
					@update:filters="filters = $event" />
				<NcNoteCard v-if="saveFailed" type="error" :text="t('honeycomb', 'Could not save the change; the photos show what is stored.')" />
				<PhotoGrid
					v-if="view.length > 0"
					class="honeycomb__grid"
					:pictures="view"
					:folderSet="folderSet"
					:groupByFolder="grouped"
					:tileSize="tileSize"
					:selecting="selecting"
					:selection="selection.selection.value"
					:decisionOf="cull.decisionOf"
					@update:tileSize="cull.setTileSize"
					@update:selecting="selection.setSelecting"
					@update:selection="selection.select" />
				<NcEmptyContent v-else-if="empty === 'no-pictures'" :name="t('honeycomb', 'No photos in these folders')" />
				<NcEmptyContent v-else-if="empty === 'no-match'" :name="t('honeycomb', 'Nothing matches these filters')">
					<template #action>
						<NcButton @click="filters = clearFilters(filters)">
							{{ t('honeycomb', 'Clear filters') }}
						</NcButton>
					</template>
				</NcEmptyContent>
				<NcEmptyContent
					v-else
					:name="empty === 'all-decided' ? t('honeycomb', 'Every photo is decided') : t('honeycomb', 'No photos left to cull')">
					<template #action>
						<NcButton @click="cull.setScope('all')">
							{{ t('honeycomb', 'Show all') }}
						</NcButton>
					</template>
				</NcEmptyContent>
				<ActionBar
					v-if="selecting"
					:common="common"
					:disabled="selected.length === 0"
					@decide="cull.decide($event, selected)" />
			</template>
			<NcEmptyContent
				v-else
				:name="t('honeycomb', 'No folder chosen')"
				:description="t('honeycomb', 'Pick a folder to start culling.')">
				<template #action>
					<NcButton variant="primary" @click="pickerOpen = true">
						{{ t('honeycomb', 'Choose a folder…') }}
					</NcButton>
				</template>
			</NcEmptyContent>
			<FolderPicker
				v-if="pickerOpen"
				:current="folderSet"
				:listFolders="props.listFolders"
				:listEntries="props.listEntries"
				@confirm="cull.open"
				@cancel="pickerOpen = false" />
		</NcAppContent>
	</NcContent>
</template>

<style scoped>
.honeycomb {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.honeycomb__grid {
	flex: 1;
}
</style>
