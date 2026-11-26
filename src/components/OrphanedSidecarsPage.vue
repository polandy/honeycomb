<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api/index.ts'
import type { OrphanedSidecarSeams } from '../trash/orphaned-sidecars-run.ts'
import type { PageNavigationSeams } from './PageLayout.vue'

import { t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import { computed, ref } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import AppIcon from './AppIcon.vue'
import FolderTree from './FolderTree.vue'
import PageLayout from './PageLayout.vue'
import { outsideRootsNote } from '../folders/folders-text.ts'
import { isInsideRoots } from '../logic/library-roots.ts'
import { formatFileSize } from '../shared/l10n.ts'
import { useOrphanedSidecars } from '../trash/orphaned-sidecars-run.ts'
import { folderText, moveText, reportText, skipReason, totalText } from '../trash/orphaned-sidecars-text.ts'

const props = withDefaults(defineProps<{
	seams: OrphanedSidecarSeams
	listFolders: (path: string) => Promise<Folder[]>
	/** The library roots; the folders to scan lie inside them while any is set (SETTINGS-001.36). */
	roots?: readonly string[]
	/** The navigation's seams (APP-001.25). */
	navigation: PageNavigationSeams
}>(), {
	roots: () => [],
})

/** The user's folder, which *Whole library* chooses. */
const WHOLE_LIBRARY = '/'

const run = useOrphanedSidecars(props.seams)
const chosen = ref<string | null>(null)
const busy = computed(() => run.status.value === 'scanning' || run.status.value === 'moving')
const cullUrl = generateUrl('/apps/honeycomb/')

/** Chooses a folder, or lets go of the chosen one; the list of another folder goes (XMP-009.10). */
function choose(path: string) {
	chosen.value = chosen.value === path ? null : path
	run.drop()
}
</script>

<template>
	<PageLayout page="orphaned-sidecars" :seams="props.navigation">
		<div class="orphaned-sidecars">
			<NcButton variant="tertiary" :href="cullUrl">
				<template #icon>
					<AppIcon name="back" />
				</template>
				{{ t('honeycomb', 'Back to the cull') }}
			</NcButton>
			<p>{{ t('honeycomb', 'Finds sidecars whose photo or video is no longer in their folder. Nothing moves until you confirm; the trash bin can restore them.') }}</p>
			<FolderTree
				:ticked="chosen === null ? [] : [chosen]"
				:listFolders="props.listFolders"
				:disabledNote="(path) => outsideRootsNote(props.roots, path)"
				single
				@toggle="choose" />
			<div class="orphaned-sidecars__actions">
				<NcButton :pressed="chosen === WHOLE_LIBRARY" :disabled="busy || !isInsideRoots(props.roots, WHOLE_LIBRARY)" @click="choose(WHOLE_LIBRARY)">
					{{ t('honeycomb', 'Whole library') }}
				</NcButton>
				<NcButton variant="primary" :disabled="chosen === null || busy" @click="run.scan(chosen!)">
					{{ t('honeycomb', 'Find orphaned sidecars') }}
				</NcButton>
			</div>
			<p v-if="run.status.value === 'scanning'">
				{{ t('honeycomb', 'Looking for orphaned sidecars …') }}
			</p>
			<NcNoteCard v-if="run.problem.value === 'scan'" type="error">
				{{ t('honeycomb', 'Could not look for orphaned sidecars. Try again.') }}
			</NcNoteCard>
			<template v-if="run.status.value === 'found' || run.status.value === 'moving'">
				<NcNoteCard v-if="run.list.value.count === 0" type="success">
					{{ t('honeycomb', 'No orphaned sidecars found.') }}
				</NcNoteCard>
				<template v-else>
					<p class="orphaned-sidecars__total">
						{{ totalText(run.list.value.count, run.list.value.size) }}
					</p>
					<details v-for="folder in run.list.value.folders" :key="folder.path" class="orphaned-sidecars__folder">
						<summary>{{ folderText(folder.path, folder.count, folder.size) }}</summary>
						<ul>
							<li v-for="sidecar in folder.sidecars" :key="sidecar.fileId">
								{{ sidecar.name }} – {{ formatFileSize(sidecar.size) }}
							</li>
						</ul>
					</details>
					<div class="orphaned-sidecars__actions">
						<NcButton variant="error" :disabled="busy" @click="run.move()">
							<template #icon>
								<AppIcon name="trash" />
							</template>
							{{ moveText(run.list.value.count) }}
						</NcButton>
					</div>
				</template>
			</template>
			<template v-if="run.report.value !== null">
				<NcNoteCard :type="run.report.value.skipped.length === 0 ? 'success' : 'warning'">
					{{ reportText(run.report.value.trashed, run.report.value.skipped.length) }}
				</NcNoteCard>
				<NcNoteCard v-if="run.problem.value === 'trash'" type="error">
					{{ t('honeycomb', 'Could not reach the server; the sidecars not sent stay where they are.') }}
				</NcNoteCard>
				<details v-if="run.report.value.skipped.length > 0" class="orphaned-sidecars__skipped" open>
					<summary>{{ t('honeycomb', 'Sidecars that stayed') }}</summary>
					<ul>
						<li v-for="skip in run.report.value.skipped" :key="skip.path">
							{{ skip.path }} – {{ skipReason(skip.reason) }}
						</li>
					</ul>
				</details>
			</template>
		</div>
	</PageLayout>
</template>

<style scoped>
.orphaned-sidecars {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
	max-width: 640px;
	padding: calc(4 * var(--default-grid-baseline));
}

.orphaned-sidecars__actions {
	display: flex;
	flex-wrap: wrap;
	gap: calc(2 * var(--default-grid-baseline));
}

.orphaned-sidecars__total {
	font-weight: bold;
}

.orphaned-sidecars__folder ul,
.orphaned-sidecars__skipped ul {
	max-height: 240px;
	overflow-y: auto;
	color: var(--color-text-maxcontrast);
	overflow-wrap: anywhere;
}
</style>
