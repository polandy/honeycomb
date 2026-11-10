<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { PictureFile } from '../logic/delete-summary.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ConflictChoice, PlannedPicture } from '../logic/move-plan.ts'
import type { RenderedFile } from '../logic/name-template/render.ts'
import type { MoveFlow } from '../move-flow.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ConflictChoiceGroup from './ConflictChoiceGroup.vue'
import DeleteStats from './DeleteStats.vue'
import { formatFileSize, formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { addedSuffix } from '../logic/move-candidates.ts'
import { folderName } from '../logic/move-targets.ts'
import { badgeExtension } from '../logic/pair-badge.ts'
import { moveNote, namingProblemText } from '../move-text.ts'

const props = defineProps<{
	flow: MoveFlow
	/** The chosen target folder. */
	target: string
	plan: readonly PlannedPicture[]
	folderSet: FolderSet
}>()

/** Each picture with its plan, or why it cannot be named. */
const rows = computed(() => {
	let next = 0
	return props.flow.named.value.map(({ picture, candidate, problem }) => {
		if (candidate === null) {
			return { picture, problem, planned: null, notes: [] }
		}
		const planned = props.plan[next++]!
		return { picture, problem: null, planned, notes: notesOf(planned, candidate.rendered[0]!) }
	})
})
const stats = computed(() => {
	const photos = props.plan.length
	const { files, conflicts } = props.flow.counts.value
	return [
		{ value: formatNumber(photos), label: n('honeycomb', 'photo', 'photos', photos) },
		{ value: formatNumber(files), label: n('honeycomb', 'file', 'files', files) },
		{ value: formatNumber(conflicts), label: n('honeycomb', 'conflict', 'conflicts', conflicts) },
	]
})
const replacing = computed(() => props.plan.some(replaces))
const conflicts = computed(() => props.plan.filter((planned) => planned.inConflict).length)

/** Whether the picture replaces an existing file. */
function replaces(planned: PlannedPicture): boolean {
	return planned.files.some((file) => file.replace !== null)
}

/** How the picture's conflict is settled. */
function choiceOf(planned: PlannedPicture): ConflictChoice {
	return !planned.sent ? 'skip' : replaces(planned) ? 'replace' : 'suffix'
}

/** The tags of a picture's first file: what replaces and what suffix was added. */
function notesOf(planned: PlannedPicture, rendered: RenderedFile): { text: string, warn: boolean }[] {
	if (!planned.sent) {
		return []
	}
	if (replaces(planned)) {
		return [{ text: t('honeycomb', 'replaces the existing file'), warn: true }]
	}
	const suffix = addedSuffix(rendered, planned.files[0]!.path)
	if (suffix === null) {
		return []
	}
	return [{
		text: planned.inConflict
			? t('honeycomb', '{suffix} added', { suffix }, undefined, PLAIN_TEXT)
			: t('honeycomb', '{suffix}: same name as another photo', { suffix }, undefined, PLAIN_TEXT),
		warn: false,
	}]
}

/** The file's current path as the grid names its folder. */
function pathOf({ entry, picture }: PictureFile): string {
	return `${folderLabel(picture.folder, props.folderSet)}/${entry.path.slice(entry.path.lastIndexOf('/') + 1)}`
}
</script>

<template>
	<div class="move-summary">
		<DeleteStats :stats="stats" />
		<p class="move-summary__template">
			{{ t('honeycomb', 'Name template') }} <code>{{ props.flow.templateText.value }}</code>
		</p>
		<div v-if="conflicts > 1" class="move-summary__all">
			<span>{{ t('honeycomb', 'All conflicts:') }}</span>
			<ConflictChoiceGroup :choice="props.flow.allChoice.value" :label="t('honeycomb', 'All conflicts')" @choose="props.flow.setAll" />
		</div>
		<ul class="move-summary__files" :aria-label="t('honeycomb', 'Files that will be moved')">
			<template v-for="row in rows" :key="row.picture.baseName + row.picture.folder">
				<li v-if="row.planned === null" class="move-summary__unnamed">
					{{ row.picture.baseName }} {{ namingProblemText(row.problem!) }}
				</li>
				<template v-else>
					<li v-if="row.planned.inConflict" class="move-summary__conflict">
						<span class="move-summary__clash">{{ t('honeycomb', '{name}: a file with this name is already in {folder}', { name: row.picture.baseName, folder: folderName(props.target) }, undefined, PLAIN_TEXT) }}</span>
						<ConflictChoiceGroup :choice="choiceOf(row.planned)" :label="t('honeycomb', 'On conflict')" @choose="props.flow.setChoice(row.picture, $event)" />
					</li>
					<li
						v-for="(planned, index) in row.planned.files"
						:key="planned.file.entry.fileId"
						class="move-summary__file"
						:class="{ 'move-summary__file--skipped': !row.planned.sent }">
						<span class="move-summary__kind">{{ badgeExtension(planned.file.entry) }}</span>
						<span class="move-summary__path">{{ pathOf(planned.file) }}</span>
						<span class="move-summary__to">{{ row.planned.sent ? `→ ${planned.path}` : t('honeycomb', 'skipped') }}</span>
						<template v-if="index === 0">
							<span
								v-for="note in row.notes"
								:key="note.text"
								class="move-summary__note-tag"
								:class="{ 'move-summary__note-tag--warn': note.warn }">{{ note.text }}</span>
						</template>
						<span class="move-summary__size">{{ formatFileSize(planned.file.entry.size) }}</span>
					</li>
				</template>
			</template>
		</ul>
		<p class="move-summary__note">
			{{ moveNote(replacing) }}
		</p>
	</div>
</template>

<style scoped>
.move-summary__template,
.move-summary__note {
	color: var(--color-text-maxcontrast);
}

.move-summary__all {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	margin-bottom: calc(var(--default-grid-baseline) * 2);
}

.move-summary__files {
	max-height: 40vh;
	overflow-y: auto;
	margin: 0;
	padding: 0;
	list-style: none;
}

.move-summary__file,
.move-summary__conflict,
.move-summary__unnamed {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 2);
	padding: calc(var(--default-grid-baseline) * 2) 0;
	border-bottom: 1px solid var(--color-border);
}

.move-summary__conflict {
	background: var(--color-warning-hover, var(--color-background-hover));
}

.move-summary__unnamed {
	color: var(--color-error-text);
}

.move-summary__file--skipped {
	opacity: 0.5;
}

.move-summary__kind {
	min-width: 3em;
	font-weight: bold;
}

.move-summary__path,
.move-summary__to {
	overflow-wrap: anywhere;
}

.move-summary__to {
	flex: 1;
	font-family: var(--font-face-monospace, monospace);
}

.move-summary__note-tag {
	padding: 0 var(--default-grid-baseline);
	border-radius: var(--border-radius);
	background: var(--color-background-dark);
}

.move-summary__note-tag--warn {
	background: var(--color-warning);
	color: var(--color-warning-text, var(--color-main-text));
}

.move-summary__size {
	color: var(--color-text-maxcontrast);
}

.move-summary__note {
	margin-top: calc(var(--default-grid-baseline) * 3);
}
</style>
