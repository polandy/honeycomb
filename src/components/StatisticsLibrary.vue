<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { LibraryCard } from '../logic/stats-library.ts'

import { n, t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import NcButton from '@nextcloud/vue/components/NcButton'
import ProgressBar from './ProgressBar.vue'
import { formatFileSize, formatNumber, formatPercent, PLAIN_TEXT } from '../shared/l10n.ts'
import { forecastNote, forecastText } from '../statistics/library-words.ts'

const props = defineProps<{
	roots: readonly string[]
	/** The card's numbers; null while they are not read. */
	card: LibraryCard | null
	failed: boolean
}>()

const PERCENT = 100
const foldersUrl = generateUrl('/apps/honeycomb/')
</script>

<template>
	<section class="statistics-library">
		<h3>{{ t('honeycomb', 'Library progress') }}</h3>
		<p v-if="props.roots.length === 0" class="statistics-library__note">
			{{ t('honeycomb', 'Choose your library') }}
		</p>
		<p v-else-if="props.failed" class="statistics-library__note">
			{{ t('honeycomb', 'The library progress could not be loaded.') }}
		</p>
		<template v-else-if="props.card !== null">
			<div class="statistics-library__head">
				<div
					class="statistics-library__ring"
					role="img"
					:aria-label="t('honeycomb', '{percent} of the photos are in folders marked done', { percent: formatPercent(props.card.progress.total.donePercent) }, undefined, PLAIN_TEXT)">
					<svg viewBox="0 0 120 120" aria-hidden="true">
						<circle class="statistics-library__track" cx="60" cy="60" r="52" />
						<circle
							class="statistics-library__arc"
							cx="60"
							cy="60"
							r="52"
							pathLength="100"
							:stroke-dasharray="`${props.card.progress.total.donePercent} ${PERCENT}`" />
					</svg>
					<span class="statistics-library__ring-text" aria-hidden="true">
						<b>{{ formatPercent(props.card.progress.total.donePercent) }}</b>
						<small>{{ t('honeycomb', 'done') }}</small>
					</span>
				</div>
				<ul class="statistics-library__facts">
					<li class="statistics-library__fact">
						<b>{{ formatPercent(props.card.progress.total.decidedPercent) }}</b>
						<small>{{ t('honeycomb', 'of the photos decided') }}</small>
						<ProgressBar
							class="statistics-library__bar"
							:label="t('honeycomb', '{percent} of the photos decided', { percent: formatPercent(props.card.progress.total.decidedPercent) }, undefined, PLAIN_TEXT)"
							:value="props.card.progress.total.decidedPercent"
							:max="PERCENT" />
					</li>
					<li class="statistics-library__fact">
						<b>{{ formatNumber(props.card.progress.total.doneFolders) }} / {{ formatNumber(props.card.progress.total.folders) }}</b>
						<small>{{ t('honeycomb', 'folders done · +{count} this month', { count: formatNumber(props.card.progress.total.doneThisMonth) }, undefined, PLAIN_TEXT) }}</small>
					</li>
					<li class="statistics-library__fact">
						<b>{{ formatNumber(props.card.undecided) }}</b>
						<small>{{ n('honeycomb', 'photo still undecided', 'photos still undecided', props.card.undecided) }}</small>
					</li>
					<li v-if="props.card.forecast !== null" class="statistics-library__fact statistics-library__forecast">
						<b>{{ forecastText(props.card.forecast) }}</b>
						<small>{{ forecastNote(props.card.forecast) }}</small>
					</li>
				</ul>
			</div>
			<ul v-if="props.roots.length > 1" class="statistics-library__roots">
				<li v-for="each in props.card.progress.perRoot" :key="each.root" class="statistics-library__root">
					<span class="statistics-library__root-line">
						<span class="statistics-library__root-name" translate="no">{{ each.root }}</span>
						<span class="statistics-library__root-done">
							{{ t('honeycomb', '{done} of {photos} photos done · {percent}', { done: formatNumber(each.progress.donePhotos), photos: formatNumber(each.progress.photos), percent: formatPercent(each.progress.donePercent) }, undefined, PLAIN_TEXT) }}
						</span>
					</span>
					<ProgressBar
						class="statistics-library__bar"
						:label="t('honeycomb', '{root}: {percent} done', { root: each.root, percent: formatPercent(each.progress.donePercent) }, undefined, PLAIN_TEXT)"
						:value="each.progress.donePhotos"
						:max="each.progress.photos" />
				</li>
			</ul>
		</template>
		<div class="statistics-library__open">
			<p v-if="props.card !== null && props.card.doneRawBytes > 0" class="statistics-library__raws">
				{{ t('honeycomb', 'Up to {size} of RAW files lie in folders marked done.', { size: formatFileSize(props.card.doneRawBytes) }, undefined, PLAIN_TEXT) }}
			</p>
			<NcButton :href="foldersUrl">
				{{ t('honeycomb', 'Open Folders') }}
			</NcButton>
		</div>
	</section>
</template>

<style scoped>
.statistics-library {
	display: flex;
	flex-direction: column;
	gap: calc(3 * var(--default-grid-baseline));
}

.statistics-library h3,
.statistics-library p {
	margin: 0;
}

.statistics-library__note,
.statistics-library small {
	color: var(--color-text-maxcontrast);
}

.statistics-library b {
	font-variant-numeric: tabular-nums;
}

.statistics-library__head {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(4 * var(--default-grid-baseline));
}

.statistics-library__ring {
	position: relative;
	flex: none;
	width: 128px;
	height: 128px;
}

.statistics-library__ring svg {
	width: 100%;
	height: 100%;
	transform: rotate(-90deg);
}

.statistics-library__ring circle {
	fill: none;
	stroke-width: 14;
}

.statistics-library__track {
	stroke: var(--color-background-darker);
}

.statistics-library__arc {
	stroke: var(--color-primary-element);
	stroke-linecap: round;
}

.statistics-library__ring-text {
	position: absolute;
	inset: 0;
	display: grid;
	place-content: center;
	text-align: center;
}

.statistics-library__ring-text b {
	font-size: 28px;
	line-height: 1;
}

.statistics-library__facts {
	display: grid;
	flex: 1 1 200px;
	gap: calc(2 * var(--default-grid-baseline));
}

.statistics-library__fact {
	display: grid;
}

.statistics-library__fact b {
	font-size: 18px;
}

.statistics-library__bar {
	width: 100%;
	height: 8px;
	margin-top: var(--default-grid-baseline);
	border-radius: 4px;
}

.statistics-library__roots {
	display: grid;
	gap: calc(2 * var(--default-grid-baseline));
}

.statistics-library__root-line {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	gap: 0 calc(2 * var(--default-grid-baseline));
	font-size: 13px;
}

.statistics-library__root-name {
	overflow-wrap: anywhere;
}

.statistics-library__root-done {
	color: var(--color-text-maxcontrast);
	font-variant-numeric: tabular-nums;
}

.statistics-library__open {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: calc(2 * var(--default-grid-baseline));
	margin-top: auto;
}
</style>
