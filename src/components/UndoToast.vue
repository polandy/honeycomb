<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Toast } from '../shared/toast.ts'

import { t } from '@nextcloud/l10n'
import { onBeforeUnmount } from 'vue'
import AppIcon from './AppIcon.vue'
import { keyCap } from '../shared/hotkeys.ts'
import { dismissesToast } from '../shared/toast.ts'
import { tip } from '../shared/tooltip.ts'

const props = defineProps<{
	toast: Toast
	/** Whether it sits at the top, clear of the loupe's controls at the bottom. */
	top?: boolean
}>()

const emit = defineEmits<{
	act: []
	/** The offer before the action was pressed. */
	offer: []
	/** The details button, for the dialog. */
	details: []
	/** The close button, or a sideways swipe on a touch screen (APP-001.18). */
	close: []
	/** Whether the focus is inside it. */
	focus: [inside: boolean]
	/** Whether a pointer is pressed on it. */
	press: [down: boolean]
}>()

/** Moving between its own parts keeps the focus inside. */
function onFocusOut(event: FocusEvent) {
	if (!(event.relatedTarget instanceof Node && (event.currentTarget as Node).contains(event.relatedTarget))) {
		emit('focus', false)
	}
}

/** Where a touch or pen press began, for the swipe; null for a mouse, which has the close button. */
let start: { x: number, y: number } | null = null

/** The release can happen anywhere on the page. */
function onPointerDown(event: PointerEvent) {
	start = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY }
	emit('press', true)
	window.addEventListener('pointerup', release)
	window.addEventListener('pointercancel', release)
}

/** Ends the press and stops listening; a release far enough sideways closes the toast. */
function release(event: PointerEvent) {
	window.removeEventListener('pointerup', release)
	window.removeEventListener('pointercancel', release)
	emit('press', false)
	const from = start
	start = null
	if (from !== null && event.type === 'pointerup' && dismissesToast(event.clientX - from.x, event.clientY - from.y)) {
		emit('close')
	}
}

onBeforeUnmount(() => {
	window.removeEventListener('pointerup', release)
	window.removeEventListener('pointercancel', release)
})
</script>

<template>
	<div
		class="undo-toast"
		:class="{ 'undo-toast--top': props.top }"
		:role="props.toast.kind === 'error' ? 'alert' : 'status'"
		@focusin="emit('focus', true)"
		@focusout="onFocusOut"
		@pointerdown="onPointerDown">
		<div class="undo-toast__row">
			<span>{{ props.toast.message }}</span>
			<span v-if="props.toast.action !== null || props.toast.offer || props.toast.details" aria-hidden="true">·</span>
			<!-- mousedown would move the focus out of the loupe and its keys -->
			<button
				v-if="props.toast.offer"
				type="button"
				class="undo-toast__action undo-toast__offer"
				v-bind="tip(props.toast.offer.label, keyCap('pick-rest'))"
				@mousedown.prevent
				@click="emit('offer')">
				{{ props.toast.offer.label }}
			</button>
			<button
				v-if="props.toast.action !== null"
				type="button"
				class="undo-toast__action"
				@mousedown.prevent
				@click="emit('act')">
				{{ props.toast.action.label }}
			</button>
			<button
				v-if="props.toast.details"
				type="button"
				class="undo-toast__action undo-toast__details"
				@mousedown.prevent
				@click="emit('details')">
				{{ t('honeycomb', 'Details') }}
			</button>
			<button
				type="button"
				class="undo-toast__action undo-toast__close"
				:aria-label="t('honeycomb', 'Close')"
				@mousedown.prevent
				@click="emit('close')">
				<AppIcon name="close" />
			</button>
		</div>
	</div>
</template>

<style scoped>
.undo-toast {
	position: fixed;
	inset-inline: 0;
	bottom: calc(16px + env(safe-area-inset-bottom, 0px));
	z-index: 10001;
	display: flex;
	flex-direction: column;
	justify-content: center;
	width: fit-content;
	max-width: 92%;
	min-height: 48px;
	margin-inline: auto;
	padding: var(--default-grid-baseline) calc(1.5 * var(--default-grid-baseline)) var(--default-grid-baseline) calc(4 * var(--default-grid-baseline));
	border-radius: var(--border-radius-large);
	background: var(--color-main-text);
	color: var(--color-main-background);
	box-shadow: 0 2px 12px var(--color-box-shadow);
	/* A sideways move stays a pointer move for the swipe, not a pan that cancels it. */
	touch-action: pan-y;
}

.undo-toast__row {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
}

.undo-toast--top {
	top: calc(70px + env(safe-area-inset-top, 0px));
	bottom: auto;
}

.undo-toast__action {
	min-height: var(--default-clickable-area);
	padding: 0 calc(3.5 * var(--default-grid-baseline));
	border: 0;
	border-radius: var(--border-radius-element);
	background: transparent;
	color: var(--color-primary-element-light);
	font-weight: bold;
}

/* Nextcloud's global button:hover would paint it light under its light text. */
.undo-toast .undo-toast__action:hover,
.undo-toast .undo-toast__action:focus {
	background: transparent;
	color: var(--color-primary-element-light);
}

.undo-toast .undo-toast__action:hover {
	text-decoration: underline;
}

/* Nextcloud's focus-visible ring is !important and dark on the dark toast. */
.undo-toast .undo-toast__action:focus {
	outline: 2px solid var(--color-primary-element-light) !important;
	outline-offset: -2px;
	box-shadow: none !important;
}
</style>
