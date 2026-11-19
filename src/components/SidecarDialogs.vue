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

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { splitFolder } from '../logic/file-name.ts'
import { sidecarFailureReason } from '../sidecar-text.ts'

const props = defineProps<{
	flow: SidecarFlow
	folderSet: FolderSet
	decisionOf: (picture: Picture<ListingEntry>) => Decision
}>()

const asking = computed(() => props.flow.asking.value)
const report = computed(() => props.flow.report.value)

const askedText = computed(() => {
	const chosen = asking.value ?? []
	const folders = [...new Set(chosen.map(({ picture }) => folderLabel(picture.folder, props.folderSet)))].join(', ')
	return n('honeycomb', '{count} photo in {folders}', '{count} photos in {folders}', chosen.length, { count: formatNumber(chosen.length), folders }, PLAIN_TEXT)
})

/** A sidecar's path as the grid names its folder. */
function shownPath(path: string): string {
	const { parent, name } = splitFolder(path)
	return `${folderLabel(parent, props.folderSet)}/${name}`
}
</script>

<template>
	<ConfirmDialog
		v-if="asking !== null"
		:title="t('honeycomb', 'Write decisions to sidecars')"
		:confirmLabel="t('honeycomb', 'Write to sidecars')"
		:confirmDisabled="asking.length === 0 || props.flow.progress.value !== null"
		:cancel="props.flow.progress.value === null"
		:progress="props.flow.progress.value"
		@cancel="props.flow.close"
		@confirm="props.flow.confirm(props.decisionOf)">
		<p class="sidecar-dialogs__intro">
			{{ t('honeycomb', 'honeycomb still keeps these decisions and tags in its database. The XMP sidecar of each file gets the stored rating, colour label, flag and Keep RAW mark.') }}
			{{ t('honeycomb', 'Where a sidecar says otherwise, the stored value wins; stored tags are added to the sidecar\'s.') }}
		</p>
		<p class="sidecar-dialogs__hint">
			{{ askedText }}
		</p>
	</ConfirmDialog>
	<ConfirmDialog
		v-else-if="report !== null"
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
.sidecar-dialogs__intro {
	margin-top: 0;
}

.sidecar-dialogs__hint,
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
