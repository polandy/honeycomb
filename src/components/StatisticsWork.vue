<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { WorkKey, WorkRow } from '../logic/stats-work.ts'

import { n, t } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{ rows: readonly WorkRow[] }>()

const names: Record<WorkKey, () => string> = {
	sidecarsCreated: () => t('honeycomb', 'Sidecars created'),
	sidecarsUpdated: () => t('honeycomb', 'Sidecars updated'),
	ratingsSet: () => t('honeycomb', 'Ratings set'),
	colourLabelsSet: () => t('honeycomb', 'Colour labels set'),
	tagsSet: () => t('honeycomb', 'Tags set'),
	seriesDone: () => t('honeycomb', 'Series done'),
	foldersDone: () => t('honeycomb', 'Folders done'),
	picturesMoved: () => t('honeycomb', 'Pictures moved'),
}
</script>

<template>
	<section class="statistics-work">
		<h3>{{ t('honeycomb', 'Work done') }}</h3>
		<p v-if="props.rows.length === 0" class="statistics-work__note">
			{{ t('honeycomb', 'Nothing done in this period.') }}
		</p>
		<ul v-else class="statistics-rows">
			<li v-for="row in props.rows" :key="row.key" class="statistics-rows__row">
				<span class="statistics-rows__text">
					<span class="statistics-rows__name">{{ names[row.key]() }}</span>
					<span v-if="row.foreign > 0" class="statistics-rows__note">{{ n('honeycomb', '%n from digiKam or darktable', '%n from digiKam or darktable', row.foreign, undefined, PLAIN_TEXT) }}</span>
				</span>
				<span class="statistics-rows__value">{{ formatNumber(row.value) }}</span>
			</li>
		</ul>
	</section>
</template>

<style scoped src="../statistics/card-rows.css" />

<style scoped>
.statistics-work {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
}

.statistics-work h3 {
	margin: 0;
}

.statistics-work__note {
	margin: 0;
	color: var(--color-text-maxcontrast);
}
</style>
