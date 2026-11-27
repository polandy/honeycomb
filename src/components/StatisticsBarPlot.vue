<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ChartMetric } from '../logic/stats-chart.ts'
import type { BarUnit, PeriodBar, PeriodKind } from '../logic/stats-period.ts'

import { computed } from 'vue'
import { barSegments, chartScale } from '../logic/stats-chart.ts'
import { barLabel, barTick, formatChartValue } from '../statistics/chart-words.ts'

/** `held` is the first day of the held bar, null for none. */
const props = defineProps<{ bars: readonly PeriodBar[], kind: PeriodKind, unit: BarUnit, chart: ChartMetric, held: string | null }>()
/** `toggle` holds or releases a bar; `preview` names the first day of the bar under the mouse, null when it leaves (STATS-001.64). */
const emit = defineEmits<{ toggle: [bar: PeriodBar], preview: [from: string | null] }>()

const HALF = 2

const scale = computed(() => chartScale(props.bars, props.chart))
const axis = computed(() => [scale.value, scale.value / HALF].map((value) => formatChartValue(props.chart, value)))

/** Previews the bar under a mouse; a touch only taps. */
function preview(event: PointerEvent, bar: PeriodBar) {
	if (event.pointerType === 'mouse') {
		emit('preview', bar.range.from)
	}
}
</script>

<template>
	<div class="statistics-bars__plot">
		<div class="statistics-bars__axis" aria-hidden="true">
			<span v-for="value in axis" :key="value">{{ value }}</span>
		</div>
		<ul class="statistics-bars__chart" @pointerleave="emit('preview', null)">
			<li
				v-for="bar in props.bars"
				:key="bar.range.from"
				class="statistics-bars__bar"
				:class="{ 'statistics-bars__bar--future': bar.future, 'statistics-bars__bar--before-first': bar.beforeFirst, 'statistics-bars__bar--today': bar.today }"
				:data-from="bar.range.from">
				<button
					type="button"
					class="statistics-bars__columns"
					:aria-pressed="props.held === bar.range.from"
					:aria-label="barLabel(bar, props.unit, props.chart)"
					@click="emit('toggle', bar)"
					@pointerenter="preview($event, bar)">
					<i
						v-for="segment in barSegments(bar, props.chart, scale)"
						:key="segment.part"
						class="statistics-bars__part"
						:class="`statistics-bars__part--${segment.part}`"
						:style="{ height: `${segment.percent}%` }" />
				</button>
				<span class="statistics-bars__label" aria-hidden="true">{{ barTick(bar, props.unit, props.kind) }}</span>
			</li>
		</ul>
	</div>
</template>

<style scoped src="../statistics/bar-parts.css" />

<style scoped>
.statistics-bars__plot {
	--statistics-bars-height: 160px;
	--statistics-bars-label: 1.5em;

	display: flex;
	gap: var(--default-grid-baseline);
}

.statistics-bars__axis {
	display: grid;
	grid-template-rows: 1fr 1fr;
	height: calc(var(--statistics-bars-height) - var(--statistics-bars-label));
	font-size: 0.8em;
	line-height: 1;
	white-space: nowrap;
	color: var(--color-text-maxcontrast);
	font-variant-numeric: tabular-nums;
}

.statistics-bars__axis span + span {
	transform: translateY(-50%);
}

.statistics-bars__chart {
	display: flex;
	flex: 1;
	gap: var(--default-grid-baseline);
	min-width: 0;
	height: var(--statistics-bars-height);
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
	flex-direction: column-reverse;
	min-width: 0;
	min-height: 0;
	padding: 0;
	border: none;
	border-block-end: 1px solid var(--color-border);
	border-radius: 0;
	background: transparent;
	cursor: pointer;
}

/* Nextcloud core's button margin outranks a single class. */
.statistics-bars__bar > .statistics-bars__columns {
	margin: 0;
}

.statistics-bars__columns:focus-visible {
	outline: 2px solid var(--color-main-text);
	outline-offset: 1px;
}

.statistics-bars__columns[aria-pressed='true'] {
	background: var(--color-background-hover);
	box-shadow: inset 0 -3px 0 var(--color-main-text);
}

.statistics-bars__bar--today .statistics-bars__columns {
	outline: 2px solid var(--color-primary-element);
	outline-offset: 1px;
}

.statistics-bars__part {
	flex: none;
	transition: height 0.2s ease;
}

.statistics-bars__label {
	flex: none;
	overflow: hidden;
	height: var(--statistics-bars-label);
	font-size: 0.8em;
	line-height: var(--statistics-bars-label);
	text-align: center;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--color-text-maxcontrast);
}

@media (prefers-reduced-motion: reduce) {
	.statistics-bars__part {
		transition: none;
	}
}
</style>
