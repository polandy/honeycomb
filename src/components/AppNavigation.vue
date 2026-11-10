<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { RecentFolderSet } from '../logic/recent.ts'
import type { ResumePosition } from '../logic/resume-position.ts'

import { t } from '@nextcloud/l10n'
import NcAppNavigation from '@nextcloud/vue/components/NcAppNavigation'
import NcAppNavigationCaption from '@nextcloud/vue/components/NcAppNavigationCaption'
import NcAppNavigationItem from '@nextcloud/vue/components/NcAppNavigationItem'
import AppIcon from './AppIcon.vue'
import RecentFolderSets from './RecentFolderSets.vue'

const props = defineProps<{
	items: readonly RecentFolderSet[]
}>()

const emit = defineEmits<{
	chooseFolders: []
	openRecent: [position: ResumePosition]
	openSettings: []
}>()
</script>

<template>
	<NcAppNavigation :ariaLabel="t('honeycomb', 'honeycomb navigation')">
		<template #list>
			<NcAppNavigationItem :name="t('honeycomb', 'Folder')" @click="emit('chooseFolders')">
				<template #icon>
					<AppIcon name="folder" />
				</template>
			</NcAppNavigationItem>
			<NcAppNavigationCaption :name="t('honeycomb', 'Recent')" />
			<RecentFolderSets v-if="props.items.length > 0" :items="props.items" @open="emit('openRecent', $event)" />
			<p v-else class="app-navigation__empty">
				{{ t('honeycomb', 'Folder sets you cull show here.') }}
			</p>
		</template>
		<template #footer>
			<NcAppNavigationItem :name="t('honeycomb', 'Settings')" @click="emit('openSettings')">
				<template #icon>
					<AppIcon name="settings" />
				</template>
			</NcAppNavigationItem>
		</template>
	</NcAppNavigation>
</template>

<style scoped>
.app-navigation__empty {
	padding: var(--default-grid-baseline) calc(3 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
}
</style>
