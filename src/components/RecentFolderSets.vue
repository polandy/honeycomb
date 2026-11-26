<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { RecentConnection } from '../logic/immich-position.ts'
import type { RecentFolderSet } from '../logic/recent.ts'
import type { ResumePosition } from '../logic/resume-position.ts'

import { t } from '@nextcloud/l10n'
import NcListItem from '@nextcloud/vue/components/NcListItem'
import { decidedText } from '../cull/decision-text.ts'
import { folderSetName } from '../folders/recent-text.ts'
import { PLAIN_TEXT } from '../shared/l10n.ts'

const props = withDefaults(defineProps<{
	items: readonly RecentFolderSet[]
	/** The Immich connections with a position, listed first (IMMICH-003.15). */
	connections?: readonly RecentConnection[]
}>(), { connections: () => [] })

const emit = defineEmits<{
	open: [position: ResumePosition]
	openConnection: [connectionId: string]
}>()
</script>

<template>
	<ul class="recent-folder-sets">
		<NcListItem
			v-for="connection in props.connections"
			:key="'immich:' + connection.connectionId"
			:name="connection.label"
			:active="false"
			compact
			@click="emit('openConnection', connection.connectionId)">
			<template #name>
				<span translate="no">{{ connection.label }}</span>
			</template>
			<template #subname>
				{{ t('honeycomb', 'Immich · {progress}', { progress: decidedText(connection.decided, connection.total) }, PLAIN_TEXT) }}
			</template>
		</NcListItem>
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
