<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from './api.ts'
import type { BrowserStorage } from './browser-storage.ts'
import type { ListEntries } from './folder-count.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { StoredDecision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Schedule } from './logic/long-press.ts'
import type { Picture } from './logic/pairing.ts'

import { t } from '@nextcloud/l10n'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
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
import PhotoLoupe from './components/PhotoLoupe.vue'
import ShortcutSheet from './components/ShortcutSheet.vue'
import UndoToast from './components/UndoToast.vue'
import { listEntries as apiListEntries, listFolders as apiListFolders, lookupDecisions as apiLookupDecisions, saveDecisions as apiSaveDecisions, warmPreviews as apiWarmPreviews } from './api.ts'
import { readStored } from './browser-storage.ts'
import { useCull } from './cull.ts'
import { changeText, redoneText, undoneText } from './decision-text.ts'
import { toggleBrowserFullscreen } from './fullscreen.ts'
import { gridHotkeys } from './grid-hotkeys.ts'
import { useHotkeys, VI_KEYS_KEY } from './hotkeys.ts'
import { clearFilters } from './logic/picture-filter.ts'
import { useSelectionMode } from './selection-mode.ts'
import { browserSchedule } from './tile-selection.ts'
import { useToast } from './toast.ts'

const props = withDefaults(defineProps<{
	listFolders?: (path: string) => Promise<Folder[]>
	listEntries?: ListEntries
	warmPreviews?: (fileIds: readonly number[]) => Promise<void>
	lookupDecisions?: (fileIds: readonly number[]) => Promise<StoredDecision[]>
	saveDecisions?: (decisions: readonly StoredDecision[]) => Promise<void>
	storage?: BrowserStorage
	schedule?: Schedule
	toggleFullscreen?: (element: HTMLElement) => void
}>(), {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	warmPreviews: apiWarmPreviews,
	lookupDecisions: apiLookupDecisions,
	saveDecisions: apiSaveDecisions,
	storage: () => () => window.localStorage,
	schedule: browserSchedule,
	toggleFullscreen: toggleBrowserFullscreen,
})

const cull = useCull({ warmPreviews: props.warmPreviews, lookupDecisions: props.lookupDecisions, saveDecisions: props.saveDecisions }, props.storage)
const { folderSet, pictures, folderPaths, folders, grouped, view, progress, filters, activeFilters, empty, sortOrder, filtersOpen, pickerOpen, groupByFolder, tileSize, saveFailed } = cull
const loupe = ref<{ pictures: readonly Picture<ListingEntry>[], index: number } | null>(null)
const grid = useTemplateRef<InstanceType<typeof PhotoGrid>>('grid')
const loupeView = useTemplateRef<InstanceType<typeof PhotoLoupe>>('loupeView')
const filterBar = useTemplateRef<InstanceType<typeof FilterBar>>('filterBar')
const headerShown = ref(true)
const shortcutsOpen = ref(false)
const selection = useSelectionMode(() => view.value, pictures)
const { selecting, selected } = selection
const common = computed(() => cull.common(selected.value))
const toast = useToast(props.schedule)

/** Decides the pictures and says what changed, with Undo. */
function decide(intent: DecisionIntent, chosen: readonly Picture<ListingEntry>[]) {
	const entry = cull.decide(intent, chosen)
	if (entry !== null) {
		toast.show(changeText(entry), { label: t('honeycomb', 'Undo'), run: undo })
	}
}

/** Takes back the latest decision and says so. */
function undo() {
	const entry = cull.undo()
	if (entry !== null) {
		toast.show(undoneText(entry))
	}
}

/** Puts back the latest undone decision and says so. */
function redo() {
	const entry = cull.redo()
	if (entry !== null) {
		toast.show(redoneText(entry))
	}
}

const gridKeys = gridHotkeys({
	grid: () => grid.value,
	view: () => view.value,
	selection,
	common: cull.common,
	decide,
	toggleFiltersOff: cull.toggleFiltersOff,
	openLoupe: (index) => {
		loupe.value = { pictures: view.value, index }
	},
	headerShown,
	filtersOpen,
	filterBar: () => filterBar.value?.$el,
	toggleFullscreen: () => props.toggleFullscreen(document.documentElement),
})

/** Opens or closes the shortcut sheet. */
function toggleShortcuts() {
	shortcutsOpen.value = !shortcutsOpen.value
}

useHotkeys(() => {
	if (pickerOpen.value) {
		return null
	}
	if (shortcutsOpen.value || folderSet.value === null) {
		return { shortcuts: toggleShortcuts }
	}
	return { undo, redo, shortcuts: toggleShortcuts, ...(loupe.value === null ? gridKeys : loupeView.value?.hotkeys) }
}, () => readStored(props.storage, VI_KEYS_KEY) === 'true')

/** Closes the loupe and focuses its last picture in the grid. */
async function closeLoupe() {
	const { index } = loupe.value!
	loupe.value = null
	await nextTick()
	await grid.value?.reveal(index)
}
</script>

<template>
	<NcContent appName="honeycomb">
		<NcAppContent class="honeycomb">
			<template v-if="folderSet !== null">
				<GridToolbar
					v-if="headerShown"
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
					v-if="filtersOpen && headerShown"
					ref="filterBar"
					:filters="filters"
					:folders="folderPaths"
					:folderSet="folderSet"
					:shown="view.length"
					:total="pictures.length"
					@update:filters="filters = $event" />
				<NcNoteCard v-if="saveFailed" type="error" :text="t('honeycomb', 'Could not save the change; the photos show what is stored.')" />
				<PhotoGrid
					v-if="view.length > 0"
					ref="grid"
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
					@update:selection="selection.select"
					@open="loupe = { pictures: view, index: $event }" />
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
					@decide="decide($event, selected)" />
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
			<Teleport to="body">
				<PhotoLoupe
					v-if="loupe !== null && folderSet !== null"
					ref="loupeView"
					v-model:index="loupe.index"
					:pictures="loupe.pictures"
					:folderSet="folderSet"
					:decisionOf="cull.decisionOf"
					:storage="props.storage"
					@decide="(intent, picture) => decide(intent, [picture])"
					@toast="toast.show($event.message, $event.action)"
					@close="closeLoupe" />
				<ShortcutSheet
					v-if="shortcutsOpen"
					:container="loupe !== null ? '.photo-loupe' : undefined"
					@close="shortcutsOpen = false" />
				<UndoToast
					v-if="toast.current.value !== null"
					:toast="toast.current.value"
					:top="loupe !== null"
					@act="toast.act" />
			</Teleport>
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
