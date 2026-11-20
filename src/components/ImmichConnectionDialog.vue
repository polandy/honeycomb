<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ConnectionStatus, ImmichConnection } from '../logic/immich-connections.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import { connectionLine } from '../immich-text.ts'
import { formatNumber } from '../l10n.ts'

const props = defineProps<{
	connection: ImmichConnection
	/** Its last status, null while it is asked. */
	status: ConnectionStatus | null
}>()

const emit = defineEmits<{
	test: []
	close: []
}>()

/** The scopes Phase 1 needs, each with what it is for (IMMICH-001). */
const SCOPES = [
	{ scope: 'asset.read', use: t('honeycomb', 'list and search the phone uploads') },
	{ scope: 'asset.view', use: t('honeycomb', 'thumbnails and previews') },
	{ scope: 'asset.statistics', use: t('honeycomb', 'the number of uploads and the filter counts') },
	{ scope: 'user.read', use: t('honeycomb', 'optional: shows the account; without it honeycomb shows the label') },
]

const tested = ref(false)
const line = computed(() => connectionLine(props.connection, props.status))
const version = computed(() => {
	if (props.status === null) {
		return '…'
	}
	const known = props.status.version ?? t('honeycomb', 'unknown')
	return props.status.state === 'version' ? t('honeycomb', '{version} · not supported', { version: known }) : known
})
const totalText = computed(() => {
	const total = props.status?.total ?? null
	return total === null ? '–' : formatNumber(total)
})
const rows = computed(() => [
	{ term: t('honeycomb', 'Label'), value: props.connection.label, data: true },
	{ term: t('honeycomb', 'Immich server'), value: props.connection.url, data: true },
	{ term: t('honeycomb', 'Status'), value: line.value },
	{ term: t('honeycomb', 'Account'), value: props.status?.account ?? t('honeycomb', 'not shown, the key lacks user.read') },
	{ term: t('honeycomb', 'Immich version'), value: version.value },
	{ term: t('honeycomb', 'Phone uploads'), value: totalText.value },
])

/** Asks the status again and shows its result. */
function test() {
	tested.value = true
	emit('test')
}
</script>

<template>
	<NcDialog :name="t('honeycomb', 'Immich connection')" @update:open="emit('close')">
		<dl class="immich-connection__facts">
			<template v-for="row in rows" :key="row.term">
				<dt>{{ row.term }}</dt>
				<dd :translate="row.data ? 'no' : undefined">
					{{ row.value }}
				</dd>
			</template>
		</dl>
		<h3 class="immich-connection__heading">
			{{ t('honeycomb', 'Permissions the API key needs') }}
		</h3>
		<dl class="immich-connection__facts">
			<template v-for="each in SCOPES" :key="each.scope">
				<dt><code translate="no">{{ each.scope }}</code></dt>
				<dd>{{ each.use }}</dd>
			</template>
		</dl>
		<p
			v-if="tested && props.status !== null"
			class="immich-connection__result"
			:class="{ 'immich-connection__result--failed': props.status.state !== 'ok' }"
			role="alert">
			{{ line }}
		</p>
		<p class="immich-connection__note">
			{{ t('honeycomb', 'Your Nextcloud admin sets up the Immich connections. To add an account, change its API key or remove it, ask your admin.') }}
		</p>
		<template #actions>
			<NcButton variant="tertiary" @click="test">
				{{ t('honeycomb', 'Test connection') }}
			</NcButton>
			<NcButton variant="primary" @click="emit('close')">
				{{ t('honeycomb', 'Done') }}
			</NcButton>
		</template>
	</NcDialog>
</template>

<style scoped>
.immich-connection__facts {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: var(--default-grid-baseline) calc(3 * var(--default-grid-baseline));
	margin: 0 0 calc(3 * var(--default-grid-baseline));
}

.immich-connection__facts dt {
	color: var(--color-text-maxcontrast);
}

.immich-connection__facts dd {
	margin: 0;
	overflow-wrap: anywhere;
}

.immich-connection__heading {
	margin: 0 0 var(--default-grid-baseline);
	font-size: 1em;
	font-weight: bold;
}

.immich-connection__result {
	padding: calc(2 * var(--default-grid-baseline));
	border-radius: var(--border-radius-element);
	background: var(--color-success);
	color: var(--color-success-text);
}

.immich-connection__result--failed {
	background: var(--color-error);
	color: var(--color-error-text);
}

.immich-connection__note {
	color: var(--color-text-maxcontrast);
}
</style>
