<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision, Flag } from '../logic/decision.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { t } from '@nextcloud/l10n'
import AppIcon from './AppIcon.vue'
import FlagButtons from './FlagButtons.vue'
import FlagMark from './FlagMark.vue'
import StarRating from './StarRating.vue'
import { keyCap } from '../hotkeys.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { gridSrcset, imageMember, smallSource } from '../logic/image-tiers.ts'
import { tip } from '../tooltip.ts'

const props = defineProps<{
	picture: Picture<ListingEntry>
	/** The card's place in the series, from 0. */
	index: number
	active: boolean
	decision: Decision
	imageUrl: ImageUrlFor
	/** The photo's width in CSS pixels, or null before the grid is measured. */
	photoWidth: number | null
}>()

const emit = defineEmits<{
	/** A tap or click on the photo; the compare tells a double tap from it. */
	tap: [event: MouseEvent]
	view: []
	flag: [flag: Flag]
}>()
</script>

<template>
	<li class="series-compare__card" :class="{ 'series-compare__card--active': props.active }">
		<div class="series-compare__frame">
			<button
				type="button"
				class="series-compare__photo"
				:aria-pressed="props.active"
				:aria-label="t('honeycomb', 'Photo {i}: {name}', { i: formatNumber(props.index + 1), name: props.picture.baseName }, undefined, PLAIN_TEXT)"
				v-bind="tip(t('honeycomb', 'Make active, double-tap to view full screen'))"
				@click="emit('tap', $event)"
				@keydown.enter.prevent="emit('view')">
				<img
					:src="smallSource(imageMember(props.picture), props.imageUrl)"
					:srcset="gridSrcset(imageMember(props.picture), props.imageUrl)"
					:sizes="props.photoWidth === null ? '33vw' : `${props.photoWidth}px`"
					alt="">
			</button>
			<button
				type="button"
				class="series-compare__full"
				:aria-label="t('honeycomb', 'View photo {i} full screen', { i: formatNumber(props.index + 1) }, undefined, PLAIN_TEXT)"
				v-bind="tip(t('honeycomb', 'View full screen'), keyCap('open'))"
				@click="emit('view')">
				<AppIcon name="expand" />
			</button>
		</div>
		<span class="series-compare__label">
			<span class="series-compare__name">{{ formatNumber(props.index + 1) }} · {{ props.picture.baseName }}</span>
			<StarRating :rating="props.decision.rating" readonly />
			<FlagMark v-if="props.decision.flag !== 'unflagged'" :flag="props.decision.flag" />
		</span>
		<FlagButtons :flag="props.decision.flag" @flag="emit('flag', $event)" />
	</li>
</template>

<style scoped>
/* Border and padding make up CARD_FRAME; with the label row and the flag buttons, CARD_CHROME_HEIGHT. */
.series-compare__card {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	padding: 4px;
	border: 2px solid transparent;
	border-radius: var(--border-radius-element);
	background: var(--color-background-dark);
}

.series-compare__card--active {
	border-color: var(--color-primary-element);
}

.series-compare__frame {
	position: relative;
}

.series-compare__photo {
	display: block;
	padding: 0;
	border: 0;
	background: none;
	cursor: pointer;
}

.series-compare__photo img {
	display: block;
	width: var(--series-compare-photo-width, 100%);
	aspect-ratio: 3 / 2;
	object-fit: contain;
}

/* Always shown on a dark disc, so it reads on any photo (owner point 4). */
.series-compare__full {
	position: absolute;
	top: 6px;
	right: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 44px;
	height: 44px;
	padding: 0;
	border: 0;
	border-radius: 50%;
	background-color: rgba(0, 0, 0, .7);
	color: #fff;
	cursor: pointer;
}

@media (pointer: fine) {
	.series-compare__full {
		width: 34px;
		height: 34px;
	}
}

.series-compare__label {
	display: flex;
	align-items: center;
	gap: 6px;
	min-height: 24px;
	color: var(--color-main-text);
}

.series-compare__name {
	flex: 1;
	overflow: hidden;
	font-weight: bold;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
