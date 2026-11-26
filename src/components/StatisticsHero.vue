<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Overview } from '../logic/stats-overview.ts'

import { n, t } from '@nextcloud/l10n'
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
const picked = computed(() => n('honeycomb', '%n picked', '%n picked', props.overview.picked, undefined, PLAIN_TEXT))
const rejected = computed(() => n('honeycomb', '%n rejected', '%n rejected', props.overview.rejected, undefined, PLAIN_TEXT))
const perDay = computed(() => {
	const { activeDays, perActiveDay } = props.overview
	return perActiveDay === null
		? t('honeycomb', 'No active day in this period')
		: n('honeycomb', '{perDay} per active day · %n active day', '{perDay} per active day · %n active days', activeDays, { perDay: formatNumber(perActiveDay) }, PLAIN_TEXT)
})
</script>

<template>
	<section class="statistics-hero" :aria-labelledby="labelId">
		<h2 :id="labelId" class="statistics-hero__label">
			{{ t('honeycomb', 'Photos decided') }}
		</h2>
		<p class="statistics-hero__figure">
			<span class="statistics-hero__value">{{ formatNumber(props.overview.decided) }}</span>
			<span v-if="direction" class="statistics-hero__change" :class="`statistics-hero__change--${direction}`"><span v-if="ARROW[direction]" aria-hidden="true">{{ `${ARROW[direction]} ` }}</span>{{ changeWords }}</span>
		</p>
		<div class="statistics-hero__split" role="img" :aria-label="splitLabel">
			<i v-if="props.overview.picked > 0" class="statistics-hero__picked" :style="{ width: `${pickedShare}%` }" />
			<i v-if="props.overview.rejected > 0" class="statistics-hero__rejected" :style="{ width: `${PERCENT - pickedShare}%` }" />
		</div>
		<p class="statistics-hero__key">
			<span>{{ MARK.picked }} {{ picked }}</span> <span>{{ MARK.rejected }} {{ rejected }}</span>
		</p>
		<p class="statistics-hero__per-day">
			{{ perDay }}
		</p>
	</section>
</template>

<style scoped>
.statistics-hero {
	display: grid;
	gap: var(--default-grid-baseline);
	align-content: start;
	padding: calc(3 * var(--default-grid-baseline));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large);
}

.statistics-hero p,
.statistics-hero__label {
	margin: 0;
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
	background: var(--color-success);
}

.statistics-hero__rejected {
	background: repeating-linear-gradient(135deg, var(--color-error) 0 3px, transparent 3px 6px);
}

.statistics-hero__key {
	display: flex;
	flex-wrap: wrap;
	gap: 0 calc(3 * var(--default-grid-baseline));
	font-variant-numeric: tabular-nums;
}

.statistics-hero__per-day {
	color: var(--color-text-maxcontrast);
	font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
	.statistics-hero__split i {
		transition: none;
	}
}
</style>
