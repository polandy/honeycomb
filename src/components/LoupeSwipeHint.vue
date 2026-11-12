<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { SwipeHint } from '../logic/loupe-gesture.ts'

import AppIcon from './AppIcon.vue'
import { FLAG_ICONS, flagLabel } from '../flag-icons.ts'

const props = defineProps<{ hint: SwipeHint }>()
</script>

<template>
	<div
		class="loupe-swipe-hint"
		:class="[`loupe-swipe-hint--${props.hint.flag}`, { 'loupe-swipe-hint--armed': props.hint.armed }]"
		:style="{ opacity: props.hint.progress }"
		aria-hidden="true">
		<AppIcon :name="FLAG_ICONS[props.hint.flag]" />
		<span>{{ flagLabel(props.hint.flag) }}</span>
	</div>
</template>

<style scoped>
.loupe-swipe-hint {
	position: absolute;
	z-index: 1;
	top: 50%;
	left: 50%;
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(3 * var(--default-grid-baseline)) calc(5 * var(--default-grid-baseline));
	border: 2px dashed #fff;
	border-radius: var(--border-radius-pill);
	background-color: rgba(0, 0, 0, .6);
	color: #fff;
	font-size: 20px;
	font-weight: bold;
	pointer-events: none;
	transform: translate(-50%, -50%);
}

.loupe-swipe-hint .app-icon {
	width: 28px;
	height: 28px;
}

.loupe-swipe-hint--armed {
	border-style: solid;
}

.loupe-swipe-hint--armed.loupe-swipe-hint--picked {
	border-color: var(--honeycomb-pick-fill);
	background-color: var(--honeycomb-pick-fill);
}

.loupe-swipe-hint--armed.loupe-swipe-hint--rejected {
	border-color: var(--honeycomb-reject-fill);
	background-color: var(--honeycomb-reject-fill);
}

.loupe-swipe-hint--armed.loupe-swipe-hint--unflagged {
	border-color: var(--honeycomb-unflag-fill);
	background-color: var(--honeycomb-unflag-fill);
}
</style>
