<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { SeriesCompareFlow } from '../series-compare.ts'

import SeriesCompare from './SeriesCompare.vue'

const props = defineProps<{
	flow: SeriesCompareFlow<Picture<ListingEntry>>
	decisionOf: (picture: Picture<ListingEntry>) => Decision
}>()
</script>

<template>
	<SeriesCompare
		v-if="props.flow.open.value"
		:series="props.flow.current.value"
		:position="props.flow.position.value"
		:count="props.flow.count.value"
		:active="props.flow.active.value"
		:decisionOf="props.decisionOf"
		@decide="props.flow.decide"
		@pickRest="props.flow.pickRest"
		@activate="props.flow.setActive"
		@skip="props.flow.skip"
		@close="props.flow.close" />
</template>
