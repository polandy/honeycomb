<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ConflictChoice } from '../logic/move-plan.ts'

import { t } from '@nextcloud/l10n'

const props = defineProps<{
	/** The chosen way, or null when the conflicts it sets differ. */
	choice: ConflictChoice | null
	/** The group's accessible name. */
	label: string
}>()

const emit = defineEmits<{
	choose: [choice: ConflictChoice]
}>()

const CHOICES: readonly { choice: ConflictChoice, label: string }[] = [
	{ choice: 'suffix', label: t('honeycomb', 'Add suffix') },
	{ choice: 'skip', label: t('honeycomb', 'Skip') },
	{ choice: 'replace', label: t('honeycomb', 'Replace') },
]
</script>

<template>
	<span class="conflict-choice" role="radiogroup" :aria-label="props.label">
		<button
			v-for="each in CHOICES"
			:key="each.choice"
			type="button"
			role="radio"
			class="conflict-choice__option"
			:aria-checked="props.choice === each.choice"
			@click="emit('choose', each.choice)">
			{{ each.label }}
		</button>
	</span>
</template>

<style scoped>
.conflict-choice {
	display: inline-flex;
	overflow: hidden;
	border: 1px solid var(--color-border-maxcontrast);
	border-radius: var(--border-radius-element, var(--border-radius-large));
}

.conflict-choice__option {
	min-width: var(--default-clickable-area);
	min-height: var(--default-clickable-area);
	margin: 0;
	padding: 0 calc(var(--default-grid-baseline) * 3);
	border: 0;
	border-inline-end: 1px solid var(--color-border-maxcontrast);
	border-radius: 0;
	background: transparent;
	color: var(--color-main-text);
}

.conflict-choice__option:last-child {
	border-inline-end: 0;
}

.conflict-choice__option[aria-checked='true'] {
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-weight: bold;
}
</style>
