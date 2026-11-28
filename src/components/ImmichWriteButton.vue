<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import { formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{
	/** How many assets are pending; `null` while unknown (IMMICH-004.27). */
	pending: number | null
}>()

const emit = defineEmits<{
	open: []
}>()

const pendingText = computed(() => props.pending === null ? '' : n('honeycomb', '{count} change not written to Immich', '{count} changes not written to Immich', props.pending, { count: formatNumber(props.pending) }, PLAIN_TEXT))
</script>

<template>
	<NcButton class="immich-screen__write" :disabled="props.pending === 0" @click="emit('open')">
		<span class="immich-screen__write-label">{{ t('honeycomb', 'Write to Immich') }}</span>
		<template v-if="props.pending">
			<span class="immich-screen__pending" aria-hidden="true">{{ formatNumber(props.pending) }}</span>
			<span class="hidden-visually">{{ pendingText }}</span>
		</template>
	</NcButton>
</template>

<style scoped>
.immich-screen__write {
	margin-inline-start: auto;
}

.immich-screen__pending {
	margin-inline-start: var(--default-grid-baseline);
	padding: 1px calc(2 * var(--default-grid-baseline));
	border-radius: var(--border-radius-pill, 10px);
	background: var(--color-main-text);
	color: var(--color-main-background);
	font-size: 12px;
	font-weight: bold;
}
</style>
