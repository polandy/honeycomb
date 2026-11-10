<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { PanelLimits } from '../logic/panel-width.ts'

import { dragWidth, keyWidth } from '../logic/panel-width.ts'

const props = defineProps<{
	/** The width of the panel on the divider's right. */
	width: number
	limits: PanelLimits
	label: string
}>()

const emit = defineEmits<{ 'update:width': [width: number] }>()

let drag: { pointerId: number, startX: number, startWidth: number } | null = null

/** Starts a drag that follows the pointer outside the divider. */
function onPointerDown(event: PointerEvent) {
	(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
	drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: props.width }
}

/** Resizes the panel while the drag lasts. */
function onPointerMove(event: PointerEvent) {
	if (drag?.pointerId === event.pointerId) {
		emit('update:width', dragWidth(drag.startWidth, drag.startX, event.clientX, props.limits))
	}
}

/** Resizes the panel by an arrow key, Home or End. */
function onKeydown(event: KeyboardEvent) {
	const width = keyWidth(props.width, event.key, props.limits)
	if (width !== null) {
		event.preventDefault()
		emit('update:width', width)
	}
}
</script>

<template>
	<div
		class="panel-divider"
		role="separator"
		tabindex="0"
		aria-orientation="vertical"
		:aria-label="props.label"
		:aria-valuenow="props.width"
		:aria-valuemin="props.limits.min"
		:aria-valuemax="props.limits.max"
		@pointerdown="onPointerDown"
		@pointermove="onPointerMove"
		@pointerup="drag = null"
		@pointercancel="drag = null"
		@keydown="onKeydown" />
</template>

<style scoped>
.panel-divider {
	flex: none;
	width: 12px;
	margin-inline: -4px;
	z-index: 1;
	cursor: col-resize;
	touch-action: none;
	background: linear-gradient(var(--color-border), var(--color-border)) center / 1px 100% no-repeat;
}

.panel-divider:focus-visible {
	outline: 2px solid var(--color-primary-element);
}
</style>
