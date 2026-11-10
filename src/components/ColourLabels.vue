<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ColourLabel } from '../logic/decision.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref } from 'vue'
import { COLOUR_LABEL_SWATCHES, colourLabelName } from '../colour-labels.ts'
import { PLAIN_TEXT } from '../l10n.ts'
import { COLOUR_LABELS } from '../logic/decision.ts'

const props = withDefaults(defineProps<{
	/** The label, null for none, or undefined where a selection's labels differ. */
	colourLabel: ColourLabel | null | undefined
	disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ choose: [colourLabel: ColourLabel | null] }>()

const open = ref(false)
const current = computed(() => props.colourLabel ?? null)
const openerLabel = computed(() => (current.value === null
	? t('honeycomb', 'Colour label')
	: t('honeycomb', 'Colour label: {name}', { name: colourLabelName(current.value) }, undefined, PLAIN_TEXT)))

/** Closes the palette and asks for the label. */
function choose(colourLabel: ColourLabel | null) {
	open.value = false
	emit('choose', colourLabel)
}
</script>

<template>
	<div class="colour-labels">
		<button
			type="button"
			class="colour-labels__opener"
			:disabled="props.disabled"
			:aria-expanded="open"
			:aria-label="openerLabel"
			@click="open = !open">
			<span class="colour-labels__dot" :class="{ 'colour-labels__dot--none': current === null }" :style="current === null ? undefined : { backgroundColor: COLOUR_LABEL_SWATCHES[current] }" />
			{{ current === null ? t('honeycomb', 'Label') : colourLabelName(current) }}
		</button>
		<div
			v-if="open"
			class="colour-labels__palette"
			role="group"
			:aria-label="t('honeycomb', 'Colour label')"
			@keydown.esc.prevent="open = false">
			<button
				v-for="label in COLOUR_LABELS"
				:key="label"
				type="button"
				class="colour-labels__swatch"
				:aria-label="colourLabelName(label)"
				:aria-pressed="props.colourLabel === label"
				@click="choose(label)">
				<span class="colour-labels__dot" :style="{ backgroundColor: COLOUR_LABEL_SWATCHES[label] }" />
			</button>
			<button
				type="button"
				class="colour-labels__swatch"
				:aria-label="t('honeycomb', 'No label')"
				@click="choose(null)">
				<!-- eslint-disable-next-line vue/no-bare-strings-in-template -- a symbol; the button's label names it -->
				<span class="colour-labels__dot colour-labels__dot--none" aria-hidden="true">∅</span>
			</button>
		</div>
	</div>
</template>

<style scoped>
.colour-labels {
	position: relative;
	display: flex;
}

.colour-labels__opener,
.colour-labels__swatch {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--default-grid-baseline);
	min-width: 34px;
	min-height: 34px;
	padding: 0 10px;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-element);
	background: var(--color-main-background);
	color: var(--color-main-text);
	cursor: pointer;
}

.colour-labels__opener:disabled {
	cursor: default;
	opacity: .5;
}

.colour-labels__dot {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 18px;
	height: 18px;
	border: 1px solid var(--color-border-dark);
	border-radius: 50%;
}

.colour-labels__dot--none {
	background: conic-gradient(#e5484d, #f2c94c, #3fb26b, #3b82f6, #d946ef, #e5484d);
}

.colour-labels__swatch .colour-labels__dot--none {
	background: none;
}

.colour-labels__palette {
	position: absolute;
	z-index: 2;
	bottom: calc(100% + var(--default-grid-baseline));
	inset-inline-start: 0;
	display: grid;
	grid-template-columns: repeat(5, auto);
	gap: var(--default-grid-baseline);
	padding: var(--default-grid-baseline);
	border-radius: var(--border-radius-large);
	background: var(--color-main-background);
	box-shadow: 0 2px 8px var(--color-box-shadow);
}

.colour-labels__swatch[aria-pressed='true'] {
	outline: 2px solid var(--color-primary-element);
}

@media (pointer: coarse) {
	.colour-labels__opener,
	.colour-labels__swatch {
		min-width: 44px;
		min-height: 44px;
	}
}
</style>
