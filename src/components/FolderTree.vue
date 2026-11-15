<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api.ts'
import type { Branch, TreeNote } from '../logic/folder-tree.ts'

import { t } from '@nextcloud/l10n'
import { computed, nextTick, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { listFolders as apiListFolders } from '../api.ts'
import { nameComparer, PLAIN_TEXT } from '../l10n.ts'
import { logger } from '../logger.ts'
import { isHiddenFolder } from '../logic/folder-set.ts'
import { foldersToExpand, ROOT, treeKey, visibleRows } from '../logic/folder-tree.ts'
import { tip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	/** The ticked folder paths. */
	ticked: readonly string[]
	listFolders?: (path: string) => Promise<Folder[]>
	/** One folder is chosen, not several ticked. */
	single?: boolean
	/** Folders that cannot be chosen, e.g. the open folder set's as a move target. */
	blocked?: readonly string[]
}>(), {
	listFolders: apiListFolders,
	blocked: () => [],
})

const emit = defineEmits<{
	toggle: [path: string]
}>()

const NOTES: Record<TreeNote, () => string> = {
	loading: () => t('honeycomb', 'Loading…'),
	failed: () => t('honeycomb', 'Could not load this folder.'),
	empty: () => t('honeycomb', 'This folder has no subfolders.'),
}

const branches = ref(new Map<string, Branch>())
const expanded = ref(new Set<string>())
const focusedPath = ref<string | null>(null)
const treeEl = ref<HTMLElement | null>(null)
const rows = computed(() => visibleRows(branches.value, expanded.value))
const compareNames = nameComparer()
/** The one folder row in the tab order: the focused one while shown, else the first. */
const tabStop = computed(() => {
	const folders = rows.value.flatMap((row) => (row.kind === 'folder' ? [row.folder.path] : []))
	return folders.find((path) => path === focusedPath.value) ?? folders[0]
})

/** Stores the state of the child folders of `path`. */
function setBranch(path: string, branch: Branch) {
	branches.value = new Map(branches.value).set(path, branch)
}

/** Loads the child folders of `path`, sorted with digits by value. */
async function load(path: string) {
	setBranch(path, { state: 'loading' })
	try {
		const children = await props.listFolders(path)
		setBranch(path, { state: 'loaded', folders: children.toSorted((a, b) => compareNames(a.name, b.name)) })
	} catch (error) {
		logger.error('Could not load the folders', { path, error })
		setBranch(path, { state: 'failed' })
	}
}

/** Shows the child folders of `path`, loading them unless known or on the way. */
function expand(path: string) {
	expanded.value = new Set(expanded.value).add(path)
	const state = branches.value.get(path)?.state
	if (state === undefined || state === 'failed') {
		void load(path)
	}
}

/** Hides the child folders of `path`. */
function collapse(path: string) {
	expanded.value = new Set([...expanded.value].filter((each) => each !== path))
}

/** Expands a collapsed folder and collapses an expanded one. */
function flip(folder: Folder) {
	focusedPath.value = folder.path
	if (expanded.value.has(folder.path)) {
		collapse(folder.path)
	} else {
		expand(folder.path)
	}
}

/** Whether a folder is shown disabled. */
const isDisabled = (folder: Folder) => isHiddenFolder(folder.name) || props.blocked.includes(folder.path)

/** Ticks or unticks a folder the cull can include. */
function toggle(folder: Folder) {
	focusedPath.value = folder.path
	if (!isDisabled(folder)) {
		emit('toggle', folder.path)
	}
}

/** Moves the focus, expands or collapses after the WAI-ARIA tree keys. */
async function onKey(event: KeyboardEvent, folder: Folder) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault()
		toggle(folder)
		return
	}
	const move = treeKey(rows.value, folder.path, event.key)
	if (move === null) {
		return
	}
	event.preventDefault()
	if ('expand' in move) {
		expand(move.expand)
	} else if ('collapse' in move) {
		collapse(move.collapse)
	} else {
		focusedPath.value = move.focus
		await nextTick()
		treeEl.value?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')?.focus()
	}
}

for (const path of [ROOT, ...foldersToExpand(props.ticked)]) {
	expand(path)
}
</script>

<template>
	<ul
		ref="treeEl"
		class="folder-tree"
		role="tree"
		:aria-multiselectable="!props.single"
		:aria-label="t('honeycomb', 'Folders')">
		<template v-for="row in rows" :key="row.kind === 'folder' ? row.folder.path : `${row.parent}\0${row.note}`">
			<li
				v-if="row.kind === 'folder'"
				role="treeitem"
				class="folder-tree__item"
				:style="{ '--folder-tree-level': row.level - 1 }"
				:tabindex="row.folder.path === tabStop ? 0 : -1"
				:aria-level="row.level"
				:aria-expanded="row.folder.hasSubfolders ? row.expanded : undefined"
				:aria-selected="props.ticked.includes(row.folder.path)"
				:aria-disabled="isDisabled(row.folder) || undefined"
				@click="toggle(row.folder)"
				@keydown.self="onKey($event, row.folder)">
				<button
					v-if="row.folder.hasSubfolders"
					type="button"
					class="folder-tree__twisty"
					tabindex="-1"
					aria-hidden="true"
					v-bind="tip(row.expanded
						? t('honeycomb', 'Collapse {name}', { name: row.folder.name }, undefined, PLAIN_TEXT)
						: t('honeycomb', 'Expand {name}', { name: row.folder.name }, undefined, PLAIN_TEXT))"
					@click.stop="flip(row.folder)">
					<AppIcon name="chevronRight" />
				</button>
				<span v-else class="folder-tree__spacer" aria-hidden="true" />
				<span class="folder-tree__box" aria-hidden="true">
					<AppIcon v-if="props.ticked.includes(row.folder.path)" name="check" />
				</span>
				<AppIcon name="folder" />
				<span class="folder-tree__label">
					<span class="folder-tree__name">{{ row.folder.name }}</span>
					<span v-if="isHiddenFolder(row.folder.name)" class="folder-tree__meta">{{ t('honeycomb', 'Hidden folder, always skipped') }}</span>
					<span v-else-if="props.blocked.includes(row.folder.path)" class="folder-tree__meta">{{ t('honeycomb', 'Open folder, cannot be the target') }}</span>
				</span>
			</li>
			<li
				v-else
				role="none"
				class="folder-tree__note"
				:class="{ 'folder-tree__note--failed': row.note === 'failed' }"
				:style="{ '--folder-tree-level': row.level - 1 }">
				{{ NOTES[row.note]() }}
			</li>
		</template>
	</ul>
</template>

<style scoped>
.folder-tree {
	--folder-tree-indent: calc(4 * var(--default-grid-baseline));
	--folder-tree-target: 34px;
	margin-top: calc(2 * var(--default-grid-baseline));
}

.folder-tree__item,
.folder-tree__note {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	min-height: var(--folder-tree-target);
	padding-block: 0;
	padding-inline: calc(var(--folder-tree-level) * var(--folder-tree-indent)) calc(2 * var(--default-grid-baseline));
	border-radius: var(--border-radius-element);
}

.folder-tree__note {
	padding-inline-start: calc(var(--folder-tree-level) * var(--folder-tree-indent) + var(--folder-tree-target) + 2 * var(--default-grid-baseline));
}

.folder-tree__note,
.folder-tree__meta {
	color: var(--color-text-maxcontrast);
}

.folder-tree__note--failed {
	color: var(--color-error-text);
}

.folder-tree__item {
	cursor: pointer;
}

.folder-tree__item[aria-selected='true'] {
	background-color: var(--color-primary-element-light);
}

.folder-tree__item[aria-disabled='true'] {
	color: var(--color-text-maxcontrast);
	cursor: default;
}

.folder-tree__item:focus-visible {
	outline: 2px solid var(--color-primary-element);
	outline-offset: -2px;
}

.folder-tree__twisty,
.folder-tree__spacer {
	flex: none;
	width: var(--folder-tree-target);
}

.folder-tree__twisty {
	display: flex;
	align-items: center;
	justify-content: center;
	height: var(--folder-tree-target);
	min-height: 0;
	/* Outranks Nextcloud's global button margin, which would make the row taller. */
	margin: 0;
	padding: 0;
	border: none;
	border-radius: var(--border-radius-element);
	background: none;
	color: var(--color-main-text);
	cursor: pointer;
}

.folder-tree__item[aria-expanded='true'] .folder-tree__twisty :deep(svg) {
	transform: rotate(90deg);
}

.folder-tree__box {
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border: 2px solid var(--color-border-maxcontrast);
	border-radius: var(--border-radius-small);
}

.folder-tree__item[aria-selected='true'] .folder-tree__box {
	border-color: var(--color-primary-element);
	background-color: var(--color-primary-element);
	color: var(--color-primary-element-text);
}

.folder-tree__label {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
}

.folder-tree__name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

@media (pointer: coarse) {
	.folder-tree {
		--folder-tree-target: 44px;
	}
}
</style>
