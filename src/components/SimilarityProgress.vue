<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { HashProgress } from '../logic/hash-progress.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'

const props = defineProps<{
	/** How far the visual hashes of the cull are. */
	progress: HashProgress
}>()

/** Marks the short form of a failure on a narrow toolbar. */
const WARNING_SIGN = '⚠'

const text = computed(() => {
	const { phase, hashed, failed, total } = props.progress
	if (phase === 'running') {
		return t('honeycomb', 'Similarity {hashed}/{total}', { hashed: formatNumber(hashed), total: formatNumber(total) }, undefined, PLAIN_TEXT)
	}
	return failed > 0
		? n('honeycomb', 'Similarity: {count} photo not compared', 'Similarity: {count} photos not compared', failed, { count: formatNumber(failed) }, PLAIN_TEXT)
		: t('honeycomb', 'Similarity: not saved')
})

const short = computed(() => (props.progress.failed > 0 ? `${WARNING_SIGN} ${formatNumber(props.progress.failed)}` : WARNING_SIGN))
</script>

<template>
	<span
		v-if="props.progress.phase !== 'done'"
		class="similarity-progress"
		:class="{ 'similarity-progress--failed': props.progress.phase === 'failed' }">
		<span class="similarity-progress__text">{{ text }}</span>
		<span v-if="props.progress.phase === 'failed'" class="similarity-progress__short" aria-hidden="true">{{ short }}</span>
	</span>
</template>

<style scoped>
.similarity-progress {
	color: var(--color-text-maxcontrast);
	font-variant-numeric: tabular-nums;
}

.similarity-progress--failed {
	color: var(--color-warning-text, var(--color-warning));
}

.similarity-progress__short {
	display: none;
}

/* A narrow toolbar keeps two rows (GRID-001.17): the bar alone while running, the short form of a failure. */
@media (max-width: 899px) {
	.similarity-progress:not(.similarity-progress--failed) {
		position: absolute;
	}

	.similarity-progress__text {
		position: absolute;
		overflow: hidden;
		width: 1px;
		height: 1px;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.similarity-progress__short {
		display: inline;
	}
}
</style>
