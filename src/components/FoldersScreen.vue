<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderList } from '../folders/folders.ts'
import type { FolderNode } from '../logic/folder-hierarchy.ts'
import type { FolderFilter, FolderSort } from '../logic/folder-list.ts'
import type { FolderRow } from '../logic/folder-row.ts'
import type { FolderSet } from '../logic/folder-set.ts'

import { t } from '@nextcloud/l10n'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import FolderBreadcrumb from './FolderBreadcrumb.vue'
import FolderLevelCard from './FolderLevelCard.vue'
import FolderLevelList from './FolderLevelList.vue'
import FolderListFilters from './FolderListFilters.vue'
import FolderListRow from './FolderListRow.vue'
import FolderMenu from './FolderMenu.vue'
import FoldersProgress from './FoldersProgress.vue'
import PageTitleRow from './PageTitleRow.vue'
import ProgressBar from './ProgressBar.vue'
import { progressSummary, progressTitle, updatingText, yearHeadingText } from '../folders/folders-text.ts'
import { breadcrumb, buildHierarchy } from '../logic/folder-hierarchy.ts'
import { allRows, cullSet, flatRows, ownRow, parentBelow, shownLevel } from '../logic/folder-level.ts'
import { buildFolderList, filterCounts } from '../logic/folder-list.ts'
import { folderProgress } from '../logic/folder-progress.ts'
import { formatNumber } from '../shared/l10n.ts'

const props = defineProps<{
	folders: FolderList
	roots: readonly string[]
	/** The current time in Unix seconds; it sets the month of the progress card. */
	now: () => number
	/** The row whose done status changed last; its *More* takes the focus (FOLDERS-008.3). */
	focusRow?: { fileId: number } | null
	/** Whether a row covers its whole subtree (FOLDERS-009.5). */
	includeSubfolders: boolean
}>()

const emit = defineEmits<{
	/** Cull one folder, with its subfolders or without (FOLDERS-007.13). */
	cull: [set: FolderSet]
	/** Mark the folder done, or reopen it, or each folder of a subtree, without a dialog (FOLDERS-008). */
	markDone: [row: FolderRow]
	reopen: [row: FolderRow]
	markAllDone: [node: FolderNode]
	reopenAll: [node: FolderNode]
	/** Cull a done folder's new photos (FOLDERS-008.7). */
	cullNew: [set: FolderSet]
	'update:includeSubfolders': [on: boolean]
}>()

/** The level the user opened, null for the start. */
const chosen = ref<string | null>(null)
const filter = ref<FolderFilter>('suggested')
const sort = ref<FolderSort>('suggested')
const menuRow = ref<FolderRow | null>(null)
const scroller = useTemplateRef<HTMLElement>('scroller')

const rows = computed(() => props.folders.rows.value)
const tree = computed(() => buildHierarchy(props.roots, rows.value))
const level = computed(() => shownLevel(tree.value, chosen.value))
const crumbs = computed(() => (level.value === null ? [] : breadcrumb(level.value.root, level.value.path)))
const flat = computed(() => flatRows(rows.value, level.value).filter((each) => props.roots.includes(each.root)))
const listing = computed(() => buildFolderList(flat.value, { roots: level.value === null ? props.roots : [level.value.root], root: null, filter: filter.value, sort: sort.value }))
const entries = computed(() => allRows(tree.value, level.value))
const own = computed(() => ownRow(level.value))
const empty = computed(() => (filter.value === 'all'
	? entries.value.length === 0 && own.value === null
	: listing.value.sections.every((section) => section.groups.every((group) => group.rows.length === 0))))
const counts = computed(() => ({ ...filterCounts(flat.value), all: entries.value.length + (own.value === null ? 0 : 1) }))
/** The root of the shown level for the progress card; null for the whole library, also of one root. */
const root = computed(() => (tree.value.length > 1 ? level.value?.root ?? null : null))
const library = computed(() => folderProgress(rows.value, props.roots, new Date(props.now() * 1000)))
const progress = computed(() => (root.value === null ? library.value.total : library.value.perRoot.find((each) => each.root === root.value)!.progress))
/** One bar per root only for the whole library of several roots (FOLDERS-007.9). */
const perRoot = computed(() => (root.value === null && props.roots.length > 1 ? library.value.perRoot : []))
const updating = computed(() => props.folders.updating.value)
const levelList = useTemplateRef<InstanceType<typeof FolderLevelList>>('levelList')

/** The list stays mounted under a cull; its scroll comes back with it (FOLDERS-007.14). */
let scrollTop = 0
watch(() => props.folders.shown.value, async (shown) => {
	if (!shown) {
		scrollTop = scroller.value?.scrollTop ?? 0
		return
	}
	await nextTick()
	if (scroller.value !== null) {
		scroller.value.scrollTop = scrollTop
	}
})

/** The shown rows by file id, to focus one. */
const rowRefs = new Map<number, { focus(): void }>()

/** Keeps the row's instance while it shows. */
function rowRef(fileId: number) {
	return (shown: unknown) => (shown === null ? rowRefs.delete(fileId) : rowRefs.set(fileId, shown as { focus(): void }))
}

/** Focuses the changed row's *More*, or the list when the filter hides the row now. */
watch(() => props.focusRow, async (target) => {
	if (target === null || target === undefined) {
		return
	}
	await nextTick()
	const shown = rowRefs.get(target.fileId)
	if (shown !== undefined) {
		shown.focus()
	} else if (levelList.value?.focus(target.fileId) !== true) {
		scroller.value?.focus()
	}
})

/** Closes the menu and asks for the row's done change. */
function change(event: 'markDone' | 'reopen', row: FolderRow) {
	menuRow.value = null
	if (event === 'markDone') {
		emit('markDone', row)
	} else {
		emit('reopen', row)
	}
}

/** Close the menu and open the folder in the grid. */
function cull(row: FolderRow, subfolders: boolean) {
	menuRow.value = null
	emit('cull', { paths: [row.path], subfolders })
}
</script>

<template>
	<div ref="scroller" class="folders-screen" tabindex="-1">
		<PageTitleRow>
			<span :translate="root === null ? undefined : 'no'">{{ progressTitle(root) }}</span>
			<template #meta>
				{{ progressSummary(root, props.roots.length, progress) }}
			</template>
		</PageTitleRow>
		<div class="folders-screen__body">
			<FoldersProgress
				:titled="false"
				:root="root"
				:roots="props.roots.length"
				:progress="progress"
				:perRoot="perRoot" />
			<div v-if="updating !== null" class="folders-screen__updating">
				<span>{{ updatingText(updating.total - updating.done) }}</span>
				<ProgressBar
					class="folders-screen__updating-bar"
					:label="updatingText(updating.total - updating.done)"
					:value="updating.done"
					:max="updating.total" />
			</div>
			<div class="folders-screen__header">
				<FolderBreadcrumb :crumbs="crumbs" :library="tree.length > 1" @open="chosen = $event" />
				<NcCheckboxRadioSwitch
					class="folders-screen__subfolders"
					type="switch"
					:modelValue="props.includeSubfolders"
					@update:modelValue="emit('update:includeSubfolders', $event)">
					{{ t('honeycomb', 'Include subfolders') }}
				</NcCheckboxRadioSwitch>
			</div>
			<FolderLevelCard
				v-if="level !== null"
				:level="level"
				:includeSubfolders="props.includeSubfolders"
				@cull="emit('cull', cullSet(level, props.includeSubfolders))" />
			<FolderListFilters
				v-model:filter="filter"
				v-model:sort="sort"
				:counts="counts" />
			<p v-if="props.folders.state.value === 'loading'" class="folders-screen__state">
				{{ t('honeycomb', 'Loading the folders…') }}
			</p>
			<div v-else-if="props.folders.state.value === 'failed'" class="folders-screen__state" role="alert">
				<p>{{ t('honeycomb', 'Could not load the folders.') }}</p>
				<NcButton @click="props.folders.refresh">
					{{ t('honeycomb', 'Try again') }}
				</NcButton>
			</div>
			<p v-else-if="empty" class="folders-screen__state">
				{{ t('honeycomb', 'No folders here.') }}
			</p>
			<FolderLevelList
				v-else-if="filter === 'all'"
				ref="levelList"
				:level="level"
				:entries="entries"
				:own="own"
				:includeSubfolders="props.includeSubfolders"
				@cull="emit('cull', $event)"
				@open="chosen = $event"
				@markDone="change('markDone', $event)"
				@cullNew="emit('cullNew', $event)"
				@menu="menuRow = $event"
				@markAllDone="emit('markAllDone', $event)"
				@reopenAll="emit('reopenAll', $event)" />
			<template v-else>
				<section v-for="section in listing.sections" :key="section.root" class="folders-screen__section">
					<h3 v-if="listing.rootHeadings" class="folders-screen__root-heading">
						<span translate="no">{{ section.root }}</span>
						<span class="folders-screen__root-count">{{ formatNumber(section.count) }}</span>
					</h3>
					<template v-for="group in section.groups" :key="String(group.heading)">
						<h4 v-if="yearHeadingText(group.heading) !== null" class="folders-screen__year">
							{{ yearHeadingText(group.heading) }}
						</h4>
						<FolderListRow
							v-for="each in group.rows"
							:key="each.fileId"
							:ref="rowRef(each.fileId)"
							:row="each"
							:parent="level === null ? undefined : parentBelow(level, each.path)"
							@cull="cull(each, false)"
							@markDone="change('markDone', each)"
							@cullNew="emit('cullNew', { paths: [each.path], subfolders: false })"
							@menu="menuRow = each" />
					</template>
				</section>
			</template>
		</div>
		<FolderMenu
			v-if="menuRow !== null"
			:row="menuRow"
			@cull="cull(menuRow, $event)"
			@markDone="change('markDone', menuRow)"
			@reopen="change('reopen', menuRow)"
			@close="menuRow = null" />
	</div>
</template>

<style scoped>
.folders-screen {
	overflow: auto;
	box-sizing: border-box;
	height: 100%;
}

.folders-screen__body {
	display: flex;
	flex-direction: column;
	gap: calc(3 * var(--default-grid-baseline));
	box-sizing: border-box;
	width: min(960px, 100%);
	margin: 0 auto;
	padding: 0 calc(4 * var(--default-grid-baseline)) calc(4 * var(--default-grid-baseline));
}

.folders-screen__header {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: calc(2 * var(--default-grid-baseline));
}

.folders-screen__updating {
	display: grid;
	gap: var(--default-grid-baseline);
	color: var(--color-text-maxcontrast);
	font-size: 13px;
}

.folders-screen__updating-bar {
	width: 100%;
	height: 6px;
	border-radius: 3px;
}

.folders-screen__state {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
}

.folders-screen__section {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
}

.folders-screen__root-heading {
	display: flex;
	align-items: baseline;
	gap: calc(2 * var(--default-grid-baseline));
	margin: calc(2 * var(--default-grid-baseline)) 0 0;
	font-size: 15px;
}

.folders-screen__root-count,
.folders-screen__year {
	color: var(--color-text-maxcontrast);
	font-size: 13px;
	font-variant-numeric: tabular-nums;
}

.folders-screen__year {
	margin: var(--default-grid-baseline) 0 0;
}
</style>
