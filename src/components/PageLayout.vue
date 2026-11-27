<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Page } from '../folders/navigation-items.ts'
import type { NavigationTarget } from '../logic/cull-location.ts'
import type { ResumePosition } from '../logic/resume-position.ts'
import type { BrowserStorage } from '../shared/browser-storage.ts'

import { generateUrl } from '@nextcloud/router'
import { computed, onMounted, ref } from 'vue'
import AppLayout from './AppLayout.vue'
import PageTitleRow from './PageTitleRow.vue'
import { useNavigationItems } from '../folders/navigation-items.ts'
import { locationHash, targetHash } from '../logic/cull-location.ts'
import { recentFolderSets } from '../logic/recent.ts'
import { parsePositions } from '../logic/resume-position.ts'
import { logger } from '../shared/logger.ts'

/** What a page of its own needs for its navigation (APP-001.25). */
export interface PageNavigationSeams {
	loadPositions: () => Promise<unknown>
	storage: BrowserStorage
	/** Opens another address of the app. */
	goTo: (url: string) => void
}

const props = defineProps<{
	page: Page
	seams: PageNavigationSeams
	/** Gives the title row the shared page width (`--honeycomb-page-width`) of a page that takes it too. */
	wide?: boolean
}>()

const NO_PROGRESS = { decided: 0, total: 0 }
const cullUrl = generateUrl('/apps/honeycomb/')
const positions = ref<ResumePosition[]>([])
const items = computed(() => recentFolderSets(positions.value, null, NO_PROGRESS))
const title = computed(() => useNavigationItems().find((item) => item.page === props.page)?.name ?? '')

onMounted(async () => {
	try {
		positions.value = parsePositions(await props.seams.loadPositions())
	} catch (error) {
		logger.error('Could not read the recent folder sets', { error })
	}
})

/** Opens the cull page with `hash` (APP-001.26). */
function openCull(hash: string) {
	props.seams.goTo(cullUrl + hash)
}

/** Opens the cull page with the folder picker or the settings. */
function openTarget(target: NavigationTarget) {
	openCull(targetHash(target))
}
</script>

<template>
	<AppLayout
		:items="items"
		:storage="props.seams.storage"
		:page="props.page"
		@openFolders="openCull('')"
		@chooseFolders="openTarget('folder-picker')"
		@openRecent="(position: ResumePosition) => openCull(locationHash(position.folderSet, position.fileId))"
		@openSettings="openTarget('settings')">
		<PageTitleRow :class="{ 'page-title-row--page-width': props.wide }">
			{{ title }}
			<template v-if="$slots.actions" #actions>
				<slot name="actions" />
			</template>
		</PageTitleRow>
		<slot />
	</AppLayout>
</template>
