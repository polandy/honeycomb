<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { n, t } from '@nextcloud/l10n'
import { formatNumber } from '../l10n.ts'
import { tip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	/** The rating, or undefined where a selection's ratings differ. */
	rating: number | undefined
	/** Shows the stars without buttons, as a tile does. */
	readonly?: boolean
	disabled?: boolean
}>(), { readonly: false, disabled: false })

const emit = defineEmits<{ rate: [rating: number] }>()

const RATINGS = [0, 1, 2, 3, 4, 5]

/** What a rating button says to a screen reader. */
function rateLabel(value: number) {
	return value === 0
		? t('honeycomb', 'Clear rating')
		: n('honeycomb', 'Rate {count} star', 'Rate {count} stars', value, { count: formatNumber(value) })
}

/** What a rating button shows: the count, with a star once there is one. */
function buttonText(value: number) {
	return value === 0 ? formatNumber(0) : `${formatNumber(value)}★`
}
</script>

<template>
	<span v-if="props.readonly" class="star-rating--readonly" aria-hidden="true">{{ '★'.repeat(props.rating ?? 0) }}</span>
	<div
		v-else
		class="star-rating"
		role="group"
		:aria-label="t('honeycomb', 'Rating')">
		<button
			v-for="value in RATINGS"
			:key="value"
			type="button"
			class="star-rating__button"
			:disabled="props.disabled"
			:aria-pressed="props.rating === value"
			:aria-label="rateLabel(value)"
			v-bind="tip(rateLabel(value), String(value))"
			@click="emit('rate', value)">
			{{ buttonText(value) }}
		</button>
	</div>
</template>

<style scoped>
.star-rating {
	display: flex;
	gap: 2px;
}

.star-rating--readonly {
	color: var(--color-warning);
}

.star-rating__button {
	min-width: 34px;
	min-height: 34px;
	padding: 0 6px;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-element);
	background: var(--color-main-background);
	color: var(--color-main-text);
	cursor: pointer;
}

.star-rating__button[aria-pressed='true'] {
	border-color: var(--color-primary-element);
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
}

.star-rating__button:disabled {
	cursor: default;
	opacity: .5;
}

@media (pointer: coarse) {
	.star-rating__button {
		min-width: 44px;
		min-height: 44px;
	}
}
</style>
