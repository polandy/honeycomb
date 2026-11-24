<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Domain\StatsCounter;
use OCA\Honeycomb\Domain\StatsMetric;
use OCA\Honeycomb\Domain\Store\StatsStore;

/** Keeps the daily counters in memory, by user, day and metric; each add can be made to fail first. */
final class FakeStatsStore implements StatsStore {
	/** @var array<string, array<string, array<string, int>>> */
	public array $rows = [];
	/** @var list<\Exception> thrown by the next adds, in order */
	public array $failures = [];

	#[\Override]
	public function add(string $userId, string $day, StatsMetric $metric, int $amount): void {
		$failure = array_shift($this->failures);
		if ($failure !== null) {
			throw $failure;
		}
		$this->rows[$userId][$day][$metric->value] = max(0, ($this->rows[$userId][$day][$metric->value] ?? 0) + $amount);
	}

	#[\Override]
	public function between(string $userId, ?string $from, ?string $to): array {
		$counters = [];
		foreach ($this->rows[$userId] ?? [] as $day => $metrics) {
			if (($from === null || $day >= $from) && ($to === null || $day <= $to)) {
				foreach ($metrics as $metric => $value) {
					$counters[] = new StatsCounter($day, $metric, $value);
				}
			}
		}
		usort($counters, static fn (StatsCounter $a, StatsCounter $b): int => [$a->day, $a->metric] <=> [$b->day, $b->metric]);
		return $counters;
	}

	#[\Override]
	public function total(string $userId, StatsMetric $metric): int {
		return (int)array_sum(array_column($this->rows[$userId] ?? [], $metric->value));
	}

	#[\Override]
	public function firstDay(string $userId): ?string {
		$days = array_keys($this->rows[$userId] ?? []);
		return $days === [] ? null : min($days);
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		unset($this->rows[$userId]);
	}
}
