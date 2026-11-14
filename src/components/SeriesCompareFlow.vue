<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { HotkeyHandlers } from '../hotkeys.ts'
import type { Decision } from '../logic/decision.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { SeriesCompareFlow } from '../series-compare.ts'

import { useTemplateRef } from 'vue'
import SeriesCompare from './SeriesCompare.vue'
import SeriesViewer from './SeriesViewer.vue'

const props = defineProps<{
	flow: SeriesCompareFlow<Picture<ListingEntry>>
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	/** Where the compare and its viewer mount: inside the loupe when opened from it. */
	container?: string
}>()

const emit = defineEmits<{ tag: [picture: Picture<ListingEntry>] }>()

const viewer = useTemplateRef<InstanceType<typeof SeriesViewer>>('viewer')

/** The keys of the series viewer while it is open, else those of the compare. */
function hotkeys(): HotkeyHandlers {
	return viewer.value?.hotkeys ?? props.flow.hotkeys
}

defineExpose({ hotkeys })
</script>

<template>
	<SeriesCompare
		v-if="props.flow.open.value && !props.flow.viewer.open.value"
		:series="props.flow.current.value"
		:position="props.flow.position.value"
		:count="props.flow.count.value"
		:active="props.flow.active.value"
		:decisionOf="props.decisionOf"
		:oneSeries="props.flow.oneSeries.value"
		:container="props.container ?? 'body'"
		@decide="props.flow.decide"
		@pickRest="props.flow.pickRest"
		@activate="props.flow.setActive"
		@view="props.flow.view"
		@columns="props.flow.setColumns"
		@skip="props.flow.skip"
		@close="props.flow.close" />
	<Teleport :to="props.container ?? 'body'">
		<SeriesViewer
			v-if="props.flow.viewer.open.value"
			ref="viewer"
			:pictures="props.flow.viewer.pictures.value"
			:index="props.flow.viewer.index.value"
			:position="props.flow.position.value"
			:count="props.flow.count.value"
			:decisionOf="props.decisionOf"
			:settings="props.flow.settings()"
			@update:index="props.flow.viewer.go"
			@decide="props.flow.decide"
			@pickRest="props.flow.pickRest"
			@toast="props.flow.toast"
			@updateSettings="props.flow.updateSettings"
			@tag="emit('tag', $event)"
			@close="props.flow.viewer.close" />
	</Teleport>
</template>
