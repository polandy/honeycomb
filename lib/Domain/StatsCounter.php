<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Domain;

/** One stored daily counter as the API answers it: the day, the metric's key and the sum. */
final readonly class StatsCounter implements \JsonSerializable {
	public function __construct(
		public string $day,
		public string $metric,
		public int $value,
	) {
	}

	/** @return array{day: string, metric: string, value: int} */
	#[\Override]
	public function jsonSerialize(): array {
		return ['day' => $this->day, 'metric' => $this->metric, 'value' => $this->value];
	}
}
