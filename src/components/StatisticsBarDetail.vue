<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { DrillTarget } from '../logic/stats-chart.ts'
import type { BarUnit, PeriodBar } from '../logic/stats-period.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import { barDetail, drillTarget } from '../logic/stats-chart.ts'
import { barName, detailLines, drillLabel } from '../statistics/chart-words.ts'

/** `bar` is the held or previewed bar, null for none; `hint` asks to select one, by default a bar. */
const props = defineProps<{ bar: PeriodBar | null, unit: BarUnit, hint?: string }>()
/** `drill` opens the month or year of the shown bar (STATS-001.65). */
const emit = defineEmits<{ drill: [target: DrillTarget] }>()

const lines = computed(() => (props.bar ? detailLines(barDetail(props.bar)) : []))
const target = computed(() => (props.bar ? drillTarget(props.bar, props.unit) : null))
</script>

<template>
	<div class="statistics-bars__detail" aria-live="polite">
		<template v-if="props.bar">
			<strong class="statistics-bars__detail-name">{{ barName(props.bar, props.unit) }}</strong>
			<span v-for="line in lines" :key="line">{{ line }}</span>
			<NcButton v-if="target" class="statistics-bars__drill" @click="emit('drill', target)">
				{{ drillLabel(target) }}
			</NcButton>
		</template>
		<span v-else class="statistics-bars__hint">{{ props.hint ?? t('honeycomb', 'Select a bar to see its numbers.') }}</span>
	</div>
</template>

<style scoped>
.statistics-bars__detail {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline) calc(3 * var(--default-grid-baseline));
	min-height: var(--default-clickable-area);
	font-variant-numeric: tabular-nums;
}

.statistics-bars__hint {
	color: var(--color-text-maxcontrast);
}

.statistics-bars__drill {
	margin-inline-start: auto;
}
</style>
