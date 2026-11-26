<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Highlights } from '../logic/stats-highlights.ts'
import type { PeriodKind } from '../logic/stats-period.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import { addDays } from '../logic/days.ts'
import { formatDay, formatDuration, formatNumber, formatPercent, PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{
	/** Null for a period without a counter (STATS-001.67). */
	highlights: Highlights | null
	kind: PeriodKind
	/** The days the pace is compared with, e.g. "October" or "the week before". */
	compared: string
}>()
/** `showDay` opens the week of the best day (STATS-001.68). */
const emit = defineEmits<{ showDay: [day: string] }>()

/** A Sunday, from which a weekday's name is read in the user's locale. */
const SUNDAY = '2026-11-01'
const PERCENT = 100
const SECOND_MS = 1000
/** Tenths in one. */
const TENTHS = 10
/** A card without a figure. */
const NO_FIGURE = '—'

/** A weekday average whole, or to a tenth (at least 0.1) while it is below one. */
const shownAverage = (average: number): number => (average < 1 && average > 0 ? Math.max(1, Math.round(average * TENTHS)) / TENTHS : Math.round(average))

const weekdayName = (weekday: number, style: 'long' | 'short'): string => formatDay(addDays(SUNDAY, weekday), { weekday: style })
const bestDay = computed(() => props.highlights?.bestDay ?? null)
const weekday = computed(() => props.highlights?.busiestWeekday ?? null)
const weekdayTop = computed(() => Math.max(...(weekday.value?.days.map((each) => each.average) ?? [0])))
const shownTop = computed(() => shownAverage(weekdayTop.value))
const weekdayLabel = computed(() => t('honeycomb', 'Average photos decided per weekday: {days}', {
	days: (weekday.value?.days ?? []).map((each) => `${weekdayName(each.weekday, 'short')} ${formatNumber(shownAverage(each.average))}`).join(', '),
}, undefined, PLAIN_TEXT))
const paceNote = computed(() => {
	const { change } = props.highlights!.pace
	if (change === null) {
		return t('honeycomb', 'photos a minute')
	}
	const amount = formatNumber(change.amount)
	const period = props.compared
	return {
		more: () => t('honeycomb', '▲ {change} faster than {period}', { change: amount, period }, undefined, PLAIN_TEXT),
		fewer: () => t('honeycomb', '▼ {change} slower than {period}', { change: amount, period }, undefined, PLAIN_TEXT),
		same: () => t('honeycomb', 'Same as {period}', { period }, undefined, PLAIN_TEXT),
	}[change.direction]()
})
const activeShare = computed(() => {
	const { active, days } = props.highlights!.activeDays
	return formatPercent(Math.round(active * PERCENT / Math.max(1, days)))
})
const streakLength = computed(() => props.highlights?.longestStreak?.length ?? 0)
</script>

<template>
	<section class="statistics-highlights" :aria-label="t('honeycomb', 'Highlights')">
		<p v-if="props.highlights === null" class="statistics-highlights__empty">
			{{ t('honeycomb', 'Nothing counted in this period.') }}
		</p>
		<template v-else>
			<div class="statistics-highlights__card">
				<h3>{{ t('honeycomb', 'Best day') }}</h3>
				<p class="statistics-highlights__value">
					{{ bestDay ? formatNumber(bestDay.decided) : NO_FIGURE }}
				</p>
				<p v-if="bestDay" class="statistics-highlights__note">
					{{ t('honeycomb', '{day} · in {time}', { day: formatDay(bestDay.day), time: formatDuration(bestDay.activeSeconds * SECOND_MS) }, undefined, PLAIN_TEXT) }}
				</p>
				<NcButton
					v-if="bestDay && props.kind !== 'week'"
					variant="tertiary"
					class="statistics-highlights__show"
					@click="emit('showDay', bestDay.day)">
					{{ t('honeycomb', 'Show day') }}
				</NcButton>
			</div>
			<div class="statistics-highlights__card">
				<h3>{{ t('honeycomb', 'Busiest weekday') }}</h3>
				<p class="statistics-highlights__value">
					{{ weekday ? weekdayName(weekday.weekday, 'long') : NO_FIGURE }}
				</p>
				<template v-if="weekday">
					<p class="statistics-highlights__note">
						{{ n('honeycomb', '%n photo on average', '%n photos on average', shownTop, undefined, PLAIN_TEXT) }}
					</p>
					<div class="statistics-highlights__week" role="img" :aria-label="weekdayLabel">
						<div v-for="each in weekday.days" :key="each.weekday" :class="{ 'statistics-highlights__day--top': each.weekday === weekday.weekday }">
							<i :style="{ height: `${each.average * PERCENT / weekdayTop}%` }" />
							<span aria-hidden="true">{{ weekdayName(each.weekday, 'short') }}</span>
						</div>
					</div>
				</template>
			</div>
			<div class="statistics-highlights__card">
				<h3>{{ t('honeycomb', 'Pace') }}</h3>
				<p class="statistics-highlights__value">
					{{ props.highlights.pace.pace === null ? NO_FIGURE : formatNumber(props.highlights.pace.pace) }}
				</p>
				<p class="statistics-highlights__note">
					{{ paceNote }}
				</p>
			</div>
			<div class="statistics-highlights__card">
				<h3>{{ t('honeycomb', 'Active days') }}</h3>
				<p class="statistics-highlights__value">
					{{ t('honeycomb', '{active} of {days}', { active: formatNumber(props.highlights.activeDays.active), days: formatNumber(props.highlights.activeDays.days) }, undefined, PLAIN_TEXT) }}
				</p>
				<p class="statistics-highlights__note">
					{{ t('honeycomb', '{share} of the days', { share: activeShare }, undefined, PLAIN_TEXT) }}
				</p>
			</div>
			<div class="statistics-highlights__card">
				<h3>{{ t('honeycomb', 'Longest streak') }}</h3>
				<p class="statistics-highlights__value">
					{{ n('honeycomb', '%n day', '%n days', streakLength, undefined, PLAIN_TEXT) }}
				</p>
				<p v-if="props.highlights.longestStreak" class="statistics-highlights__note">
					{{ props.highlights.longestStreak.length === 1 ? formatDay(props.highlights.longestStreak.from) : t('honeycomb', '{from} to {to}', { from: formatDay(props.highlights.longestStreak.from), to: formatDay(props.highlights.longestStreak.to) }, undefined, PLAIN_TEXT) }}
				</p>
			</div>
		</template>
	</section>
</template>

<style scoped>
.statistics-highlights {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: calc(2 * var(--default-grid-baseline));
}

.statistics-highlights__card {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
	padding: calc(2 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large);
}

.statistics-highlights__card h3,
.statistics-highlights__card p,
.statistics-highlights__empty {
	margin: 0;
}

.statistics-highlights__card h3 {
	font-size: 1em;
	font-weight: normal;
	color: var(--color-text-maxcontrast);
}

.statistics-highlights__value {
	font-size: 1.5em;
	font-weight: bold;
	font-variant-numeric: tabular-nums;
}

.statistics-highlights__note,
.statistics-highlights__empty {
	color: var(--color-text-maxcontrast);
	font-variant-numeric: tabular-nums;
}

.statistics-highlights__show {
	align-self: flex-start;
}

.statistics-highlights__empty {
	grid-column: 1 / -1;
}

.statistics-highlights__week {
	display: flex;
	gap: var(--default-grid-baseline);
	height: calc(8 * var(--default-grid-baseline));
}

.statistics-highlights__week > div {
	display: flex;
	flex: 1;
	flex-direction: column;
	justify-content: flex-end;
	align-items: center;
	gap: 2px;
	font-size: 0.75em;
	color: var(--color-text-maxcontrast);
}

.statistics-highlights__week i {
	display: block;
	width: 100%;
	min-height: 2px;
	border-radius: 3px 3px 0 0;
	background: var(--color-background-dark);
	box-shadow: inset 0 0 0 1px var(--color-border-dark);
}

.statistics-highlights__day--top {
	font-weight: bold;
	color: var(--color-main-text);
}

.statistics-highlights__day--top i {
	background: var(--color-primary-element);
	box-shadow: none;
}
</style>
