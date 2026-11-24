<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ConnectionLine } from '../immich/immich-text.ts'

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

/** The icon of each state, so the colour is not the only sign. */
const MARKS = { working: 'check', failed: 'close', asked: 'minus' } as const

/** Whether the connection works, fails or is still asked. */
function markState(working: boolean | null): keyof typeof MARKS {
	return working === null ? 'asked' : working ? 'working' : 'failed'
}
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
						<span class="immich-connections__mark" :data-state="markState(connection.working)">
							<AppIcon :name="MARKS[markState(connection.working)]" />
						</span>
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
.immich-connections__mark {
	display: flex;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--color-success-text);
	color: var(--color-main-background);
}

.immich-connections__mark[data-state="failed"] {
	background: var(--color-error-text);
}

.immich-connections__mark[data-state="asked"] {
	background: var(--color-text-maxcontrast);
}

.immich-connections__mark .app-icon {
	width: 14px;
	height: 14px;
	stroke-width: 3;
}

.immich-connections {
	list-style: none;
	margin: 0;
	padding: 0;
}
</style>
