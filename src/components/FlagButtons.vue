<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Flag } from '../logic/decision.ts'
import type { IconName } from './AppIcon.vue'

import { t } from '@nextcloud/l10n'
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{
	/** The flag, or undefined where a selection's flags differ. */
	flag: Flag | undefined
	disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ flag: [flag: Flag] }>()

const FLAGS: readonly { flag: Flag, icon: IconName, label: () => string }[] = [
	{ flag: 'picked', icon: 'flagPick', label: () => t('honeycomb', 'Pick') },
	{ flag: 'rejected', icon: 'flagX', label: () => t('honeycomb', 'Reject') },
	{ flag: 'unflagged', icon: 'flag', label: () => t('honeycomb', 'Unflag') },
]
</script>

<template>
	<div class="flag-buttons" role="group" :aria-label="t('honeycomb', 'Flag')">
		<button
			v-for="button in FLAGS"
			:key="button.flag"
			type="button"
			class="flag-buttons__button"
			:class="`flag-buttons__button--${button.flag}`"
			:disabled="props.disabled"
			:aria-pressed="props.flag === button.flag"
			:aria-label="button.label()"
			@click="emit('flag', button.flag)">
			<AppIcon :name="button.icon" />
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
</style>
