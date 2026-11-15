<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { useTemplateRef } from 'vue'
import PhotoLoupe from './PhotoLoupe.vue'
import { useCullContext } from '../cull-context.ts'

const { cull, decide, deleting, moving, seriesCompare, tagEntry, loupe, restOffer, toast, settings, updateSettings, viewState, storage } = useCullContext()
const { folderSet } = cull
const { shown } = loupe
const photoLoupe = useTemplateRef<InstanceType<typeof PhotoLoupe>>('photoLoupe')

/** Decides the shown picture, offering *Reject the other N* after a Pick. */
function decideShown(intent: DecisionIntent, picture: Picture<ListingEntry>) {
	decide(intent, [picture], () => restOffer(intent, picture))
}

defineExpose({ loupe: photoLoupe })
</script>

<template>
	<PhotoLoupe
		v-if="shown !== null && folderSet !== null"
		ref="photoLoupe"
		:index="shown.index"
		:pictures="shown.pictures"
		:folderSet="folderSet"
		:decisionOf="cull.decisionOf"
		:seriesOf="cull.seriesOf.value"
		:tagsOf="cull.tags.tagsOf"
		:sidecarWriting="cull.sidecarWriting"
		:storage="storage"
		:viewState="viewState"
		:settings="settings"
		@update:index="loupe.page"
		@updateSettings="updateSettings"
		@decide="decideShown"
		@toast="toast($event.message, $event.action)"
		@allDecided="deleting.allDecided"
		@move="moving.openShown([], () => 0)"
		@tag="tagEntry.open([$event])"
		@compareSeries="(series, picture) => seriesCompare.startOn(series, picture, loupe.land)"
		@pickRest="(series, picture) => seriesCompare.pickRestAndLand(series, picture, loupe.land)"
		@close="loupe.close" />
</template>
