<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderNode, LevelRow } from '../logic/folder-hierarchy.ts'
import type { FolderRow } from '../logic/folder-row.ts'
import type { FolderSet } from '../logic/folder-set.ts'

import { t } from '@nextcloud/l10n'
import { computed, shallowRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import FolderListRow from './FolderListRow.vue'
import FolderSubtreeMenu from './FolderSubtreeMenu.vue'
import FolderSubtreeRow from './FolderSubtreeRow.vue'
import { cullSet, opensLevel, singleRow } from '../logic/folder-level.ts'
import { PLAIN_TEXT } from '../shared/l10n.ts'

/** The rows of *All* on a level: *Photos directly in* first, then each subfolder or chain (FOLDERS-009). */
const props = defineProps<{
	level: FolderNode | null
	entries: readonly LevelRow[]
	own: FolderRow | null
	includeSubfolders: boolean
}>()

const emit = defineEmits<{
	cull: [set: FolderSet]
	/** Show the level at the path. */
	open: [path: string]
	markDone: [row: FolderRow]
	cullNew: [set: FolderSet]
	menu: [row: FolderRow]
	/** Mark done every rateable open folder of the subtree, or reopen every done one (FOLDERS-009.11, .13). */
	markAllDone: [node: FolderNode]
	reopenAll: [node: FolderNode]
}>()

/** The row with subfolders whose ⋯ menu is open. */
const subtreeMenu = shallowRef<LevelRow | null>(null)

/** Each entry with the row it shows as one folder, null for a row of its subtree. */
const items = computed(() => props.entries.map((entry) => ({ entry, single: singleRow(entry.node, props.includeSubfolders) })))

/** The shown folder rows by file id, to focus one. */
const rowRefs = new Map<number, { focus(): void }>()

/** Keeps the row's instance while it shows. */
function rowRef(fileId: number) {
	return (shown: unknown) => (shown === null ? rowRefs.delete(fileId) : rowRefs.set(fileId, shown as { focus(): void }))
}

/** Opens the row's level on a tap outside its controls. */
function tap(event: MouseEvent, entry: LevelRow) {
	if (opensLevel(entry) && !(event.target as Element).closest('button, a, input')) {
		emit('open', entry.node.path)
	}
}

/** Closes the subtree menu and passes its choice on. */
function choose(event: 'cull' | 'markAllDone' | 'reopenAll', entry: LevelRow) {
	subtreeMenu.value = null
	if (event === 'cull') {
		emit('cull', cullSet(entry.node, props.includeSubfolders))
	} else if (event === 'markAllDone') {
		emit('markAllDone', entry.node)
	} else {
		emit('reopenAll', entry.node)
	}
}

/** Focuses the row's *More*; false when no shown row has the file id. */
function focus(fileId: number): boolean {
	rowRefs.get(fileId)?.focus()
	return rowRefs.has(fileId)
}

defineExpose({ focus })
</script>

<template>
	<div class="folder-level-list">
		<FolderListRow
			v-if="props.own !== null && props.level !== null"
			:ref="rowRef(props.own.fileId)"
			:row="props.own"
			:label="t('honeycomb', 'Photos directly in {name}', { name: props.level.name }, undefined, PLAIN_TEXT)"
			parent=""
			own
			@cull="emit('cull', { paths: [props.own.path], subfolders: false })"
			@markDone="emit('markDone', props.own)"
			@cullNew="emit('cullNew', { paths: [props.own.path], subfolders: false })"
			@menu="emit('menu', props.own)" />
		<div
			v-for="{ entry, single } in items"
			:key="entry.node.path"
			:class="{ 'folder-level-list__opens': opensLevel(entry) }"
			@click="tap($event, entry)">
			<FolderListRow
				v-if="single !== null"
				:ref="rowRef(single.fileId)"
				:row="single"
				:label="entry.label"
				parent=""
				@cull="emit('cull', { paths: [single.path], subfolders: false })"
				@markDone="emit('markDone', single)"
				@cullNew="emit('cullNew', { paths: [single.path], subfolders: false })"
				@menu="emit('menu', single)">
				<NcButton
					v-if="opensLevel(entry)"
					variant="tertiary"
					:aria-label="t('honeycomb', 'Open {name}', { name: entry.label }, undefined, PLAIN_TEXT)"
					@click="emit('open', entry.node.path)">
					<template #icon>
						<AppIcon name="chevronRight" />
					</template>
				</NcButton>
			</FolderListRow>
			<FolderSubtreeRow
				v-else
				:node="entry.node"
				:label="entry.label"
				:includeSubfolders="props.includeSubfolders"
				@cull="emit('cull', cullSet(entry.node, props.includeSubfolders))"
				@markAllDone="emit('markAllDone', entry.node)"
				@menu="subtreeMenu = entry">
				<NcButton
					variant="tertiary"
					:aria-label="t('honeycomb', 'Open {name}', { name: entry.label }, undefined, PLAIN_TEXT)"
					@click="emit('open', entry.node.path)">
					<template #icon>
						<AppIcon name="chevronRight" />
					</template>
				</NcButton>
			</FolderSubtreeRow>
		</div>
		<FolderSubtreeMenu
			v-if="subtreeMenu !== null"
			:node="subtreeMenu.node"
			:label="subtreeMenu.label"
			:includeSubfolders="props.includeSubfolders"
			@cull="choose('cull', subtreeMenu)"
			@markAllDone="choose('markAllDone', subtreeMenu)"
			@reopenAll="choose('reopenAll', subtreeMenu)"
			@close="subtreeMenu = null" />
	</div>
</template>

<style scoped>
.folder-level-list {
	display: grid;
	gap: calc(2 * var(--default-grid-baseline));
}

.folder-level-list__opens {
	cursor: pointer;
}
</style>
