<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ChartMetric } from '../logic/stats-chart.ts'
import type { BarUnit, PeriodBar } from '../logic/stats-period.ts'

import { computed } from 'vue'
import { chartParts, partValue, tableBars } from '../logic/stats-chart.ts'
import { barName, chartHeading, formatChartValue, partLabel, unitName } from '../statistics/chart-words.ts'

const props = defineProps<{ bars: readonly PeriodBar[], unit: BarUnit, chart: ChartMetric }>()

const rows = computed(() => tableBars(props.bars))
const parts = computed(() => chartParts(props.chart))
</script>

<template>
	<div class="statistics-bars__table-scroll">
		<table class="statistics-bars__table" :aria-label="chartHeading(props.chart, props.unit)">
			<thead>
				<tr>
					<th scope="col">
						{{ unitName(props.unit) }}
					</th>
					<th v-for="part in parts" :key="part" scope="col">
						{{ partLabel(part) }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="bar in rows" :key="bar.range.from">
					<td>{{ barName(bar, props.unit) }}</td>
					<td v-for="part in parts" :key="part">
						{{ formatChartValue(props.chart, partValue(bar, part)) }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<style scoped>
.statistics-bars__table-scroll {
	overflow-x: auto;
}

.statistics-bars__table {
	width: 100%;
	border-collapse: collapse;
	font-variant-numeric: tabular-nums;
}

.statistics-bars__table th,
.statistics-bars__table td {
	padding: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
	border-block-end: 1px solid var(--color-border);
	text-align: end;
}

.statistics-bars__table th:first-child,
.statistics-bars__table td:first-child {
	text-align: start;
}
</style>
