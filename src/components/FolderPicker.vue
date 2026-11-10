<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api.ts'
import type { ListEntries } from '../folder-count.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { PairingSettings } from '../logic/pairing.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, ref } from 'vue'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import ConfirmDialog from './ConfirmDialog.vue'
import FolderList from './FolderList.vue'
import { listEntries as apiListEntries, listFolders as apiListFolders } from '../api.ts'
import { useFolderCount } from '../folder-count.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { toggleFolder } from '../logic/folder-set.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../logic/pairing.ts'
import { PICTURE_CAP } from '../logic/picture-order.ts'

const props = withDefaults(defineProps<{
	/** The folder set of the open cull; null while none is open. */
	current: FolderSet | null
	listFolders?: (path: string) => Promise<Folder[]>
	listEntries?: ListEntries
	/** How the count pairs the files, from the settings. */
	pairing?: PairingSettings
}>(), {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	pairing: () => DEFAULT_PAIRING_SETTINGS,
})

const emit = defineEmits<{
	confirm: [set: FolderSet, entries: ListingEntry[], sharedFolders: string[]]
	cancel: []
}>()

const set = ref<FolderSet>(props.current ?? { paths: [], subfolders: false })
const { count, failed } = useFolderCount(set, props.listEntries, () => props.pairing)
const canCull = computed(() => (count.value?.pictures ?? 0) > 0)

const summary = computed(() => {
	if (set.value.paths.length === 0) {
		return t('honeycomb', 'Tick one or more folders.')
	}
	if (count.value === null) {
		return ''
	}
	if (count.value.pictures === 0) {
		return t('honeycomb', 'No photos in the ticked folders.')
	}
	const { pictures, folders } = count.value
	return t('honeycomb', '{photos} in {folders}', {
		photos: n('honeycomb', '{count} photo', '{count} photos', pictures, { count: formatNumber(pictures) }),
		folders: n('honeycomb', '{count} folder', '{count} folders', folders, { count: formatNumber(folders) }),
	}, undefined, PLAIN_TEXT)
})

const confirmLabel = computed(() => {
	if (!canCull.value) {
		return t('honeycomb', 'Choose')
	}
	const { folders, firstFolder } = count.value!
	return folders === 1
		? t('honeycomb', 'Cull {folder}', { folder: firstFolder!.split('/').pop()! }, undefined, PLAIN_TEXT)
		: n('honeycomb', 'Cull {count} folder', 'Cull {count} folders', folders, { count: formatNumber(folders) })
})

/** Ticks or unticks a folder. */
function onToggle(path: string) {
	set.value = { ...set.value, paths: toggleFolder(set.value.paths, path) }
}

/** Turns *Include subfolders* on or off. */
function onSubfolders(subfolders: boolean) {
	set.value = { ...set.value, subfolders }
}

/** Starts the cull of the counted folders. */
function onConfirm() {
	if (canCull.value) {
		emit('confirm', set.value, count.value!.entries, count.value!.sharedFolders)
	}
}
</script>

<template>
	<ConfirmDialog
		:title="t('honeycomb', 'Choose folders')"
		:confirmLabel="confirmLabel"
		:confirmDisabled="!canCull"
		:cancel="props.current !== null"
		@cancel="emit('cancel')"
		@confirm="onConfirm">
		<p v-if="props.current === null" class="folder-picker__intro">
			{{ t('honeycomb', 'Choose one or more folders of photos to start culling. Decisions save as you go and can be undone; deleting only moves files to the Nextcloud trash bin.') }}
		</p>
		<FolderList :ticked="set.paths" :listFolders="props.listFolders" @toggle="onToggle" />
		<NcCheckboxRadioSwitch
			class="folder-picker__subfolders"
			type="switch"
			:modelValue="set.subfolders"
			:description="t('honeycomb', 'Any depth. Hidden folders, the trash bin and preview folders are skipped.')"
			@update:modelValue="onSubfolders">
			{{ t('honeycomb', 'Include subfolders') }}
		</NcCheckboxRadioSwitch>
		<p class="folder-picker__count" aria-live="polite">
			{{ summary }}
		</p>
		<NcNoteCard v-if="failed" type="error">
			{{ t('honeycomb', 'Could not count the photos.') }}
		</NcNoteCard>
		<NcNoteCard v-if="count?.overCap" type="warning">
			{{ t('honeycomb', 'More than {cap} photos. honeycomb shows the first {cap} by capture time; untick folders to see the rest.', { cap: formatNumber(PICTURE_CAP) }) }}
		</NcNoteCard>
	</ConfirmDialog>
</template>

<style scoped>
.folder-picker__intro {
	margin-bottom: calc(2 * var(--default-grid-baseline));
}

.folder-picker__subfolders {
	margin-top: calc(2 * var(--default-grid-baseline));
}

.folder-picker__count {
	min-height: 1lh;
	margin-top: calc(2 * var(--default-grid-baseline));
	font-weight: bold;
}
</style>
