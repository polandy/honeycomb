<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ConnectionStatus, ImmichConnection } from '../logic/immich-connections.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import AppIcon from './AppIcon.vue'
import { connectionFacts, connectionLine } from '../immich-text.ts'

const props = defineProps<{
	/** The opened connection, none with a broken connections file. */
	connection: ImmichConnection | null
	/** Its last status, null while it is asked. */
	status: ConnectionStatus | null
}>()

const emit = defineEmits<{
	retry: []
	details: []
}>()

const failed = computed(() => props.status !== null && props.status.state !== 'ok')
const description = computed(() => {
	if (props.connection === null) {
		return t('honeycomb', 'Ask your Nextcloud admin to check the Immich connections. Your Nextcloud folders work as before.')
	}
	if (failed.value) {
		return t('honeycomb', 'Decisions already made stay in honeycomb.')
	}
	return props.status === null ? '' : connectionFacts(props.status)
})
</script>

<template>
	<NcEmptyContent
		class="immich-state"
		:name="props.connection === null ? t('honeycomb', 'Immich is unavailable because of the server configuration') : connectionLine(props.connection, props.status)"
		:description="description">
		<template #icon>
			<AppIcon name="phone" />
		</template>
		<template v-if="props.connection !== null && props.status !== null" #action>
			<NcButton v-if="failed" variant="primary" @click="emit('retry')">
				{{ t('honeycomb', 'Try again') }}
			</NcButton>
			<NcButton :variant="failed ? 'secondary' : 'primary'" @click="emit('details')">
				{{ t('honeycomb', 'Connection details') }}
			</NcButton>
		</template>
	</NcEmptyContent>
</template>
