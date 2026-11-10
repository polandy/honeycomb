<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from './api.ts'
import type { BrowserStorage } from './cull.ts'
import type { ListEntries } from './folder-count.ts'

import { t } from '@nextcloud/l10n'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcContent from '@nextcloud/vue/components/NcContent'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import FolderPicker from './components/FolderPicker.vue'
import GridToolbar from './components/GridToolbar.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import { listEntries as apiListEntries, listFolders as apiListFolders, warmPreviews as apiWarmPreviews } from './api.ts'
import { useCull } from './cull.ts'

const props = withDefaults(defineProps<{
	listFolders?: (path: string) => Promise<Folder[]>
	listEntries?: ListEntries
	warmPreviews?: (fileIds: readonly number[]) => Promise<void>
	storage?: BrowserStorage
}>(), {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	warmPreviews: apiWarmPreviews,
	storage: () => () => window.localStorage,
})

const cull = useCull(props.warmPreviews, props.storage)
const { folderSet, pictures, folders, pickerOpen, groupByFolder, tileSize } = cull
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
					@changeFolders="pickerOpen = true"
					@update:tileSize="cull.setTileSize"
					@update:groupByFolder="groupByFolder = $event" />
				<PhotoGrid
					class="honeycomb__grid"
					:pictures="pictures"
					:folderSet="folderSet"
					:groupByFolder="groupByFolder && folders > 1"
					:tileSize="tileSize"
					@update:tileSize="cull.setTileSize" />
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
