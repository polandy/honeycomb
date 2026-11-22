<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api.ts'

import { t } from '@nextcloud/l10n'
import { ref } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import FolderTree from './FolderTree.vue'
import { refusalText } from '../folders-text.ts'
import { PLAIN_TEXT } from '../l10n.ts'
import { logger } from '../logger.ts'
import { addLibraryRoot, removeLibraryRoot } from '../logic/library-roots.ts'

const props = defineProps<{
	listFolders: (path: string) => Promise<Folder[]>
	/** Whether the server takes the folder as a root: one of the user's own storage (FOLDERS-005). */
	check: (root: string) => Promise<boolean>
}>()

const emit = defineEmits<{
	/** The chosen roots, in their order. */
	save: [roots: string[]]
}>()

const roots = ref<string[]>([])
/** The folder chosen in the tree, not yet added. */
const chosen = ref<string | null>(null)
const refusal = ref<string | null>(null)
const checking = ref(false)

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
	const added = addLibraryRoot(roots.value, path)
	if ('refused' in added) {
		refusal.value = refusalText(added.refused)
		return
	}
	checking.value = true
	try {
		if (await props.check(path)) {
			roots.value = added.roots
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

/** Drop one root from the choice. */
function remove(root: string) {
	roots.value = removeLibraryRoot(roots.value, root)
}
</script>

<template>
	<section class="library-setup" aria-labelledby="library-setup-heading">
		<h2 id="library-setup-heading">
			{{ t('honeycomb', 'Where is your library?') }}
		</h2>
		<p class="library-setup__hint">
			{{ t('honeycomb', 'Choose the folders that hold your photos. The list shows the folders below them.') }}
		</p>
		<div class="library-setup__tree">
			<FolderTree
				:ticked="chosen === null ? [] : [chosen]"
				single
				:listFolders="props.listFolders"
				@toggle="onToggle" />
		</div>
		<NcButton :disabled="chosen === null || checking" @click="add">
			<template #icon>
				<AppIcon name="plus" />
			</template>
			{{ t('honeycomb', 'Add as root') }}
		</NcButton>
		<p v-if="refusal !== null" class="library-setup__refusal" role="alert">
			{{ refusal }}
		</p>
		<ul v-if="roots.length > 0" class="library-setup__roots" :aria-label="t('honeycomb', 'Library roots')">
			<li v-for="root in roots" :key="root" class="library-setup__root">
				<AppIcon name="folder" />
				<span class="library-setup__root-name" translate="no">{{ root }}</span>
				<NcButton variant="tertiary" :aria-label="t('honeycomb', 'Remove {path}', { path: root }, undefined, PLAIN_TEXT)" @click="remove(root)">
					<template #icon>
						<AppIcon name="close" />
					</template>
				</NcButton>
			</li>
		</ul>
		<p v-else class="library-setup__none">
			{{ t('honeycomb', 'No root chosen yet.') }}
		</p>
		<NcButton variant="primary" :disabled="roots.length === 0" @click="emit('save', roots)">
			{{ t('honeycomb', 'Show folders') }}
		</NcButton>
	</section>
</template>

<style scoped>
.library-setup {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: calc(3 * var(--default-grid-baseline));
	box-sizing: border-box;
	width: min(640px, 100%);
	margin: 0 auto;
	padding: calc(4 * var(--default-grid-baseline));
}

.library-setup__hint,
.library-setup__none {
	color: var(--color-text-maxcontrast);
}

.library-setup__tree {
	overflow: auto;
	box-sizing: border-box;
	width: 100%;
	max-height: 50vh;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-container);
}

.library-setup__refusal {
	color: var(--color-text-error, var(--color-error));
}

.library-setup__roots {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
	width: 100%;
}

.library-setup__root {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
}

.library-setup__root-name {
	flex: 1;
	min-width: 0;
	overflow-wrap: anywhere;
}
</style>
