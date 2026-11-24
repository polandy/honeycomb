<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Bar, Period } from '../logic/statistics.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { formatDay, formatDayRange, formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{ bars: readonly Bar[], period: Period }>()

/** Above this many bars only the first and the last carry a label, so the labels never crowd. */
const MAX_LABELS = 12
const PERCENT = 100
/** The label under a bar: the weekday, the first day, or the month. */
const LABEL_STYLE: Record<Period, Intl.DateTimeFormatOptions> = {
	week: { weekday: 'short' },
	month: { month: 'short', day: 'numeric' },
	year: { month: 'short' },
	all: { month: 'short', year: '2-digit' },
}

const heading = computed(() => ({
	week: t('honeycomb', 'Per day'),
	month: t('honeycomb', 'Per week'),
	year: t('honeycomb', 'Per month'),
	all: t('honeycomb', 'Per month'),
}[props.period]))
const highest = computed(() => Math.max(1, ...props.bars.flatMap((bar) => [bar.decided, bar.trashed])))

/** What a bar shows, for a screen reader. */
function description(bar: Bar): string {
	return t('honeycomb', '{days}: {decided} photos decided, {trashed} moved to the trash bin', {
		days: bar.range.from === bar.range.to ? formatDay(bar.range.from) : formatDayRange(bar.range.from, bar.range.to),
		decided: formatNumber(bar.decided),
		trashed: formatNumber(bar.trashed),
	}, undefined, PLAIN_TEXT)
}

const height = (value: number) => `${(value / highest.value) * PERCENT}%`
const labelled = (index: number) => props.bars.length <= MAX_LABELS || index === 0 || index === props.bars.length - 1
</script>

<template>
	<section class="statistics-bars">
		<h3>{{ heading }}</h3>
		<ul class="statistics-bars__chart">
			<li
				v-for="(bar, index) in props.bars"
				:key="bar.range.from"
				class="statistics-bars__bar"
				role="img"
				:aria-label="description(bar)">
				<span class="statistics-bars__columns">
					<span class="statistics-bars__decided" :style="{ height: height(bar.decided) }" />
					<span class="statistics-bars__trashed" :style="{ height: height(bar.trashed) }" />
				</span>
				<span class="statistics-bars__label" aria-hidden="true">{{ labelled(index) ? formatDay(bar.range.from, LABEL_STYLE[props.period]) : '' }}</span>
			</li>
		</ul>
		<p class="statistics-bars__legend">
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
