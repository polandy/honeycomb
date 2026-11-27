<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { CleanUp, CleanUpPart } from '../logic/stats-work.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { formatFileSize, PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{ cleanUp: CleanUp }>()

const names: Record<CleanUpPart, () => string> = {
	trash: () => t('honeycomb', 'Moved to the trash bin'),
	deleted: () => t('honeycomb', 'Deleted for good'),
	raws: () => t('honeycomb', 'RAW files removed'),
}
const counts: Record<CleanUpPart, (count: number) => string> = {
	trash: (count) => n('honeycomb', '%n photo', '%n photos', count, undefined, PLAIN_TEXT),
	deleted: (count) => n('honeycomb', '%n photo the trash bin would not keep', '%n photos the trash bin would not keep', count, undefined, PLAIN_TEXT),
	raws: (count) => n('honeycomb', '%n RAW file', '%n RAW files', count, undefined, PLAIN_TEXT),
}
const bar = computed(() => props.cleanUp.rows.filter((row) => row.bytes > 0))
const summary = computed(() => bar.value.map((row) => `${names[row.part]()} ${formatFileSize(row.bytes)}`).join(', '))
</script>

<template>
	<section class="statistics-cleanup">
		<h3>
			{{ t('honeycomb', 'Clean-up') }}
			<small v-if="props.cleanUp.freedBytes > 0" class="statistics-cleanup__freed">{{ t('honeycomb', '{size} freed', { size: formatFileSize(props.cleanUp.freedBytes) }, undefined, PLAIN_TEXT) }}</small>
		</h3>
		<p v-if="props.cleanUp.rows.length === 0" class="statistics-cleanup__note">
			{{ t('honeycomb', 'Nothing freed in this period.') }}
		</p>
		<template v-else>
			<div
				v-if="bar.length > 0"
				class="statistics-cleanup__split"
				role="img"
				:aria-label="summary">
				<i
					v-for="row in bar"
					:key="row.part"
					:class="`statistics-bars__part--${row.part}`"
					:style="{ flexGrow: row.bytes }" />
			</div>
			<ul class="statistics-rows">
				<li v-for="row in props.cleanUp.rows" :key="row.part" class="statistics-rows__row">
					<i class="statistics-cleanup__swatch" :class="`statistics-bars__part--${row.part}`" aria-hidden="true" />
					<span class="statistics-rows__text">
						<span class="statistics-rows__name">{{ names[row.part]() }}</span>
						<span class="statistics-rows__note">{{ counts[row.part](row.count) }}</span>
					</span>
					<span class="statistics-rows__value">{{ formatFileSize(row.bytes) }}</span>
				</li>
			</ul>
		</template>
		<p class="statistics-cleanup__note">
			{{ t('honeycomb', 'Space is freed when the trash bin is emptied.') }}
		</p>
	</section>
</template>

<style scoped src="../statistics/bar-parts.css" />

<style scoped src="../statistics/card-rows.css" />

<style scoped>
.statistics-cleanup {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
}

.statistics-cleanup h3 {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	justify-content: space-between;
	gap: calc(2 * var(--default-grid-baseline));
	margin: 0;
}

.statistics-cleanup__freed {
	color: var(--color-text-maxcontrast);
	font-weight: normal;
}

.statistics-cleanup__split {
	display: flex;
	height: calc(4 * var(--default-grid-baseline));
	border-radius: var(--border-radius-small);
	overflow: hidden;
}

.statistics-cleanup__split i {
	display: block;
	flex-basis: 0;
}

.statistics-cleanup__swatch {
	display: block;
	flex: none;
	width: calc(4 * var(--default-grid-baseline));
	height: calc(4 * var(--default-grid-baseline));
	border-radius: var(--border-radius-small);
}

.statistics-cleanup__note {
	margin: 0;
	color: var(--color-text-maxcontrast);
}
</style>
