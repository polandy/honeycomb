<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderRow } from '../logic/folder-row.ts'
import type { StatsAnswer } from '../logic/statistics.ts'
import type { Compared, PeriodBounds, PeriodKind } from '../logic/stats-period.ts'
import type { LocationApi } from '../shared/browser-location.ts'
import type { PageNavigationSeams } from './PageLayout.vue'

import { n, t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import { computed, onMounted, ref, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import AppIcon from './AppIcon.vue'
import DeleteStats from './DeleteStats.vue'
import PageLayout from './PageLayout.vue'
import StatisticsBars from './StatisticsBars.vue'
import StatisticsHero from './StatisticsHero.vue'
import StatisticsLibrary from './StatisticsLibrary.vue'
import StatisticsPeriod from './StatisticsPeriod.vue'
import StatisticsRead from './StatisticsRead.vue'
import YearReview from './YearReview.vue'
import { yearOf } from '../logic/days.ts'
import { folderProgress } from '../logic/folder-progress.ts'
import { parseSettings } from '../logic/settings.ts'
import { parsePeriodHash, periodHash, resolveLocation } from '../logic/stats-location.ts'
import { periodOverview } from '../logic/stats-overview.ts'
import { periodAt, periodNumbers, periodRun } from '../logic/stats-period.ts'
import { reviewYear, yearReview } from '../logic/year-review.ts'
import { formatDay, formatDayRange, formatDuration, formatFileSize, formatNumber, formatPercent, PLAIN_TEXT } from '../shared/l10n.ts'
import { logger } from '../shared/logger.ts'

/** How the page reads the counters, the library's folders below a root and the settings. */
export interface StatisticsSeams {
	readonly loadStatistics: () => Promise<StatsAnswer>
	readonly loadLibraryFolders: (root: string) => Promise<FolderRow[]>
	readonly loadSettings: () => Promise<unknown>
	/** Stores the year whose year in review was opened, which closes the navigation's hint (STATS-001.48). */
	readonly saveViewState: (patch: { year_review_hint_closed: number }) => Promise<void>
	/** The locale's first day of the week, 0 for Sunday (STATS-001.53). */
	readonly firstWeekDay: () => number
	/** The page address, whose hash names the period (STATS-001.57). */
	readonly location: LocationApi
}

const props = defineProps<{ seams: StatisticsSeams, navigation: PageNavigationSeams }>()

const answer = ref<StatsAnswer | null>(null)
const libraryRows = ref<FolderRow[]>([])
const libraryFailed = ref(false)
const keepStatistics = ref(true)
const failed = ref(false)
const kind = ref<PeriodKind>('month')
/** The day whose period shows, kept when the segment changes; null for today (STATS-001.52). */
const anchor = ref<string | null>(null)
const YEAR_STYLE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
/** A tile without a figure, e.g. no keep rate without a decision. */
const NO_FIGURE = '—'

const bounds = computed<PeriodBounds>(() => ({ today: answer.value!.today, firstDay: answer.value!.firstDay, firstWeekDay: props.seams.firstWeekDay() }))
const period = computed(() => periodAt(kind.value, anchor.value ?? bounds.value.today, bounds.value))
const counted = computed(() => answer.value !== null && answer.value.counters.length > 0)
const review = computed(() => {
	const year = answer.value === null || !counted.value ? null : reviewYear(answer.value.today)
	return year === null ? null : yearReview(answer.value!.counters, year, answer.value!.firstDay)
})
const numbers = computed(() => answer.value && periodNumbers(answer.value.counters, period.value, bounds.value))
const overview = computed(() => periodOverview(answer.value!.counters, period.value.range))
const roots = ref<readonly string[]>([])
/** The library's progress as of the user's today, whose month counts as this month (STATS-001.42). */
const library = computed(() => answer.value === null ? null : folderProgress(libraryRows.value, roots.value, new Date(`${answer.value.today}T00:00:00Z`)))
const cullUrl = generateUrl('/apps/honeycomb/')
const stats = computed(() => {
	const sums = overview.value
	const run = periodRun(answer.value!.counters, period.value, bounds.value.today)
	const photos = n('honeycomb', '%n photo', '%n photos', sums.picturesFreed, undefined, PLAIN_TEXT)
	return [
		{
			value: formatFileSize(sums.spaceFreedBytes),
			label: t('honeycomb', 'Space freed'),
			note: sums.rawsRemoved === 0 ? photos : n('honeycomb', '{photos} · %n RAW file', '{photos} · %n RAW files', sums.rawsRemoved, { photos }, PLAIN_TEXT),
		},
		{
			value: sums.keepRate === null ? NO_FIGURE : formatPercent(sums.keepRate),
			label: t('honeycomb', 'Keep rate'),
			note: sums.keepRate === null
				? t('honeycomb', 'Nothing decided')
				: t('honeycomb', '{kept} kept of {decided}', { kept: formatNumber(sums.picked), decided: formatNumber(sums.picked + sums.rejected) }, undefined, PLAIN_TEXT),
		},
		{
			value: formatDuration(sums.activeMs),
			label: t('honeycomb', 'Active time'),
			note: sums.pace === null ? NO_FIGURE : t('honeycomb', '{rate} photos a minute', { rate: formatNumber(sums.pace) }, undefined, PLAIN_TEXT),
		},
		{
			value: formatNumber(run.days),
			label: t('honeycomb', 'Days in a row'),
			note: run.longest === null ? t('honeycomb', 'Longest in this period') : t('honeycomb', 'Longest {longest}', { longest: formatNumber(run.longest) }, undefined, PLAIN_TEXT),
		},
	]
})
/** The sidecars and the series until *Work done* takes them. */
const line = computed(() => {
	const sums = overview.value
	return [
		sums.sidecarsCreated > 0 ? n('honeycomb', '%n sidecar created', '%n sidecars created', sums.sidecarsCreated, undefined, PLAIN_TEXT) : null,
		sums.sidecarsUpdated > 0 ? n('honeycomb', '%n sidecar updated', '%n sidecars updated', sums.sidecarsUpdated, undefined, PLAIN_TEXT) : null,
		sums.sidecarsForeign > 0 ? n('honeycomb', '%n from digiKam or darktable', '%n from digiKam or darktable', sums.sidecarsForeign, undefined, PLAIN_TEXT) : null,
		sums.seriesDone > 0 ? n('honeycomb', '%n series done', '%n series done', sums.seriesDone, undefined, PLAIN_TEXT) : null,
	].filter((part) => part !== null).join(' · ')
})

/** The days pictures decided are compared with: by their days, or the month, year or week before when whole (STATS-001.41). */
function comparedName(compared: Compared | null): string {
	if (compared === null) {
		return ''
	}
	const { from, to } = compared.range
	if (compared.whole && kind.value === 'week') {
		return t('honeycomb', 'the week before')
	}
	return compared.whole
		? (kind.value === 'month' ? formatDay(from, { month: 'long' }) : String(yearOf(from)))
		: formatDayRange(from, to, kind.value === 'year' ? YEAR_STYLE : undefined)
}

/** Shows the period the address names, then keeps the address on the period shown (STATS-001.57, STATS-001.58). */
function showLocated() {
	const located = resolveLocation(parsePeriodHash(props.seams.location.read()), bounds.value)
	kind.value = located.kind
	anchor.value = located.anchor
	watch(period, (shown) => props.seams.location.write(periodHash(shown, bounds.value.today)), { immediate: true })
}

/** Opening the year in review closes the hint for its year; a failed write is only logged. */
function closeHint() {
	if (review.value !== null) {
		props.seams.saveViewState({ year_review_hint_closed: review.value.year }).catch((error: unknown) => logger.error('Could not save the closed year-in-review hint.', { error }))
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
		showLocated()
		closeHint()
		await loadLibrary()
	} catch (error) {
		failed.value = true
		logger.error('Could not load the statistics', { error })
	}
})
</script>

<template>
	<PageLayout page="statistics" :seams="props.navigation">
		<div class="statistics-page">
			<NcButton variant="tertiary" :href="cullUrl">
				<template #icon>
					<AppIcon name="back" />
				</template>
				{{ t('honeycomb', 'Back to the cull') }}
			</NcButton>
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
					<StatisticsPeriod
						:period="period"
						:bounds="bounds"
						@kind="kind = $event"
						@anchor="anchor = $event" />
					<div class="statistics-page__overview">
						<StatisticsHero :overview="overview" :change="numbers!.decidedChange" :compared="comparedName(numbers!.compared)" />
						<StatisticsBars
							:bars="numbers!.bars"
							:kind="kind"
							:unit="numbers!.unit"
							:counted="numbers!.counted" />
					</div>
					<DeleteStats :stats="stats" tiles fit />
					<p v-if="line" class="statistics-page__line">
						{{ line }}
					</p>
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
	</PageLayout>
</template>

<style src="../shared/coarse-controls.css" />

<style scoped>
.statistics-page {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
	max-width: 1280px;
	padding: calc(4 * var(--default-grid-baseline));
	container-type: inline-size;
}

.statistics-page__overview {
	display: grid;
	gap: calc(2 * var(--default-grid-baseline));
	align-items: start;
}

/* The hero beside the bars from 960 px of content width (STATS-001.59). */
@container (min-width: 960px) {
	.statistics-page__overview {
		grid-template-columns: 1fr 2fr;
	}
}

.statistics-page__line {
	color: var(--color-text-maxcontrast);
}
</style>
