<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import AppIcon from './AppIcon.vue'
import { tip } from '../tooltip.ts'

const props = defineProps<{
	/** Only the icon, named by its label and tooltip, for a thumbnail. */
	compact?: boolean
}>()
</script>

<template>
	<span
		v-if="props.compact"
		class="sharpest-mark sharpest-mark--compact"
		role="img"
		:aria-label="t('honeycomb', 'Sharpest')"
		v-bind="tip(t('honeycomb', 'Sharpest'))">
		<AppIcon name="sharp" />
	</span>
	<span v-else class="sharpest-mark">
		<AppIcon name="sharp" />{{ t('honeycomb', 'Sharpest') }}
	</span>
</template>

<style scoped>
/* A dark badge with the primary colour's border, readable on any photo (mockup quality). */
.sharpest-mark {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 8px;
	border: 1px solid var(--color-primary-element);
	border-radius: 12px;
	background-color: rgba(0, 0, 0, .7);
	color: #fff;
	font-size: 12px;
	font-weight: bold;
	white-space: nowrap;
}

.sharpest-mark .app-icon {
	width: 14px;
	height: 14px;
	color: var(--color-primary-element);
}

.sharpest-mark--compact {
	justify-content: center;
	width: 16px;
	height: 16px;
	padding: 0;
	border: 0;
	border-radius: 50%;
}

.sharpest-mark--compact .app-icon {
	width: 12px;
	height: 12px;
}
</style>
