<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { HashProgress } from '../logic/hash-progress.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ProgressBar from './ProgressBar.vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'

const props = defineProps<{
	/** How far the visual hashes of the cull are. */
	progress: HashProgress
}>()

const text = computed(() => {
	const { phase, hashed, failed, total } = props.progress
	if (phase === 'running') {
		return t('honeycomb', 'Similarity {hashed}/{total}', { hashed: formatNumber(hashed), total: formatNumber(total) }, undefined, PLAIN_TEXT)
	}
	return failed > 0
		? n('honeycomb', 'Similarity: {count} photo not compared', 'Similarity: {count} photos not compared', failed, { count: formatNumber(failed) }, PLAIN_TEXT)
		: t('honeycomb', 'Similarity: not saved')
})
</script>

<template>
	<div
		v-if="props.progress.phase !== 'done'"
		class="similarity-progress"
		:class="{ 'similarity-progress--failed': props.progress.phase === 'failed' }">
		<span class="similarity-progress__text">{{ text }}</span>
		<ProgressBar
			v-if="props.progress.phase === 'running'"
			:label="t('honeycomb', 'Similarity')"
			:value="props.progress.hashed"
			:max="props.progress.total" />
	</div>
</template>

<style scoped>
.similarity-progress {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
	font-variant-numeric: tabular-nums;
}

.similarity-progress--failed {
	color: var(--color-warning-text, var(--color-warning));
}
</style>
