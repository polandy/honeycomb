<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ heading: string }>()

const headingId = useId()
</script>

<template>
	<div class="grid-more-group" role="group" :aria-labelledby="headingId">
		<h3 :id="headingId" class="grid-more-group__heading">
			{{ heading }}
		</h3>
		<slot />
	</div>
</template>

<style scoped>
.grid-more-group {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
}

.grid-more-group__heading {
	margin: 0;
	color: var(--color-text-maxcontrast);
	font-size: var(--default-font-size);
	font-weight: bold;
}
</style>
