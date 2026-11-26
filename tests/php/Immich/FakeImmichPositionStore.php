<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\ImmichPosition;
use OCA\Honeycomb\Immich\ImmichPositionStore;

/** Keeps the connections' positions in memory, by user and connection. */
final class FakeImmichPositionStore implements ImmichPositionStore {
	/** @var array<string, array<string, ImmichPosition>> */
	public array $rows = [];

	#[\Override]
	public function all(string $userId): array {
		$positions = array_reverse(array_values($this->rows[$userId] ?? []));
		usort($positions, static fn (ImmichPosition $a, ImmichPosition $b): int => $b->updatedAt <=> $a->updatedAt);
		return $positions;
	}

	#[\Override]
	public function save(string $userId, ImmichPosition $position): void {
		unset($this->rows[$userId][$position->connectionId]);
		$this->rows[$userId][$position->connectionId] = $position;
	}

	#[\Override]
	public function keepOnly(array $kept): int {
		$removed = 0;
		foreach ($this->rows as $userId => $positions) {
			foreach (array_keys($positions) as $connectionId) {
				if (!in_array([$connectionId, $userId], $kept, true)) {
					unset($this->rows[$userId][$connectionId]);
					$removed++;
				}
			}
		}
		return $removed;
	}
}
