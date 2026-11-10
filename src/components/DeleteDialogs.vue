<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { DeleteDialog } from '../delete-flow.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { RawRemoval } from '../logic/raw-removal.ts'

import DeleteReport from './DeleteReport.vue'
import DeleteSummary from './DeleteSummary.vue'
import RawRemovalSummary from './RawRemovalSummary.vue'
import RejectReview from './RejectReview.vue'

const props = defineProps<{
	/** The open step of the delete, if any. */
	dialog: DeleteDialog | null
	rejected: readonly Picture<ListingEntry>[]
	/** What *Remove RAWs* does while its summary is open. */
	rawRemoval: RawRemoval | null
	folderSet: FolderSet
	/** How many folders the cull shows. */
	folders: number
	busy: boolean
	/** Where the dialogs open, e.g. inside the loupe; the page body by default. */
	container?: string | undefined
}>()

const emit = defineEmits<{
	rescue: [picture: Picture<ListingEntry>]
	toggleKeepRaw: [picture: Picture<ListingEntry>]
	continue: []
	back: []
	close: []
	confirm: []
	retry: []
}>()
</script>

<template>
	<RejectReview
		v-if="props.dialog?.kind === 'review'"
		:pictures="props.rejected"
		:folderSet="props.folderSet"
		:folders="props.folders"
		:container="props.container"
		@rescue="emit('rescue', $event)"
		@cancel="emit('close')"
		@confirm="emit('continue')" />
	<DeleteSummary
		v-else-if="props.dialog?.kind === 'summary'"
		:pictures="props.dialog.pictures"
		:folderSet="props.folderSet"
		:fromReview="props.dialog.fromReview"
		:busy="props.busy"
		:container="props.container"
		@back="emit('back')"
		@cancel="emit('close')"
		@confirm="emit('confirm')" />
	<RawRemovalSummary
		v-else-if="props.dialog?.kind === 'raws' && props.rawRemoval !== null"
		:removal="props.rawRemoval"
		:folderSet="props.folderSet"
		:busy="props.busy"
		:container="props.container"
		@toggle="emit('toggleKeepRaw', $event)"
		@cancel="emit('close')"
		@confirm="emit('confirm')" />
	<DeleteReport
		v-else-if="props.dialog?.kind === 'report'"
		:report="props.dialog.report"
		:folderSet="props.folderSet"
		:busy="props.busy"
		:container="props.container"
		@close="emit('close')"
		@retry="emit('retry')" />
</template>
