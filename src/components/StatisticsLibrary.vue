<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { LibraryProgress } from '../logic/folder-progress.ts'

import { t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import NcButton from '@nextcloud/vue/components/NcButton'
import FoldersProgress from './FoldersProgress.vue'

defineProps<{
	roots: readonly string[]
	/** The progress of the roots; null while it is not read or could not be. */
	progress: LibraryProgress | null
	failed: boolean
}>()

const foldersUrl = generateUrl('/apps/honeycomb/')
</script>

<template>
	<section class="statistics-library">
		<h3>{{ t('honeycomb', 'Library progress') }}</h3>
		<p v-if="roots.length === 0" class="statistics-library__note">
			{{ t('honeycomb', 'Choose your library') }}
		</p>
		<p v-else-if="failed" class="statistics-library__note">
			{{ t('honeycomb', 'The library progress could not be loaded.') }}
		</p>
		<FoldersProgress
			v-else-if="progress !== null"
			:root="null"
			:roots="roots.length"
			:progress="progress.total"
			:perRoot="roots.length > 1 ? progress.perRoot : []" />
		<NcButton :href="foldersUrl">
			{{ t('honeycomb', 'Open Folders') }}
		</NcButton>
	</section>
</template>

<style scoped>
.statistics-library {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: calc(2 * var(--default-grid-baseline));
}

.statistics-library :deep(.folders-progress) {
	align-self: stretch;
	padding: 0;
	border: 0;
}

.statistics-library__note {
	color: var(--color-text-maxcontrast);
}
</style>
