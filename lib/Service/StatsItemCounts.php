<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

/** Parses the counts one item of a save carries: metric to -1, 0 or 1, as the browser counts one picture (STATS-001.16, .36). */
final class StatsItemCounts {
	/**
	 * The item's counts, each capped at ±1; none without counts.
	 * @param list<StatsMetric> $takes the metrics the endpoint takes
	 * @param class-string<InvalidRequestException> $exception what a malformed counts object throws
	 * @return list<StatsCount>
	 */
	public static function parse(mixed $counts, array $takes, string $exception): array {
		if ($counts === null) {
			return [];
		}
		if (!is_array($counts) || ($counts !== [] && array_is_list($counts))) {
			throw new $exception('counts must be an object of metrics');
		}
		$parsed = [];
		foreach ($counts as $key => $amount) {
			$metric = StatsMetric::tryFrom((string)$key);
			if ($metric === null || !in_array($metric, $takes, true) || !is_int($amount)) {
				throw new $exception('counts name a metric this save carries, each with a whole number');
			}
			$parsed[] = new StatsCount($metric, max(-1, min(1, $amount)));
		}
		return $parsed;
	}
}
