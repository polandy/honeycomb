<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { RecentFolderSet } from '../logic/recent.ts'
import type { ResumePosition } from '../logic/resume-position.ts'

import NcListItem from '@nextcloud/vue/components/NcListItem'
import { decidedText } from '../decision-text.ts'
import { folderSetName } from '../recent-text.ts'

const props = defineProps<{
	items: readonly RecentFolderSet[]
}>()

const emit = defineEmits<{
	open: [position: ResumePosition]
}>()
</script>

<template>
	<ul class="recent-folder-sets">
		<NcListItem
			v-for="item in props.items"
			:key="item.position.folderSet.paths.join('\n') + item.position.folderSet.subfolders"
			:name="folderSetName(item.position.folderSet)"
			:active="item.current"
			compact
			@click="emit('open', item.position)">
			<template #subname>
				{{ decidedText(item.decided, item.total) }}
			</template>
		</NcListItem>
	</ul>
</template>
