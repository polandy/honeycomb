<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { decidedText } from '../decision-text.ts'

const props = defineProps<{
	decided: number
	total: number
}>()

const progressText = computed(() => decidedText(props.decided, props.total))
const percent = computed(() => (props.total > 0 ? Math.round(100 * props.decided / props.total) : 0))
</script>

<template>
	<div class="cull-progress">
		<span class="cull-progress__count" aria-live="polite">{{ progressText }}</span>
		<div
			class="cull-progress__bar"
			role="progressbar"
			:aria-label="t('honeycomb', 'Decided')"
			aria-valuemin="0"
			:aria-valuemax="props.total"
			:aria-valuenow="props.decided">
			<span class="cull-progress__done" :style="{ width: `${percent}%` }" />
		</div>
	</div>
</template>

<style scoped>
.cull-progress {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
}

.cull-progress__count {
	font-weight: bold;
	font-variant-numeric: tabular-nums;
}

.cull-progress__bar {
	overflow: hidden;
	width: 80px;
	height: 4px;
	border-radius: 2px;
	background: var(--color-background-darker);
}

.cull-progress__done {
	display: block;
	height: 100%;
	background: var(--color-primary-element);
}
</style>
