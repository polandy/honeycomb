<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\Domain\StatsMetric;

/** An amount to add to one metric of the day; negative takes back. */
final readonly class StatsCount {
	public function __construct(
		public StatsMetric $metric,
		public int $amount,
	) {
	}
}
