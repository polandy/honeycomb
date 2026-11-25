<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderRow } from '../logic/folder-row.ts'

import { t } from '@nextcloud/l10n'
import { computed, useId, useTemplateRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import { doneText, newBadgeText, photosText, reasonText, splitText, undecidedText } from '../folders/folders-text.ts'
import { folderName, isComplete, isRateable, newCount, percent } from '../logic/folder-row.ts'
import { PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{
	row: FolderRow
	/** Shown in place of the folder's name, as a chain's names or *Photos directly in* (FOLDERS-009). */
	label?: string
	/** The parent line, the parent's path when left out; empty hides it. */
	parent?: string | undefined
	/** The grey row *Photos directly in* of a level (FOLDERS-009.8). */
	own?: boolean
}>()

const emit = defineEmits<{
	cull: []
	menu: []
	/** Mark the complete folder done without a dialog (FOLDERS-008.1). */
	markDone: []
	/** Cull the done folder's new photos (FOLDERS-008.7). */
	cullNew: []
}>()

const name = computed(() => props.label ?? folderName(props.row))
const nameId = useId()
const parent = computed(() => props.parent ?? (props.row.path.slice(0, -folderName(props.row).length - 1) || '/'))
const rateable = computed(() => isRateable(props.row))
const open = computed(() => props.row.done === null)
/** An open folder the user may rate with photos left to decide offers *Cull* (FOLDERS-007.11). */
const cullable = computed(() => open.value && rateable.value && props.row.undecided > 0)
/** A complete open folder offers *Mark done* in place of *Cull* (FOLDERS-008.1). */
const markable = computed(() => open.value && rateable.value && isComplete(props.row))
const cullableNew = computed(() => !open.value && rateable.value && newCount(props.row) > 0)
const more = useTemplateRef<InstanceType<typeof NcButton>>('more')
const split = computed(() => ([['picked', props.row.picked], ['undecided', props.row.undecided], ['rejected', props.row.rejected]] as const)
	.map(([kind, count]) => ({ kind, width: `${percent(count, props.row.photos)}%` })))

/** Focuses the row's *More*, where a done change leaves the focus (FOLDERS-008.3). */
function focus() {
	(more.value?.$el as HTMLElement | undefined)?.focus()
}

defineExpose({ focus })
</script>

<template>
	<article class="folder-row" :class="{ 'folder-row--done': !open, 'folder-row--own': props.own }" :aria-labelledby="nameId">
		<span class="folder-row__icon" aria-hidden="true">
			<AppIcon :name="open ? 'folder' : 'check'" />
		</span>
		<div class="folder-row__head">
			<span :id="nameId" class="folder-row__name" translate="no">{{ name }}</span>
			<span v-if="parent !== ''" class="folder-row__parent" translate="no">{{ parent }}</span>
		</div>
		<div class="folder-row__counts">
			<span>{{ photosText(props.row.photos) }}</span>
			<span v-if="open && props.row.undecided > 0">{{ undecidedText(props.row.undecided) }}</span>
		</div>
		<div class="folder-row__meta">
			<div class="folder-row__split" role="img" :aria-label="splitText(props.row)">
				<span
					v-for="part in split"
					:key="part.kind"
					:class="`folder-row__split-${part.kind}`"
					:style="{ width: part.width }" />
			</div>
			<p class="folder-row__state">
				<template v-if="!open">
					<span v-if="newBadgeText(props.row) !== null" class="folder-row__badge">{{ newBadgeText(props.row) }}</span>
					<span>{{ doneText(props.row) }}</span>
				</template>
				<span v-else-if="rateable && isComplete(props.row)" class="folder-row__badge">{{ t('honeycomb', 'Complete · not marked done') }}</span>
				<template v-else>
					<span v-if="!rateable" class="folder-row__badge">{{ t('honeycomb', 'Read-only') }}</span>
					<span>{{ reasonText(props.row) }}</span>
				</template>
			</p>
		</div>
		<div class="folder-row__actions">
			<NcButton
				v-if="cullable"
				class="folder-row__cull"
				variant="primary"
				:aria-label="t('honeycomb', 'Cull {name}', { name }, undefined, PLAIN_TEXT)"
				@click="emit('cull')">
				{{ t('honeycomb', 'Cull') }}
			</NcButton>
			<NcButton
				v-if="markable"
				class="folder-row__mark-done"
				variant="primary"
				:aria-label="t('honeycomb', 'Mark done: {name}', { name }, undefined, PLAIN_TEXT)"
				@click="emit('markDone')">
				{{ t('honeycomb', 'Mark done') }}
			</NcButton>
			<NcButton
				v-if="cullableNew"
				class="folder-row__cull-new"
				variant="primary"
				:aria-label="t('honeycomb', 'Cull new in {name}', { name }, undefined, PLAIN_TEXT)"
				@click="emit('cullNew')">
				{{ t('honeycomb', 'Cull new') }}
			</NcButton>
			<slot />
			<NcButton
				ref="more"
				variant="tertiary"
				:aria-label="t('honeycomb', 'More for {name}', { name }, undefined, PLAIN_TEXT)"
				@click="emit('menu')">
				<template #icon>
					<AppIcon name="more" />
				</template>
			</NcButton>
		</div>
	</article>
</template>

<style scoped src="./folder-row.css" />
