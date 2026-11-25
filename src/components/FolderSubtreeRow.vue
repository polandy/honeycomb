<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderNode } from '../logic/folder-hierarchy.ts'

import { t } from '@nextcloud/l10n'
import { computed, useId } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import FolderCover from './FolderCover.vue'
import { imageUrl } from '../api/index.ts'
import { foldersText, photosText, splitText, subtreeStateText, undecidedText } from '../folders/folders-text.ts'
import { scopeSums, subtreeState } from '../logic/folder-hierarchy.ts'
import { percent } from '../logic/folder-row.ts'
import { PLAIN_TEXT } from '../shared/l10n.ts'

/** A row of a level that stands for a folder with subfolders, in the switch's scope (FOLDERS-009). */
const props = defineProps<{ node: FolderNode, label: string, includeSubfolders: boolean }>()

const emit = defineEmits<{ cull: [] }>()

const nameId = useId()
const sums = computed(() => scopeSums(props.node, props.includeSubfolders))
const state = computed(() => subtreeState(sums.value))
const cullable = computed(() => state.value === 'open')
const split = computed(() => ([['picked', sums.value.picked], ['undecided', sums.value.undecided], ['rejected', sums.value.rejected]] as const)
	.map(([kind, count]) => ({ kind, width: `${percent(count, sums.value.photos)}%` })))
</script>

<template>
	<article class="folder-row" :class="{ 'folder-row--done': state === 'done' }" :aria-labelledby="nameId">
		<FolderCover
			class="folder-row__cover"
			:previews="[]"
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
				<span :class="{ 'folder-row__badge': state === 'read-only' || state === 'complete' }">
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
			<slot />
		</div>
	</article>
</template>

<style scoped src="./folder-row.css" />
