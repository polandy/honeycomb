<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderNode } from '../logic/folder-hierarchy.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import { largeSubtreeText, levelSummaryText } from '../folders/folders-text.ts'
import { isLargeSubtree, scopeSums } from '../logic/folder-hierarchy.ts'

/** The card of the shown level: its photos and *Cull this level* in the switch's scope (FOLDERS-009). */
const props = defineProps<{ level: FolderNode, includeSubfolders: boolean }>()

const emit = defineEmits<{ cull: [] }>()

const summary = computed(() => levelSummaryText(scopeSums(props.level, true), scopeSums(props.level, false)))
const large = computed(() => isLargeSubtree(scopeSums(props.level, true)))
const cullable = computed(() => scopeSums(props.level, props.includeSubfolders).photos > 0)
</script>

<template>
	<section class="folder-level-card">
		<div class="folder-level-card__text">
			<h2 class="folder-level-card__name" translate="no">
				{{ props.level.name }}
			</h2>
			<span class="folder-level-card__summary">{{ summary }}</span>
			<span v-if="large" class="folder-level-card__summary">{{ largeSubtreeText() }}</span>
		</div>
		<NcButton variant="primary" :disabled="!cullable" @click="emit('cull')">
			{{ t('honeycomb', 'Cull this level') }}
		</NcButton>
	</section>
</template>

<style scoped>
.folder-level-card {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(3 * var(--default-grid-baseline)) calc(3.5 * var(--default-grid-baseline));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-container);
	background: var(--color-main-background);
}

.folder-level-card__text {
	display: grid;
	min-width: 0;
}

.folder-level-card__name {
	overflow: hidden;
	margin: 0;
	font-size: 18px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.folder-level-card__summary {
	color: var(--color-text-maxcontrast);
	font-size: 13px;
}
</style>
