<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Flag } from '../logic/decision.ts'

import { t } from '@nextcloud/l10n'
import AppIcon from './AppIcon.vue'
import { FLAG_ICONS } from '../flag-icons.ts'
import { toggleChip } from '../logic/picture-filter.ts'

const props = defineProps<{
	flags: ReadonlySet<Flag>
}>()

const emit = defineEmits<{
	'update:flags': [flags: ReadonlySet<Flag>]
}>()

const CHIPS: readonly { flag: Flag, label: () => string }[] = [
	{ flag: 'picked', label: () => t('honeycomb', 'Picked') },
	{ flag: 'unflagged', label: () => t('honeycomb', 'Unflagged') },
	{ flag: 'rejected', label: () => t('honeycomb', 'Rejected') },
]
</script>

<template>
	<div class="flag-filter" role="group" :aria-label="t('honeycomb', 'Flag')">
		<AppIcon name="filter" class="flag-filter__icon" />
		<button
			v-for="chip in CHIPS"
			:key="chip.flag"
			type="button"
			class="flag-filter__chip"
			:aria-label="chip.label()"
			:aria-pressed="props.flags.has(chip.flag)"
			@click="emit('update:flags', toggleChip(props.flags, chip.flag))">
			<AppIcon :name="FLAG_ICONS[chip.flag]" />
			<span class="flag-filter__label">{{ chip.label() }}</span>
		</button>
	</div>
</template>

<style scoped>
.flag-filter {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline);
}

.flag-filter__icon {
	color: var(--color-text-maxcontrast);
}

.flag-filter__chip {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: var(--default-grid-baseline);
	min-width: 34px;
	min-height: 34px;
	margin: 0;
	padding: 0 calc(3 * var(--default-grid-baseline));
	border: 1px solid var(--color-border-maxcontrast);
	border-radius: 17px;
	background: var(--color-background-hover);
	color: var(--color-main-text);
	cursor: pointer;
}

.flag-filter__chip[aria-pressed="true"] {
	border-color: var(--color-primary-element);
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-weight: bold;
}

.flag-filter__chip:focus-visible {
	outline: 2px solid var(--color-primary-element);
	outline-offset: 2px;
}

@media (pointer: coarse) {
	.flag-filter__chip {
		min-width: 44px;
		min-height: 44px;
		border-radius: 22px;
	}
}
</style>
