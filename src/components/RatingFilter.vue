<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { DecisionFilters, RatingComparison } from '../logic/picture-filter.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { nextComparison } from '../logic/picture-filter.ts'
import { formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'
import { tip } from '../shared/tooltip.ts'

const props = defineProps<{
	rating: number | null
	comparison: RatingComparison
}>()

const emit = defineEmits<{
	update: [changes: Partial<Pick<DecisionFilters, 'rating' | 'comparison'>>]
}>()

const STARS = [0, 1, 2, 3, 4, 5]

const COMPARISONS: Record<RatingComparison, { symbol: string, name: () => string, stars: (count: number) => string }> = {
	'at-least': {
		symbol: '≥',
		name: () => t('honeycomb', 'At least'),
		stars: (count) => n('honeycomb', 'At least {count} star', 'At least {count} stars', count, { count: formatNumber(count) }),
	},
	'at-most': {
		symbol: '≤',
		name: () => t('honeycomb', 'At most'),
		stars: (count) => n('honeycomb', 'At most {count} star', 'At most {count} stars', count, { count: formatNumber(count) }),
	},
	exactly: {
		symbol: '=',
		name: () => t('honeycomb', 'Exactly'),
		stars: (count) => n('honeycomb', 'Exactly {count} star', 'Exactly {count} stars', count, { count: formatNumber(count) }),
	},
}

const shown = computed(() => COMPARISONS[props.comparison])
const comparisonLabel = computed(() => (props.rating === null
	? t('honeycomb', 'Rating comparison: pick a star count first')
	: t('honeycomb', 'Rating comparison: {now}. Tap for: {next}', {
			now: shown.value.name(),
			next: COMPARISONS[nextComparison(props.comparison)].name(),
		}, undefined, PLAIN_TEXT)))

/** Sets the rating filter; the pressed star chip, like *Any*, turns it off. */
function setRating(rating: number | null) {
	emit('update', { rating: rating === props.rating ? null : rating })
}
</script>

<template>
	<div class="filter-bar__group" role="group" :aria-label="t('honeycomb', 'Rating')">
		<span class="filter-bar__label" aria-hidden="true">{{ t('honeycomb', 'Rating') }}</span>
		<div class="filter-bar__chips">
			<button
				type="button"
				class="filter-bar__chip filter-bar__comparison"
				:aria-label="comparisonLabel"
				v-bind="tip(comparisonLabel)"
				:disabled="props.rating === null"
				@click="emit('update', { comparison: nextComparison(props.comparison) })">
				{{ shown.symbol }}
			</button>
			<button
				type="button"
				class="filter-bar__chip"
				:aria-pressed="props.rating === null"
				@click="emit('update', { rating: null })">
				{{ t('honeycomb', 'Any') }}
			</button>
			<button
				v-for="count in STARS"
				:key="count"
				type="button"
				class="filter-bar__chip filter-bar__star"
				:aria-label="shown.stars(count)"
				:aria-pressed="props.rating === count"
				@click="setRating(count)">
				{{ `${formatNumber(count)}★` }}
			</button>
		</div>
	</div>
</template>

<style scoped src="./filter-bar.css" />
