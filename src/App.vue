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
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcContent from '@nextcloud/vue/components/NcContent'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import FilterBar from './components/FilterBar.vue'
import FolderPicker from './components/FolderPicker.vue'
import GridToolbar from './components/GridToolbar.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import { listEntries as apiListEntries, listFolders as apiListFolders, lookupDecisions as apiLookupDecisions, warmPreviews as apiWarmPreviews } from './api.ts'
import { useCull } from './cull.ts'
import { clearFilters } from './logic/picture-filter.ts'

const props = withDefaults(defineProps<{
	listFolders?: (path: string) => Promise<Folder[]>
	listEntries?: ListEntries
	warmPreviews?: (fileIds: readonly number[]) => Promise<void>
	lookupDecisions?: (fileIds: readonly number[]) => Promise<StoredDecision[]>
	storage?: BrowserStorage
}>(), {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	warmPreviews: apiWarmPreviews,
	lookupDecisions: apiLookupDecisions,
	storage: () => () => window.localStorage,
})

const cull = useCull({ warmPreviews: props.warmPreviews, lookupDecisions: props.lookupDecisions }, props.storage)
const { folderSet, pictures, folderPaths, folders, grouped, view, progress, filters, activeFilters, empty, sortOrder, filtersOpen, pickerOpen, groupByFolder, tileSize } = cull
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
					@changeFolders="pickerOpen = true"
					@update:tileSize="cull.setTileSize"
					@update:groupByFolder="groupByFolder = $event"
					@update:scope="cull.setScope"
					@update:filtersOpen="filtersOpen = $event"
					@update:sortOrder="sortOrder = $event" />
				<FilterBar
					v-if="filtersOpen"
					:filters="filters"
					:folders="folderPaths"
					:folderSet="folderSet"
					:shown="view.length"
					:total="pictures.length"
					@update:filters="filters = $event" />
				<PhotoGrid
					v-if="view.length > 0"
					class="honeycomb__grid"
					:pictures="view"
					:folderSet="folderSet"
					:groupByFolder="grouped"
					:tileSize="tileSize"
					@update:tileSize="cull.setTileSize" />
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
