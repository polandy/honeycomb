<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ProgressBar from './ProgressBar.vue'
import { decidedText, shownDecidedText } from '../decision-text.ts'

const props = defineProps<{
	decided: number
	total: number
	/** Whether the filters hide photos of the cull, so the count is of the shown ones. */
	filtered: boolean
}>()

const progressText = computed(() => (props.filtered ? shownDecidedText : decidedText)(props.decided, props.total))
</script>

<template>
	<div class="cull-progress">
		<span class="cull-progress__count" aria-live="polite">{{ progressText }}</span>
		<ProgressBar :label="t('honeycomb', 'Decided')" :value="props.decided" :max="props.total" />
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
</style>
