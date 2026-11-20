<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { SessionNumbers } from '../logic/cull-session.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import ConfirmDialog from './ConfirmDialog.vue'
import DeleteStats from './DeleteStats.vue'
import { formatDuration, formatFileSize, formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { pageUrl } from '../navigation-items.ts'

const props = defineProps<{ numbers: SessionNumbers }>()

const emit = defineEmits<{ close: [] }>()

/** Rounds pictures a minute to one decimal. */
const RATE_STEPS = 10

const decided = computed(() => n('honeycomb', '%n photo decided', '%n photos decided', props.numbers.decided, undefined, PLAIN_TEXT))
const split = computed(() => t('honeycomb', '{picked} picked · {unflagged} unflagged · {rejected} rejected', {
	picked: formatNumber(props.numbers.picked),
	unflagged: formatNumber(props.numbers.unflagged),
	rejected: formatNumber(props.numbers.rejected),
}, undefined, PLAIN_TEXT))
const stats = computed(() => [
	{ value: formatNumber(props.numbers.trashed), label: t('honeycomb', 'Moved to the trash bin') },
	{ value: formatNumber(props.numbers.deleted), label: t('honeycomb', 'Deleted for good') },
	{ value: formatNumber(props.numbers.sidecarsCreated), label: t('honeycomb', 'Sidecars created') },
	{ value: formatNumber(props.numbers.sidecarsUpdated), label: t('honeycomb', 'Sidecars updated') },
])
const freed = computed(() => t('honeycomb', '{size} freed', { size: formatFileSize(props.numbers.freedBytes) }, undefined, PLAIN_TEXT))
const beforeAfter = computed(() => {
	const { before, after } = props.numbers
	return n('honeycomb', 'Before %n photo · {size} → after {after} · {afterSize}', 'Before %n photos · {size} → after {after} · {afterSize}', before.pictures, {
		size: formatFileSize(before.bytes),
		after: formatNumber(after.pictures),
		afterSize: formatFileSize(after.bytes),
	}, PLAIN_TEXT)
})
const activeTime = computed(() => {
	const { activeMs, perMinute } = props.numbers
	const duration = formatDuration(activeMs)
	return perMinute === null
		? t('honeycomb', 'Active time {duration}', { duration }, undefined, PLAIN_TEXT)
		: t('honeycomb', 'Active time {duration} · {rate} photos a minute', { duration, rate: formatNumber(Math.round(perMinute * RATE_STEPS) / RATE_STEPS) }, undefined, PLAIN_TEXT)
})
</script>

<template>
	<ConfirmDialog :title="t('honeycomb', 'Cull finished')" :confirmLabel="t('honeycomb', 'Done')" @confirm="emit('close')">
		<p class="cull-finished__decided">
			{{ decided }}
		</p>
		<p class="cull-finished__line">
			{{ split }}
		</p>
		<DeleteStats :stats="stats" tiles />
		<p v-if="props.numbers.freedBytes > 0" class="cull-finished__line">
			{{ freed }}
		</p>
		<p class="cull-finished__line">
			{{ beforeAfter }}
		</p>
		<p class="cull-finished__line">
			{{ activeTime }}
		</p>
		<template #actions>
			<NcButton variant="tertiary" :href="pageUrl('statistics')">
				{{ t('honeycomb', 'Statistics') }}
			</NcButton>
		</template>
	</ConfirmDialog>
</template>

<style scoped>
.cull-finished__decided {
	font-size: 1.4em;
	font-weight: bold;
}

.cull-finished__line {
	margin-block-end: var(--default-grid-baseline);
	color: var(--color-text-maxcontrast);
}
</style>
