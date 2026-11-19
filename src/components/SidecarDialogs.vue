<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { SidecarFlow } from '../sidecar-flow.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import { folderLabel } from '../logic/cull.ts'
import { splitFolder } from '../logic/file-name.ts'
import { sidecarFailureReason } from '../sidecar-text.ts'

const props = defineProps<{
	flow: SidecarFlow
	folderSet: FolderSet
}>()

const report = computed(() => props.flow.report.value)

/** A sidecar's path as the grid names its folder. */
function shownPath(path: string): string {
	const { parent, name } = splitFolder(path)
	return `${folderLabel(parent, props.folderSet)}/${name}`
}
</script>

<template>
	<NcDialog
		v-if="report !== null"
		:name="t('honeycomb', 'Some sidecars could not be written')"
		container="body"
		@update:open="props.flow.close">
		<ul class="sidecar-dialogs__list">
			<li v-for="failure in report" :key="failure.path">
				<span class="sidecar-dialogs__path">{{ shownPath(failure.path) }}</span>
				<span class="sidecar-dialogs__reason">{{ sidecarFailureReason(failure.reason) }}</span>
			</li>
		</ul>
		<template #actions>
			<NcButton variant="primary" @click="props.flow.close">
				{{ t('honeycomb', 'Close') }}
			</NcButton>
		</template>
	</NcDialog>
</template>

<style scoped>
.sidecar-dialogs__reason {
	color: var(--color-text-maxcontrast);
}

.sidecar-dialogs__list {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
	padding: 0;
	list-style: none;
}

.sidecar-dialogs__list li {
	display: flex;
	flex-direction: column;
}

.sidecar-dialogs__path {
	overflow-wrap: anywhere;
}
</style>
