<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { CommonDecision, DecisionIntent } from '../logic/decision-change.ts'

import { t } from '@nextcloud/l10n'
import ColourLabels from './ColourLabels.vue'
import FlagButtons from './FlagButtons.vue'
import StarRating from './StarRating.vue'

const props = withDefaults(defineProps<{
	/** What the pictures the bar acts on share. */
	common: CommonDecision
	disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ decide: [intent: DecisionIntent] }>()
</script>

<template>
	<div class="action-bar">
		<slot />
		<StarRating :rating="props.common.rating" :disabled="props.disabled" @rate="emit('decide', { kind: 'rating', rating: $event })" />
		<ColourLabels :colourLabel="props.common.colourLabel" :disabled="props.disabled" @choose="emit('decide', { kind: 'colourLabel', colourLabel: $event })" />
		<button
			type="button"
			class="action-bar__keep-raw"
			:disabled="props.disabled || !props.common.canKeepRaw"
			:aria-pressed="props.common.keepRaw === true"
			:aria-label="props.common.canKeepRaw ? t('honeycomb', 'Keep RAW') : t('honeycomb', 'Keep RAW: only for pairs')"
			@click="emit('decide', { kind: 'keepRaw' })">
			{{ t('honeycomb', 'Keep RAW') }}
		</button>
		<FlagButtons :flag="props.common.flag" :disabled="props.disabled" @flag="emit('decide', { kind: 'flag', flag: $event })" />
	</div>
</template>

<style scoped>
.action-bar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(2 * var(--default-grid-baseline));
	border-top: 1px solid var(--color-border);
	background: var(--color-main-background);
}

.action-bar__keep-raw {
	min-height: 34px;
	padding: 0 12px;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-element);
	background: var(--color-main-background);
	color: var(--color-main-text);
	cursor: pointer;
}

.action-bar__keep-raw[aria-pressed='true'] {
	border-color: var(--color-primary-element);
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
}

.action-bar__keep-raw:disabled {
	cursor: default;
	opacity: .5;
}

@media (pointer: coarse) {
	.action-bar__keep-raw {
		min-height: 44px;
	}
}
</style>
