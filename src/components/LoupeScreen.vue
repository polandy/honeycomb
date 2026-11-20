<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Series } from '../logic/series.ts'

import { useTemplateRef } from 'vue'
import PhotoLoupe from './PhotoLoupe.vue'
import { useCullContext } from '../cull-context.ts'
import { assertListedSeries, listedPicture } from '../logic/listing.ts'

const { cull, decide, deleting, moving, seriesCompare, unsaved, tagEntry, loupe, restOffer, toast, settings, updateSettings, viewState, storage, imageUrl } = useCullContext()
const { folderSet } = cull
const { shown } = loupe
const photoLoupe = useTemplateRef<InstanceType<typeof PhotoLoupe>>('photoLoupe')

/** Decides the shown picture, offering *Reject the other N* after a Pick. */
function decideShown(intent: DecisionIntent, picture: Picture<SourceEntry>) {
	decide(intent, [picture], () => restOffer(intent, listedPicture(picture)))
}

/** Opens the compare on the shown series, landing the loupe where it closes. */
function compareSeries(series: Series<Picture<SourceEntry>>, picture: Picture<SourceEntry>) {
	assertListedSeries(series)
	seriesCompare.startOn(series, listedPicture(picture), loupe.land, 'loupe')
}

/** Picks the shown picture and rejects the rest of its series, landing the loupe. */
function pickRest(series: Series<Picture<SourceEntry>>, picture: Picture<SourceEntry>) {
	assertListedSeries(series)
	seriesCompare.pickRestAndLand(series, listedPicture(picture), loupe.land)
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
		:decidedOf="cull.decidedOf"
		:seriesOf="cull.seriesOf.value"
		:qualityOf="cull.qualityOf"
		:tagsOf="cull.tags.tagsOf"
		:writabilityOf="cull.writabilityOf"
		:unsaved="unsaved"
		:storage="storage"
		:viewState="viewState"
		:settings="settings"
		:imageUrl="imageUrl"
		@update:index="loupe.page"
		@updateSettings="updateSettings"
		@decide="decideShown"
		@toast="toast($event.message, $event.action)"
		@allDecided="deleting.allDecided"
		@move="moving.openShown([], () => 0)"
		@tag="tagEntry.open([listedPicture($event)])"
		@compareSeries="compareSeries"
		@pickRest="pickRest"
		@close="loupe.close" />
</template>
