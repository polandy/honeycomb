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
import StatisticsBarPlot from './StatisticsBarPlot.vue'
import StatisticsBarTable from './StatisticsBarTable.vue'
import { CHART_METRICS, chartParts } from '../logic/stats-chart.ts'
import { chartHeading, chartSwitchLabel, partLabel } from '../statistics/chart-words.ts'

const props = defineProps<{ bars: readonly PeriodBar[], kind: PeriodKind, unit: BarUnit, counted: boolean }>()
/** `drill` opens the month or year of a held bar (STATS-001.65). */
const emit = defineEmits<{ drill: [target: DrillTarget] }>()

const chart = ref<ChartMetric>('decided')
const table = ref(false)
/** The first day of the held bar, null for none. */
const held = ref<string | null>(null)
/** The first day of the bar under the mouse, null for none. */
const previewed = ref<string | null>(null)
const heading = useTemplateRef<HTMLElement>('heading')

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

/** Opens the held bar's month or year and puts the focus on the new chart. */
async function drill(target: DrillTarget) {
	emit('drill', target)
	await nextTick()
	heading.value?.focus()
}
</script>

<template>
	<section class="statistics-bars">
		<div class="statistics-bars__head">
			<h3 ref="heading" tabindex="-1">
				{{ chartHeading(chart, props.unit) }}
			</h3>
			<div
				v-if="props.counted"
				class="statistics-bars__switch honeycomb-segment"
				role="group"
				:aria-label="t('honeycomb', 'Chart shows')">
				<NcButton
					v-for="each in CHART_METRICS"
					:key="each"
					variant="tertiary"
					:pressed="chart === each"
					@update:pressed="chart = each">
					{{ chartSwitchLabel(each) }}
				</NcButton>
			</div>
		</div>
		<p v-if="!props.counted" class="statistics-bars__empty">
			{{ t('honeycomb', 'Nothing counted in this period.') }}
		</p>
		<template v-else>
			<StatisticsBarTable
				v-if="table"
				:bars="props.bars"
				:unit="props.unit"
				:chart="chart" />
			<StatisticsBarPlot
				v-else
				:bars="props.bars"
				:kind="props.kind"
				:unit="props.unit"
				:chart="chart"
				:held="held"
				@toggle="toggle"
				@preview="previewed = $event" />
			<div class="statistics-bars__foot">
				<p v-if="!table" class="statistics-bars__legend">
					<span v-for="part in chartParts(chart)" :key="part">
						<span class="statistics-bars__key" :class="`statistics-bars__part--${part}`" />{{ partLabel(part) }}
					</span>
					<span v-if="future">
						<span class="statistics-bars__key statistics-bars__key--future" />{{ t('honeycomb', 'Still to come') }}
					</span>
				</p>
				<NcButton class="statistics-bars__table-switch" variant="tertiary" @click="table = !table">
					{{ table ? t('honeycomb', 'Show as chart') : t('honeycomb', 'Show as table') }}
				</NcButton>
			</div>
			<StatisticsBarDetail
				v-if="!table"
				:bar="shown"
				:unit="props.unit"
				@drill="drill" />
		</template>
	</section>
</template>

<style scoped src="../statistics/bar-parts.css" />

<style scoped>
.statistics-bars {
	display: flex;
	flex-direction: column;
	gap: calc(3 * var(--default-grid-baseline));
	box-sizing: border-box;
	min-width: 0;
	padding: calc(4 * var(--default-grid-baseline));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large);
}

.statistics-bars h3 {
	margin: 0;
	font-size: calc(1.2 * var(--default-font-size));
	line-height: var(--default-line-height);
}

.statistics-bars h3:focus {
	outline: none;
}

/* The heading and the key at the start, their switches at the end, wrapped ones still at the end (STATS-001.76). */
.statistics-bars__head,
.statistics-bars__foot {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline)) calc(4 * var(--default-grid-baseline));
}

.statistics-bars__switch,
.statistics-bars__table-switch {
	margin-inline-start: auto;
}

.statistics-bars__switch {
	width: 100%;
}

.statistics-bars__switch > * {
	flex: auto;
}

/* A phone has room for the three names only with narrow padding. */
.statistics-bars__switch :deep(.button-vue) {
	padding-inline: var(--default-grid-baseline);
}

@container (min-width: 560px) {
	.statistics-bars__switch {
		width: auto;
	}

	.statistics-bars__switch > * {
		flex: none;
	}

	.statistics-bars__switch :deep(.button-vue) {
		padding-inline: var(--button-padding);
	}
}

.statistics-bars__empty {
	margin: 0;
	color: var(--color-text-maxcontrast);
}

.statistics-bars__legend {
	display: flex;
	margin: 0;
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
</style>
