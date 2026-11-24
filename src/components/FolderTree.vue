<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api/index.ts'
import type { Branch, TreeNote } from '../logic/folder-tree.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, nextTick, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { listFolders as apiListFolders } from '../api/index.ts'
import { effectiveExclusions, isHiddenFolder } from '../logic/folder-set.ts'
import { excludedBelow, excludedFrom, foldersToExpand, includedBy, ROOT, rowOrphans, rowPictures, tickedBelow, treeKey, visibleRows } from '../logic/folder-tree.ts'
import { fireAndLog } from '../shared/fire-and-log.ts'
import { formatNumber, nameComparer, PLAIN_TEXT } from '../shared/l10n.ts'
import { logger } from '../shared/logger.ts'
import { tip } from '../shared/tooltip.ts'

const props = withDefaults(defineProps<{
	/** The ticked folder paths. */
	ticked: readonly string[]
	listFolders?: (path: string) => Promise<Folder[]>
	/** One folder is chosen, not several ticked. */
	single?: boolean
	/** Folders that cannot be chosen, e.g. the open folder set's as a move target. */
	blocked?: readonly string[]
	/** *Include subfolders* is on: the folders below a ticked one come along. */
	subfolders?: boolean
	/** The folders *Include subfolders* leaves out. */
	excluded?: readonly string[]
}>(), {
	listFolders: apiListFolders,
	blocked: () => [],
	excluded: () => [],
})

const emit = defineEmits<{
	toggle: [path: string]
}>()

/** The folder set the tree shows. */
const folderSet = computed(() => ({ paths: props.ticked, subfolders: props.subfolders, excluded: props.excluded }))

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
		logger.error('Could not load the folders', { error })
		setBranch(path, { state: 'failed' })
	}
}

/** Shows the child folders of `path`, loading them unless known or on the way. */
function expand(path: string) {
	expanded.value = new Set(expanded.value).add(path)
	const state = branches.value.get(path)?.state
	if (state === undefined || state === 'failed') {
		fireAndLog(load(path), 'Could not load the folder')
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

/** The badges of a folder above ticked or excluded ones, shown and spoken. */
function badges(folder: Folder) {
	const ticked = tickedBelow(props.ticked, folder.path)
	const excluded = excludedBelow(folderSet.value, folder.path)
	const tickedVars = { count: formatNumber(ticked) }
	const excludedVars = { count: formatNumber(excluded) }
	return [
		...(ticked === 0
			? []
			: [{
					excluded: false,
					shown: n('honeycomb', '{count} inside', '{count} inside', ticked, tickedVars, PLAIN_TEXT),
					spoken: props.single
						? n('honeycomb', '{count} chosen folder inside', '{count} chosen folders inside', ticked, tickedVars, PLAIN_TEXT)
						: n('honeycomb', '{count} ticked folder inside', '{count} ticked folders inside', ticked, tickedVars, PLAIN_TEXT),
				}]),
		...(excluded === 0
			? []
			: [{
					excluded: true,
					shown: n('honeycomb', '{count} excluded', '{count} excluded', excluded, excludedVars, PLAIN_TEXT),
					spoken: n('honeycomb', '{count} excluded folder inside', '{count} excluded folders inside', excluded, excludedVars, PLAIN_TEXT),
				}]),
	]
}

/** The picture count of a folder row, shown and spoken; null when it holds none or is unknown. */
function pictureCount(folder: Folder, expanded: boolean) {
	const files = rowPictures(folder, expanded)
	if (files === null) {
		return null
	}
	const vars = { count: formatNumber(files.count) }
	return {
		shown: files.approximate ? `~${vars.count}` : vars.count,
		spoken: files.approximate
			? n('honeycomb', 'about {count} photo with subfolders', 'about {count} photos with subfolders', files.count, vars, PLAIN_TEXT)
			: files.below
				? n('honeycomb', '{count} photo with subfolders', '{count} photos with subfolders', files.count, vars, PLAIN_TEXT)
				: n('honeycomb', '{count} photo', '{count} photos', files.count, vars, PLAIN_TEXT),
	}
}

/** The picture counts of the folders shown, by path. */
const counts = computed(() => new Map(rows.value.flatMap((row) => {
	const count = row.kind === 'folder' ? pictureCount(row.folder, row.expanded) : null
	return row.kind === 'folder' && count !== null ? [[row.folder.path, count] as const] : []
})))

/** The orphaned-sidecar notes of the folders shown, by path. */
const orphanNotes = computed(() => new Map(rows.value.flatMap((row) => {
	const orphans = row.kind === 'folder' ? rowOrphans(row.folder, row.expanded) : null
	return row.kind === 'folder' && orphans !== null
		? [[row.folder.path, n('honeycomb', '{count} orphaned sidecar', '{count} orphaned sidecars', orphans, { count: formatNumber(orphans) }, PLAIN_TEXT)] as const]
		: []
})))

/** The spoken note of a folder *Include subfolders* takes along or leaves out; null for neither. */
function mark(path: string) {
	const from = excludedFrom(folderSet.value, path)
	if (from !== null) {
		return { excluded: true, spoken: t('honeycomb', 'excluded from {name}', { name: from.split('/').at(-1)! }, undefined, PLAIN_TEXT) }
	}
	const by = props.subfolders ? includedBy(folderSet.value, path) : null
	return by === null ? null : { excluded: false, spoken: t('honeycomb', 'included with {name}', { name: by.split('/').at(-1)! }, undefined, PLAIN_TEXT) }
}

/** The marks of the folders shown, by path. */
const marks = computed(() => new Map(rows.value.flatMap((row) => {
	const shown = row.kind === 'folder' ? mark(row.folder.path) : null
	return row.kind === 'folder' && shown !== null ? [[row.folder.path, shown] as const] : []
})))

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

for (const path of [ROOT, ...foldersToExpand([...props.ticked, ...effectiveExclusions(folderSet.value)])]) {
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
				<span
					class="folder-tree__box"
					:class="{ 'folder-tree__box--included': marks.get(row.folder.path)?.excluded === false, 'folder-tree__box--excluded': marks.get(row.folder.path)?.excluded }"
					aria-hidden="true">
					<AppIcon v-if="marks.get(row.folder.path)?.excluded" name="minus" />
					<AppIcon v-else-if="props.ticked.includes(row.folder.path) || marks.has(row.folder.path)" name="check" />
				</span>
				<AppIcon name="folder" />
				<span class="folder-tree__label">
					<span class="folder-tree__name" :class="{ 'folder-tree__name--excluded': marks.get(row.folder.path)?.excluded }">{{ row.folder.name }}</span>
					<span v-if="isHiddenFolder(row.folder.name)" class="folder-tree__meta">{{ t('honeycomb', 'Hidden folder, always skipped') }}</span>
					<span v-else-if="props.blocked.includes(row.folder.path)" class="folder-tree__meta">{{ t('honeycomb', 'Open folder, cannot be the target') }}</span>
				</span>
				<span v-if="marks.has(row.folder.path)" :class="marks.get(row.folder.path)?.excluded ? 'folder-tree__excluded' : 'folder-tree__included'">
					<span aria-hidden="true">{{ marks.get(row.folder.path)?.excluded ? t('honeycomb', 'excluded') : t('honeycomb', 'included') }}</span>
					<span class="hidden-visually">{{ marks.get(row.folder.path)?.spoken }}</span>
				</span>
				<span
					v-for="badge in badges(row.folder)"
					:key="String(badge.excluded)"
					class="folder-tree__badge"
					:class="{ 'folder-tree__badge--excluded': badge.excluded }">
					<span aria-hidden="true">{{ badge.shown }}</span>
					<span class="hidden-visually">{{ badge.spoken }}</span>
				</span>
				<span v-if="orphanNotes.has(row.folder.path)" class="folder-tree__orphans">
					<span aria-hidden="true">{{ orphanNotes.get(row.folder.path) }}</span>
					<span class="hidden-visually">{{ orphanNotes.get(row.folder.path) }}</span>
				</span>
				<span v-if="counts.has(row.folder.path)" class="folder-tree__count">
					<span aria-hidden="true">{{ counts.get(row.folder.path)?.shown }}</span>
					<span class="hidden-visually">{{ counts.get(row.folder.path)?.spoken }}</span>
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

<style scoped src="./folder-tree.css" />
