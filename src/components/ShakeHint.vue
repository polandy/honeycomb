<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import AppIcon from './AppIcon.vue'
import { tip } from '../shared/tooltip.ts'

defineProps<{
	/** Whether the tile's selection check takes the corner, so the icon moves left of it. */
	selecting: boolean
}>()
</script>

<template>
	<span
		class="shake-hint"
		:class="{ 'shake-hint--selecting': selecting }"
		aria-hidden="true"
		v-bind="tip(t('honeycomb', 'Shake risk'))">
		<AppIcon name="shake" />
	</span>
</template>

<style scoped>
/* A quiet dark dot at the photo's bottom right, readable on any photo (mockup quality). */
.shake-hint {
	position: absolute;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	inset-inline-end: 6px;
	bottom: 6px;
	background-color: rgba(0, 0, 0, 0.55);
	color: #fff;
	opacity: 0.85;
}

.shake-hint--selecting {
	inset-inline-end: 36px;
}

.shake-hint .app-icon {
	width: 14px;
	height: 14px;
}
</style>
