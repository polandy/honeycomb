<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ImmichFilterChoices } from '../logic/immich-filter-choices.ts'
import type { ImmichFilters, TimeOption } from '../logic/immich-filters.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import { deviceLabel, kindLabel, timeLabel } from '../immich/immich-filter-text.ts'
import { sameTimeOption } from '../logic/immich-filters.ts'
import { toggleChip } from '../logic/picture-filter.ts'
import { formatNumber } from '../shared/l10n.ts'

const props = defineProps<{
	filters: ImmichFilters
	/** The chips with the server's counts, none while counting (IMMICH-002.30). */
	choices: ImmichFilterChoices
	/** Whether a filter differs from its default, so *Clear filters* shows (IMMICH-002.31). */
	changed: boolean
}>()

const emit = defineEmits<{
	'update:filters': [filters: ImmichFilters]
	clear: []
}>()

/** One chip as the template draws it. */
interface Chip {
	readonly key: string
	readonly label: string
	readonly count: number | null
	readonly pressed: boolean
	readonly choose: () => void
}

const groups = computed(() => {
	const { filters, choices } = props
	const shown: { label: string, chips: Chip[] }[] = [{
		label: t('honeycomb', 'Time'),
		chips: choices.times.map(({ option, count }) => ({ key: timeKey(option), label: timeLabel(option), count, pressed: sameTimeOption(option, filters.time), choose: () => update({ time: option }) })),
	}]
	if (choices.devices.length > 0) {
		shown.push({
			label: t('honeycomb', 'Device'),
			chips: choices.devices.map(({ value, count }) => ({ key: String(value), label: deviceLabel(value), count, pressed: filters.devices.has(value), choose: () => update({ devices: toggleChip(filters.devices, value) }) })),
		})
	}
	shown.push({
		label: t('honeycomb', 'Kind'),
		chips: choices.kinds.map(({ value, count }) => ({ key: value, label: kindLabel(value), count, pressed: filters.kinds.has(value), choose: () => update({ kinds: toggleChip(filters.kinds, value) }) })),
	})
	return shown
})

/** Emits the filters with the changes applied. */
function update(changes: Partial<ImmichFilters>) {
	emit('update:filters', { ...props.filters, ...changes })
}

/** A key unique among the time options. */
function timeKey(option: TimeOption): string {
	return option.kind === 'month' ? `${option.year}-${option.month}` : option.kind
}
</script>

<template>
	<div class="filter-bar">
		<div
			v-for="group in groups"
			:key="group.label"
			class="filter-bar__group"
			role="group"
			:aria-label="group.label">
			<span class="filter-bar__label" aria-hidden="true">{{ group.label }}</span>
			<div class="filter-bar__chips">
				<button
					v-for="chip in group.chips"
					:key="chip.key"
					type="button"
					class="filter-bar__chip"
					:aria-label="chip.label"
					:aria-pressed="chip.pressed"
					@click="chip.choose()">
					{{ chip.label }}
					<span v-if="chip.count !== null" class="immich-filter-bar__count">{{ formatNumber(chip.count) }}</span>
				</button>
			</div>
		</div>
		<div v-if="props.changed" class="filter-bar__end">
			<NcButton @click="emit('clear')">
				{{ t('honeycomb', 'Clear filters') }}
			</NcButton>
		</div>
	</div>
</template>

<style scoped src="./filter-bar.css" />

<style scoped>
.immich-filter-bar__count {
	font-weight: normal;
}
</style>
