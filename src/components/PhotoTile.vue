<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script lang="ts">
/** Decodes the image the browser picks from `srcset` at `sizes`, off the page. */
async function decodeImage(srcset: string, sizes: string): Promise<void> {
	const image = new Image()
	image.sizes = sizes
	image.srcset = srcset
	await image.decode()
}
</script>

<script setup lang="ts">
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref, watch } from 'vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { PLAIN_TEXT } from '../l10n.ts'
import { GRID_TIERS, gridSrcset, imageMember, sharpTier, smallSource } from '../logic/image-tiers.ts'
import { pairBadge } from '../logic/pair-badge.ts'

const props = withDefaults(defineProps<{
	picture: Picture<ListingEntry>
	/** The tile's edge in CSS pixels. */
	size: number
	imageUrl?: ImageUrlFor
	/** Resolves once the image of `srcset` at `sizes` is decoded, rejects if it cannot be. */
	loadImage?: (srcset: string, sizes: string) => Promise<void>
	devicePixelRatio?: number
}>(), {
	imageUrl: apiImageUrl,
	loadImage: decodeImage,
	devicePixelRatio: () => window.devicePixelRatio,
})

const member = computed(() => imageMember(props.picture))
const small = computed(() => smallSource(member.value, props.imageUrl))
const srcset = computed(() => gridSrcset(member.value, props.imageUrl))
const sizes = computed(() => `${Math.round(props.size)}px`)
/** The srcset whose sharp image has decoded; null while the tile shows the small one. */
const decoded = ref<string | null>(null)

const badge = computed(() => {
	const shown = pairBadge(props.picture)
	return shown.kind === 'pair'
		? { text: shown.label, single: false }
		: { text: t('honeycomb', '{extension} only', { extension: shown.extension }, undefined, PLAIN_TEXT), single: true }
})

const label = computed(() => [
	props.picture.baseName,
	badge.value.text,
	...(props.picture.ambiguous ? [t('honeycomb', 'ambiguous name')] : []),
].join(', '))

let latestLoad = 0
watch([srcset, sizes, () => props.devicePixelRatio], async () => {
	const load = ++latestLoad
	if (decoded.value === srcset.value || sharpTier(props.size, props.devicePixelRatio) === GRID_TIERS[0]) {
		return
	}
	const wanted = srcset.value
	try {
		await props.loadImage(wanted, sizes.value)
	} catch {
		return
	}
	if (load === latestLoad) {
		decoded.value = wanted
	}
}, { immediate: true })
</script>

<template>
	<div class="photo-tile" :aria-label="label">
		<img
			class="photo-tile__image"
			alt=""
			draggable="false"
			:src="small"
			:srcset="decoded ?? undefined"
			:sizes="decoded === null ? undefined : sizes">
		<span class="photo-tile__pair" :class="{ 'photo-tile__pair--single': badge.single }">{{ badge.text }}</span>
		<span v-if="props.picture.ambiguous" class="photo-tile__ambiguous" aria-hidden="true">!</span>
	</div>
</template>

<style scoped>
.photo-tile {
	position: relative;
	overflow: hidden;
	width: 100%;
	height: 100%;
	border-radius: var(--border-radius-large);
	background-color: var(--color-background-dark);
}

.photo-tile__image {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: cover;
	user-select: none;
	-webkit-touch-callout: none;
}

.photo-tile__pair,
.photo-tile__ambiguous {
	position: absolute;
	top: 6px;
	padding: 2px 6px;
	border-radius: var(--border-radius);
	font-size: 11px;
	font-weight: bold;
	line-height: 1.3;
}

.photo-tile__pair {
	inset-inline-start: 6px;
	background-color: var(--color-main-background-blur);
	color: var(--color-main-text);
}

.photo-tile__pair--single {
	border: 1px dashed var(--color-warning);
	background-color: var(--color-main-background);
	color: var(--color-warning-text);
}

.photo-tile__ambiguous {
	inset-inline-end: 6px;
	background-color: var(--color-warning);
	color: var(--color-main-background);
}
</style>
