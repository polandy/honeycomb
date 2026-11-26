<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ChartMetric, DrillTarget } from '../logic/stats-chart.ts'
import type { BarUnit, PeriodBar, PeriodKind } from '../logic/stats-period.ts'

import { t } from '@nextcloud/l10n'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import StatisticsBarDetail from './StatisticsBarDetail.vue'
import StatisticsBarTable from './StatisticsBarTable.vue'
import { barSegments, CHART_METRICS, chartParts, chartScale } from '../logic/stats-chart.ts'
import { barLabel, barTick, chartHeading, chartSwitchLabel, formatChartValue, partLabel } from '../statistics/chart-words.ts'

const props = defineProps<{ bars: readonly PeriodBar[], kind: PeriodKind, unit: BarUnit, counted: boolean }>()
/** `drill` opens the month or year of a held bar (STATS-001.65). */
const emit = defineEmits<{ drill: [target: DrillTarget] }>()

const HALF = 2

const chart = ref<ChartMetric>('decided')
const table = ref(false)
/** The first day of the held bar, null for none. */
const held = ref<string | null>(null)
/** The first day of the bar under the mouse, null for none. */
const previewed = ref<string | null>(null)
const heading = useTemplateRef<HTMLElement>('heading')

const scale = computed(() => chartScale(props.bars, chart.value))
const axis = computed(() => [scale.value, scale.value / HALF].map((value) => formatChartValue(chart.value, value)))
const shown = computed(() => props.bars.find((bar) => bar.range.from === (previewed.value ?? held.value)) ?? null)
const future = computed(() => props.bars.some((bar) => bar.future))

watch(() => props.bars, () => {
	held.value = null
	previewed.value = null
})

/** Holds a bar in the detail panel, or releases the held one (STATS-001.64). */
function toggle(bar: PeriodBar) {
	previewed.value = null
	held.value = held.value === bar.range.from ? null : bar.range.from
}

/** Previews the bar under a mouse; a touch only taps (STATS-001.64). */
function preview(event: PointerEvent, bar: PeriodBar) {
	if (event.pointerType === 'mouse') {
		previewed.value = bar.range.from
	}
}

/** Opens the held bar's month or year and puts the focus on the new chart. */
async function drill(target: DrillTarget) {
	emit('drill', target)
	await nextTick()
	heading.value?.focus()
}
</script>

<template>
	<section class="statistics-bars">
		<h3 ref="heading" tabindex="-1">
			{{ chartHeading(chart, props.unit) }}
		</h3>
		<p v-if="!props.counted" class="statistics-bars__empty">
			{{ t('honeycomb', 'Nothing counted in this period.') }}
		</p>
		<template v-else>
			<div class="statistics-bars__switch" role="group" :aria-label="t('honeycomb', 'Chart shows')">
				<NcButton
					v-for="each in CHART_METRICS"
					:key="each"
					:pressed="chart === each"
					@update:pressed="chart = each">
					{{ chartSwitchLabel(each) }}
				</NcButton>
			</div>
			<StatisticsBarTable
				v-if="table"
				:bars="props.bars"
				:unit="props.unit"
				:chart="chart" />
			<template v-else>
				<div class="statistics-bars__plot">
					<div class="statistics-bars__axis" aria-hidden="true">
						<span v-for="value in axis" :key="value">{{ value }}</span>
					</div>
					<ul class="statistics-bars__chart" @pointerleave="previewed = null">
						<li
							v-for="bar in props.bars"
							:key="bar.range.from"
							class="statistics-bars__bar"
							:class="{ 'statistics-bars__bar--future': bar.future, 'statistics-bars__bar--before-first': bar.beforeFirst, 'statistics-bars__bar--today': bar.today }"
							:data-from="bar.range.from">
							<button
								type="button"
								class="statistics-bars__columns"
								:aria-pressed="held === bar.range.from"
								:aria-label="barLabel(bar, props.unit, chart)"
								@click="toggle(bar)"
								@pointerenter="preview($event, bar)">
								<i
									v-for="segment in barSegments(bar, chart, scale)"
									:key="segment.part"
									class="statistics-bars__part"
									:class="`statistics-bars__part--${segment.part}`"
									:style="{ height: `${segment.percent}%` }" />
							</button>
							<span class="statistics-bars__label" aria-hidden="true">{{ barTick(bar, props.unit, props.kind) }}</span>
						</li>
					</ul>
				</div>
				<p class="statistics-bars__legend">
					<span v-for="part in chartParts(chart)" :key="part">
						<span class="statistics-bars__key" :class="`statistics-bars__part--${part}`" />{{ partLabel(part) }}
					</span>
					<span v-if="future">
						<span class="statistics-bars__key statistics-bars__key--future" />{{ t('honeycomb', 'Still to come') }}
					</span>
				</p>
				<StatisticsBarDetail :bar="shown" :unit="props.unit" @drill="drill" />
			</template>
			<NcButton class="statistics-bars__table-switch" variant="tertiary" @click="table = !table">
				{{ table ? t('honeycomb', 'Show as chart') : t('honeycomb', 'Show as table') }}
			</NcButton>
		</template>
	</section>
</template>

<style scoped>
.statistics-bars {
	--statistics-bars-height: 160px;
	--statistics-bars-label: 1.5em;
}

.statistics-bars h3:focus {
	outline: none;
}

.statistics-bars__switch {
	display: flex;
	flex-wrap: wrap;
	gap: var(--default-grid-baseline);
	margin-block-end: calc(2 * var(--default-grid-baseline));
}

.statistics-bars__plot {
	display: flex;
	gap: var(--default-grid-baseline);
}

.statistics-bars__axis {
	display: grid;
	grid-template-rows: 1fr 1fr;
	height: calc(var(--statistics-bars-height) - var(--statistics-bars-label));
	font-size: 0.8em;
	line-height: 1;
	text-align: end;
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
	margin: 0;
	padding: 0;
	border: none;
	border-block-end: 1px solid var(--color-border);
	border-radius: 0;
	background: transparent;
	cursor: pointer;
}

.statistics-bars__columns:focus-visible {
	outline: 2px solid var(--color-main-text);
	outline-offset: 1px;
}

.statistics-bars__columns[aria-pressed='true'] {
	background: var(--color-background-hover);
	box-shadow: inset 0 -3px 0 var(--color-main-text);
}

.statistics-bars__bar--future .statistics-bars__columns,
.statistics-bars__key--future {
	background: repeating-linear-gradient(135deg, var(--color-border) 0 2px, transparent 2px 6px);
}

.statistics-bars__bar--today .statistics-bars__columns {
	outline: 2px solid var(--color-primary-element);
	outline-offset: 1px;
}

.statistics-bars__part {
	flex: none;
	transition: height 0.2s ease;
}

.statistics-bars__part--picked {
	background: var(--color-success-text);
}

.statistics-bars__part--trash,
.statistics-bars__part--active {
	background: var(--color-primary-element);
}

.statistics-bars__part--rejected,
.statistics-bars__part--deleted {
	background: repeating-linear-gradient(135deg, var(--color-error-text) 0 3px, transparent 3px 6px);
	box-shadow: inset 0 0 0 1px var(--color-error-text);
}

.statistics-bars__part--raws {
	background: radial-gradient(circle, var(--color-primary-element) 1.5px, transparent 1.5px) 0 0 / 5px 5px;
	box-shadow: inset 0 0 0 1px var(--color-primary-element);
}

.statistics-bars__label {
	overflow: hidden;
	min-height: var(--statistics-bars-label);
	font-size: 0.8em;
	text-align: center;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--color-text-maxcontrast);
}

.statistics-bars__empty {
	color: var(--color-text-maxcontrast);
}

.statistics-bars__legend {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline) calc(3 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
}

.statistics-bars__key {
	display: inline-block;
	width: 10px;
	height: 10px;
	margin-inline-end: var(--default-grid-baseline);
	vertical-align: middle;
}

@media (prefers-reduced-motion: reduce) {
	.statistics-bars__part {
		transition: none;
	}
}
</style>
