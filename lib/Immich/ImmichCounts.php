<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Immich;

use OCA\Honeycomb\Domain\Flag;
use OCP\AppFramework\Utility\ITimeFactory;

/**
 * The toolbar's, flag chips' and filter options' numbers: Immich's statistics with the decision table's groups (IMMICH-002.13, ADR 0044).
 * @psalm-import-type DecisionGroup from ImmichDecisionStore
 * @psalm-type Counts = array{total: int, undecided: int, decided: int, matching: int, flags: array<string, int>, ratings: object, colourLabels: object, devices: list<array{model: ?string, count: int}>, kinds: array<string, int>, periods: list<int>}
 */
final class ImmichCounts {
	/** More time options than the toolbar offers is a bad request. */
	public const int MAX_PERIODS = 50;
	private const array PERIOD_KEYS = ['takenAfter', 'takenBefore'];
	private const int MAX_RATING = 5;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it through DI. */
	public function __construct(
		private ImmichClient $client,
		private ImmichSearchFilter $filter,
		private ImmichDecisionStore $store,
		private ITimeFactory $time,
	) {
	}

	/**
	 * The numbers for the filters; each facet counts under the filters of the other groups (IMMICH-002.14).
	 * @param array<array-key, mixed> $filters
	 * @param array<array-key, mixed> $periods each `{takenAfter, takenBefore}`
	 * @return Counts
	 */
	public function of(Connection $connection, array $filters, array $periods): array {
		$checked = new ListingFilters($filters);
		$this->checkPeriods($periods);
		$now = $this->time->getTime();
		$total = $this->total($connection, $checked, $now);
		$groups = $this->store->groups($connection->user, $connection->id, $checked);
		$flags = [Flag::Picked->value => 0, Flag::Rejected->value => 0];
		$ratings = array_fill(0, self::MAX_RATING + 1, 0);
		$labels = [];
		$rows = 0;
		$matching = 0;
		foreach ($groups as $group) {
			$rows += $group['count'];
			if ($group['flag'] !== Flag::Unflagged) {
				$flags[$group['flag']->value] += $group['count'];
			}
			$ratings[$group['rating']] += $group['count'];
			if ($group['colourLabel'] !== null) {
				$labels[$group['colourLabel']->value] = ($labels[$group['colourLabel']->value] ?? 0) + $group['count'];
			}
			$matching += $checked->admits($group['flag'], $group['rating'], $group['colourLabel']) ? $group['count'] : 0;
		}
		$unflagged = $total - $flags[Flag::Picked->value] - $flags[Flag::Rejected->value];
		$ratings[0] = $total - array_sum(array_slice($ratings, 1));
		return [
			'total' => $total,
			'undecided' => $unflagged,
			'decided' => $total - $unflagged,
			'matching' => $matching + ($checked->admitsUndecided() ? max(0, $total - $rows) : 0),
			'flags' => [...$flags, Flag::Unflagged->value => $unflagged],
			'ratings' => (object)$ratings,
			'colourLabels' => (object)$labels,
			'devices' => $this->devices($connection, $checked, $now),
			'kinds' => $this->kinds($connection, $checked, $now),
			'periods' => array_map(fn (array $period): int => $this->total($connection, $checked->with($period), $now), $periods),
		];
	}

	/**
	 * The named models with uploads, the chosen ones and *No camera data*, each under the time and kind filters (IMMICH-002.24).
	 * @return list<array{model: ?string, count: int}>
	 */
	private function devices(Connection $connection, ListingFilters $filters, int $now): array {
		$options = array_values(array_unique([...$this->client->cameraModels($connection), ...array_filter($filters->devices, is_string(...))]));
		$devices = [];
		foreach ([...$options, null] as $model) {
			$count = $this->total($connection, $filters->with(['devices' => [$model]]), $now);
			if ($count > 0 || $model === null || in_array($model, $filters->devices, true)) {
				$devices[] = ['model' => $model, 'count' => $count];
			}
		}
		return $devices;
	}

	/** @return array<string, int> */
	private function kinds(Connection $connection, ListingFilters $filters, int $now): array {
		$kinds = [];
		foreach (AssetKind::cases() as $kind) {
			$kinds[$kind->value] = $this->total($connection, $filters->with(['kinds' => [$kind->value]]), $now);
		}
		return $kinds;
	}

	private function total(Connection $connection, ListingFilters $filters, int $now): int {
		return $this->client->statistics($connection, $this->filter->of($filters, $now));
	}

	/**
	 * Checked before Immich is asked, so a malformed request costs no call (IMMICH-002.25).
	 * @param array<array-key, mixed> $periods
	 * @psalm-assert list<array{takenAfter: ?int, takenBefore: ?int}> $periods
	 */
	private function checkPeriods(array $periods): void {
		if (!array_is_list($periods) || count($periods) > self::MAX_PERIODS) {
			throw new ImmichException(ImmichError::Request);
		}
		foreach ($periods as $period) {
			if (!is_array($period) || count($period) !== count(self::PERIOD_KEYS) || array_diff(self::PERIOD_KEYS, array_keys($period)) !== []) {
				throw new ImmichException(ImmichError::Request);
			}
			// The time values are checked as the filters' own.
			new ListingFilters($period);
		}
	}
}
