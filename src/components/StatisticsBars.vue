<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { BarUnit, PeriodBar, PeriodKind } from '../logic/stats-period.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { formatDay, formatDayRange, formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{ bars: readonly PeriodBar[], kind: PeriodKind, unit: BarUnit }>()

const PERCENT = 100
const WEEK_DAYS = 7
const DAY_START = 'YYYY-MM-'.length
const YEAR_LENGTH = 'YYYY'.length

const heading = computed(() => ({
	day: t('honeycomb', 'Per day'),
	month: t('honeycomb', 'Per month'),
	year: t('honeycomb', 'Per year'),
}[props.unit]))
const highest = computed(() => Math.max(1, ...props.bars.flatMap((bar) => [bar.decided, bar.trashed])))
const empty = computed(() => props.bars.every((bar) => bar.decided === 0 && bar.trashed === 0))

/** The label under a bar: the weekday, every seventh day of a month from the 1st, the month or the year. */
function label(bar: PeriodBar): string {
	const day = bar.range.from
	if (props.unit === 'year') {
		return day.slice(0, YEAR_LENGTH)
	}
	if (props.unit === 'month') {
		return formatDay(day, { month: 'short' })
	}
	if (props.kind === 'week') {
		return formatDay(day, { weekday: 'short' })
	}
	const date = Number(day.slice(DAY_START))
	return (date - 1) % WEEK_DAYS === 0 ? String(date) : ''
}

/** What a bar shows, for a screen reader. */
function description(bar: PeriodBar): string {
	return t('honeycomb', '{days}: {decided} photos decided, {trashed} moved to the trash bin', {
		days: bar.range.from === bar.range.to ? formatDay(bar.range.from) : formatDayRange(bar.range.from, bar.range.to),
		decided: formatNumber(bar.decided),
		trashed: formatNumber(bar.trashed),
	}, undefined, PLAIN_TEXT)
}

const height = (value: number) => `${(value / highest.value) * PERCENT}%`
</script>

<template>
	<section class="statistics-bars">
		<h3>{{ heading }}</h3>
		<p v-if="empty" class="statistics-bars__empty">
			{{ t('honeycomb', 'Nothing counted in this period.') }}
		</p>
		<ul v-else class="statistics-bars__chart">
			<li
				v-for="bar in props.bars"
				:key="bar.range.from"
				class="statistics-bars__bar"
				:class="{ 'statistics-bars__bar--future': bar.future, 'statistics-bars__bar--before-first': bar.beforeFirst, 'statistics-bars__bar--today': bar.today }"
				role="img"
				:aria-label="description(bar)">
				<span class="statistics-bars__columns">
					<span class="statistics-bars__decided" :style="{ height: height(bar.decided) }" />
					<span class="statistics-bars__trashed" :style="{ height: height(bar.trashed) }" />
				</span>
				<span class="statistics-bars__label" aria-hidden="true">{{ label(bar) }}</span>
			</li>
		</ul>
		<p v-if="!empty" class="statistics-bars__legend">
			<span class="statistics-bars__key statistics-bars__key--decided" />{{ t('honeycomb', 'Photos decided') }}
			<span class="statistics-bars__key statistics-bars__key--trashed" />{{ t('honeycomb', 'Moved to the trash bin') }}
		</p>
	</section>
</template>

<style scoped>
.statistics-bars__chart {
	display: flex;
	gap: var(--default-grid-baseline);
	height: 160px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.statistics-bars__bar {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
}

.statistics-bars__columns {
	display: flex;
	flex: 1;
	align-items: flex-end;
	gap: 2px;
	border-block-end: 1px solid var(--color-border);
}

.statistics-bars__bar--future .statistics-bars__columns {
	background: repeating-linear-gradient(135deg, var(--color-border) 0 2px, transparent 2px 6px);
}

.statistics-bars__bar--today .statistics-bars__columns {
	outline: 2px solid var(--color-primary-element);
	outline-offset: 1px;
}

.statistics-bars__empty {
	color: var(--color-text-maxcontrast);
}

.statistics-bars__columns > span {
	flex: 1;
	border-radius: 2px 2px 0 0;
}

.statistics-bars__decided,
.statistics-bars__key--decided {
	background: var(--color-primary-element);
}

.statistics-bars__trashed,
.statistics-bars__key--trashed {
	background: var(--color-text-maxcontrast);
}

.statistics-bars__label {
	overflow: hidden;
	min-height: 1.5em;
	font-size: 0.8em;
	text-align: center;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--color-text-maxcontrast);
}

.statistics-bars__legend {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
}

.statistics-bars__key {
	display: inline-block;
	width: 10px;
	height: 10px;
	margin-inline-end: calc(-1 * var(--default-grid-baseline));
	border-radius: 2px;
}
</style>
