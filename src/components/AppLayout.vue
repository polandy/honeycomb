<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { RecentFolderSet } from '../logic/recent.ts'
import type { BrowserStorage } from '../shared/browser-storage.ts'

import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcContent from '@nextcloud/vue/components/NcContent'
import AppNavigation from './AppNavigation.vue'

// The navigation's other props and events pass through as attributes.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
	items: readonly RecentFolderSet[]
	storage: BrowserStorage
}>()
</script>

<template>
	<NcContent appName="honeycomb">
		<AppNavigation :items="props.items" :storage="props.storage" v-bind="$attrs" />
		<NcAppContent class="app-layout__content">
			<slot />
		</NcAppContent>
		<slot name="outside" />
	</NcContent>
</template>

<style src="../app/app-global.css" />

<style scoped>
.app-layout__content {
	display: flex;
	flex-direction: column;
	height: 100%;
	padding: 0 env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
}
</style>
