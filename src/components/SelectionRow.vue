<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { n, t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import { formatNumber } from '../shared/l10n.ts'

const props = defineProps<{
	/** How many pictures are selected. */
	selected: number
	/** The label of the button that selects all, naming what "all" is. */
	allLabel: string
}>()

const emit = defineEmits<{
	selectAll: []
	selectNone: []
	done: []
}>()
</script>

<template>
	<div class="selection-row">
		<span class="selection-row__count">{{ n('honeycomb', '{count} selected', '{count} selected', props.selected, { count: formatNumber(props.selected) }) }}</span>
		<NcButton variant="tertiary" @click="emit('selectAll')">
			{{ props.allLabel }}
		</NcButton>
		<NcButton variant="tertiary" @click="emit('selectNone')">
			{{ t('honeycomb', 'None') }}
		</NcButton>
		<NcButton variant="primary" @click="emit('done')">
			{{ t('honeycomb', 'Done') }}
		</NcButton>
	</div>
</template>

<style scoped>
.selection-row {
	display: flex;
	flex-basis: 100%;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline);
}

.selection-row__count {
	flex: 1;
	font-weight: bold;
}
</style>
