<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref } from 'vue'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import AppIcon from './AppIcon.vue'
import { listFolders as apiListFolders } from '../api.ts'
import { nameComparer, PLAIN_TEXT } from '../l10n.ts'
import { logger } from '../logger.ts'
import { breadcrumbs, isHiddenFolder } from '../logic/folder-set.ts'

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

const cwd = ref('')
const folders = ref<Folder[]>([])
const failed = ref(false)
const crumbs = computed(() => breadcrumbs(cwd.value))
const compareNames = nameComparer()

let latestLoad = 0
/** Shows the child folders of `path`; an answer for a folder opened before is dropped. */
async function open(path: string) {
	const load = ++latestLoad
	cwd.value = path
	let children: Folder[] | null = null
	try {
		children = await props.listFolders(path)
	} catch (error) {
		if (load === latestLoad) {
			logger.error('Could not load the folders', { path, error })
		}
	}
	if (load === latestLoad) {
		failed.value = children === null
		folders.value = (children ?? []).toSorted((a, b) => compareNames(a.name, b.name))
	}
}

/** Ticks or unticks a folder the cull can include. */
function toggle(folder: Folder) {
	if (!isHiddenFolder(folder.name) && !props.blocked.includes(folder.path)) {
		emit('toggle', folder.path)
	}
}

void open('')
</script>

<template>
	<div class="folder-list">
		<nav class="folder-list__crumbs" :aria-label="t('honeycomb', 'Folder path')">
			<template v-for="(crumb, index) in crumbs" :key="crumb.path">
				<span v-if="index > 0" class="folder-list__separator" aria-hidden="true">/</span>
				<button
					type="button"
					:aria-current="index === crumbs.length - 1 ? 'location' : undefined"
					@click="open(crumb.path)">
					{{ index === 0 ? t('honeycomb', 'Home') : crumb.name }}
				</button>
			</template>
		</nav>
		<NcNoteCard v-if="failed" type="error">
			{{ t('honeycomb', 'Could not load this folder.') }}
		</NcNoteCard>
		<template v-else>
			<ul
				v-if="folders.length > 0"
				class="folder-list__options"
				role="listbox"
				:aria-multiselectable="!props.single"
				:aria-label="t('honeycomb', 'Folders')">
				<li
					v-for="folder in folders"
					:key="folder.path"
					role="option"
					tabindex="0"
					class="folder-list__option"
					:aria-selected="props.ticked.includes(folder.path)"
					:aria-disabled="isHiddenFolder(folder.name) || props.blocked.includes(folder.path) || undefined"
					@click="toggle(folder)"
					@keydown.enter.space.prevent.self="toggle(folder)">
					<span class="folder-list__box" aria-hidden="true">
						<AppIcon v-if="props.ticked.includes(folder.path)" name="check" />
					</span>
					<AppIcon name="folder" />
					<span class="folder-list__label">
						<span class="folder-list__name">{{ folder.name }}</span>
						<span v-if="isHiddenFolder(folder.name)" class="folder-list__meta">{{ t('honeycomb', 'Hidden folder, always skipped') }}</span>
						<span v-else-if="props.blocked.includes(folder.path)" class="folder-list__meta">{{ t('honeycomb', 'Open folder, cannot be the target') }}</span>
					</span>
					<button
						v-if="folder.hasSubfolders"
						type="button"
						class="folder-list__open"
						:aria-label="t('honeycomb', 'Open {name}', { name: folder.name }, undefined, PLAIN_TEXT)"
						@click.stop="open(folder.path)"
						@keydown.stop>
						<AppIcon name="chevronRight" />
					</button>
				</li>
			</ul>
			<p v-else class="folder-list__empty">
				{{ t('honeycomb', 'This folder has no subfolders.') }}
			</p>
		</template>
	</div>
</template>

<style scoped>
.folder-list__crumbs {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline);
}

.folder-list__crumbs button,
.folder-list__open {
	min-width: 34px;
	min-height: 34px;
	padding: 0 calc(2 * var(--default-grid-baseline));
	border: none;
	border-radius: var(--border-radius-element);
	background: none;
	color: var(--color-main-text);
	cursor: pointer;
}

.folder-list__crumbs button[aria-current] {
	font-weight: bold;
}

.folder-list__separator {
	color: var(--color-text-maxcontrast);
}

.folder-list__options {
	margin-top: calc(2 * var(--default-grid-baseline));
}

.folder-list__option {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	min-height: 34px;
	padding: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
	border-radius: var(--border-radius-element);
	cursor: pointer;
}

.folder-list__option[aria-selected='true'] {
	background-color: var(--color-primary-element-light);
}

.folder-list__option[aria-disabled='true'] {
	color: var(--color-text-maxcontrast);
	cursor: default;
}

.folder-list__option:focus-visible,
.folder-list__crumbs button:focus-visible,
.folder-list__open:focus-visible {
	outline: 2px solid var(--color-primary-element);
	outline-offset: -2px;
}

.folder-list__box {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border: 2px solid var(--color-border-maxcontrast);
	border-radius: var(--border-radius-small);
}

.folder-list__option[aria-selected='true'] .folder-list__box {
	border-color: var(--color-primary-element);
	background-color: var(--color-primary-element);
	color: var(--color-primary-element-text);
}

.folder-list__label {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
}

.folder-list__name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.folder-list__meta,
.folder-list__empty {
	color: var(--color-text-maxcontrast);
}

.folder-list__open {
	display: flex;
	align-items: center;
	justify-content: center;
	margin-inline-start: auto;
}

@media (pointer: coarse) {
	.folder-list__option,
	.folder-list__crumbs button,
	.folder-list__open {
		min-width: 44px;
		min-height: 44px;
	}
}
</style>
