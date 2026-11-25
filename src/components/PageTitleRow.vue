<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
const props = defineProps<{
	/** The id the page's region names itself by. */
	titleId?: string
}>()
</script>

<template>
	<div class="page-title-row">
		<h2 :id="props.titleId" class="page-title-row__title">
			<slot />
		</h2>
		<span v-if="$slots.meta" class="page-title-row__meta">
			<slot name="meta" />
		</span>
	</div>
</template>
