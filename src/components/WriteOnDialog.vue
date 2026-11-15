<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import ConfirmDialog from './ConfirmDialog.vue'
import { PLAIN_TEXT } from '../l10n.ts'

const props = defineProps<{
	/** Whether confirming turns writing to sidecars On; otherwise it only confirms shared folders. */
	turnsOn: boolean
	/** The names of the opened shared folders a confirm covers, with their subfolders. */
	sharedNames: readonly string[]
	/** Whether the Versions app is enabled; On needs it (SETTINGS-001.26). */
	versionsApp: boolean
	/** Where the dialog opens, e.g. inside the loupe. */
	container?: string | undefined
}>()

const emit = defineEmits<{
	cancel: []
	confirm: []
}>()

const blocked = computed(() => props.turnsOn && !props.versionsApp)
const sharedText = computed(() => t('honeycomb', 'Everyone who shares {folders} will see these decisions, and each change is a new version of their files.', { folders: props.sharedNames.join(', ') }, undefined, PLAIN_TEXT))
</script>

<template>
	<ConfirmDialog
		:title="props.turnsOn ? t('honeycomb', 'Write decisions to XMP sidecars?') : t('honeycomb', 'Write to a shared folder?')"
		:confirmLabel="t('honeycomb', 'Write to sidecars')"
		:confirmDisabled="blocked"
		:container="props.container"
		cancel
		@cancel="emit('cancel')"
		@confirm="emit('confirm')">
		<p v-if="props.turnsOn" class="write-on__intro">
			{{ t('honeycomb', 'From now on every rating, flag, colour label, Keep RAW and tag you set is written to the XMP sidecars of the photo, so digiKam, darktable and Lightroom see it.') }}
			{{ t('honeycomb', 'A file without a sidecar gets a new one, such as {name}.', { name: 'IMG_0001.NEF.xmp' }) }}
		</p>
		<NcNoteCard v-if="props.turnsOn" type="warning" :text="t('honeycomb', 'honeycomb keeps what other programs stored in a sidecar, but they may notice that it changed. Each write is a new version of the file and is synced to your devices.')" />
		<p v-if="props.sharedNames.length > 0">
			{{ sharedText }}
		</p>
		<NcNoteCard v-if="blocked" type="error" :text="t('honeycomb', 'On needs the Versions app, so that every write can be undone; ask your administrator to enable it.')" />
	</ConfirmDialog>
</template>

<style scoped>
.write-on__intro {
	margin-top: 0;
}
</style>
