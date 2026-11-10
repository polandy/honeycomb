<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { Decision } from '../logic/decision.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import ConfirmDialog from './ConfirmDialog.vue'
import FlagButtons from './FlagButtons.vue'
import FlagMark from './FlagMark.vue'
import PickRestButton from './PickRestButton.vue'
import StarRating from './StarRating.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { keyCap } from '../hotkeys.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { gridSrcset, imageMember, smallSource } from '../logic/image-tiers.ts'
import { SERIES_GAP_SECONDS } from '../logic/series.ts'
import { tip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	/** The shown series, or null once none is left. */
	series: readonly Picture<ListingEntry>[] | null
	/** The shown series' place among `count`, from 0. */
	position: number
	count: number
	/** The active picture's place in the series. */
	active: number
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	imageUrl?: ImageUrlFor
}>(), { imageUrl: apiImageUrl })

const emit = defineEmits<{
	decide: [intent: DecisionIntent, picture: Picture<ListingEntry>]
	pickRest: [picture: Picture<ListingEntry>]
	view: [index: number]
	skip: []
	close: []
}>()

const title = computed(() => (props.series === null
	? t('honeycomb', 'Compare series')
	: t('honeycomb', 'Compare series {i} of {count}', { i: formatNumber(props.position + 1), count: formatNumber(props.count) }, undefined, PLAIN_TEXT)))
/** The picture's flag, or null while it is unflagged. */
function flaggedOf(picture: Picture<ListingEntry>) {
	const { flag } = props.decisionOf(picture)
	return flag === 'unflagged' ? null : flag
}
const within = () => n('honeycomb', 'Photos taken within {count} second of each other.', 'Photos taken within {count} seconds of each other.', SERIES_GAP_SECONDS, { count: formatNumber(SERIES_GAP_SECONDS) }, PLAIN_TEXT)
</script>

<template>
	<ConfirmDialog
		:title="title"
		:confirmLabel="props.series === null ? t('honeycomb', 'Close') : t('honeycomb', 'Skip')"
		:cancel="props.series !== null"
		:cancelLabel="t('honeycomb', 'Close')"
		wide
		@cancel="emit('close')"
		@confirm="props.series === null ? emit('close') : emit('skip')">
		<NcEmptyContent
			v-if="props.series === null"
			:name="t('honeycomb', 'All series compared')"
			:description="n('honeycomb', 'No more photos taken within {count} second of each other are left to decide.', 'No more photos taken within {count} seconds of each other are left to decide.', SERIES_GAP_SECONDS, { count: formatNumber(SERIES_GAP_SECONDS) }, PLAIN_TEXT)" />
		<template v-else>
			<p class="series-compare__hint">
				{{ within() }}
				{{ t('honeycomb', 'Tap a photo to open the series fullscreen, or decide right here. The arrow keys switch the active photo (outlined); P, X, U and 0–5 decide it, {key} picks it and rejects the rest.', { key: keyCap('pick-rest') }, undefined, PLAIN_TEXT) }}
			</p>
			<ul class="series-compare" :class="`series-compare--${props.series.length}`">
				<li v-for="(picture, index) in props.series" :key="imageMember(picture).fileId" class="series-compare__card">
					<button
						type="button"
						class="series-compare__photo"
						:class="{ 'series-compare__photo--active': index === props.active }"
						:aria-pressed="index === props.active"
						:aria-label="t('honeycomb', 'Open photo {i}: {name}', { i: formatNumber(index + 1), name: picture.baseName }, undefined, PLAIN_TEXT)"
						v-bind="tip(t('honeycomb', 'Open in the series viewer'))"
						@click="emit('view', index)">
						<img
							:src="smallSource(imageMember(picture), props.imageUrl)"
							:srcset="gridSrcset(imageMember(picture), props.imageUrl)"
							sizes="(max-width: 700px) 50vw, 25vw"
							alt="">
						<span class="series-compare__name">{{ formatNumber(index + 1) }} · {{ picture.baseName }}</span>
						<span class="series-compare__state">
							<StarRating :rating="props.decisionOf(picture).rating" readonly />
							<FlagMark v-if="flaggedOf(picture) !== null" :flag="flaggedOf(picture)!" />
						</span>
					</button>
					<FlagButtons :flag="props.decisionOf(picture).flag" @flag="emit('decide', { kind: 'flag', flag: $event }, picture)" />
					<PickRestButton @pick="emit('pickRest', picture)" />
				</li>
			</ul>
		</template>
	</ConfirmDialog>
</template>

<style scoped>
.series-compare__hint {
	margin-top: 0;
	color: var(--color-text-maxcontrast);
}

.series-compare {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 8px;
	padding: 0;
	list-style: none;
}

.series-compare--3 {
	grid-template-columns: repeat(3, 1fr);
}

.series-compare--4 {
	grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 700px) {
	.series-compare--3,
	.series-compare--4 {
		grid-template-columns: repeat(2, 1fr);
	}
}

.series-compare__card {
	display: flex;
	flex-direction: column;
	gap: 6px;
	min-width: 0;
}

.series-compare__photo {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 4px;
	border: 2px solid transparent;
	border-radius: var(--border-radius-element);
	background: var(--color-background-dark);
	color: var(--color-main-text);
	text-align: start;
	cursor: pointer;
}

.series-compare__photo--active {
	border-color: var(--color-primary-element);
}

.series-compare__photo img {
	width: 100%;
	aspect-ratio: 3 / 2;
	object-fit: contain;
}

.series-compare__name {
	overflow: hidden;
	font-weight: bold;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.series-compare__state {
	display: flex;
	align-items: center;
	gap: 6px;
	min-height: 20px;
}
</style>
