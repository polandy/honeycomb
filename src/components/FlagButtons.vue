<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Flag } from '../logic/decision.ts'

import { t } from '@nextcloud/l10n'
import AppIcon from './AppIcon.vue'
import { FLAG_ICONS } from '../flag-icons.ts'
import { keyCap } from '../hotkeys.ts'
import { tip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	/** The flag, or undefined where a selection's flags differ. */
	flag: Flag | undefined
	disabled?: boolean
	/** Large buttons carry their label: a row of their own in portrait, the side edges in landscape. */
	size?: 'small' | 'large'
}>(), { disabled: false, size: 'small' })

const emit = defineEmits<{ flag: [flag: Flag] }>()

const FLAGS: readonly { flag: Flag, key: string, label: () => string }[] = [
	{ flag: 'picked', key: 'pick', label: () => t('honeycomb', 'Pick') },
	{ flag: 'rejected', key: 'reject', label: () => t('honeycomb', 'Reject') },
	{ flag: 'unflagged', key: 'unflag', label: () => t('honeycomb', 'Unflag') },
]
</script>

<template>
	<div
		class="flag-buttons"
		:class="{ 'flag-buttons--large': props.size === 'large' }"
		role="group"
		:aria-label="t('honeycomb', 'Flag')">
		<button
			v-for="button in FLAGS"
			:key="button.flag"
			type="button"
			class="flag-buttons__button"
			:class="`flag-buttons__button--${button.flag}`"
			:disabled="props.disabled"
			:aria-pressed="props.flag === button.flag"
			:aria-label="button.label()"
			v-bind="tip(button.label(), keyCap(button.key))"
			@click="emit('flag', button.flag)">
			<AppIcon :name="FLAG_ICONS[button.flag]" />
			<span v-if="props.size === 'large'" class="flag-buttons__label">{{ button.label() }}</span>
		</button>
	</div>
</template>

<style scoped>
.flag-buttons {
	display: flex;
	gap: 2px;
}

.flag-buttons__button {
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 34px;
	min-height: 34px;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-element);
	background: var(--color-main-background);
	color: var(--color-main-text);
	cursor: pointer;
}

.flag-buttons__button--picked[aria-pressed='true'] {
	border-color: var(--color-success);
	background: var(--color-success);
	color: var(--color-main-background);
}

.flag-buttons__button--rejected[aria-pressed='true'] {
	border-color: var(--color-error);
	background: var(--color-error);
	color: var(--color-main-background);
}

.flag-buttons__button--unflagged[aria-pressed='true'] {
	outline: 2px solid var(--color-main-text);
	outline-offset: -2px;
}

.flag-buttons__button:disabled {
	cursor: default;
	opacity: .5;
}

@media (pointer: coarse) {
	.flag-buttons__button {
		min-width: 44px;
		min-height: 44px;
	}
}

.flag-buttons--large {
	gap: calc(2.5 * var(--default-grid-baseline));
}

.flag-buttons--large .flag-buttons__button {
	flex: 1;
	gap: calc(2 * var(--default-grid-baseline));
	min-height: 56px;
	font-size: 16px;
	font-weight: bold;
}

@media (orientation: landscape) {
	.flag-buttons--large {
		position: absolute;
		inset: 0 var(--photo-loupe-panel, 0px) 0 0;
		display: grid;
		grid-template-columns: var(--flag-buttons-rail) 1fr var(--flag-buttons-rail);
		grid-template-rows: 1fr auto auto 1fr;
		gap: calc(2.5 * var(--default-grid-baseline)) 0;
		pointer-events: none;
		--flag-buttons-rail: 96px;
	}

	.flag-buttons--large .flag-buttons__button {
		flex-direction: column;
		width: calc(var(--flag-buttons-rail) - 12px);
		height: clamp(120px, 36vh, 240px);
		margin: 0 6px;
		font-size: 14px;
		pointer-events: auto;
	}

	.flag-buttons--large .flag-buttons__button--picked {
		grid-area: 2 / 1;
	}

	.flag-buttons--large .flag-buttons__button--rejected {
		grid-area: 2 / 3;
	}

	.flag-buttons--large .flag-buttons__button--unflagged {
		grid-area: 3 / 3;
		height: 56px;
	}

	.flag-buttons--large .flag-buttons__button--unflagged .flag-buttons__label {
		display: none;
	}
}

@media (orientation: landscape) and (pointer: fine) {
	.flag-buttons--large .flag-buttons__button {
		height: clamp(88px, 20vh, 140px);
		font-size: 13px;
	}

	.flag-buttons--large .flag-buttons__button--unflagged {
		height: 40px;
	}
}
</style>
