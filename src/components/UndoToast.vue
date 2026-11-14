<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Toast } from '../toast.ts'

import { onBeforeUnmount } from 'vue'
import { keyCap } from '../hotkeys.ts'
import { tip } from '../tooltip.ts'

const props = defineProps<{
	toast: Toast
	/** Whether it sits at the top, clear of the loupe's controls at the bottom. */
	top?: boolean
}>()

const emit = defineEmits<{
	act: []
	/** The offer before the action was pressed. */
	offer: []
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

/** The release can happen anywhere on the page. */
function onPointerDown() {
	emit('press', true)
	window.addEventListener('pointerup', release)
	window.addEventListener('pointercancel', release)
}

/** Ends the press and stops listening. */
function release() {
	window.removeEventListener('pointerup', release)
	window.removeEventListener('pointercancel', release)
	emit('press', false)
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
		role="status"
		@focusin="emit('focus', true)"
		@focusout="onFocusOut"
		@pointerdown="onPointerDown">
		<span>{{ props.toast.message }}</span>
		<span v-if="props.toast.action !== null || props.toast.offer" aria-hidden="true">·</span>
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
	</div>
</template>

<style scoped>
.undo-toast {
	position: fixed;
	inset-inline: 0;
	bottom: calc(16px + env(safe-area-inset-bottom, 0px));
	z-index: 10001;
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	width: fit-content;
	max-width: 92%;
	min-height: 48px;
	margin-inline: auto;
	padding: var(--default-grid-baseline) calc(1.5 * var(--default-grid-baseline)) var(--default-grid-baseline) calc(4 * var(--default-grid-baseline));
	border-radius: var(--border-radius-large);
	background: var(--color-main-text);
	color: var(--color-main-background);
	box-shadow: 0 2px 12px var(--color-box-shadow);
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
</style>
