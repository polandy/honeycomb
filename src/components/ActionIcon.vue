<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { IconName } from './AppIcon.vue'

import AppIcon from './AppIcon.vue'

const props = defineProps<{
	/** The icon, centred in the icon column of an NcActionButton, which sizes only its own material icons. */
	name: IconName
}>()
</script>

<template>
	<span class="action-icon">
		<AppIcon :name="props.name" />
	</span>
</template>

<style scoped>
.action-icon {
	display: flex;
	align-self: flex-start;
	align-items: center;
	justify-content: center;
	width: var(--default-clickable-area);
	height: var(--default-clickable-area);
	flex-shrink: 0;
}
</style>
