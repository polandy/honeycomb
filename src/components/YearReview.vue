<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { YearReview } from '../logic/year-review.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, ref } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import { formatDay, formatDuration, formatFileSize, formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{ review: YearReview }>()
const emit = defineEmits<{ open: [] }>()

/** Whether the numbers of the year show below the banner. */
const open = ref(false)
let opened = false

/** Rounds pictures a minute to one decimal. */
const RATE_STEPS = 10
/** Days in a week: the rows of the calendar. */
const WEEK_DAYS = 7

/** The weekday of a day with Monday as 0, which places the first square in its row. */
const firstRow = computed(() => (new Date(props.review.calendar[0]!.day).getUTCDay() + WEEK_DAYS - 1) % WEEK_DAYS + 1)
const headline = computed(() => n('honeycomb', '{count} photo decided, {size} moved to the trash bin', '{count} photos decided, {size} moved to the trash bin', props.review.decided, { count: formatNumber(props.review.decided), size: formatFileSize(props.review.freedBytes) }, PLAIN_TEXT))
const tiles = computed(() => {
	const each = props.review
	const tile = (label: string, value: string, note?: string) => ({ label, value, note })
	return [
		tile(t('honeycomb', 'Moved to the trash bin'), formatNumber(each.trashed), each.deletedForGood > 0 ? n('honeycomb', '%n deleted for good', '%n deleted for good', each.deletedForGood, undefined, PLAIN_TEXT) : undefined),
		tile(t('honeycomb', 'RAW files removed'), formatNumber(each.rawsRemoved), each.rawsRemovedBytes > 0 ? formatFileSize(each.rawsRemovedBytes) : undefined),
		tile(t('honeycomb', 'Sidecars created'), formatNumber(each.sidecarsCreated)),
		tile(t('honeycomb', 'Sidecars updated'), formatNumber(each.sidecarsUpdated), each.sidecarsForeign > 0 ? n('honeycomb', '%n from digiKam or darktable', '%n from digiKam or darktable', each.sidecarsForeign, undefined, PLAIN_TEXT) : undefined),
		tile(t('honeycomb', 'Series done'), formatNumber(each.seriesDone)),
		tile(t('honeycomb', 'Longest streak'), n('honeycomb', '%n day in a row', '%n days in a row', each.longestStreak, undefined, PLAIN_TEXT)),
		...(each.activeMs > 0 ? [tile(t('honeycomb', 'Active time'), formatDuration(each.activeMs), each.perMinute === null ? undefined : t('honeycomb', '{rate} photos a minute', { rate: formatNumber(Math.round(each.perMinute * RATE_STEPS) / RATE_STEPS) }, undefined, PLAIN_TEXT))] : []),
		...(each.busiest === null ? [] : [tile(t('honeycomb', 'Busiest day'), formatDay(each.busiest.day), n('honeycomb', '%n photo decided', '%n photos decided', each.busiest.decided, undefined, PLAIN_TEXT))]),
	]
})

/** Shows or hides the year's numbers; showing them the first time tells the page the year in review was opened (STATS-001.48). */
function toggle() {
	open.value = !open.value
	if (open.value && !opened) {
		opened = true
		emit('open')
	}
}
const activeDays = computed(() => n('honeycomb', '%n active day', '%n active days', props.review.activeDays, undefined, PLAIN_TEXT))
</script>

<template>
	<section class="year-review" :aria-label="t('honeycomb', 'Your {year} in honeycomb', { year: String(props.review.year) }, undefined, PLAIN_TEXT)">
		<h3>{{ t('honeycomb', 'Your {year} in honeycomb', { year: String(props.review.year) }, undefined, PLAIN_TEXT) }}</h3>
		<p class="year-review__headline">
			{{ headline }}
		</p>
		<NcButton class="year-review__toggle" :aria-expanded="open" @click="toggle">
			{{ open ? t('honeycomb', 'Hide the year in review') : t('honeycomb', 'Show the year in review') }}
		</NcButton>
		<dl v-if="open" class="year-review__tiles">
			<div v-for="tile in tiles" :key="tile.label" class="year-review__tile">
				<dt>{{ tile.label }}</dt>
				<dd class="year-review__value">
					{{ tile.value }}
				</dd>
				<dd v-if="tile.note" class="year-review__note">
					{{ tile.note }}
				</dd>
			</div>
		</dl>
		<h4 v-if="open">
			{{ t('honeycomb', 'Active days') }}
		</h4>
		<div
			v-if="open"
			class="year-review__days"
			role="group"
			:aria-label="activeDays">
			<div class="year-review__calendar" aria-hidden="true">
				<i
					v-for="(each, index) in props.review.calendar"
					:key="each.day"
					class="year-review__day"
					:data-shade="each.shade"
					:style="index === 0 ? { gridRowStart: firstRow } : undefined" />
			</div>
			<p>{{ activeDays }}</p>
		</div>
		<p v-if="open && props.review.countedSince" class="year-review__note">
			{{ t('honeycomb', 'Counted since {day}.', { day: formatDay(props.review.countedSince) }, undefined, PLAIN_TEXT) }}
		</p>
	</section>
</template>

<style scoped>
.year-review {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(3 * var(--default-grid-baseline));
	border-radius: var(--border-radius-large);
	background: var(--color-primary-element-light);
}

.year-review h3,
.year-review h4,
.year-review p {
	margin: 0;
}

.year-review__headline {
	font-size: var(--font-size-xlarge, 22px);
	font-weight: bold;
}

.year-review__toggle {
	align-self: flex-start;
}

.year-review__tiles {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: calc(2 * var(--default-grid-baseline));
	margin: 0;
}

.year-review__tile {
	display: flex;
	flex-direction: column;
	padding: calc(2 * var(--default-grid-baseline));
	border-radius: var(--border-radius-element);
	background: var(--color-main-background);
}

.year-review__tile dt,
.year-review__note {
	color: var(--color-text-maxcontrast);
}

.year-review__tile dd {
	margin: 0;
}

.year-review__value {
	font-size: var(--font-size-large, 20px);
	font-weight: bold;
}

.year-review__calendar {
	display: grid;
	grid-auto-flow: column;
	grid-template-rows: repeat(7, 1fr);
	grid-auto-columns: 1fr;
	gap: 2px;
}

.year-review__day {
	aspect-ratio: 1;
	border-radius: 2px;
	background: var(--color-main-background);
}

.year-review__day[data-shade="1"] {
	background: color-mix(in srgb, var(--color-primary-element) 30%, var(--color-main-background));
}

.year-review__day[data-shade="2"] {
	background: color-mix(in srgb, var(--color-primary-element) 65%, var(--color-main-background));
}

.year-review__day[data-shade="3"] {
	background: var(--color-primary-element);
}
</style>
