<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api.ts'
import type { HashRunSeams } from '../hash-run.ts'

import { t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import { computed, ref } from 'vue'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcContent from '@nextcloud/vue/components/NcContent'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import AppIcon from './AppIcon.vue'
import FolderTree from './FolderTree.vue'
import ProgressBar from './ProgressBar.vue'
import { useHashRun } from '../hash-run.ts'

const props = defineProps<{
	seams: HashRunSeams
	listFolders: (path: string) => Promise<Folder[]>
}>()

const run = useHashRun(props.seams)
const chosen = ref<string | null>(null)
const busy = computed(() => run.status.value === 'running' || run.status.value === 'pausing')
const done = computed(() => run.progress.value.hashed + run.progress.value.failed)
const counts = computed(() => [
	{ label: t('honeycomb', 'Found'), value: `${run.progress.value.total}${run.listed.value ? '' : '+'}` },
	{ label: t('honeycomb', 'Hashed'), value: `${run.progress.value.hashed}` },
	{ label: t('honeycomb', 'Failed'), value: `${run.progress.value.failed}` },
	{ label: t('honeycomb', 'Left'), value: `${run.progress.value.total - done.value}` },
])
const cullUrl = generateUrl('/apps/honeycomb/')

/** Chooses a folder, or lets go of the chosen one. */
function choose(path: string) {
	chosen.value = chosen.value === path ? null : path
}
</script>

<template>
	<NcContent appName="honeycomb">
		<NcAppContent>
			<div class="similarity-page">
				<NcButton variant="tertiary" :href="cullUrl">
					<template #icon>
						<AppIcon name="back" />
					</template>
					{{ t('honeycomb', 'Back to the cull') }}
				</NcButton>
				<h2>{{ t('honeycomb', 'Similarity') }}</h2>
				<p>{{ t('honeycomb', 'Compares every photo in a folder and its subfolders ahead of the cull, so series show at once on any device.') }}</p>
				<FolderTree
					:ticked="chosen === null ? [] : [chosen]"
					:listFolders="props.listFolders"
					single
					@toggle="choose" />
				<div class="similarity-page__actions">
					<NcButton
						v-if="!busy && run.status.value !== 'paused'"
						variant="primary"
						:disabled="chosen === null"
						@click="run.start(chosen!)">
						{{ t('honeycomb', 'Start') }}
					</NcButton>
					<NcButton v-if="busy" :disabled="run.status.value === 'pausing'" @click="run.pause()">
						{{ t('honeycomb', 'Pause') }}
					</NcButton>
					<NcButton v-if="run.status.value === 'paused'" variant="primary" @click="run.resume()">
						{{ t('honeycomb', 'Resume') }}
					</NcButton>
				</div>
				<template v-if="run.status.value !== 'idle'">
					<ProgressBar
						class="similarity-page__bar"
						:label="t('honeycomb', 'Similarity')"
						:value="done"
						:max="run.progress.value.total" />
					<dl class="similarity-page__counts">
						<div v-for="count in counts" :key="count.label">
							<dt>{{ count.label }}</dt>
							<dd>{{ count.value }}</dd>
						</div>
					</dl>
					<NcNoteCard v-if="run.problem.value === 'save'" type="error">
						{{ t('honeycomb', 'Could not save the visual hashes. Resume to try again.') }}
					</NcNoteCard>
					<NcNoteCard v-if="run.waiting.value !== null" type="info">
						{{ t('honeycomb', 'The server asked for a break: the hashes are saved again in {seconds} s.', { seconds: run.waiting.value }) }}
					</NcNoteCard>
					<NcNoteCard v-if="run.problem.value === 'page'" type="error">
						{{ t('honeycomb', 'Could not load the photos. Resume to try again.') }}
					</NcNoteCard>
					<NcNoteCard v-if="run.status.value === 'done'" type="success">
						{{ t('honeycomb', 'Done: every photo in this folder has its similarity.') }}
					</NcNoteCard>
					<details v-if="run.failedPaths.value.length > 0" class="similarity-page__failed">
						<summary>{{ t('honeycomb', 'Photos that could not be compared') }}</summary>
						<ul>
							<li v-for="path in run.failedPaths.value" :key="path">
								{{ path }}
							</li>
						</ul>
					</details>
				</template>
			</div>
		</NcAppContent>
	</NcContent>
</template>

<style scoped>
.similarity-page {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
	max-width: 640px;
	padding: calc(4 * var(--default-grid-baseline));
}

.similarity-page__actions {
	display: flex;
	gap: calc(2 * var(--default-grid-baseline));
}

.similarity-page__bar {
	width: 100%;
}

.similarity-page__counts {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: calc(2 * var(--default-grid-baseline));
	margin: 0;
}

/* Nextcloud's server styles give dt and dd a width, alignment and padding of their own. */
.similarity-page__counts dt,
.similarity-page__counts dd {
	display: block;
	width: auto;
	margin: 0;
	padding: 0;
	text-align: start;
}

.similarity-page__counts dt {
	color: var(--color-text-maxcontrast);
}

.similarity-page__counts dd {
	font-size: 1.4em;
	font-variant-numeric: tabular-nums;
}

.similarity-page__failed ul {
	max-height: 240px;
	overflow-y: auto;
	color: var(--color-text-maxcontrast);
}
</style>
