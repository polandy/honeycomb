<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api.ts'

import { t } from '@nextcloud/l10n'
import { ref } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import LibraryRoots from './LibraryRoots.vue'

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
</script>

<template>
	<section class="library-setup" aria-labelledby="library-setup-heading">
		<h2 id="library-setup-heading">
			{{ t('honeycomb', 'Where is your library?') }}
		</h2>
		<p class="library-setup__hint">
			{{ t('honeycomb', 'Choose the folders that hold your photos. The list shows the folders below them.') }}
		</p>
		<LibraryRoots
			:roots="roots"
			:listFolders="props.listFolders"
			:check="props.check"
			@update="roots = $event" />
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

.library-setup__hint {
	color: var(--color-text-maxcontrast);
}
</style>
