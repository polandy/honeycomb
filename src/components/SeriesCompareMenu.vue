<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Series } from '../logic/series.ts'
import type { MergeDirection } from '../series-compare.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCaption from '@nextcloud/vue/components/NcActionCaption'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'
import ActionIcon from './ActionIcon.vue'
import AppIcon from './AppIcon.vue'
import { formatNumber, formatTime, PLAIN_TEXT } from '../l10n.ts'
import { captureTime } from '../logic/picture-order.ts'
import { useReportedMenu } from '../reported-menu.ts'
import { tip } from '../tooltip.ts'

const props = defineProps<{
	/** The shown series. */
	series: Series<Picture<ListingEntry>>
	/** The series before and after it by first capture time, null at either end (SERIES-005.8). */
	previous: Series<Picture<ListingEntry>> | null
	next: Series<Picture<ListingEntry>> | null
	/** Where the menu mounts. */
	container: string
}>()

const emit = defineEmits<{
	merge: [direction: MergeDirection]
	dissolve: []
	/** Marks the series done, or reopens it when false (SERIES-005.14, .15). */
	markDone: [done: boolean]
	/** The menu opened or closed. */
	menu: [open: boolean]
}>()

/** The second line of a merge entry: the other series' size and first capture time, or why there is none. */
function mergeDescription(other: Series<Picture<ListingEntry>> | null, none: string): string {
	return other === null
		? none
		: t('honeycomb', '⧉ {count} · starts {time}', { count: formatNumber(other.members.length), time: formatTime(captureTime(other.members[0]!)) }, undefined, PLAIN_TEXT)
}

const reportMenu = useReportedMenu((open) => emit('menu', open))
const done = computed(() => props.series.stored?.status === 'done')
const merges = computed(() => [
	{ direction: 'next' as const, other: props.next, name: t('honeycomb', 'Merge with the next series'), description: mergeDescription(props.next, t('honeycomb', 'None after this one')) },
	{ direction: 'previous' as const, other: props.previous, name: t('honeycomb', 'Merge with the previous series'), description: mergeDescription(props.previous, t('honeycomb', 'None before this one')) },
])
</script>

<template>
	<NcActions
		forceMenu
		:container="props.container"
		:ariaLabel="t('honeycomb', 'Series menu')"
		v-bind="tip(t('honeycomb', 'More'))"
		@update:open="reportMenu">
		<template #icon>
			<AppIcon name="more" />
		</template>
		<NcActionCaption :name="t('honeycomb', 'This series · ⧉ {count}', { count: formatNumber(props.series.members.length) }, undefined, PLAIN_TEXT)" />
		<NcActionButton
			v-for="entry in merges"
			:key="entry.direction"
			closeAfterClick
			:disabled="entry.other === null"
			:description="entry.description"
			@click="emit('merge', entry.direction)">
			<template #icon>
				<ActionIcon name="merge" />
			</template>
			{{ entry.name }}
		</NcActionButton>
		<NcActionSeparator />
		<NcActionButton
			closeAfterClick
			:modelValue="done"
			:description="t('honeycomb', 'Its unflagged photos count as decided')"
			@click="emit('markDone', !done)">
			<template #icon>
				<ActionIcon name="check" />
			</template>
			{{ t('honeycomb', 'Series done') }}
		</NcActionButton>
		<NcActionButton closeAfterClick :description="t('honeycomb', 'Its photos are never grouped again automatically')" @click="emit('dissolve')">
			<template #icon>
				<ActionIcon name="minus" />
			</template>
			{{ t('honeycomb', 'Dissolve this series') }}
		</NcActionButton>
	</NcActions>
</template>
