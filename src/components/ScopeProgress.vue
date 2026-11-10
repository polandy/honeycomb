<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Scope } from '../logic/picture-filter.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { formatNumber } from '../l10n.ts'

const props = defineProps<{
	scope: Scope
	/** Whether a flag filter overrides the scope. */
	locked: boolean
	decided: number
	total: number
}>()

const emit = defineEmits<{
	'update:scope': [scope: Scope]
}>()

const scopes = computed<{ value: Scope, label: string }[]>(() => [
	{ value: 'not-rejected', label: t('honeycomb', 'Not rejected') },
	{ value: 'undecided', label: t('honeycomb', 'Undecided') },
	{ value: 'all', label: t('honeycomb', 'All') },
])
const decidedText = computed(() => n('honeycomb', '{decided} / {total} decided', '{decided} / {total} decided', props.total, {
	decided: formatNumber(props.decided),
	total: formatNumber(props.total),
}))
const percent = computed(() => (props.total > 0 ? Math.round(100 * props.decided / props.total) : 0))
</script>

<template>
	<div class="scope-progress">
		<div
			class="scope-progress__scope"
			role="group"
			:aria-label="t('honeycomb', 'Show')"
			:aria-describedby="props.locked ? 'scope-progress-locked' : undefined">
			<button
				v-for="option in scopes"
				:key="option.value"
				type="button"
				:aria-pressed="props.scope === option.value"
				:aria-label="option.label"
				:disabled="props.locked"
				@click="emit('update:scope', option.value)">
				{{ option.label }}
			</button>
		</div>
		<span v-if="props.locked" id="scope-progress-locked" class="scope-progress__hint">
			{{ t('honeycomb', 'The flag filter overrides this') }}
		</span>
		<span class="scope-progress__count" aria-live="polite">{{ decidedText }}</span>
		<div
			class="scope-progress__bar"
			role="progressbar"
			:aria-label="t('honeycomb', 'Decided')"
			aria-valuemin="0"
			:aria-valuemax="props.total"
			:aria-valuenow="props.decided">
			<span class="scope-progress__done" :style="{ width: `${percent}%` }" />
		</div>
	</div>
</template>

<style scoped>
.scope-progress {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
}

.scope-progress__scope {
	display: flex;
	overflow: hidden;
	border: 1px solid var(--color-border-maxcontrast);
	border-radius: var(--border-radius-element);
}

.scope-progress__scope button {
	min-height: 34px;
	padding: 0 calc(2 * var(--default-grid-baseline));
	border: none;
	background: var(--color-main-background);
	color: var(--color-main-text);
	cursor: pointer;
}

.scope-progress__scope button[aria-pressed="true"] {
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-weight: bold;
}

.scope-progress__scope button:disabled {
	opacity: .5;
	cursor: default;
}

.scope-progress__scope button:focus-visible {
	outline: 2px solid var(--color-primary-element);
	outline-offset: -2px;
}

.scope-progress__hint {
	color: var(--color-text-maxcontrast);
}

.scope-progress__count {
	font-weight: bold;
	font-variant-numeric: tabular-nums;
}

.scope-progress__bar {
	overflow: hidden;
	width: 80px;
	height: 4px;
	border-radius: 2px;
	background: var(--color-background-darker);
}

.scope-progress__done {
	display: block;
	height: 100%;
	background: var(--color-primary-element);
}

@media (pointer: coarse) {
	.scope-progress__scope button {
		min-height: 44px;
	}
}
</style>
