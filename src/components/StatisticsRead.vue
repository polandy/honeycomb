<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ReadPictures } from '../logic/statistics.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { formatPercent, PLAIN_TEXT } from '../l10n.ts'
import { readShares } from '../logic/statistics.ts'

const props = defineProps<{ read: ReadPictures }>()

const shares = computed(() => readShares(props.read))
const unflagged = computed(() => props.read.pictures - props.read.picked - props.read.rejected)
const line = computed(() => {
	const each = shares.value!
	return [
		t('honeycomb', '{share} picked', { share: formatPercent(each.picked) }, undefined, PLAIN_TEXT),
		t('honeycomb', '{share} rejected', { share: formatPercent(each.rejected) }, undefined, PLAIN_TEXT),
		t('honeycomb', '{share} unflagged', { share: formatPercent(each.unflagged) }, undefined, PLAIN_TEXT),
		t('honeycomb', '{share} rated', { share: formatPercent(each.rated) }, undefined, PLAIN_TEXT),
	].join(' · ')
})
</script>

<template>
	<section v-if="shares" class="statistics-read">
		<h3>{{ t('honeycomb', 'Of the pictures read so far') }}</h3>
		<div class="statistics-read__split" aria-hidden="true">
			<i class="statistics-read__picked" :style="{ flexGrow: props.read.picked }" />
			<i class="statistics-read__rejected" :style="{ flexGrow: props.read.rejected }" />
			<i class="statistics-read__unflagged" :style="{ flexGrow: unflagged }" />
		</div>
		<p class="statistics-read__line">
			{{ line }}
		</p>
	</section>
</template>

<style scoped>
.statistics-read__split {
	display: flex;
	height: calc(2.5 * var(--default-grid-baseline));
	border-radius: var(--border-radius-small);
	overflow: hidden;
}

.statistics-read__split i {
	display: block;
	flex-basis: 0;
}

.statistics-read__picked {
	background: var(--color-success);
}

.statistics-read__rejected {
	background: var(--color-error);
}

.statistics-read__unflagged {
	background: var(--color-background-darker);
}

.statistics-read__line {
	color: var(--color-text-maxcontrast);
}
</style>
