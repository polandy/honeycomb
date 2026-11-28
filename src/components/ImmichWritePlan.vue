<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { RatingChoice, RejectAs, SharedChoice, WritePlan, WriteStrips } from '../logic/immich-write-plan.ts'

import { t } from '@nextcloud/l10n'
import NcRadioGroup from '@nextcloud/vue/components/NcRadioGroup'
import NcRadioGroupButton from '@nextcloud/vue/components/NcRadioGroupButton'
import { computed } from 'vue'
import { changesText, conflictText, countHeadings, picksText, ratingConflictChoices, ratingsText, rejectAsChoices, rejectAsText, restoresText, sharedConflictChoices } from '../immich/immich-write-text.ts'
import { WRITE_BLOCK } from '../logic/immich-write-plan.ts'
import ImmichWriteStrip from './ImmichWriteStrip.vue'

const props = defineProps<{
	/** The planned write, with the counts and the conflicts (IMMICH-004.6). */
	plan: WritePlan
	picksAsFavorites: boolean
	ratingChoices: ReadonlyMap<string, RatingChoice>
	sharedChoices: ReadonlyMap<string, SharedChoice>
	thumbnailUrl: (assetId: string) => string
}>()

const emit = defineEmits<{
	rejectAs: [choice: RejectAs]
	rating: [assetId: string, choice: RatingChoice]
	shared: [assetId: string, choice: SharedChoice]
}>()

const NO_STRIPS: WriteStrips = { rejects: [], restores: [], picks: [] }

/** A write of more than one block shows numbers only, no thumbnail per asset (IMMICH-004.6). */
const strips = computed(() => props.plan.counts.assets > WRITE_BLOCK ? NO_STRIPS : props.plan.strips)
</script>

<template>
	<div class="immich-write-plan">
		<p>{{ changesText(props.plan.counts.assets) }}</p>
		<section class="immich-write-plan__block">
			<h3>{{ countHeadings.rejects(props.plan.counts.rejects) }}</h3>
			<NcRadioGroup
				:label="t('honeycomb', 'Rejected photos become')"
				labelHidden
				:modelValue="props.plan.rejectAs"
				@update:modelValue="emit('rejectAs', $event as RejectAs)">
				<NcRadioGroupButton
					v-for="choice in rejectAsChoices()"
					:key="choice.value"
					:value="choice.value"
					:label="choice.label" />
			</NcRadioGroup>
			<p>{{ rejectAsText(props.plan.rejectAs) }}</p>
			<ImmichWriteStrip :assetIds="strips.rejects" :thumbnailUrl="props.thumbnailUrl" />
		</section>
		<section v-if="props.plan.counts.restores > 0" class="immich-write-plan__block">
			<h3>{{ countHeadings.restores(props.plan.counts.restores) }}</h3>
			<p>{{ restoresText() }}</p>
			<ImmichWriteStrip :assetIds="strips.restores" :thumbnailUrl="props.thumbnailUrl" />
		</section>
		<section class="immich-write-plan__block">
			<h3>{{ countHeadings.picks(props.plan.counts.picks) }}</h3>
			<p>{{ picksText(props.picksAsFavorites) }}</p>
			<ImmichWriteStrip :assetIds="strips.picks" :thumbnailUrl="props.thumbnailUrl" />
		</section>
		<section class="immich-write-plan__block">
			<h3>{{ countHeadings.ratings(props.plan.counts.ratings) }}</h3>
			<p>{{ ratingsText() }}</p>
		</section>
		<section v-if="props.plan.conflicts.length > 0" class="immich-write-plan__block">
			<h3>{{ countHeadings.conflicts(props.plan.conflicts.length) }}</h3>
			<ul class="immich-write-plan__conflicts">
				<li v-for="conflict in props.plan.conflicts" :key="`${conflict.kind} ${conflict.assetId}`" class="immich-write-plan__conflict">
					<img class="immich-write-plan__thumbnail" alt="" :src="props.thumbnailUrl(conflict.assetId)">
					<span class="immich-write-plan__text">{{ conflictText(conflict) }}</span>
					<NcRadioGroup
						v-if="conflict.kind === 'rating'"
						:label="t('honeycomb', 'Which rating to keep')"
						labelHidden
						:modelValue="props.ratingChoices.get(conflict.assetId) ?? 'honeycomb'"
						@update:modelValue="emit('rating', conflict.assetId, $event as RatingChoice)">
						<NcRadioGroupButton
							v-for="choice in ratingConflictChoices()"
							:key="choice.value"
							:value="choice.value"
							:label="choice.label" />
					</NcRadioGroup>
					<NcRadioGroup
						v-else-if="conflict.kind === 'shared'"
						:label="t('honeycomb', 'What the shared photo becomes')"
						labelHidden
						:modelValue="props.sharedChoices.get(conflict.assetId) ?? 'trash'"
						@update:modelValue="emit('shared', conflict.assetId, $event as SharedChoice)">
						<NcRadioGroupButton
							v-for="choice in sharedConflictChoices()"
							:key="choice.value"
							:value="choice.value"
							:label="choice.label" />
					</NcRadioGroup>
				</li>
			</ul>
		</section>
	</div>
</template>

<style scoped>
.immich-write-plan__block h3 {
	margin-block: calc(3 * var(--default-grid-baseline)) var(--default-grid-baseline);
	font-size: var(--default-font-size);
	font-weight: bold;
}

.immich-write-plan__block p {
	color: var(--color-text-maxcontrast);
}

.immich-write-plan__conflicts {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
}

.immich-write-plan__conflict {
	display: grid;
	grid-template-columns: 48px 1fr;
	gap: calc(2 * var(--default-grid-baseline));
	align-items: center;
}

.immich-write-plan__conflict > :last-child:not(.immich-write-plan__text) {
	grid-column: 2;
}

.immich-write-plan__thumbnail {
	width: 48px;
	height: 48px;
	border-radius: var(--border-radius);
	object-fit: cover;
}
</style>
