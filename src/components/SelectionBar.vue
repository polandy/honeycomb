<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { CommonDecision, DecisionIntent } from '../logic/decision-change.ts'

import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import ActionBar from './ActionBar.vue'

const props = defineProps<{
	/** What the selected pictures share. */
	common: CommonDecision
	/** How many pictures are selected. */
	selected: number
}>()

const emit = defineEmits<{ decide: [intent: DecisionIntent], tag: [], move: [], delete: [] }>()
</script>

<template>
	<ActionBar
		:common="props.common"
		:disabled="props.selected === 0"
		@decide="emit('decide', $event)"
		@tag="emit('tag')">
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
