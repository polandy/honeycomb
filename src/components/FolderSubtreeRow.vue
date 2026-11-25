<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderNode } from '../logic/folder-hierarchy.ts'

import { t } from '@nextcloud/l10n'
import { computed, useId } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import FolderCover from './FolderCover.vue'
import { imageUrl } from '../api/index.ts'
import { foldersText, newText, photosText, splitText, subtreeStateText, undecidedText } from '../folders/folders-text.ts'
import { scopeSums, subtreePreviews, subtreeState } from '../logic/folder-hierarchy.ts'
import { percent } from '../logic/folder-row.ts'
import { PLAIN_TEXT } from '../shared/l10n.ts'

/** A row of a level that stands for a folder with subfolders, in the switch's scope (FOLDERS-009). */
const props = defineProps<{ node: FolderNode, label: string, includeSubfolders: boolean }>()

const emit = defineEmits<{ cull: [], cullNew: [], markAllDone: [], menu: [] }>()

const nameId = useId()
const sums = computed(() => scopeSums(props.node, props.includeSubfolders))
const state = computed(() => subtreeState(sums.value))
const cullable = computed(() => state.value === 'open')
const cullableNew = computed(() => sums.value.fresh > 0)
const previews = computed(() => subtreePreviews(props.node, props.includeSubfolders))
/** Complete as shown and in the whole subtree, so *Mark all done* marks what the row shows (FOLDERS-009.10). */
const markable = computed(() => state.value === 'complete' && subtreeState(scopeSums(props.node, true)) === 'complete')
const split = computed(() => ([['picked', sums.value.picked], ['undecided', sums.value.undecided], ['rejected', sums.value.rejected]] as const)
	.map(([kind, count]) => ({ kind, width: `${percent(count, sums.value.photos)}%` })))
</script>

<template>
	<article class="folder-row" :class="{ 'folder-row--done': state === 'done' }" :aria-labelledby="nameId">
		<FolderCover
			class="folder-row__cover"
			:previews="previews"
			:done="state === 'done'"
			:imageUrl="imageUrl" />
		<div class="folder-row__head">
			<span :id="nameId" class="folder-row__name" translate="no">{{ props.label }}</span>
		</div>
		<div v-if="state !== 'empty'" class="folder-row__counts">
			<span>{{ photosText(sums.photos) }}</span>
			<span>{{ foldersText(sums.folders) }}</span>
			<span v-if="cullable">{{ undecidedText(sums.undecided) }}</span>
		</div>
		<div class="folder-row__meta">
			<div
				v-if="state !== 'empty'"
				class="folder-row__split"
				role="img"
				:aria-label="splitText(sums)">
				<span
					v-for="part in split"
					:key="part.kind"
					:class="`folder-row__split-${part.kind}`"
					:style="{ width: part.width }" />
			</div>
			<p class="folder-row__state">
				<span v-if="cullableNew" class="folder-row__badge">{{ newText(sums.fresh) }}</span>
				<span :class="{ 'folder-row__badge': state === 'read-only' }">
					{{ subtreeStateText(state, sums, props.node.children.length) }}
				</span>
			</p>
		</div>
		<div class="folder-row__actions">
			<NcButton
				v-if="cullable"
				class="folder-row__cull"
				variant="primary"
				:aria-label="t('honeycomb', 'Cull {name}', { name: props.label }, undefined, PLAIN_TEXT)"
				@click="emit('cull')">
				{{ t('honeycomb', 'Cull') }}
			</NcButton>
			<NcButton
				v-if="cullableNew"
				class="folder-row__cull-new"
				variant="primary"
				:aria-label="t('honeycomb', 'Cull new in {name}', { name: props.label }, undefined, PLAIN_TEXT)"
				@click="emit('cullNew')">
				{{ t('honeycomb', 'Cull new') }}
			</NcButton>
			<NcButton
				v-if="markable"
				class="folder-row__mark-all"
				variant="primary"
				:aria-label="t('honeycomb', 'Mark all done: {name}', { name: props.label }, undefined, PLAIN_TEXT)"
				@click="emit('markAllDone')">
				{{ t('honeycomb', 'Mark all done') }}
			</NcButton>
			<NcButton
				variant="tertiary"
				:aria-label="t('honeycomb', 'More for {name}', { name: props.label }, undefined, PLAIN_TEXT)"
				@click="emit('menu')">
				<template #icon>
					<AppIcon name="more" />
				</template>
			</NcButton>
			<slot />
		</div>
	</article>
</template>

<style scoped src="./folder-row.css" />
