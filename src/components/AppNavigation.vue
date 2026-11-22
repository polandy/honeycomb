<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { BrowserStorage } from '../browser-storage.ts'
import type { SourceKind } from '../immich-source.ts'
import type { ConnectionLine } from '../immich-text.ts'
import type { RecentFolderSet } from '../logic/recent.ts'
import type { ResumePosition } from '../logic/resume-position.ts'

import { emit as emitEvent } from '@nextcloud/event-bus'
import { t } from '@nextcloud/l10n'
import { useIsMobile } from '@nextcloud/vue/composables/useIsMobile'
import NcAppNavigation from '@nextcloud/vue/components/NcAppNavigation'
import NcAppNavigationCaption from '@nextcloud/vue/components/NcAppNavigationCaption'
import NcAppNavigationItem from '@nextcloud/vue/components/NcAppNavigationItem'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import ImmichConnections from './ImmichConnections.vue'
import RecentFolderSets from './RecentFolderSets.vue'
import SourceSwitcher from './SourceSwitcher.vue'
import { useNavigationChoice } from '../navigation-choice.ts'
import { useNavigationItems } from '../navigation-items.ts'

const props = withDefaults(defineProps<{
	items: readonly RecentFolderSet[]
	/** Where the user's choice to open or close the navigation stays. */
	storage: BrowserStorage
	/** The viewport's width in CSS pixels when the page opens. */
	viewportWidth?: () => number
	/** The year whose year-in-review hint shows, none for no hint (STATS-001.26). */
	hintYear?: number | null
	/** The source the page shows (IMMICH-001). */
	source?: SourceKind
	/** Whether the source switcher offers Immich. */
	offersImmich?: boolean
	/** The user's connections with their status lines. */
	connections?: readonly ConnectionLine[]
	/** The opened connection's id. */
	connectionId?: string | null
}>(), {
	viewportWidth: () => window.innerWidth,
	hintYear: null,
	source: 'nextcloud',
	offersImmich: false,
	connections: () => [],
	connectionId: null,
})

const emit = defineEmits<{
	/** Shows the *Folders* list (FOLDERS-007.16). */
	openFolders: []
	chooseFolders: []
	openRecent: [position: ResumePosition]
	openSettings: []
	closeHint: []
	chooseSource: [source: SourceKind]
	openConnection: [connectionId: string]
	connectionDetails: []
}>()

const isMobile = useIsMobile()
const pageItems = useNavigationItems()
const statisticsHref = pageItems.find((item) => item.page === 'statistics')!.href
useNavigationChoice(props.storage, props.viewportWidth)

/** NcAppNavigation closes only through this event, as NcAppNavigationItem does for router links. */
function closeOnNarrowScreen() {
	if (isMobile.value) {
		emitEvent('toggle-navigation', { open: false })
	}
}
</script>

<template>
	<NcAppNavigation :ariaLabel="t('honeycomb', 'honeycomb navigation')">
		<template #list>
			<li v-if="props.offersImmich">
				<SourceSwitcher :source="props.source" @choose="emit('chooseSource', $event)" />
			</li>
			<ImmichConnections
				v-if="props.source === 'immich'"
				:connections="props.connections"
				:connectionId="props.connectionId"
				@open="closeOnNarrowScreen(); emit('openConnection', $event)"
				@details="closeOnNarrowScreen(); emit('connectionDetails')" />
			<template v-else>
				<NcAppNavigationItem :name="t('honeycomb', 'Folders')" @click="closeOnNarrowScreen(); emit('openFolders')">
					<template #icon>
						<AppIcon name="folders" />
					</template>
				</NcAppNavigationItem>
				<NcAppNavigationItem :name="t('honeycomb', 'Folder')" @click="closeOnNarrowScreen(); emit('chooseFolders')">
					<template #icon>
						<AppIcon name="folder" />
					</template>
				</NcAppNavigationItem>
			</template>
			<NcAppNavigationItem
				v-for="item in pageItems"
				:key="item.page"
				:name="item.name"
				:href="item.href">
				<template #icon>
					<AppIcon :name="item.icon" />
				</template>
			</NcAppNavigationItem>
			<li v-if="props.hintYear !== null" class="app-navigation__hint">
				<a :href="statisticsHref" @click="closeOnNarrowScreen()">
					<strong>{{ t('honeycomb', 'Your {year} in honeycomb', { year: String(props.hintYear) }) }}</strong>
					<span>{{ t('honeycomb', 'See the year in review on the statistics page.') }}</span>
				</a>
				<NcButton variant="tertiary" :ariaLabel="t('honeycomb', 'Close')" @click="emit('closeHint')">
					<template #icon>
						<AppIcon name="close" />
					</template>
				</NcButton>
			</li>
			<template v-if="props.source === 'nextcloud'">
				<NcAppNavigationCaption :name="t('honeycomb', 'Recent')" />
				<li v-if="props.items.length > 0" class="app-navigation__recent">
					<RecentFolderSets :items="props.items" @open="closeOnNarrowScreen(); emit('openRecent', $event)" />
				</li>
				<li v-else class="app-navigation__empty">
					{{ t('honeycomb', 'Folder sets you cull show here.') }}
				</li>
			</template>
		</template>
		<template #footer>
			<ul class="app-navigation__footer">
				<NcAppNavigationItem :name="t('honeycomb', 'Settings')" @click="closeOnNarrowScreen(); emit('openSettings')">
					<template #icon>
						<AppIcon name="settings" />
					</template>
				</NcAppNavigationItem>
			</ul>
		</template>
	</NcAppNavigation>
</template>

<style scoped>
.app-navigation__recent,
.app-navigation__footer {
	list-style: none;
	margin: 0;
	padding: 0;
}

.app-navigation__hint {
	display: flex;
	align-items: flex-start;
	list-style: none;
	margin: var(--default-grid-baseline);
	padding: var(--default-grid-baseline) var(--default-grid-baseline) var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
	border-radius: var(--border-radius-element);
	background: var(--color-primary-element-light);
}

.app-navigation__hint a {
	display: flex;
	flex: 1;
	flex-direction: column;
	color: inherit;
	text-decoration: none;
}

.app-navigation__hint span {
	color: var(--color-text-maxcontrast);
}

.app-navigation__empty {
	list-style: none;
	padding: var(--default-grid-baseline) calc(3 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
}
</style>
