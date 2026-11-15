<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { HotkeyHandlers } from '../hotkeys.ts'

import { computed, useTemplateRef } from 'vue'
import SeriesCompare from './SeriesCompare.vue'
import SeriesViewer from './SeriesViewer.vue'
import { useCullContext } from '../cull-context.ts'

const { cull, seriesCompare: flow, tagEntry } = useCullContext()
const viewer = useTemplateRef<InstanceType<typeof SeriesViewer>>('viewer')
/** Where the compare and its viewer mount: inside the loupe when opened from it. */
const container = computed(() => (flow.oneSeries.value ? '.photo-loupe' : 'body'))

/** The keys of the series viewer while it is open, else those of the compare. */
function hotkeys(): HotkeyHandlers {
	return viewer.value?.hotkeys ?? flow.hotkeys
}

defineExpose({ hotkeys })
</script>

<template>
	<SeriesCompare
		v-if="flow.open.value && !flow.viewer.open.value"
		:series="flow.current.value"
		:position="flow.position.value"
		:count="flow.count.value"
		:active="flow.active.value"
		:decisionOf="cull.decisionOf"
		:oneSeries="flow.oneSeries.value"
		:container="container"
		:previous="flow.neighbours.value.previous"
		:next="flow.neighbours.value.next"
		@decide="flow.decide"
		@pickRest="flow.pickRest"
		@remove="flow.removeFromSeries"
		@dissolve="flow.dissolve"
		@merge="flow.merge"
		@activate="flow.setActive"
		@view="flow.view"
		@columns="flow.setColumns"
		@skip="flow.skip"
		@close="flow.close" />
	<Teleport :to="container">
		<SeriesViewer
			v-if="flow.viewer.open.value"
			ref="viewer"
			:pictures="flow.viewer.pictures.value"
			:index="flow.viewer.index.value"
			:position="flow.position.value"
			:count="flow.count.value"
			:decisionOf="cull.decisionOf"
			:settings="flow.settings()"
			@update:index="flow.viewer.go"
			@decide="flow.decideInViewer"
			@pickRest="flow.pickRest"
			@toast="flow.toast"
			@updateSettings="flow.updateSettings"
			@tag="tagEntry.open([$event])"
			@close="flow.viewer.close" />
	</Teleport>
</template>
