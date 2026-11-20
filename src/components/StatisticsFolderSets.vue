<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ResumePosition } from '../logic/resume-position.ts'

import { t } from '@nextcloud/l10n'
import ProgressBar from './ProgressBar.vue'
import { formatNumber, formatPercent, PLAIN_TEXT } from '../l10n.ts'
import { folderSetShare } from '../logic/statistics.ts'
import { folderSetName } from '../recent-text.ts'

const props = defineProps<{ positions: readonly ResumePosition[] }>()

/** The share of a folder set decided: *Done* at 100 %, else the percent. */
function share({ decided, total }: ResumePosition): string {
	const { percent, done } = folderSetShare(decided, total)
	return done ? t('honeycomb', 'Done') : formatPercent(percent)
}

/** "79 of 100", the pictures decided of the folder set. */
function counts({ decided, total }: ResumePosition): string {
	return t('honeycomb', '{decided} of {total}', { decided: formatNumber(decided), total: formatNumber(total) }, undefined, PLAIN_TEXT)
}
</script>

<template>
	<section class="statistics-folder-sets">
		<h3>{{ t('honeycomb', 'Folder sets') }}</h3>
		<p v-if="props.positions.length === 0" class="statistics-folder-sets__empty">
			{{ t('honeycomb', 'Folder sets you cull show here.') }}
		</p>
		<ul v-else class="statistics-folder-sets__list">
			<li v-for="position in props.positions" :key="JSON.stringify(position.folderSet)" class="statistics-folder-sets__row">
				<span class="statistics-folder-sets__name">{{ folderSetName(position.folderSet) }}</span>
				<span class="statistics-folder-sets__share">{{ share(position) }}</span>
				<ProgressBar
					class="statistics-folder-sets__bar"
					:label="folderSetName(position.folderSet)"
					:value="position.decided"
					:max="position.total" />
				<span class="statistics-folder-sets__counts">{{ counts(position) }}</span>
			</li>
		</ul>
	</section>
</template>

<style scoped>
.statistics-folder-sets__list {
	display: grid;
	gap: calc(2 * var(--default-grid-baseline));
	margin: 0;
	padding: 0;
	list-style: none;
}

.statistics-folder-sets__row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	gap: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
}

.statistics-folder-sets__name {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.statistics-folder-sets__bar {
	width: 100%;
}

.statistics-folder-sets__share {
	font-weight: bold;
	text-align: end;
}

.statistics-folder-sets__counts,
.statistics-folder-sets__empty {
	color: var(--color-text-maxcontrast);
}
</style>
