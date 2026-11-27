<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Calendar } from '../logic/stats-calendar.ts'
import type { DrillTarget } from '../logic/stats-chart.ts'
import type { PeriodBar } from '../logic/stats-period.ts'

import { t } from '@nextcloud/l10n'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import StatisticsBarDetail from './StatisticsBarDetail.vue'
import { calendarHint, calendarSubtitle, groupHeading, squareLabel, squareText, weekdayInitial } from '../statistics/calendar-words.ts'

const props = defineProps<{ calendar: Calendar }>()
/** `drill` opens the month of a held month of all time (STATS-001.72). */
const emit = defineEmits<{ drill: [target: DrillTarget] }>()

const LEVELS = [0, 1, 2, 3] as const

/** The first day of the held square, null for none. */
const held = ref<string | null>(null)
const heading = useTemplateRef<HTMLElement>('heading')

const shown = computed(() => props.calendar.groups.flatMap((group) => group.squares).find((square) => square.bar.range.from === held.value)?.bar ?? null)

watch(() => props.calendar, () => {
	held.value = null
})

/** Holds a square in the detail panel, or releases the held one (STATS-001.72). */
function toggle(bar: PeriodBar) {
	held.value = held.value === bar.range.from ? null : bar.range.from
}

/** Opens the held month and puts the focus on the calendar's heading. */
async function drill(target: DrillTarget) {
	emit('drill', target)
	await nextTick()
	heading.value?.focus()
}
</script>

<template>
	<section class="statistics-calendar" :class="`statistics-calendar--${props.calendar.layout}`">
		<h3 ref="heading" tabindex="-1">
			{{ t('honeycomb', 'Activity') }} <small>{{ calendarSubtitle(props.calendar.unit) }}</small>
		</h3>
		<div class="statistics-calendar__groups">
			<div v-for="group in props.calendar.groups" :key="group.anchor" class="statistics-calendar__group">
				<h4 v-if="groupHeading(group.anchor, props.calendar.layout)">
					{{ groupHeading(group.anchor, props.calendar.layout) }}
				</h4>
				<div class="statistics-calendar__grid">
					<template v-if="props.calendar.layout === 'days'">
						<span
							v-for="weekday in props.calendar.weekDays"
							:key="weekday"
							class="statistics-calendar__weekday"
							aria-hidden="true">{{ weekdayInitial(weekday) }}</span>
					</template>
					<span v-for="place in group.lead" :key="`lead-${place}`" class="statistics-calendar__empty" />
					<button
						v-for="square in group.squares"
						:key="square.bar.range.from"
						type="button"
						class="statistics-calendar__square"
						:class="{
							'statistics-calendar__square--future': square.bar.future,
							'statistics-calendar__square--before-first': square.bar.beforeFirst,
							'statistics-calendar__square--today': square.bar.today,
						}"
						:data-from="square.bar.range.from"
						:data-level="square.level"
						:aria-pressed="held === square.bar.range.from"
						:aria-current="square.bar.today && props.calendar.unit === 'day' ? 'date' : undefined"
						:aria-label="squareLabel(square.bar, props.calendar.unit)"
						@click="toggle(square.bar)">
						<span class="statistics-calendar__text">{{ squareText(square.bar, props.calendar.layout) }}</span>
						<i class="statistics-calendar__fill" />
					</button>
				</div>
			</div>
		</div>
		<p class="statistics-calendar__legend">
			{{ t('honeycomb', 'Less') }}
			<span
				v-for="level in LEVELS"
				:key="level"
				class="statistics-calendar__square statistics-calendar__key"
				:data-level="level"
				aria-hidden="true"><i class="statistics-calendar__fill" /></span>
			{{ t('honeycomb', 'More') }} · {{ t('honeycomb', 'the fill height shows the amount') }}
		</p>
		<StatisticsBarDetail
			:bar="shown"
			:unit="props.calendar.unit"
			:hint="calendarHint(props.calendar.unit)"
			@drill="drill" />
	</section>
</template>

<style scoped>
.statistics-calendar {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
}

.statistics-calendar h3,
.statistics-calendar h4 {
	margin: 0;
}

.statistics-calendar h3:focus {
	outline: none;
}

.statistics-calendar h3 small,
.statistics-calendar h4 {
	color: var(--color-text-maxcontrast);
	font-weight: normal;
}

.statistics-calendar__groups {
	display: grid;
	gap: calc(2 * var(--default-grid-baseline));
}

.statistics-calendar--days .statistics-calendar__groups {
	max-width: 28rem;
}

.statistics-calendar--year .statistics-calendar__groups {
	grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
}

.statistics-calendar__grid {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 4px;
}

.statistics-calendar--year .statistics-calendar__grid {
	gap: 2px;
}

/* Two px less between the days keep the squares a finger wide inside a card on a phone. */
@container (max-width: 559px) {
	.statistics-calendar--days .statistics-calendar__grid {
		gap: 2px;
	}
}

.statistics-calendar--all .statistics-calendar__group {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: calc(2 * var(--default-grid-baseline));
	align-items: center;
}

.statistics-calendar--all .statistics-calendar__grid {
	grid-template-columns: repeat(12, 1fr);
}

.statistics-calendar__weekday {
	text-align: center;
	color: var(--color-text-maxcontrast);
	font-size: var(--font-size-small);
}

.statistics-calendar__square {
	position: relative;
	display: flex;
	align-items: flex-start;
	min-width: 0;
	min-height: 0;
	aspect-ratio: 1;
	padding: 0;
	overflow: hidden;
	border: 1px solid var(--color-border-maxcontrast);
	border-radius: var(--border-radius-small, 6px);
	background: var(--color-background-hover);
	color: var(--color-text-maxcontrast);
	font-size: var(--font-size-small);
	font-variant-numeric: tabular-nums;
	cursor: pointer;
}

.statistics-calendar--year .statistics-calendar__grid .statistics-calendar__square {
	border-radius: 2px;
}

.statistics-calendar--year .statistics-calendar__grid .statistics-calendar__square:not(.statistics-calendar__square--today, .statistics-calendar__square--future, .statistics-calendar__square--before-first) {
	border-color: transparent;
}

.statistics-calendar--all .statistics-calendar__grid .statistics-calendar__square {
	aspect-ratio: auto;
	height: var(--default-clickable-area);
	align-items: center;
	justify-content: center;
}

.statistics-calendar__text {
	position: relative;
	z-index: 1;
	padding: 2px 4px;
}

.statistics-calendar--all .statistics-calendar__text {
	padding: 0;
}

.statistics-calendar__fill {
	position: absolute;
	inset: auto 0 0;
	height: 0;
	background: var(--color-primary-element);
}

[data-level="1"] > .statistics-calendar__fill {
	height: 33%;
}

[data-level="2"] > .statistics-calendar__fill {
	height: 67%;
}

[data-level="3"] > .statistics-calendar__fill {
	height: 100%;
}

.statistics-calendar__square[data-level="3"] .statistics-calendar__text {
	color: var(--color-primary-element-text);
	font-weight: bold;
}

.statistics-calendar__square--future {
	border-style: dashed;
	background: repeating-linear-gradient(135deg, var(--color-border) 0 2px, transparent 2px 6px);
}

.statistics-calendar__square--before-first {
	border-style: dotted;
	background: none;
}

.statistics-calendar__square--today {
	border: 2px solid var(--color-main-text);
}

.statistics-calendar__square[aria-pressed="true"] {
	outline: 2px solid var(--color-primary-element);
	outline-offset: 1px;
}

.statistics-calendar__square:focus-visible {
	outline: 2px solid var(--color-main-text);
	outline-offset: 1px;
}

.statistics-calendar__legend {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: calc(1.5 * var(--default-grid-baseline));
	margin: 0;
	color: var(--color-text-maxcontrast);
}

.statistics-calendar__key {
	flex: none;
	width: 16px;
	height: 16px;
	aspect-ratio: auto;
	cursor: default;
}
</style>
