<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Overview } from '../logic/stats-overview.ts'

import { t } from '@nextcloud/l10n'
import { computed, useId } from 'vue'
import { changeDirection } from '../logic/stats-overview.ts'
import { formatNumber, formatPercent, PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{
	overview: Overview
	/** The change of pictures decided in percent, null without one (STATS-001.41). */
	change: number | null
	/** The days compared with, e.g. "October" or "the week before". */
	compared: string
}>()

const ARROW = { more: '▲', fewer: '▼', same: '' } as const
const PERCENT = 100
/** The signs that, beside the fill and the hatching, tell picked from rejected without colour. */
const MARK = { picked: '✓', rejected: '✕' } as const
/** A figure that does not exist, e.g. no pictures per active day without an active day. */
const NO_FIGURE = '—'

const labelId = useId()
const direction = computed(() => (props.change === null ? null : changeDirection(props.change)))
const changeWords = computed(() => {
	const period = props.compared
	const change = formatPercent(Math.abs(props.change ?? 0))
	return {
		more: () => t('honeycomb', '{change} more than {period}', { change, period }, undefined, PLAIN_TEXT),
		fewer: () => t('honeycomb', '{change} fewer than {period}', { change, period }, undefined, PLAIN_TEXT),
		same: () => t('honeycomb', 'Same as {period}', { period }, undefined, PLAIN_TEXT),
	}[direction.value ?? 'same']()
})
const pickedShare = computed(() => props.overview.keepRate ?? 0)
const splitLabel = computed(() => t('honeycomb', '{picked} picked, {rejected} rejected', { picked: formatNumber(props.overview.picked), rejected: formatNumber(props.overview.rejected) }, undefined, PLAIN_TEXT))
const rows = computed(() => {
	const { picked, rejected, perActiveDay, activeDays } = props.overview
	return [
		{ name: `${MARK.picked} ${t('honeycomb', 'Picked')}`, figure: formatNumber(picked) },
		{ name: `${MARK.rejected} ${t('honeycomb', 'Rejected')}`, figure: formatNumber(rejected) },
		{ name: t('honeycomb', 'Per active day'), figure: perActiveDay === null ? NO_FIGURE : formatNumber(perActiveDay) },
		{ name: t('honeycomb', 'Active days'), figure: formatNumber(activeDays) },
	]
})
</script>

<template>
	<section class="statistics-hero" :aria-labelledby="labelId">
		<div class="statistics-hero__head">
			<h2 :id="labelId" class="statistics-hero__label">
				{{ t('honeycomb', 'Photos decided') }}
			</h2>
			<p class="statistics-hero__figure">
				<span class="statistics-hero__value">{{ formatNumber(props.overview.decided) }}</span>
				<span v-if="direction" class="statistics-hero__change" :class="`statistics-hero__change--${direction}`"><span v-if="ARROW[direction]" aria-hidden="true">{{ `${ARROW[direction]} ` }}</span>{{ changeWords }}</span>
			</p>
		</div>
		<div class="statistics-hero__body">
			<div class="statistics-hero__split" role="img" :aria-label="splitLabel">
				<i v-if="props.overview.picked > 0" class="statistics-hero__picked" :style="{ width: `${pickedShare}%` }" />
				<i v-if="props.overview.rejected > 0" class="statistics-hero__rejected" :style="{ width: `${PERCENT - pickedShare}%` }" />
			</div>
			<dl class="statistics-hero__rows">
				<div v-for="row in rows" :key="row.name" class="statistics-hero__row">
					<dt>{{ row.name }}</dt>
					<dd>{{ row.figure }}</dd>
				</div>
			</dl>
		</div>
	</section>
</template>

<style scoped>
.statistics-hero {
	display: flex;
	flex-direction: column;
	gap: calc(4 * var(--default-grid-baseline));
	box-sizing: border-box;
	min-width: 0;
	padding: calc(4 * var(--default-grid-baseline));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large);
}

.statistics-hero p,
.statistics-hero__label {
	margin: 0;
}

/* Nextcloud's core styles pad every dl, dt and dd and right-align the dt. */
.statistics-hero__rows,
.statistics-hero__row :is(dt, dd) {
	margin: 0;
	padding: 0;
	text-align: start;
}

.statistics-hero__body {
	display: grid;
	gap: calc(3 * var(--default-grid-baseline));
}

.statistics-hero__label {
	font-size: 1em;
	color: var(--color-text-maxcontrast);
}

.statistics-hero__figure {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 0 calc(2 * var(--default-grid-baseline));
}

.statistics-hero__value {
	font-size: 3em;
	font-weight: bold;
	line-height: 1.1;
	font-variant-numeric: tabular-nums;
}

.statistics-hero__change {
	font-variant-numeric: tabular-nums;
	color: var(--color-text-maxcontrast);
}

.statistics-hero__change--more {
	color: var(--color-success-text);
}

.statistics-hero__split {
	display: flex;
	height: calc(3 * var(--default-grid-baseline));
	overflow: hidden;
	border-radius: var(--border-radius);
	background: var(--color-background-dark);
}

.statistics-hero__split i {
	/* A share that rounds to 0 % stays visible beside its count. */
	min-width: 4px;
	transition: width 0.3s ease;
}

.statistics-hero__picked {
	background: var(--color-success-text);
}

.statistics-hero__rejected {
	background: repeating-linear-gradient(135deg, var(--color-error-text) 0 3px, transparent 3px 6px);
}

.statistics-hero__rows {
	display: grid;
	column-gap: calc(6 * var(--default-grid-baseline));
}

.statistics-hero__row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: calc(2 * var(--default-grid-baseline));
	min-height: calc(8 * var(--default-grid-baseline));
	border-top: 1px solid var(--color-border);
}

.statistics-hero__row dt {
	color: var(--color-text-maxcontrast);
}

.statistics-hero__row dd {
	font-weight: bold;
	font-variant-numeric: tabular-nums;
}

/* The band below 960 px of content: the number at the start, the bar and two columns of rows beside it (STATS-001.75). */
@container (min-width: 560px) {
	.statistics-hero {
		flex-direction: row;
		align-items: center;
		gap: calc(8 * var(--default-grid-baseline));
	}

	.statistics-hero__head {
		flex: none;
		min-width: 176px;
	}

	.statistics-hero__body {
		flex: 1;
	}

	.statistics-hero__rows {
		grid-template-columns: 1fr 1fr;
	}
}

/* Beside the bars in one column, the rows spread down to the hero's bottom. */
@container (min-width: 960px) {
	.statistics-hero {
		flex-direction: column;
		align-items: stretch;
		gap: calc(4 * var(--default-grid-baseline));
	}

	.statistics-hero__head {
		min-width: 0;
	}

	.statistics-hero__body {
		grid-template-rows: auto 1fr;
	}

	.statistics-hero__rows {
		grid-template-columns: 1fr;
		align-content: space-between;
	}
}

@media (prefers-reduced-motion: reduce) {
	.statistics-hero__split i {
		transition: none;
	}
}
</style>
