<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderRow } from '../logic/folder-row.ts'
import type { Period, StatsAnswer } from '../logic/statistics.ts'

import { n, t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import { computed, onMounted, ref } from 'vue'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcContent from '@nextcloud/vue/components/NcContent'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import AppIcon from './AppIcon.vue'
import DeleteStats from './DeleteStats.vue'
import StatisticsBars from './StatisticsBars.vue'
import StatisticsLibrary from './StatisticsLibrary.vue'
import StatisticsRead from './StatisticsRead.vue'
import YearReview from './YearReview.vue'
import { formatDay, formatDuration, formatFileSize, formatNumber, formatPercent, PLAIN_TEXT } from '../l10n.ts'
import { logger } from '../logger.ts'
import { folderProgress } from '../logic/folder-progress.ts'
import { parseSettings } from '../logic/settings.ts'
import { periodNumbers, streak } from '../logic/statistics.ts'
import { reviewYear, yearReview } from '../logic/year-review.ts'

/** How the page reads the counters, the library's folders below a root and the settings. */
export interface StatisticsSeams {
	readonly loadStatistics: () => Promise<StatsAnswer>
	readonly loadLibraryFolders: (root: string) => Promise<FolderRow[]>
	readonly loadSettings: () => Promise<unknown>
	/** Stores the year whose year in review was opened, which closes the navigation's hint (STATS-001.48). */
	readonly saveViewState: (patch: { yearReviewHintClosed: number }) => Promise<void>
}

const props = defineProps<{ seams: StatisticsSeams }>()

/** Rounds pictures a minute to one decimal. */
const RATE_STEPS = 10

const answer = ref<StatsAnswer | null>(null)
const libraryRows = ref<FolderRow[]>([])
const libraryFailed = ref(false)
const keepStatistics = ref(true)
const failed = ref(false)
const period = ref<Period>('month')

const periods = computed(() => [
	{ period: 'week' as const, label: t('honeycomb', '7 days') },
	{ period: 'month' as const, label: t('honeycomb', '30 days') },
	{ period: 'year' as const, label: answer.value?.today.slice(0, 4) ?? '' },
	{ period: 'all' as const, label: t('honeycomb', 'All time') },
])
const counted = computed(() => answer.value !== null && answer.value.counters.length > 0)
const review = computed(() => {
	const year = answer.value === null || !counted.value ? null : reviewYear(answer.value.today)
	return year === null ? null : yearReview(answer.value!.counters, year, answer.value!.firstDay)
})
const numbers = computed(() => answer.value && periodNumbers(answer.value.counters, period.value, answer.value.today, answer.value.firstDay))
const roots = ref<readonly string[]>([])
/** The library's progress as of the user's today, whose month counts as this month (STATS-001.42). */
const library = computed(() => answer.value === null ? null : folderProgress(libraryRows.value, roots.value, new Date(`${answer.value.today}T00:00:00Z`)))
const cullUrl = generateUrl('/apps/honeycomb/')
const stats = computed(() => {
	const sums = numbers.value!
	const run = streak(answer.value!.counters, answer.value!.today)
	return [
		{
			value: formatNumber(sums.decided),
			label: t('honeycomb', 'Photos decided'),
			note: sums.decidedChange === null ? undefined : n('honeycomb', '{change} on the day before', '{change} on the %n days before', sums.days, { change: formatPercent(sums.decidedChange, true) }, PLAIN_TEXT),
		},
		{
			value: formatNumber(sums.trashed),
			label: t('honeycomb', 'Moved to the trash bin'),
			note: sums.freedBytes + sums.deletedForGood === 0 ? undefined : n('honeycomb', '{size} · %n deleted for good', '{size} · %n deleted for good', sums.deletedForGood, { size: formatFileSize(sums.freedBytes) }, PLAIN_TEXT),
		},
		{
			value: `${formatNumber(sums.sidecarsCreated)} / ${formatNumber(sums.sidecarsUpdated)}`,
			label: t('honeycomb', 'Sidecars created / updated'),
			note: sums.sidecarsForeign === 0 ? undefined : n('honeycomb', '%n from digiKam or darktable', '%n from digiKam or darktable', sums.sidecarsForeign, undefined, PLAIN_TEXT),
		},
		{
			value: formatNumber(run.current),
			label: t('honeycomb', 'Days in a row'),
			note: t('honeycomb', 'Longest {longest}', { longest: formatNumber(run.longest) }, undefined, PLAIN_TEXT),
		},
	]
})
const line = computed(() => {
	const sums = numbers.value!
	return [
		sums.activeMs > 0 ? t('honeycomb', 'Active time {duration}', { duration: formatDuration(sums.activeMs) }, undefined, PLAIN_TEXT) : null,
		sums.perMinute === null ? null : t('honeycomb', '{rate} photos a minute', { rate: formatNumber(Math.round(sums.perMinute * RATE_STEPS) / RATE_STEPS) }, undefined, PLAIN_TEXT),
		sums.seriesDone > 0 ? n('honeycomb', '%n series done', '%n series done', sums.seriesDone, undefined, PLAIN_TEXT) : null,
		sums.rawsRemoved > 0 ? n('honeycomb', '%n RAW file removed', '%n RAW files removed', sums.rawsRemoved, undefined, PLAIN_TEXT) : null,
	].filter((part) => part !== null).join(' · ')
})

/** Opening the year in review closes the hint for its year; a failed write is only logged. */
function closeHint() {
	if (review.value !== null) {
		props.seams.saveViewState({ yearReviewHintClosed: review.value.year }).catch((error: unknown) => logger.error('Could not save the closed year-in-review hint.', { error }))
	}
}

/** Reads the folders below every root; a failure only empties the library panel. */
async function loadLibrary() {
	try {
		libraryRows.value = (await Promise.all(roots.value.map((root) => props.seams.loadLibraryFolders(root)))).flat()
	} catch (error) {
		libraryFailed.value = true
		logger.error('Could not load the library progress', { error })
	}
}

onMounted(async () => {
	try {
		const [statistics, settings] = await Promise.all([props.seams.loadStatistics(), props.seams.loadSettings()])
		const parsed = parseSettings(settings)
		keepStatistics.value = parsed.keepStatistics
		roots.value = parsed.libraryRoots
		answer.value = statistics
		closeHint()
		await loadLibrary()
	} catch (error) {
		failed.value = true
		logger.error('Could not load the statistics', { error })
	}
})
</script>

<template>
	<NcContent appName="honeycomb">
		<NcAppContent>
			<div class="statistics-page">
				<NcButton variant="tertiary" :href="cullUrl">
					<template #icon>
						<AppIcon name="back" />
					</template>
					{{ t('honeycomb', 'Back to the cull') }}
				</NcButton>
				<h2>{{ t('honeycomb', 'Statistics') }}</h2>
				<NcNoteCard v-if="failed" type="error">
					{{ t('honeycomb', 'The statistics could not be loaded.') }}
				</NcNoteCard>
				<NcLoadingIcon v-else-if="answer === null" />
				<template v-else>
					<NcNoteCard v-if="!keepStatistics" type="info">
						{{ t('honeycomb', 'Statistics are off. Turn on Keep statistics in the settings to count again.') }}
					</NcNoteCard>
					<template v-if="counted">
						<YearReview v-if="review" :review="review" />
						<div class="statistics-page__periods" role="group" :aria-label="t('honeycomb', 'Period')">
							<NcButton
								v-for="each in periods"
								:key="each.period"
								:pressed="period === each.period"
								@update:pressed="period = each.period">
								{{ each.label }}
							</NcButton>
						</div>
						<DeleteStats :stats="stats" tiles fit />
						<p v-if="line" class="statistics-page__line">
							{{ line }}
						</p>
						<StatisticsBars :bars="numbers!.bars" :period="period" />
					</template>
					<p v-else>
						{{ t('honeycomb', 'Nothing counted yet. Cull a folder and the numbers show here.') }}
					</p>
					<StatisticsLibrary :roots="roots" :progress="library" :failed="libraryFailed" />
					<StatisticsRead :read="answer.read" />
					<p v-if="counted && answer.firstDay" class="statistics-page__line">
						{{ t('honeycomb', 'Counted since {day}.', { day: formatDay(answer.firstDay) }, undefined, PLAIN_TEXT) }}
						<template v-if="answer.seriesDoneBefore > 0">
							{{ n('honeycomb', 'Before that: %n series done (no date).', 'Before that: %n series done (no date).', answer.seriesDoneBefore, undefined, PLAIN_TEXT) }}
						</template>
						{{ t('honeycomb', 'Space is freed when the trash bin is emptied.') }}
					</p>
				</template>
			</div>
		</NcAppContent>
	</NcContent>
</template>

<style src="../coarse-controls.css" />

<style scoped>
.statistics-page {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
	max-width: 960px;
	padding: calc(4 * var(--default-grid-baseline));
}

.statistics-page__periods {
	display: flex;
	flex-wrap: wrap;
	gap: var(--default-grid-baseline);
}

.statistics-page__line {
	color: var(--color-text-maxcontrast);
}
</style>
