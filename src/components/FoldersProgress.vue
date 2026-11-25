<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderProgress } from '../logic/folder-progress.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ProgressBar from './ProgressBar.vue'
import { progressSummary, progressTexts, progressTitle } from '../folders/folders-text.ts'
import { PLAIN_TEXT } from '../shared/l10n.ts'

const props = withDefaults(defineProps<{
	/** The chosen root, null for the whole library. */
	root: string | null
	/** How many roots the library has. */
	roots: number
	progress: FolderProgress
	/** One bar per root, shown for the whole library of several roots. */
	perRoot: readonly { readonly root: string, readonly progress: FolderProgress }[]
	/** Whether the card shows its own title; false where the page's title row shows it. */
	titled?: boolean
}>(), {
	titled: true,
})

const texts = computed(() => progressTexts(props.progress))
</script>

<template>
	<section class="folders-progress" :aria-label="t('honeycomb', 'Library progress')">
		<div v-if="props.titled" class="folders-progress__head">
			<h2 class="folders-progress__name" :translate="props.root === null ? undefined : 'no'">
				{{ progressTitle(props.root) }}
			</h2>
			<span class="folders-progress__summary">{{ progressSummary(props.root, props.roots, props.progress) }}</span>
		</div>
		<p class="folders-progress__headline">
			{{ texts.headline }}
		</p>
		<ProgressBar
			class="folders-progress__bar"
			:label="texts.headline"
			:value="props.progress.donePhotos"
			:max="props.progress.photos" />
		<p class="folders-progress__lines">
			<span>{{ texts.folders }}</span>
			<span>{{ texts.month }}</span>
			<span>{{ texts.decided }}</span>
		</p>
		<ul v-if="props.perRoot.length > 0" class="folders-progress__roots">
			<li v-for="each in props.perRoot" :key="each.root" class="folders-progress__root">
				<span class="folders-progress__root-name" translate="no">{{ each.root }}</span>
				<ProgressBar
					class="folders-progress__bar"
					:label="t('honeycomb', '{root}: {percent} % of photos in done folders', { root: each.root, percent: each.progress.donePercent }, undefined, PLAIN_TEXT)"
					:value="each.progress.donePhotos"
					:max="each.progress.photos" />
				<span class="folders-progress__percent">{{ t('honeycomb', '{percent} %', { percent: each.progress.donePercent }) }}</span>
			</li>
		</ul>
	</section>
</template>

<style scoped>
.folders-progress {
	display: grid;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(3 * var(--default-grid-baseline)) calc(3.5 * var(--default-grid-baseline));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-container);
	background: var(--color-main-background);
}

.folders-progress__head {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	justify-content: space-between;
	gap: calc(2.5 * var(--default-grid-baseline));
}

.folders-progress__name {
	margin: 0;
	font-size: 16px;
	overflow-wrap: anywhere;
}

.folders-progress__summary,
.folders-progress__lines {
	color: var(--color-text-maxcontrast);
	font-size: 13px;
}

.folders-progress__headline {
	font-size: 22px;
	font-weight: bold;
	font-variant-numeric: tabular-nums;
}

.folders-progress__bar {
	width: 100%;
	height: 12px;
	border-radius: 6px;
}

.folders-progress__lines {
	display: flex;
	flex-wrap: wrap;
	gap: var(--default-grid-baseline) calc(3.5 * var(--default-grid-baseline));
}

.folders-progress__roots {
	display: grid;
	gap: calc(1.5 * var(--default-grid-baseline));
}

.folders-progress__root {
	display: grid;
	grid-template-columns: minmax(80px, 140px) 1fr auto;
	align-items: center;
	gap: calc(2.5 * var(--default-grid-baseline));
	font-size: 13px;
}

.folders-progress__root-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.folders-progress__percent {
	font-variant-numeric: tabular-nums;
}
</style>
