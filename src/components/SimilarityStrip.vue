<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { HashProgress } from '../logic/hash-progress.ts'
import type { Schedule } from '../logic/long-press.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ProgressBar from './ProgressBar.vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { progressStep } from '../logic/hash-progress.ts'
import { browserSchedule } from '../tile-selection.ts'

const props = withDefaults(defineProps<{
	/** How far the visual hashes of the cull are. */
	progress: HashProgress
	/** The timer that hides *Photos compared*. */
	schedule?: Schedule
}>(), {
	schedule: browserSchedule,
})

/** How long *Photos compared* shows once the last pending picture is hashed (SERIES-003.20). */
const COMPARED_MS = 2000

const compared = ref(false)
let cancelCompared: (() => void) | null = null

/** Stops the timer of *Photos compared*. */
function stopCompared() {
	cancelCompared?.()
	cancelCompared = null
}

watch(() => props.progress.phase, (phase, before) => {
	stopCompared()
	compared.value = phase === 'done' && before === 'running'
	if (compared.value) {
		cancelCompared = props.schedule(() => {
			compared.value = false
		}, COMPARED_MS)
	}
})
onBeforeUnmount(stopCompared)

const text = computed(() => {
	const { phase, hashed, failed, total } = props.progress
	if (phase === 'running') {
		return t('honeycomb', 'Comparing photos {hashed}/{total}', { hashed: formatNumber(hashed), total: formatNumber(total) }, undefined, PLAIN_TEXT)
	}
	if (phase === 'done') {
		return compared.value ? t('honeycomb', 'Photos compared') : ''
	}
	return failed > 0
		? n('honeycomb', 'Similarity: {count} photo not compared', 'Similarity: {count} photos not compared', failed, { count: formatNumber(failed) }, PLAIN_TEXT)
		: t('honeycomb', 'Similarity: not saved')
})

/** What screen readers hear: the progress in steps of 10 %, not every hash (SERIES-003.24). */
const announced = computed(() => (props.progress.phase === 'running'
	? t('honeycomb', 'Comparing photos: {percent} %', { percent: progressStep(props.progress) })
	: text.value))
</script>

<template>
	<div
		v-if="text !== ''"
		class="similarity-strip"
		:class="{ 'similarity-strip--failed': props.progress.phase === 'failed' }">
		<ProgressBar
			v-if="props.progress.phase === 'running'"
			class="similarity-strip__bar"
			:label="t('honeycomb', 'Similarity')"
			:value="props.progress.hashed"
			:max="props.progress.total" />
		<span class="similarity-strip__text" aria-hidden="true">{{ text }}</span>
	</div>
	<span class="hidden-visually" aria-live="polite">{{ announced }}</span>
</template>

<style scoped>
.similarity-strip {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	height: 100%;
	padding: 0 calc(2 * var(--default-grid-baseline));
	background-color: var(--color-main-background-blur);
	color: var(--color-text-maxcontrast);
	font-size: 12px;
	font-variant-numeric: tabular-nums;
	-webkit-backdrop-filter: var(--filter-background-blur);
	backdrop-filter: var(--filter-background-blur);
}

.similarity-strip--failed {
	color: var(--color-warning-text, var(--color-warning));
}

.similarity-strip__bar {
	flex: 1;
	width: auto;
}

.similarity-strip__text {
	white-space: nowrap;
}
</style>
