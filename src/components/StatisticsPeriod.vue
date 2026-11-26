<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Period, PeriodBounds, PeriodKind, Step } from '../logic/stats-period.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import { yearOf } from '../logic/days.ts'
import { canStep, holdsToday, stepAnchor } from '../logic/stats-period.ts'
import { formatDay, formatDayRange, PLAIN_TEXT } from '../shared/l10n.ts'

const props = defineProps<{ period: Period, bounds: PeriodBounds }>()
/** `kind` picks a granularity; `anchor` a day to show, null for today. */
const emit = defineEmits<{ kind: [kind: PeriodKind], anchor: [day: string | null] }>()

const WEEK_STYLE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
const MONTH_STYLE: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }

const kinds = [
	{ kind: 'week' as const, label: t('honeycomb', 'Week') },
	{ kind: 'month' as const, label: t('honeycomb', 'Month') },
	{ kind: 'year' as const, label: t('honeycomb', 'Year') },
	{ kind: 'all' as const, label: t('honeycomb', 'All time') },
]
const label = computed(() => {
	const { from, to } = props.period.range
	return {
		week: () => formatDayRange(from, to, WEEK_STYLE),
		month: () => formatDay(from, MONTH_STYLE),
		year: () => String(yearOf(from)),
		all: () => t('honeycomb', 'Since {day}', { day: formatDay(from) }, undefined, PLAIN_TEXT),
	}[props.period.kind]()
})
const current = computed(() => holdsToday(props.period, props.bounds.today))
const stepper = computed(() => props.period.kind !== 'all')

/** Moves one period back or forward. */
function step(by: Step) {
	emit('anchor', stepAnchor(props.period, by, props.bounds))
}
</script>

<template>
	<div class="statistics-period">
		<div class="statistics-period__segment" role="group" :aria-label="t('honeycomb', 'Period')">
			<NcButton
				v-for="each in kinds"
				:key="each.kind"
				:pressed="props.period.kind === each.kind"
				@update:pressed="emit('kind', each.kind)">
				{{ each.label }}
			</NcButton>
		</div>
		<div class="statistics-period__stepper">
			<NcButton
				v-if="stepper"
				variant="tertiary"
				:aria-label="t('honeycomb', 'Previous period')"
				:disabled="!canStep(props.period, -1, props.bounds)"
				@click="step(-1)">
				<template #icon>
					<AppIcon name="chevronLeft" />
				</template>
			</NcButton>
			<span class="statistics-period__label">{{ label }}</span>
			<template v-if="stepper">
				<NcButton
					variant="tertiary"
					:aria-label="t('honeycomb', 'Next period')"
					:disabled="!canStep(props.period, 1, props.bounds)"
					@click="step(1)">
					<template #icon>
						<AppIcon name="chevronRight" />
					</template>
				</NcButton>
				<NcButton :disabled="current" @click="emit('anchor', null)">
					{{ t('honeycomb', 'Today') }}
				</NcButton>
			</template>
		</div>
	</div>
</template>

<style scoped>
.statistics-period {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
}

.statistics-period__segment,
.statistics-period__stepper {
	display: flex;
	align-items: center;
	gap: var(--default-grid-baseline);
}

.statistics-period__stepper {
	flex: 1 1 auto;
}

.statistics-period__label {
	flex: 1;
	min-width: 0;
	font-weight: bold;
	text-align: center;
}
</style>
