<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { imageMember, smallSource } from '../logic/image-tiers.ts'

const props = withDefaults(defineProps<{
	pictures: readonly Picture<ListingEntry>[]
	/** What a tap does, e.g. "Rescue". */
	action: string
	/** The tile's accessible name, e.g. "Rescue IMG_0001". */
	label: (picture: Picture<ListingEntry>) => string
	/** The tile's frame: red for pictures that go, honey for pictures that stay. */
	tone: 'error' | 'primary'
	imageUrl: ImageUrlFor
	/** A second line under the name. */
	caption?: (picture: Picture<ListingEntry>) => string
}>(), { caption: () => '' })

const emit = defineEmits<{
	tap: [picture: Picture<ListingEntry>]
}>()
</script>

<template>
	<ul class="picture-thumbs">
		<li v-for="picture in props.pictures" :key="imageMember(picture).fileId">
			<button
				type="button"
				class="picture-thumbs__tile"
				:class="`picture-thumbs__tile--${props.tone}`"
				:aria-label="props.label(picture)"
				@click="emit('tap', picture)">
				<img :src="smallSource(imageMember(picture), props.imageUrl)" alt="" loading="lazy">
				<span class="picture-thumbs__name">{{ picture.baseName }}</span>
				<span v-if="props.caption(picture)" class="picture-thumbs__caption">{{ props.caption(picture) }}</span>
				<span class="picture-thumbs__action">{{ props.action }}</span>
			</button>
		</li>
	</ul>
</template>

<style scoped>
.picture-thumbs {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	gap: calc(var(--default-grid-baseline) * 2);
	margin: 0;
	padding: 0;
	list-style: none;
}

.picture-thumbs__tile {
	display: flex;
	flex-direction: column;
	width: 100%;
	min-height: 44px;
	margin: 0;
	padding: calc(var(--default-grid-baseline) * 1);
	border: 2px solid var(--color-error);
	border-radius: var(--border-radius-large);
	background: var(--color-main-background);
	text-align: start;
}

.picture-thumbs__tile--primary {
	border-color: var(--color-primary-element);
}

.picture-thumbs__tile img {
	width: 100%;
	aspect-ratio: 1;
	object-fit: cover;
}

.picture-thumbs__name {
	font-weight: bold;
	overflow-wrap: anywhere;
}

.picture-thumbs__caption {
	color: var(--color-text-maxcontrast);
}

.picture-thumbs__action {
	align-self: flex-start;
	margin-top: calc(var(--default-grid-baseline) * 1);
	color: var(--color-primary-element);
	font-weight: bold;
}
</style>
