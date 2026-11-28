<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { useImmichCull } from '../immich/immich-cull.ts'
import type { useImmichResume } from '../immich/immich-resume.ts'
import type { ImmichWrite } from '../immich/immich-write.ts'
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { Flag } from '../logic/decision.ts'
import type { SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Settings } from '../logic/settings.ts'
import type { ViewStateStore } from '../settings/view-state.ts'
import type { BrowserStorage } from '../shared/browser-storage.ts'
import type { HotkeyHandlers } from '../shared/hotkeys.ts'
import type { ObserveSize } from '../shared/observe-size.ts'
import type { Toast } from '../shared/toast.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import ActionBar from './ActionBar.vue'
import AppIcon from './AppIcon.vue'
import FlagFilter from './FlagFilter.vue'
import ImmichFilterBar from './ImmichFilterBar.vue'
import ImmichWriteDialog from './ImmichWriteDialog.vue'
import PhotoGrid from './PhotoGrid.vue'
import PhotoLoupe from './PhotoLoupe.vue'
import SelectionRow from './SelectionRow.vue'
import { gridCoreHotkeys } from '../grid/grid-hotkeys.ts'
import { useSelectionMode } from '../grid/selection-mode.ts'
import { immichBadges } from '../immich/immich-pills.ts'
import { pageFailedText } from '../immich/immich-text.ts'
import { LOUPE_AHEAD, loupeCounter } from '../logic/immich-paging.ts'
import { keptIndex } from '../logic/loupe-pictures.ts'
import { DECISIONS_ONLY } from '../logic/opened-source.ts'
import { DEFAULT_TILE_SIZE } from '../logic/tile-size.ts'
import { toggleBrowserFullscreen } from '../shared/fullscreen.ts'
import { formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

const props = withDefaults(defineProps<{
	/** The opened connection's cull. */
	cull: ReturnType<typeof useImmichCull>
	/** Saves where the loupe goes and opens it where a resume asks (IMMICH-003.14). */
	resume?: ReturnType<typeof useImmichResume> | undefined
	/** *Write to Immich* on the opened connection; without it the button is not shown (IMMICH-004.25). */
	write?: ImmichWrite | undefined
	settings: Settings
	storage: BrowserStorage
	viewState: ViewStateStore
	tileSize?: number
	observeSize?: ObserveSize | undefined
	toggleFullscreen?: (element: HTMLElement) => void
}>(), { resume: undefined, write: undefined, tileSize: DEFAULT_TILE_SIZE, observeSize: undefined, toggleFullscreen: toggleBrowserFullscreen })

const emit = defineEmits<{
	'update:tileSize': [size: number]
	updateSettings: [patch: Partial<Settings>]
	toast: [toast: Toast]
}>()

const { list, counts, pictures, filters, choices, filtersChanged, connectionId } = props.cull
const loupeIndex = ref<number | null>(null)
const photoLoupe = useTemplateRef<InstanceType<typeof PhotoLoupe>>('photoLoupe')
const photoGrid = useTemplateRef<InstanceType<typeof PhotoGrid>>('photoGrid')
// A new listing ends selection mode, so a step never reaches assets no longer shown (IMMICH-003.28).
const selection = useSelectionMode(() => pictures.value, () => [filters.value, connectionId.value])
const { selecting, selected } = selection

const countText = computed(() => {
	if (counts.value === null) {
		return t('honeycomb', 'Counting…')
	}
	const { matching, total, decided } = counts.value
	const shown = n('honeycomb', '{matching} of {total} photo', '{matching} of {total} photos', total, { matching: formatNumber(matching), total: formatNumber(total) }, PLAIN_TEXT)
	return `${shown} · ${n('honeycomb', '{count} decided', '{count} decided', decided, { count: formatNumber(decided) }, PLAIN_TEXT)}`
})
// The counts say 0, or the listing ended without an entry before they arrived (IMMICH-002.18).
const empty = computed(() => counts.value?.matching === 0 || (list.value.started && list.value.entries.length === 0 && list.value.nextCursor === null && list.value.next === 'idle'))
const counter = computed(() => loupeIndex.value === null ? null : loupeCounter(list.value, loupeIndex.value, counts.value?.matching ?? list.value.entries.length))

// A newer page goes before the shown pictures, so the loupe follows its picture (IMMICH-002.34).
watch(pictures, (now, before) => {
	const shown = loupeIndex.value === null ? -1 : now.indexOf(before[loupeIndex.value]!)
	if (shown >= 0) {
		loupeIndex.value = shown
	}
})
watch(() => props.resume?.loupeAt.value, () => {
	const index = props.resume?.takeLoupeAt() ?? null
	if (index !== null) {
		openLoupe(index)
	}
})

/** Asks the newer photos, or the failed newer page again (IMMICH-002.34). */
function showNewer() {
	if (list.value.previous === 'failed') {
		props.cull.retry()
	} else {
		props.cull.loadPrevious(0)
	}
}

/** Shows the pictures with the chosen flags, from the listing's start (IMMICH-002.11). */
function setFlags(flags: ReadonlySet<Flag>) {
	props.cull.setFilters({ ...filters.value, flags })
}

/** Moves the loupe, loads a page as it nears either loaded end and keeps its asset as the position (IMMICH-002.9, IMMICH-003.14). */
function page(index: number) {
	loupeIndex.value = index
	props.cull.loadNext(index, LOUPE_AHEAD)
	props.cull.loadPrevious(index)
	props.resume?.track(index)
}

/** Opens the loupe and holds the grid's pictures while it shows, so a decision moves no picture (IMMICH-002.28). */
function openLoupe(index: number) {
	props.cull.hold(true)
	page(index)
}

/** Closes the loupe, lets the grid drop the pictures the filters refuse now and shows the tile it was on, or the next one left. */
async function closeLoupe() {
	const before = pictures.value
	const index = loupeIndex.value!
	loupeIndex.value = null
	props.cull.hold(false)
	await nextTick()
	await photoGrid.value?.reveal(Math.max(0, keptIndex(before, pictures.value, index)))
}

/** Decides the picture the loupe shows. */
function decideShown(intent: DecisionIntent, picture: Picture<SourceEntry>) {
	props.cull.decide(intent, [picture])
}

// The folder grid's keys, without the toolbar and filter bar this screen does not have (IMMICH-003.25).
const gridKeys: HotkeyHandlers = {
	...gridCoreHotkeys({ grid: () => photoGrid.value, view: () => pictures.value, selection, common: props.cull.common, decide: props.cull.decide, openLoupe, toggleFullscreen: () => props.toggleFullscreen(document.documentElement) }),
	'file-names': () => emit('updateSettings', { showFileNames: !props.settings.showFileNames }),
}

defineExpose({
	loupe: photoLoupe,
	/** The keys of the loupe while it shows, else the grid's. */
	hotkeys: (): HotkeyHandlers => loupeIndex.value === null ? gridKeys : photoLoupe.value?.hotkeys ?? {},
})
</script>

<template>
	<div class="immich-screen">
		<div class="immich-screen__toolbar">
			<FlagFilter :flags="filters.flags" :counts="counts?.flags ?? null" @update:flags="setFlags" />
			<span class="immich-screen__count">{{ countText }}</span>
			<NcButton variant="tertiary" :aria-pressed="selecting" @click="selection.setSelecting(!selecting)">
				{{ t('honeycomb', 'Select') }}
			</NcButton>
			<SelectionRow
				v-if="selecting"
				:selected="selected.length"
				:allLabel="t('honeycomb', 'Select all (loaded)')"
				@selectAll="selection.selectAll"
				@selectNone="selection.selectNone"
				@done="selection.setSelecting(false)" />
			<NcButton v-if="props.write !== undefined" class="immich-screen__write" @click="props.write.open()">
				{{ t('honeycomb', 'Write to Immich') }}
			</NcButton>
		</div>
		<ImmichFilterBar
			:filters="filters"
			:choices="choices"
			:changed="filtersChanged"
			@update:filters="props.cull.setFilters"
			@clear="props.cull.clearFilters" />
		<NcEmptyContent
			v-if="empty"
			class="immich-screen__empty"
			:name="t('honeycomb', 'No photos match. Change the time, device or flag filter.')">
			<template #icon>
				<AppIcon name="server" />
			</template>
			<template v-if="filtersChanged" #action>
				<NcButton @click="props.cull.clearFilters">
					{{ t('honeycomb', 'Clear filters') }}
				</NcButton>
			</template>
		</NcEmptyContent>
		<template v-else>
			<div v-if="list.previousCursor !== null" class="immich-screen__footer">
				<NcButton :disabled="list.previous === 'loading'" @click="showNewer">
					{{ t('honeycomb', 'Show newer photos') }}
				</NcButton>
			</div>
			<PhotoGrid
				v-if="pictures.length > 0"
				ref="photoGrid"
				class="immich-screen__grid"
				:pictures="pictures"
				:groupByFolder="true"
				:fileNames="props.settings.showFileNames"
				:tileSize="props.tileSize"
				:decisionOf="props.cull.decisionOf"
				:badgesOf="immichBadges"
				:imageUrl="props.cull.imageUrl"
				:selecting="selecting"
				:selection="selection.selection.value"
				v-bind="props.observeSize === undefined ? {} : { observeSize: props.observeSize }"
				@update:tileSize="emit('update:tileSize', $event)"
				@update:selecting="selection.setSelecting"
				@update:selection="selection.select"
				@open="openLoupe"
				@shown="props.cull.loadNext($event, 1)" />
			<div v-if="list.next !== 'idle'" class="immich-screen__footer">
				<template v-if="list.next === 'failed'">
					<span>{{ pageFailedText(list.failure) }}</span>
					<NcButton @click="props.cull.retry">
						{{ t('honeycomb', 'Try again') }}
					</NcButton>
				</template>
				<span v-else>{{ t('honeycomb', 'Loading photos…') }}</span>
			</div>
		</template>
		<ActionBar
			v-if="selecting"
			:common="props.cull.common(selected)"
			:disabled="selected.length === 0"
			:keepRaw="false"
			:tags="false"
			@decide="props.cull.decide($event, selected)" />
		<ImmichWriteDialog v-if="props.write !== undefined" :write="props.write" />
		<Teleport to="body">
			<PhotoLoupe
				v-if="loupeIndex !== null && pictures.length > loupeIndex"
				ref="photoLoupe"
				:index="loupeIndex"
				:pictures="pictures"
				:capabilities="DECISIONS_ONLY"
				:counter="counter"
				:decisionOf="props.cull.decisionOf"
				:storage="props.storage"
				:viewState="props.viewState"
				:settings="props.settings"
				:imageUrl="props.cull.imageUrl"
				@update:index="page"
				@updateSettings="emit('updateSettings', $event)"
				@decide="decideShown"
				@toast="emit('toast', $event)"
				@close="closeLoupe" />
		</Teleport>
	</div>
</template>

<style scoped>
.immich-screen {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.immich-screen__toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(2 * var(--default-grid-baseline));
	padding-inline-start: var(--honeycomb-toggle-gutter);
}

.immich-screen__count {
	color: var(--color-text-maxcontrast);
}

.immich-screen__write {
	margin-inline-start: auto;
}

.immich-screen__grid {
	flex: 1;
}

.immich-screen__footer {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
}
</style>
