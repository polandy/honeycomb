<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { MoveFlow } from '../move-flow.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import DeleteStats from './DeleteStats.vue'
import FolderList from './FolderList.vue'
import MoveSummary from './MoveSummary.vue'
import TrashFileList from './TrashFileList.vue'
import { listFolders as apiListFolders } from '../api.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { folderName, parentName } from '../logic/move-targets.ts'
import { moveFailureReason } from '../move-text.ts'

const props = withDefaults(defineProps<{
	flow: MoveFlow
	folderSet: FolderSet
	listFolders?: (path: string) => Promise<Folder[]>
	/** Where the dialogs open, e.g. inside the loupe; the page body by default. */
	container?: string | undefined
}>(), {
	listFolders: apiListFolders,
	container: undefined,
})

const flow = props.flow
const browsed = ref<string | null>(null)
const pictures = computed(() => flow.pictures.value?.length ?? 0)
const confirmLabel = computed(() => (flow.plan.value === null
	? t('honeycomb', 'Move')
	: n('honeycomb', 'Move {count} file', 'Move {count} files', flow.counts.value.files, { count: formatNumber(flow.counts.value.files) }, PLAIN_TEXT)))
const reportRows = computed(() => (flow.report.value?.failed ?? []).map(({ file, result }) => ({ file, reason: moveFailureReason(result) })))
const reportStats = computed(() => {
	const moved = flow.report.value?.moved.length ?? 0
	return [
		{ value: formatNumber(moved), label: n('honeycomb', 'file moved', 'files moved', moved) },
		{ value: formatNumber(reportRows.value.length), label: t('honeycomb', 'failed') },
	]
})

watch(flow.browsing, () => {
	browsed.value = null
})

/** `1`–`9` choose a chip and `Enter` moves while the move dialog is in front. */
function onKey(event: KeyboardEvent) {
	const onControl = event.target instanceof HTMLElement && event.target.closest('button, input, textarea, select, a') !== null
	if (flow.pictures.value === null || flow.browsing.value || event.defaultPrevented || onControl || event.ctrlKey || event.metaKey || event.altKey) {
		return
	}
	if (/^[1-9]$/.test(event.key)) {
		flow.chooseKey(Number(event.key))
		event.preventDefault()
	} else if (event.key === 'Enter') {
		void flow.confirm()
		event.preventDefault()
	}
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
	<ConfirmDialog
		v-if="flow.pictures.value !== null && flow.browsing.value"
		:title="t('honeycomb', 'Choose the target folder')"
		:confirmLabel="t('honeycomb', 'Choose')"
		:confirmDisabled="browsed === null"
		:container="props.container"
		back
		cancel
		@back="flow.browsing.value = false"
		@cancel="flow.close()"
		@confirm="flow.choose(browsed!)">
		<FolderList
			:ticked="browsed === null ? [] : [browsed]"
			:listFolders="props.listFolders"
			single
			:blocked="props.folderSet.paths"
			@toggle="browsed = $event" />
	</ConfirmDialog>
	<ConfirmDialog
		v-else-if="flow.pictures.value !== null"
		:title="n('honeycomb', 'Move {count} photo', 'Move {count} photos', pictures, { count: formatNumber(pictures) }, PLAIN_TEXT)"
		:confirmLabel="confirmLabel"
		:confirmDisabled="flow.plan.value === null || flow.counts.value.files === 0 || flow.busy.value"
		:container="props.container"
		cancel
		wide
		@cancel="flow.close()"
		@confirm="flow.confirm()">
		<section class="move-dialog__to" :aria-label="t('honeycomb', 'To')">
			<button
				v-for="chip in flow.chips.value"
				:key="chip.path"
				type="button"
				class="move-dialog__chip"
				:aria-pressed="flow.target.value === chip.path"
				@click="flow.choose(chip.path)">
				<kbd>{{ chip.key }}</kbd>{{ chip.favourite ? '★ ' : '' }}{{ folderName(chip.path) }}<small>{{ parentName(chip.path) }}</small>
			</button>
			<button type="button" class="move-dialog__browse" @click="flow.browsing.value = true">
				{{ t('honeycomb', 'Browse…') }}
			</button>
		</section>
		<p v-if="flow.target.value === null" class="move-dialog__hint">
			{{ t('honeycomb', 'Tap a folder or press 1–9. Favourites (★) first, then recent folders.') }}
		</p>
		<p v-else class="move-dialog__target">
			{{ t('honeycomb', 'Moving to {target}', { target: flow.target.value }, undefined, PLAIN_TEXT) }}
			<button
				type="button"
				class="move-dialog__favourite"
				:aria-pressed="flow.favourite.value"
				@click="flow.toggleFavourite()">
				{{ flow.favourite.value ? t('honeycomb', '★ Favourite') : t('honeycomb', '☆ Add to favourites') }}
			</button>
		</p>
		<MoveSummary
			v-if="flow.plan.value !== null"
			:flow="flow"
			:target="flow.target.value!"
			:plan="flow.plan.value"
			:folderSet="props.folderSet" />
	</ConfirmDialog>
	<ConfirmDialog
		v-else-if="flow.report.value !== null"
		:title="t('honeycomb', 'Move finished with errors')"
		:confirmLabel="t('honeycomb', 'Close')"
		:container="props.container"
		wide
		@confirm="flow.closeReport()">
		<DeleteStats :stats="reportStats" />
		<TrashFileList :rows="reportRows" :folderSet="props.folderSet" :label="t('honeycomb', 'Files that failed')" />
		<p>{{ t('honeycomb', 'The failed files stay where they were and in the grid.') }}</p>
	</ConfirmDialog>
</template>

<style scoped>
.move-dialog__to {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--default-grid-baseline) * 2);
}

.move-dialog__chip,
.move-dialog__browse,
.move-dialog__favourite {
	display: inline-flex;
	align-items: center;
	gap: var(--default-grid-baseline);
	min-height: var(--default-clickable-area);
	margin: 0;
	padding: 0 calc(var(--default-grid-baseline) * 3);
	border: 1px solid var(--color-border-maxcontrast);
	border-radius: var(--border-radius-element, var(--border-radius-large));
	background: var(--color-main-background);
	color: var(--color-main-text);
}

.move-dialog__chip[aria-pressed='true'],
.move-dialog__favourite[aria-pressed='true'] {
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
}

.move-dialog__chip small {
	color: inherit;
	opacity: 0.7;
}

.move-dialog__hint {
	color: var(--color-text-maxcontrast);
}

.move-dialog__target {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	margin: calc(var(--default-grid-baseline) * 2) 0;
}
</style>
