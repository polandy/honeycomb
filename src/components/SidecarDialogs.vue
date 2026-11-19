<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { SidecarFlow } from '../sidecar-flow.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { folderLabel } from '../logic/cull.ts'
import { splitFolder } from '../logic/file-name.ts'
import { sidecarFailureReason } from '../sidecar-text.ts'

const props = defineProps<{
	flow: SidecarFlow
	folderSet: FolderSet
	decisionOf: (picture: Picture<ListingEntry>) => Decision
}>()

const report = computed(() => props.flow.report.value)

/** A sidecar's path as the grid names its folder. */
function shownPath(path: string): string {
	const { parent, name } = splitFolder(path)
	return `${folderLabel(parent, props.folderSet)}/${name}`
}
</script>

<template>
	<ConfirmDialog
		v-if="report !== null"
		:title="t('honeycomb', 'Some sidecars could not be written')"
		:confirmLabel="t('honeycomb', 'Retry failed sidecars')"
		:cancelLabel="t('honeycomb', 'Close')"
		cancel
		@cancel="props.flow.close"
		@confirm="props.flow.retry(props.decisionOf)">
		<ul class="sidecar-dialogs__list">
			<li v-for="failure in report" :key="failure.path">
				<span class="sidecar-dialogs__path">{{ shownPath(failure.path) }}</span>
				<span class="sidecar-dialogs__reason">{{ sidecarFailureReason(failure.reason) }}</span>
			</li>
		</ul>
	</ConfirmDialog>
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
