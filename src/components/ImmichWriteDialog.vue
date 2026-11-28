<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ImmichWrite } from '../immich/immich-write.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import ImmichWritePlan from './ImmichWritePlan.vue'
import ModalPanel from './ModalPanel.vue'
import ProgressBar from './ProgressBar.vue'
import { blocksHint, checkingText, DOWN_TEXT, FAILED_TEXT, resultText, skippedText, writeButtonText, writingText } from '../immich/immich-write-text.ts'

const props = defineProps<{
	/** The write's state on the opened connection (IMMICH-004.25). */
	write: ImmichWrite
}>()

/** Up to this many failed show a thumbnail each, more their number only (IMMICH-004.6). */
const FAILED_THUMBNAILS = 100

const step = computed(() => props.write.step.value)
const assets = computed(() => props.write.plan.value?.counts.assets ?? 0)
const progress = computed(() => {
	const shown = step.value
	if (shown.kind === 'checking') {
		return { label: checkingText(shown.progress), done: shown.progress?.done ?? 0, total: shown.progress?.total ?? 0 }
	}
	return shown.kind === 'writing' ? { label: writingText(shown.progress), done: shown.progress.done, total: shown.progress.total } : null
})
</script>

<template>
	<ModalPanel
		v-if="step.kind !== 'closed'"
		:title="t('honeycomb', 'Write to Immich')"
		:locked="step.kind === 'writing'"
		@close="props.write.close()">
		<div v-if="progress !== null" class="immich-write__progress" role="status">
			<p>{{ progress.label }}</p>
			<ProgressBar :label="progress.label" :value="progress.done" :max="progress.total" />
		</div>
		<NcNoteCard v-else-if="step.kind === 'down'" type="error">
			{{ DOWN_TEXT }}
		</NcNoteCard>
		<ImmichWritePlan
			v-else-if="step.kind === 'ready' && props.write.plan.value !== null"
			:plan="props.write.plan.value"
			:picksAsFavorites="props.write.picksAsFavorites.value"
			:ratingChoices="props.write.ratingChoices.value"
			:sharedChoices="props.write.sharedChoices.value"
			:thumbnailUrl="props.write.thumbnailUrl"
			@rejectAs="props.write.chooseRejectAs($event)"
			@rating="(assetId, choice) => props.write.chooseRating(assetId, choice)"
			@shared="(assetId, choice) => props.write.chooseShared(assetId, choice)" />
		<div v-else-if="step.kind === 'finished'" class="immich-write__result">
			<NcNoteCard :type="step.tally.failed === 0 ? 'success' : 'warning'">
				{{ resultText(step.tally) }}
			</NcNoteCard>
			<p v-if="step.tally.skipped > 0">
				{{ skippedText(step.tally.skipped) }}
			</p>
			<ul v-if="step.tally.failedIds.length > 0 && step.tally.failedIds.length <= FAILED_THUMBNAILS" class="immich-write__failed">
				<li v-for="assetId in step.tally.failedIds" :key="assetId">
					<img class="immich-write__thumbnail" alt="" :src="props.write.thumbnailUrl(assetId)">
					<span>{{ FAILED_TEXT }}</span>
				</li>
			</ul>
		</div>
		<template #actions>
			<template v-if="step.kind === 'finished'">
				<NcButton variant="primary" @click="props.write.close()">
					{{ t('honeycomb', 'Close') }}
				</NcButton>
			</template>
			<template v-else>
				<p v-if="step.kind === 'ready'" class="immich-write__hint">
					{{ blocksHint(assets) }}
				</p>
				<NcButton variant="tertiary" :disabled="step.kind === 'writing'" @click="props.write.close()">
					{{ t('honeycomb', 'Cancel') }}
				</NcButton>
				<NcButton variant="primary" :disabled="step.kind !== 'ready' || assets === 0" @click="props.write.write()">
					{{ writeButtonText(assets) }}
				</NcButton>
			</template>
		</template>
	</ModalPanel>
</template>

<style scoped>
.immich-write__progress p,
.immich-write__hint {
	color: var(--color-text-maxcontrast);
}

.immich-write__hint {
	flex: 1 1 100%;
	margin: 0;
}

.immich-write__failed li {
	display: grid;
	grid-template-columns: 48px 1fr;
	gap: calc(2 * var(--default-grid-baseline));
	align-items: center;
}

.immich-write__thumbnail {
	width: 48px;
	height: 48px;
	border-radius: var(--border-radius);
	object-fit: cover;
}
</style>
