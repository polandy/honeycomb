<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api.ts'
import type { DeleteFlow } from '../delete-flow.ts'
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { MoveFlow } from '../move-flow.ts'
import type { SidecarFlow } from '../sidecar-flow.ts'

import DeleteDialogs from './DeleteDialogs.vue'
import MoveDialogs from './MoveDialogs.vue'
import SidecarDialogs from './SidecarDialogs.vue'

const props = defineProps<{
	deleting: DeleteFlow
	moving: MoveFlow
	sidecars: SidecarFlow
	folderSet: FolderSet
	/** How many folders the cull shows. */
	folders: number
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	listFolders: (path: string) => Promise<Folder[]>
	/** Where the dialogs open, e.g. inside the loupe; the page body by default. */
	container?: string | undefined
}>()

const deleting = props.deleting
</script>

<template>
	<DeleteDialogs
		:dialog="deleting.dialog.value"
		:rejected="deleting.rejected.value"
		:rawRemoval="deleting.rawRemoval.value"
		:folderSet="props.folderSet"
		:folders="props.folders"
		:busy="deleting.busy.value"
		:container="props.container"
		@rescue="deleting.rescue"
		@toggleKeepRaw="deleting.toggleKeepRaw"
		@continue="deleting.continueToSummary"
		@back="deleting.backToReview"
		@close="deleting.close"
		@confirm="deleting.confirm"
		@retry="deleting.retry" />
	<SidecarDialogs :flow="props.sidecars" :folderSet="props.folderSet" :decisionOf="props.decisionOf" />
	<MoveDialogs
		:flow="props.moving"
		:folderSet="props.folderSet"
		:listFolders="props.listFolders"
		:container="props.container" />
</template>
