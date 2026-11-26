<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Stats;

use OCA\Honeycomb\Domain\Store\StatsStore;

/** Counts and removes the statistics rows of one user or of every user, for `occ` (STATS-001.3). */
final readonly class StatsReset {
	public function __construct(
		private StatsStore $store,
	) {
	}

	/**
	 * The rows each user with statistics holds, only the named user when given.
	 * @return array<string, int>
	 */
	public function rows(?string $userId): array {
		return $this->store->rowsPerUser($userId);
	}

	/**
	 * Removes every statistics row of the named user, or of every user without one, and answers what each lost.
	 * @return array<string, int>
	 */
	public function reset(?string $userId): array {
		$rows = $this->rows($userId);
		foreach (array_keys($rows) as $user) {
			$this->store->forgetUser($user);
		}
		return $rows;
	}
}
