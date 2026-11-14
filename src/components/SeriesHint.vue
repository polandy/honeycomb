<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import { keyCap } from '../hotkeys.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { placeUnderAnchor } from '../logic/anchored-card.ts'

const props = defineProps<{
	/** The series' count. */
	count: number
	/** The series chip the card points at. */
	anchor: HTMLElement
	/** What the card stays inside: the title row. */
	box: HTMLElement
}>()

const emit = defineEmits<{
	dismiss: []
}>()

/** As in the signed-off mockup: the card's end 10 px past the chip's, 8 px from the loupe's edges. */
const ROOM = { overhang: 10, margin: 8 }

const card = useTemplateRef<HTMLElement>('card')
const place = ref({ left: 0, arrow: 0 })

/** Puts the card under the chip and inside the title row. */
function measure() {
	const box = props.box.getBoundingClientRect()
	const anchor = props.anchor.getBoundingClientRect()
	place.value = placeUnderAnchor({ left: anchor.left - box.left, width: anchor.width }, card.value!.offsetWidth, box.width, ROOM)
}

watch(() => props.count, measure, { flush: 'post' })
onMounted(() => {
	measure()
	window.addEventListener('resize', measure)
})
onUnmounted(() => window.removeEventListener('resize', measure))
</script>

<template>
	<div
		ref="card"
		class="series-hint"
		role="dialog"
		:aria-label="t('honeycomb', 'Series hint')"
		:style="{ left: `${place.left}px`, '--series-hint-arrow': `${place.arrow}px` }">
		<p>{{ t('honeycomb', 'This photo is part of a series of {count}. ⧉ or {compareKey} compares them; {pickRestKey} picks this one and rejects the rest.', { count: formatNumber(count), compareKey: keyCap('compare'), pickRestKey: keyCap('pick-rest') }, undefined, PLAIN_TEXT) }}</p>
		<NcButton variant="primary" @click="emit('dismiss')">
			{{ t('honeycomb', 'Got it') }}
		</NcButton>
	</div>
</template>

<style scoped>
.series-hint {
	position: absolute;
	z-index: 2;
	top: calc(100% + 3 * var(--default-grid-baseline));
	width: min(300px, calc(100vw - 16px));
	padding: calc(3 * var(--default-grid-baseline)) calc(3.5 * var(--default-grid-baseline));
	border: 2px solid var(--color-primary-element);
	border-radius: var(--border-radius-large);
	background-color: var(--color-main-background);
	color: var(--color-main-text);
	box-shadow: 0 2px 8px var(--color-box-shadow);
	font-weight: normal;
	white-space: normal;
}

/* The arrow up to the chip. */
.series-hint::before {
	content: '';
	position: absolute;
	top: -9px;
	left: calc(var(--series-hint-arrow) - 7px);
	width: 14px;
	height: 14px;
	border-left: 2px solid var(--color-primary-element);
	border-top: 2px solid var(--color-primary-element);
	background-color: var(--color-main-background);
	transform: rotate(45deg);
}

.series-hint p {
	margin-block: 0 calc(2.5 * var(--default-grid-baseline));
}
</style>
