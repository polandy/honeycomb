<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Flag } from '../logic/decision.ts'

import AppIcon from './AppIcon.vue'

const props = defineProps<{ flag: Exclude<Flag, 'unflagged'> }>()
</script>

<template>
	<span class="flag-mark" :class="`flag-mark--${props.flag}`" aria-hidden="true">
		<AppIcon :name="props.flag === 'picked' ? 'flagPick' : 'flagX'" />
	</span>
</template>

<style scoped>
.flag-mark {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	color: var(--color-main-background);
}

.flag-mark .app-icon {
	width: 16px;
	height: 16px;
}

.flag-mark--picked {
	background-color: var(--color-success);
}

.flag-mark--rejected {
	background-color: var(--color-error);
}
</style>
