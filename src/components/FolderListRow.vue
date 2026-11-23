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
import { doneText, newBadgeText, photosText, reasonText, splitText, undecidedText } from '../folders-text.ts'
import { PLAIN_TEXT } from '../l10n.ts'
import { folderName, isComplete, isRateable, newCount, percent } from '../logic/folder-row.ts'

const props = defineProps<{ row: FolderRow }>()

const emit = defineEmits<{
	cull: []
	menu: []
	/** Mark the complete folder done without a dialog (FOLDERS-008.1). */
	markDone: []
	/** Cull the done folder's new photos (FOLDERS-008.7). */
	cullNew: []
}>()

const name = computed(() => folderName(props.row))
const nameId = useId()
const parent = computed(() => props.row.path.slice(0, -name.value.length - 1) || '/')
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
	<article class="folder-row" :class="{ 'folder-row--done': !open }" :aria-labelledby="nameId">
		<span class="folder-row__icon" aria-hidden="true">
			<AppIcon :name="open ? 'folder' : 'check'" />
		</span>
		<div class="folder-row__head">
			<span :id="nameId" class="folder-row__name" translate="no">{{ name }}</span>
			<span class="folder-row__parent" translate="no">{{ parent }}</span>
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

<style scoped>
.folder-row {
	display: grid;
	grid-template-areas: "icon head counts" "icon meta meta" "icon actions actions";
	grid-template-columns: 36px 1fr auto;
	gap: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
	align-items: start;
	padding: calc(2.5 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-container);
	background: var(--color-main-background);
}

@media (min-width: 720px) {
	.folder-row {
		grid-template-areas: "icon head counts actions" "icon meta meta actions";
		grid-template-columns: 36px 1fr auto auto;
		align-items: center;
	}
}

.folder-row--done {
	background: var(--color-background-hover);
}

.folder-row__icon {
	display: flex;
	grid-area: icon;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: 50%;
	background: var(--color-background-dark);
	color: var(--color-text-maxcontrast);
}

.folder-row__head {
	display: flex;
	grid-area: head;
	flex-direction: column;
	min-width: 0;
}

.folder-row__name {
	overflow: hidden;
	font-weight: bold;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.folder-row__parent {
	overflow: hidden;
	color: var(--color-text-maxcontrast);
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.folder-row__counts {
	display: flex;
	grid-area: counts;
	flex-direction: column;
	align-items: flex-end;
	color: var(--color-text-maxcontrast);
	font-size: 13px;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.folder-row__meta {
	display: grid;
	grid-area: meta;
	gap: var(--default-grid-baseline);
	min-width: 0;
}

.folder-row__split {
	display: flex;
	overflow: hidden;
	height: 8px;
	border-radius: 4px;
	background: var(--color-background-darker);
}

.folder-row__split-picked {
	background: var(--color-success);
}

.folder-row__split-undecided {
	background: var(--color-border-maxcontrast);
}

.folder-row__split-rejected {
	background: var(--color-error);
}

.folder-row__state {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 2px calc(1.5 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
	font-size: 13px;
}

.folder-row__badge {
	padding: 1px calc(2 * var(--default-grid-baseline));
	border-radius: var(--border-radius-pill, 10px);
	background: var(--color-primary-element-light);
	color: var(--color-primary-element-light-text);
	font-size: 12px;
	font-weight: bold;
}

.folder-row__actions {
	display: flex;
	grid-area: actions;
	align-items: center;
	justify-content: flex-end;
	gap: calc(1.5 * var(--default-grid-baseline));
}
</style>
