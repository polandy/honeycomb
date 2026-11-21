<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Box, TipPlacement } from '../logic/tooltip.ts'

import { t } from '@nextcloud/l10n'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { formatDateTimeSeconds, PLAIN_TEXT } from '../l10n.ts'
import { imageMember } from '../logic/image-tiers.ts'
import { ratingStars, tileInfoMembers } from '../logic/tile-info.ts'
import { placeTip } from '../logic/tooltip.ts'

const props = defineProps<{
	picture: Picture<SourceEntry>
	decision: Decision
	/** The tile's box in the viewport, which the bubble points at. */
	anchor: Box
}>()

const bubble = useTemplateRef<HTMLElement>('bubble')
const placement = ref<TipPlacement | null>(null)

const members = computed(() => {
	const extensions = tileInfoMembers(props.picture)
	return extensions.length === 1
		? t('honeycomb', '{extension} only', { extension: extensions[0]! }, undefined, PLAIN_TEXT)
		: extensions.join(' + ')
})
const rows = computed(() => {
	const { captureTime, camera } = imageMember(props.picture)
	return [
		...(captureTime === null ? [] : [{ term: t('honeycomb', 'Captured'), value: formatDateTimeSeconds(captureTime), nowrap: true }]),
		...(camera === null ? [] : [{ term: t('honeycomb', 'Camera'), value: camera, nowrap: false }]),
		{ term: t('honeycomb', 'Rating'), value: ratingStars(props.decision.rating), nowrap: false },
	]
})

// Placed in the window like the tooltip, without a photo to keep off (GRID-004.10).
onMounted(() => {
	const { width, height } = bubble.value!.getBoundingClientRect()
	placement.value = placeTip(props.anchor, { width, height }, { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }, null)
})

const style = computed(() => placement.value === null
	? { visibility: 'hidden' as const }
	: { left: `${placement.value.x}px`, top: `${placement.value.y}px`, '--tip-arrow': `${placement.value.arrow}px` })
</script>

<template>
	<Teleport to="body">
		<div
			ref="bubble"
			class="tip-bubble tile-info"
			aria-hidden="true"
			:data-side="placement?.side"
			:style="style">
			<p class="tile-info__name">
				{{ props.picture.baseName }} <span class="tile-info__members">{{ members }}</span>
			</p>
			<dl class="tile-info__rows">
				<template v-for="row in rows" :key="row.term">
					<dt>{{ row.term }}</dt>
					<dd :class="{ 'tile-info__nowrap': row.nowrap }">
						{{ row.value }}
					</dd>
				</template>
			</dl>
			<i class="tip-bubble__arrow" />
		</div>
	</Teleport>
</template>

<style scoped src="./tip-bubble.css" />

<style scoped>
.tile-info__name {
	margin: 0;
	font-weight: 600;
	overflow-wrap: anywhere;
}

.tile-info__members {
	font-weight: normal;
	white-space: nowrap;
}

.tile-info {
	max-width: min(320px, calc(100vw - 16px));
}

.tile-info__nowrap {
	white-space: nowrap;
}

.tile-info__rows {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: 0 8px;
	margin: 4px 0 0;
}

.tile-info__rows dt,
.tile-info__rows dd {
	margin: 0;
	padding: 0;
}
</style>
