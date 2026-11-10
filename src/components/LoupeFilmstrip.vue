<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import FlagMark from './FlagMark.vue'
import { imageMember, smallSource } from '../logic/image-tiers.ts'

const props = defineProps<{
	pictures: readonly Picture<ListingEntry>[]
	index: number
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	imageUrl: ImageUrlFor
}>()

const emit = defineEmits<{ select: [index: number] }>()

/** How many pictures the filmstrip shows on each side of the shown one, as in the mockup. */
const REACH = 8

const shown = computed(() => {
	const first = Math.max(0, props.index - REACH)
	return props.pictures.slice(first, props.index + REACH + 1).map((picture, offset) => ({
		picture,
		index: first + offset,
		member: imageMember(picture),
		flag: props.decisionOf(picture).flag,
	}))
})
</script>

<template>
	<nav class="loupe-filmstrip" :aria-label="t('honeycomb', 'Filmstrip')">
		<button
			v-for="item in shown"
			:key="item.member.fileId"
			type="button"
			class="loupe-filmstrip__photo"
			:class="{ 'loupe-filmstrip__photo--current': item.index === props.index }"
			:aria-label="item.picture.baseName"
			:aria-current="item.index === props.index ? 'true' : undefined"
			@click="emit('select', item.index)">
			<img alt="" draggable="false" :src="smallSource(item.member, props.imageUrl)">
			<FlagMark v-if="item.flag !== 'unflagged'" class="loupe-filmstrip__flag" :flag="item.flag" />
		</button>
	</nav>
</template>

<style scoped>
.loupe-filmstrip {
	display: flex;
	justify-content: center;
	gap: var(--default-grid-baseline);
	padding: var(--default-grid-baseline);
	overflow-x: auto;
}

.loupe-filmstrip__photo {
	position: relative;
	flex: none;
	width: 64px;
	height: 64px;
	min-height: 0;
	padding: 0;
	border: 2px solid transparent;
	border-radius: var(--border-radius-small, 4px);
	background: none;
	opacity: 0.7;
}

.loupe-filmstrip__photo--current {
	border-color: var(--color-primary-element);
	opacity: 1;
}

.loupe-filmstrip__photo img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.loupe-filmstrip__flag {
	position: absolute;
	inset-block-end: 2px;
	inset-inline-end: 2px;
}
</style>
