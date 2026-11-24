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
import { PLAIN_TEXT } from '../l10n.ts'

const props = defineProps<{
	listFolders: (path: string) => Promise<Folder[]>
	/** Whether the server takes the folder as a root: one of the user's own storage (FOLDERS-005). */
	check: (root: string) => Promise<boolean>
}>()

const emit = defineEmits<{
	/** The chosen roots, in their order. */
	save: [roots: string[]]
}>()

/** The page that says what honeycomb changes in the files and what it stores. */
const PRIVACY_URL = 'https://github.com/polandy/honeycomb/blob/main/docs/user/your-files-and-privacy.md'
const EXAMPLE_PATH = '/Photos/2026'

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
		<p class="library-setup__hint">
			{{ t('honeycomb', 'Decisions save as you go and can be undone; deleting only moves files to the Nextcloud trash bin. Your decisions are also written to XMP sidecar files next to the photos.') }}
		</p>
		<NcButton variant="tertiary" :href="PRIVACY_URL" target="_blank">
			{{ t('honeycomb', 'Your files and privacy') }}
		</NcButton>
		<p class="library-setup__hint">
			{{ t('honeycomb', 'For example, {path} holds your photos by year.', { path: EXAMPLE_PATH }, undefined, PLAIN_TEXT) }}
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
