<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Toast } from '../toast.ts'

const props = defineProps<{
	toast: Toast
	/** Whether it sits at the top, clear of the loupe's controls at the bottom. */
	top?: boolean
}>()

const emit = defineEmits<{
	act: []
}>()
</script>

<template>
	<div class="undo-toast" :class="{ 'undo-toast--top': props.top }" role="status">
		<span>{{ props.toast.message }}</span>
		<template v-if="props.toast.action !== null">
			<span aria-hidden="true">·</span>
			<!-- mousedown would move the focus out of the loupe and its keys -->
			<button
				type="button"
				class="undo-toast__action"
				@mousedown.prevent
				@click="emit('act')">
				{{ props.toast.action.label }}
			</button>
		</template>
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
