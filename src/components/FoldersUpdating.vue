<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import ProgressBar from './ProgressBar.vue'
import { updatingText } from '../folders/folders-text.ts'

const props = defineProps<{
	/** How many folders the server has summarised of the total. */
	updating: { readonly done: number, readonly total: number }
}>()
</script>

<template>
	<div class="folders-screen__updating">
		<span>{{ updatingText(props.updating.total - props.updating.done) }}</span>
		<ProgressBar
			class="folders-screen__updating-bar"
			:label="updatingText(props.updating.total - props.updating.done)"
			:value="props.updating.done"
			:max="props.updating.total" />
	</div>
</template>

<style scoped>
.folders-screen__updating {
	display: grid;
	gap: var(--default-grid-baseline);
	color: var(--color-text-maxcontrast);
	font-size: 13px;
}

.folders-screen__updating-bar {
	width: 100%;
	height: 6px;
	border-radius: 3px;
}
</style>
