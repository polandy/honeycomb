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
				variant="tertiary"
				:pressed="props.period.kind === each.kind"
				@update:pressed="emit('kind', each.kind)">
				{{ each.label }}
			</NcButton>
		</div>
		<div class="statistics-period__stepper">
			<template v-if="stepper">
				<NcButton :disabled="current" @click="emit('anchor', null)">
					{{ t('honeycomb', 'Today') }}
				</NcButton>
				<div class="statistics-period__steps">
					<NcButton
						variant="tertiary"
						:aria-label="t('honeycomb', 'Previous period')"
						:disabled="!canStep(props.period, -1, props.bounds)"
						@click="step(-1)">
						<template #icon>
							<AppIcon name="chevronLeft" />
						</template>
					</NcButton>
					<span class="statistics-period__label statistics-period__name">{{ label }}</span>
					<NcButton
						variant="tertiary"
						:aria-label="t('honeycomb', 'Next period')"
						:disabled="!canStep(props.period, 1, props.bounds)"
						@click="step(1)">
						<template #icon>
							<AppIcon name="chevronRight" />
						</template>
					</NcButton>
				</div>
			</template>
			<span v-else class="statistics-period__label">{{ label }}</span>
		</div>
	</div>
</template>

<style scoped>
/* A phone stacks the segment above the stepper, each across the content (STATS-001.74). */
.statistics-period {
	--statistics-period-name-width: 168px;

	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: calc(2 * var(--default-grid-baseline)) calc(4 * var(--default-grid-baseline));
}

.statistics-period__segment,
.statistics-period__steps {
	display: flex;
	align-items: center;
	border-radius: var(--border-radius-element);
	background: var(--color-background-dark);
}

.statistics-period__segment {
	width: 100%;
}

.statistics-period__segment > *,
.statistics-period__steps {
	flex: 1;
}

.statistics-period__stepper {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	width: 100%;
}

.statistics-period__label {
	font-weight: bold;
	font-variant-numeric: tabular-nums;
}

.statistics-period__name {
	flex: 1;
	min-width: 0;
	text-align: center;
}

/* From 560 px one row: the name keeps its width, so the arrows stay put while stepping. */
@container (min-width: 560px) {
	.statistics-period__segment,
	.statistics-period__stepper {
		width: auto;
	}

	.statistics-period__segment > *,
	.statistics-period__steps,
	.statistics-period__name {
		flex: none;
	}

	.statistics-period__stepper {
		margin-inline-start: auto;
	}

	.statistics-period__name {
		width: var(--statistics-period-name-width);
	}
}
</style>
