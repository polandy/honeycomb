<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { OpenedFolder } from '../logic/writability.ts'
import type { SidecarFlow } from '../sidecar-flow.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import ConfirmDialog from './ConfirmDialog.vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { splitFolder } from '../logic/file-name.ts'
import { withoutUnconfirmed } from '../logic/legacy.ts'
import { sidecarFailureReason, skippedNoteText } from '../sidecar-text.ts'

const props = defineProps<{
	flow: SidecarFlow
	folderSet: FolderSet
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	/** Whether writing creates new sidecars, which the migration needs (XMP-007.7). */
	ready: boolean
	/** Whether the picture lies in a shared folder not confirmed, which the migration skips (XMP-007.13). */
	unconfirmed: (picture: Picture<ListingEntry>) => boolean
	/** The opened folders that confirm the pictures' shared folders. */
	confirmationFolders: (pictures: readonly Picture<ListingEntry>[]) => readonly OpenedFolder[]
}>()

const emit = defineEmits<{
	confirmFolder: [folder: OpenedFolder]
}>()

const asking = computed(() => props.flow.asking.value)
const report = computed(() => props.flow.report.value)

const run = computed(() => withoutUnconfirmed(asking.value ?? [], props.unconfirmed))
const toConfirm = computed(() => props.confirmationFolders((asking.value ?? []).map(({ picture }) => picture)))
const askedText = computed(() => {
	const chosen = run.value.written
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
		:confirmDisabled="!props.ready || run.written.length === 0 || props.flow.progress.value !== null"
		:cancel="props.flow.progress.value === null"
		:progress="props.flow.progress.value"
		@cancel="props.flow.close"
		@confirm="props.flow.confirm(props.decisionOf, props.unconfirmed)">
		<p class="sidecar-dialogs__intro">
			{{ t('honeycomb', 'honeycomb still keeps these decisions and tags in its database. The XMP sidecar of each file gets the stored rating, colour label, flag and Keep RAW mark.') }}
			{{ t('honeycomb', 'Where a sidecar says otherwise, the stored value wins; stored tags are added to the sidecar\'s.') }}
		</p>
		<NcNoteCard v-if="!props.ready" type="info" :text="t('honeycomb', 'Turn on Write decisions to XMP sidecars in the settings first.')" />
		<NcNoteCard v-if="props.ready && run.skipped > 0" type="warning">
			<p>
				{{ skippedNoteText(run.skipped) }}
				{{ t('honeycomb', 'Once you confirm a folder, every user of it, and digiKam, darktable and Lightroom, will see its decisions.') }}
			</p>
			<ul class="sidecar-dialogs__folders">
				<li v-for="folder in toConfirm" :key="folder.fileId">
					<NcButton variant="secondary" @click="emit('confirmFolder', folder)">
						{{ t('honeycomb', 'Confirm {folder}', { folder: splitFolder(folder.path).name || '/' }, undefined, PLAIN_TEXT) }}
					</NcButton>
				</li>
			</ul>
		</NcNoteCard>
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

.sidecar-dialogs__folders {
	display: flex;
	flex-wrap: wrap;
	gap: var(--default-grid-baseline);
	padding: 0;
	list-style: none;
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
