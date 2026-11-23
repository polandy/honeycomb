<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Folder } from '../api.ts'
import type { FoldersHome } from '../folders-home.ts'

import FoldersScreen from './FoldersScreen.vue'
import LibrarySetup from './LibrarySetup.vue'

const props = defineProps<{
	home: FoldersHome
	listFolders: (path: string) => Promise<Folder[]>
}>()
</script>

<template>
	<div class="folders-home">
		<LibrarySetup
			v-if="props.home.roots.value.length === 0"
			:listFolders="props.listFolders"
			:check="props.home.check"
			@save="props.home.saveRoots" />
		<FoldersScreen
			v-else
			:folders="props.home"
			:roots="props.home.roots.value"
			:now="props.home.now"
			:focusRow="props.home.changed.value"
			@cull="props.home.cull"
			@markDone="props.home.markDone"
			@reopen="props.home.reopen"
			@cullNew="props.home.cullNew" />
	</div>
</template>

<style scoped>
.folders-home {
	overflow: auto;
	height: 100%;
}
</style>
