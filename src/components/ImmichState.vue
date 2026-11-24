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
import { connectionFacts, connectionLine, stateHelp } from '../immich-text.ts'

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

const failedState = computed(() => (props.status === null || props.status.state === 'ok' ? null : props.status.state))
const failed = computed(() => failedState.value !== null)
const help = computed(() => stateHelp(failedState.value ?? 'configuration'))
const retryIsPrimary = computed(() => failedState.value === 'unreachable')
const description = computed(() => {
	if (props.connection === null) {
		return t('honeycomb', 'Ask your Nextcloud admin to check the Immich connections. Your Nextcloud folders work as before.')
	}
	if (failed.value) {
		return `${help.value.todo} ${t('honeycomb', 'Decisions already made stay in honeycomb.')}`
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
		<template v-if="props.connection === null || props.status !== null" #action>
			<div class="immich-state__actions">
				<template v-if="props.connection !== null">
					<NcButton v-if="failed" :variant="retryIsPrimary ? 'primary' : 'secondary'" @click="emit('retry')">
						{{ t('honeycomb', 'Try again') }}
					</NcButton>
					<NcButton :variant="failed && retryIsPrimary ? 'secondary' : 'primary'" @click="emit('details')">
						{{ t('honeycomb', 'Connection details') }}
					</NcButton>
				</template>
				<NcButton v-if="failed || props.connection === null" variant="tertiary" :href="help.url" target="_blank">
					{{ t('honeycomb', 'Help for your admin') }}
				</NcButton>
			</div>
		</template>
	</NcEmptyContent>
</template>

<style scoped>
.immich-state__actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: calc(2 * var(--default-grid-baseline));
}
</style>
