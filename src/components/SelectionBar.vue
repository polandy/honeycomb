<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { CommonDecision, DecisionIntent } from '../logic/decision-change.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { SelectionEdit, SeriesOffer } from '../logic/series-menu.ts'

import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import ActionBar from './ActionBar.vue'
import SeriesMenu from './SeriesMenu.vue'

const props = defineProps<{
	/** What the selected pictures share. */
	common: CommonDecision
	/** How many pictures are selected. */
	selected: number
	/** Whether every selected picture is read only (GRID-003.16). */
	readOnly: boolean
	/** What the selection touches, for the *Series…* menu. */
	seriesOffer: SeriesOffer<Picture<ListingEntry>>
}>()

const emit = defineEmits<{ decide: [intent: DecisionIntent], tag: [], move: [], delete: [], series: [edit: SelectionEdit] }>()
</script>

<template>
	<ActionBar
		:common="props.common"
		:disabled="props.selected === 0"
		:readOnly="props.readOnly"
		@decide="emit('decide', $event)"
		@tag="emit('tag')">
		<template #tools>
			<SeriesMenu :offer="props.seriesOffer" @edit="emit('series', $event)" />
		</template>
		<template #end>
			<NcButton :disabled="props.selected === 0" @click="emit('move')">
				{{ t('honeycomb', 'Move…') }}
			</NcButton>
			<NcButton variant="error" :disabled="props.selected === 0" @click="emit('delete')">
				{{ t('honeycomb', 'Delete…') }}
			</NcButton>
		</template>
	</ActionBar>
</template>
