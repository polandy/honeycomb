<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { BrowserStorage } from '../browser-storage.ts'
import type { useImmichCull } from '../immich-cull.ts'
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { Flag } from '../logic/decision.ts'
import type { SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Settings } from '../logic/settings.ts'
import type { ObserveSize } from '../observe-size.ts'
import type { Toast } from '../toast.ts'
import type { ViewStateStore } from '../view-state.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, ref, useTemplateRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import AppIcon from './AppIcon.vue'
import FlagFilter from './FlagFilter.vue'
import PhotoGrid from './PhotoGrid.vue'
import PhotoLoupe from './PhotoLoupe.vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { LOUPE_AHEAD, loupeCounter } from '../logic/immich-paging.ts'
import { DECISIONS_ONLY } from '../logic/opened-source.ts'
import { DEFAULT_TILE_SIZE } from '../logic/tile-size.ts'

const props = withDefaults(defineProps<{
	/** The opened connection's cull. */
	cull: ReturnType<typeof useImmichCull>
	settings: Settings
	storage: BrowserStorage
	viewState: ViewStateStore
	tileSize?: number
	observeSize?: ObserveSize | undefined
}>(), { tileSize: DEFAULT_TILE_SIZE, observeSize: undefined })

const emit = defineEmits<{
	'update:tileSize': [size: number]
	updateSettings: [patch: Partial<Settings>]
	toast: [toast: Toast]
}>()

const { list, counts, pictures, filters } = props.cull
const loupeIndex = ref<number | null>(null)
const photoLoupe = useTemplateRef<InstanceType<typeof PhotoLoupe>>('photoLoupe')

const countText = computed(() => {
	if (counts.value === null) {
		return t('honeycomb', 'Counting…')
	}
	const { matching, total, decided } = counts.value
	const shown = n('honeycomb', '{matching} of {total} picture', '{matching} of {total} pictures', total, { matching: formatNumber(matching), total: formatNumber(total) }, PLAIN_TEXT)
	return `${shown} · ${n('honeycomb', '{count} decided', '{count} decided', decided, { count: formatNumber(decided) }, PLAIN_TEXT)}`
})
// The counts say 0, or the listing ended without an entry before they arrived (IMMICH-002.18).
const empty = computed(() => counts.value?.matching === 0 || (list.value.started && list.value.entries.length === 0 && list.value.nextCursor === null && list.value.next === 'idle'))
const counter = computed(() => loupeIndex.value === null ? null : loupeCounter(list.value, loupeIndex.value, counts.value?.matching ?? list.value.entries.length))

/** Shows the pictures with the chosen flags, from the listing's start (IMMICH-002.11). */
function setFlags(flags: ReadonlySet<Flag>) {
	props.cull.setFilters({ ...filters.value, flags })
}

/** Moves the loupe and loads the next page as it nears the loaded end (IMMICH-002.9). */
function page(index: number) {
	loupeIndex.value = index
	props.cull.loadNext(index, LOUPE_AHEAD)
}

/** Decides the picture the loupe shows. */
function decideShown(intent: DecisionIntent, picture: Picture<SourceEntry>) {
	void props.cull.decide(intent, [picture])
}

defineExpose({ loupe: photoLoupe })
</script>

<template>
	<div class="immich-screen">
		<div class="immich-screen__toolbar">
			<FlagFilter :flags="filters.flags" :counts="counts?.flags ?? null" @update:flags="setFlags" />
			<span class="immich-screen__count">{{ countText }}</span>
		</div>
		<NcEmptyContent
			v-if="empty"
			class="immich-screen__empty"
			:name="t('honeycomb', 'No pictures match. Change the time, device or flag filter.')">
			<template #icon>
				<AppIcon name="phone" />
			</template>
		</NcEmptyContent>
		<template v-else>
			<PhotoGrid
				v-if="pictures.length > 0"
				class="immich-screen__grid"
				:pictures="pictures"
				:groupByFolder="true"
				:fileNames="props.settings.showFileNames"
				:tileSize="props.tileSize"
				:decisionOf="props.cull.decisionOf"
				:imageUrl="props.cull.imageUrl"
				v-bind="props.observeSize === undefined ? {} : { observeSize: props.observeSize }"
				@update:tileSize="emit('update:tileSize', $event)"
				@open="page"
				@shown="props.cull.loadNext($event, 1)" />
			<div v-if="list.next !== 'idle'" class="immich-screen__footer">
				<template v-if="list.next === 'failed'">
					<span>{{ t('honeycomb', 'Could not load more pictures.') }}</span>
					<NcButton @click="props.cull.retry">
						{{ t('honeycomb', 'Try again') }}
					</NcButton>
				</template>
				<span v-else>{{ t('honeycomb', 'Loading pictures…') }}</span>
			</div>
		</template>
		<Teleport to="body">
			<PhotoLoupe
				v-if="loupeIndex !== null && pictures.length > loupeIndex"
				ref="photoLoupe"
				:index="loupeIndex"
				:pictures="pictures"
				:capabilities="DECISIONS_ONLY"
				:counter="counter"
				:decisionOf="props.cull.decisionOf"
				:storage="props.storage"
				:viewState="props.viewState"
				:settings="props.settings"
				:imageUrl="props.cull.imageUrl"
				@update:index="page"
				@updateSettings="emit('updateSettings', $event)"
				@decide="decideShown"
				@toast="emit('toast', $event)"
				@close="loupeIndex = null" />
		</Teleport>
	</div>
</template>

<style scoped>
.immich-screen {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.immich-screen__toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(2 * var(--default-grid-baseline));
}

.immich-screen__count {
	color: var(--color-text-maxcontrast);
}

.immich-screen__grid {
	flex: 1;
}

.immich-screen__footer {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
}
</style>
