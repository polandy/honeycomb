<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api/index.ts'

import { t } from '@nextcloud/l10n'
import { ref } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import FolderTree from './FolderTree.vue'
import { refusalText, rootNote } from '../folders/folders-text.ts'
import { addLibraryRoot, removeLibraryRoot } from '../logic/library-roots.ts'
import { PLAIN_TEXT } from '../shared/l10n.ts'
import { logger } from '../shared/logger.ts'

const props = defineProps<{
	roots: readonly string[]
	listFolders: (path: string) => Promise<Folder[]>
	/** Whether the server takes the folder as a root: one of the user's own storage (FOLDERS-005). */
	check: (root: string) => Promise<boolean>
}>()

const emit = defineEmits<{
	/** The roots after an add or a remove, in their order. */
	update: [roots: string[]]
}>()

/** The folder chosen in the tree, not yet added. */
const chosen = ref<string | null>(null)
const refusal = ref<string | null>(null)
const checking = ref(false)

/** Why a folder of the tree cannot be a root, null when it can. */
function disabledNote(path: string): string | null {
	const added = addLibraryRoot(props.roots, path)
	return rootNote('refused' in added ? added.refused : null)
}

/** One folder is chosen at a time; pressing it again unchooses it. */
function onToggle(path: string) {
	chosen.value = chosen.value === path ? null : path
	refusal.value = null
}

/** Adds the chosen folder when the rules (FOLDERS-004) and the server take it, else says why not. */
async function add() {
	const path = chosen.value
	if (path === null) {
		return
	}
	const added = addLibraryRoot(props.roots, path)
	if ('refused' in added) {
		refusal.value = refusalText(added.refused)
		return
	}
	checking.value = true
	try {
		if (await props.check(path)) {
			emit('update', added.roots)
			chosen.value = null
			refusal.value = null
		} else {
			refusal.value = t('honeycomb', '{path} is not in your own files: shares, group folders and external storage cannot be roots.', { path }, undefined, PLAIN_TEXT)
		}
	} catch (error: unknown) {
		logger.error('Could not check a library root', { error })
		refusal.value = t('honeycomb', 'Could not check {path}; try again.', { path }, undefined, PLAIN_TEXT)
	} finally {
		checking.value = false
	}
}
</script>

<template>
	<div class="library-roots">
		<div class="library-roots__tree">
			<FolderTree
				:ticked="chosen === null ? [] : [chosen]"
				single
				:disabledNote="disabledNote"
				:listFolders="props.listFolders"
				@toggle="onToggle" />
		</div>
		<NcButton :disabled="chosen === null || checking" @click="add">
			<template #icon>
				<AppIcon name="plus" />
			</template>
			{{ t('honeycomb', 'Add as root') }}
		</NcButton>
		<p v-if="refusal !== null" class="library-roots__refusal" role="alert">
			{{ refusal }}
		</p>
		<ul v-if="props.roots.length > 0" class="library-roots__roots" :aria-label="t('honeycomb', 'Library roots')">
			<li v-for="root in props.roots" :key="root" class="library-roots__root">
				<AppIcon name="folder" />
				<span class="library-roots__root-name" translate="no">{{ root }}</span>
				<NcButton variant="tertiary" :aria-label="t('honeycomb', 'Remove {path}', { path: root }, undefined, PLAIN_TEXT)" @click="emit('update', removeLibraryRoot(props.roots, root))">
					<template #icon>
						<AppIcon name="close" />
					</template>
				</NcButton>
			</li>
		</ul>
		<p v-else class="library-roots__none">
			{{ t('honeycomb', 'No root chosen yet.') }}
		</p>
	</div>
</template>

<style scoped>
.library-roots {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: calc(3 * var(--default-grid-baseline));
	width: 100%;
}

.library-roots__none {
	color: var(--color-text-maxcontrast);
}

.library-roots__tree {
	overflow: auto;
	box-sizing: border-box;
	width: 100%;
	max-height: 50vh;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-container);
}

.library-roots__refusal {
	color: var(--color-text-error, var(--color-error));
}

.library-roots__roots {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
	width: 100%;
}

.library-roots__root {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
}

.library-roots__root-name {
	flex: 1;
	min-width: 0;
	overflow-wrap: anywhere;
}
</style>
