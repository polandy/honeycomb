<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { CommonDecision, DecisionIntent } from '../logic/decision-change.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import ColourLabels from './ColourLabels.vue'
import FlagButtons from './FlagButtons.vue'
import StarRating from './StarRating.vue'

const props = withDefaults(defineProps<{
	/** What the pictures the bar acts on share. */
	common: CommonDecision
	disabled?: boolean
	/** Whether the user may not change the pictures, which greys the controls and says so (GRID-003.16, LOUPE-002.18). */
	readOnly?: boolean
	/** A bar under the grid, or the loupe's large flag buttons apart from a row of the rest. */
	layout?: 'bar' | 'loupe'
	/** Whether the loupe shows its large flag buttons. */
	flags?: boolean
	/** Whether the loupe's overlays are idle, which fades the row in landscape. */
	idle?: boolean
	/** Whether the loupe's row stays below the photo in landscape instead of floating over it. */
	pinned?: boolean
	/** Whether the source offers *Keep RAW* and tags (IMMICH-002.17). */
	keepRaw?: boolean
	tags?: boolean
}>(), { disabled: false, readOnly: false, layout: 'bar', flags: true, idle: false, pinned: false, keepRaw: true, tags: true })

const emit = defineEmits<{ decide: [intent: DecisionIntent], tag: [] }>()

const loupe = computed(() => props.layout === 'loupe')
const off = computed(() => props.disabled || props.readOnly)
</script>

<template>
	<div class="action-bar" :class="[`action-bar--${props.layout}`, { 'action-bar--idle': props.idle && !props.pinned, 'action-bar--pinned': props.pinned }]">
		<div v-if="loupe && props.flags" class="action-bar__flags">
			<FlagButtons
				size="large"
				:flag="props.common.flag"
				:disabled="off"
				@flag="emit('decide', { kind: 'flag', flag: $event })" />
		</div>
		<div class="action-bar__row">
			<slot />
			<span v-if="props.readOnly" class="action-bar__note">{{ t('honeycomb', 'Read only') }}</span>
			<StarRating :rating="props.common.rating" :disabled="off" @rate="emit('decide', { kind: 'rating', rating: $event })" />
			<ColourLabels :colourLabel="props.common.colourLabel" :disabled="off" @choose="emit('decide', { kind: 'colourLabel', colourLabel: $event })" />
			<button
				v-if="props.keepRaw"
				type="button"
				class="action-bar__keep-raw"
				:disabled="off || !props.common.canKeepRaw"
				:aria-pressed="props.common.keepRaw === true"
				:aria-label="props.common.canKeepRaw ? t('honeycomb', 'Keep RAW') : t('honeycomb', 'Keep RAW: only for pairs')"
				@click="emit('decide', { kind: 'keepRaw' })">
				{{ t('honeycomb', 'Keep RAW') }}
			</button>
			<button
				v-if="props.tags"
				type="button"
				class="action-bar__tags"
				:disabled="off"
				:aria-label="t('honeycomb', 'Tags')"
				@click="emit('tag')">
				<AppIcon name="tag" />
				{{ t('honeycomb', 'Tags') }}
			</button>
			<slot name="tools" />
			<slot v-if="loupe" name="end" />
		</div>
		<div v-if="!loupe" class="action-bar__primary">
			<slot name="end" />
			<FlagButtons
				:flag="props.common.flag"
				:disabled="off"
				@flag="emit('decide', { kind: 'flag', flag: $event })" />
		</div>
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

.action-bar__row,
.action-bar__primary {
	display: contents;
}

.action-bar__note {
	color: var(--color-text-maxcontrast);
}

.action-bar--bar {
	container: action-bar / inline-size;
}

/* One row needs about 1020 px with 44 px targets. */
@container action-bar (max-width: 1040px) {
	.action-bar__primary,
	.action-bar__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: inherit;
	}

	.action-bar__primary {
		flex-basis: 100%;
		order: -1;
	}

	.action-bar__primary > .flag-buttons {
		order: -1;
	}
}

.action-bar--loupe {
	flex-direction: column;
	align-items: stretch;
	border-top: 0;
}

.action-bar--loupe .action-bar__flags {
	width: 100%;
	max-width: 720px;
	align-self: center;
}

.action-bar--loupe .action-bar__row {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: center;
	gap: calc(1.5 * var(--default-grid-baseline)) calc(3.5 * var(--default-grid-baseline));
}

@media (orientation: landscape) {
	.action-bar--loupe {
		display: contents;
	}

	.action-bar--loupe .action-bar__row {
		position: absolute;
		z-index: 1;
		inset-inline: var(--photo-loupe-rail, 0px) calc(var(--photo-loupe-panel, 0px) + var(--photo-loupe-rail, 0px));
		bottom: var(--photo-loupe-strip, 0px);
		box-sizing: border-box;
		min-height: var(--photo-loupe-row, 56px);
		padding: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
		background-color: color-mix(in srgb, var(--color-main-background) 80%, transparent);
		transition: opacity 0.2s;
	}

	.action-bar--pinned .action-bar__row {
		position: static;
		margin-inline-end: var(--photo-loupe-panel, 0px);
	}

	.action-bar--idle .action-bar__row {
		opacity: 0;
		pointer-events: none;
	}
}

.action-bar__keep-raw,
.action-bar__tags {
	display: inline-flex;
	align-items: center;
	gap: var(--default-grid-baseline);
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

.action-bar__keep-raw:disabled,
.action-bar__tags:disabled {
	cursor: default;
	opacity: .5;
}

@media (pointer: coarse) {
	.action-bar__keep-raw,
	.action-bar__tags {
		min-height: 44px;
	}
}
</style>
