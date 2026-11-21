<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { ReductionPlan } from '../logic/series-reduction.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, ref } from 'vue'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import ConfirmDialog from './ConfirmDialog.vue'
import DeleteStats from './DeleteStats.vue'
import PictureThumbs from './PictureThumbs.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { reductionCounts, withoutSeries } from '../logic/series-reduction.ts'

const props = withDefaults(defineProps<{
	/** The series the reduction would decide when the dialog opened. */
	plan: ReductionPlan<Picture<ListingEntry>>
	imageUrl?: ImageUrlFor
}>(), { imageUrl: apiImageUrl })

const emit = defineEmits<{
	confirm: [plan: ReductionPlan<Picture<ListingEntry>>]
	cancel: []
}>()

const plan = ref(props.plan)
const counts = computed(() => reductionCounts(plan.value))
const stats = computed(() => [
	{ value: formatNumber(counts.value.series), label: n('honeycomb', 'series', 'series', counts.value.series) },
	{ value: formatNumber(counts.value.picked), label: t('honeycomb', 'to pick') },
	{ value: formatNumber(counts.value.rejected), label: t('honeycomb', 'to reject') },
])
const kept = computed(() => plan.value.reduced.map((series) => series.kept))

/** The tile's caption: how many photos its series holds. */
function caption(picture: Picture<ListingEntry>): string {
	const size = plan.value.reduced.find((series) => series.kept === picture)!.rejected.length + 1
	return t('honeycomb', 'Sharpest of {count}', { count: formatNumber(size) }, undefined, PLAIN_TEXT)
}

/** Leaves the series of the tapped sharpest photo out of the plan (SERIES-008.4). */
function leaveOut(picture: Picture<ListingEntry>) {
	const series = plan.value.reduced.find((reduced) => reduced.kept === picture)!
	plan.value = withoutSeries(plan.value, series.key)
}
</script>

<template>
	<ConfirmDialog
		:title="t('honeycomb', 'Reduce series to the sharpest')"
		:confirmLabel="n('honeycomb', 'Pick {picked}, reject {count}', 'Pick {picked}, reject {count}', counts.rejected, { picked: formatNumber(counts.picked), count: formatNumber(counts.rejected) }, PLAIN_TEXT)"
		:confirmDisabled="counts.series === 0"
		cancel
		wide
		@cancel="emit('cancel')"
		@confirm="emit('confirm', plan)">
		<NcEmptyContent
			v-if="props.plan.reduced.length === 0"
			:name="t('honeycomb', 'No series to reduce')"
			:description="t('honeycomb', 'No open series has a clear sharpest photo.')" />
		<template v-else>
			<DeleteStats :stats="stats" />
			<p>{{ t('honeycomb', 'Each series keeps its sharpest photo as picked and rejects the rest. Nothing is deleted; one undo takes it all back. Tap a photo to leave its series out.') }}</p>
			<PictureThumbs
				:pictures="kept"
				:action="t('honeycomb', 'Leave out')"
				:caption="caption"
				tone="primary"
				:imageUrl="props.imageUrl"
				@tap="leaveOut" />
		</template>
		<p v-if="counts.leftOut > 0">
			{{ n('honeycomb', '{count} series is left out, for you to compare.', '{count} series are left out, for you to compare.', counts.leftOut, { count: formatNumber(counts.leftOut) }, PLAIN_TEXT) }}
		</p>
	</ConfirmDialog>
</template>
