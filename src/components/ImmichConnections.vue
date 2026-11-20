<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ConnectionLine } from '../immich-text.ts'

import { t } from '@nextcloud/l10n'
import NcAppNavigationCaption from '@nextcloud/vue/components/NcAppNavigationCaption'
import NcAppNavigationItem from '@nextcloud/vue/components/NcAppNavigationItem'
import NcListItem from '@nextcloud/vue/components/NcListItem'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
	connections: readonly ConnectionLine[]
	/** The opened connection's id. */
	connectionId: string | null
}>()

const emit = defineEmits<{
	open: [connectionId: string]
	details: []
}>()
</script>

<template>
	<template v-if="props.connections.length > 1">
		<NcAppNavigationCaption :name="t('honeycomb', 'Connections')" />
		<li>
			<ul class="immich-connections">
				<NcListItem
					v-for="connection in props.connections"
					:key="connection.id"
					:name="connection.label"
					:active="connection.id === props.connectionId"
					compact
					@click="emit('open', connection.id)">
					<template #icon>
						<span class="immich-connections__dot" :class="{ 'immich-connections__dot--failed': connection.working === false, 'immich-connections__dot--asked': connection.working === null }" />
					</template>
					<template #subname>
						{{ connection.line }}
					</template>
				</NcListItem>
			</ul>
		</li>
	</template>
	<NcAppNavigationItem :name="t('honeycomb', 'Connection details')" @click="emit('details')">
		<template #icon>
			<AppIcon name="user" />
		</template>
	</NcAppNavigationItem>
</template>

<style scoped>
.immich-connections__dot {
	flex-shrink: 0;
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: var(--color-success);
}

.immich-connections__dot--failed {
	background: var(--color-error);
}

.immich-connections__dot--asked {
	background: var(--color-text-maxcontrast);
}

.immich-connections {
	list-style: none;
	margin: 0;
	padding: 0;
}
</style>
