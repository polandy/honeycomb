<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Domain\StatsMetric;
use OCA\Honeycomb\Domain\Store\SeriesStore;
use OCA\Honeycomb\Domain\Store\StatsStore;
use OCA\Honeycomb\Domain\Store\XmpCacheStore;
use OCP\IUser;

/** What the statistics page shows besides the counters: done series from before the counting and the pictures read so far (STATS-001.44, .45). */
final readonly class StatsBaseline {
	public function __construct(
		private SeriesStore $series,
		private StatsStore $stats,
		private XmpCacheStore $cache,
	) {
	}

	/**
	 * Series done that no counter holds, and the state of the user's cached XMP readings.
	 * @return array{seriesDoneBefore: int, read: array{pictures: int, picked: int, rejected: int, rated: int}}
	 */
	public function of(IUser $user): array {
		$userId = $user->getUID();
		return [
			'seriesDoneBefore' => max(0, $this->series->countDone($userId) - $this->stats->total($userId, StatsMetric::SeriesDone)),
			'read' => $this->cache->readCounts($userId),
		];
	}
}
