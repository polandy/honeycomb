<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\PositionStore;
use OCA\Honeycomb\Service\ResumePosition;

/** Keeps resume positions in memory, by user and folder set key. */
final class FakePositionStore implements PositionStore {
	/** @var array<string, array<string, ResumePosition>> */
	public array $rows = [];

	#[\Override]
	public function all(string $userId): array {
		$positions = array_reverse(array_values($this->rows[$userId] ?? []));
		usort($positions, static fn (ResumePosition $a, ResumePosition $b): int => $b->updatedAt <=> $a->updatedAt);
		return $positions;
	}

	#[\Override]
	public function save(string $userId, ResumePosition $position): void {
		$key = $position->folderSet->key();
		unset($this->rows[$userId][$key]);
		$this->rows[$userId][$key] = $position;
	}

	#[\Override]
	public function delete(string $userId, array $folderSetKeys): void {
		$this->rows[$userId] = array_diff_key($this->rows[$userId] ?? [], array_flip($folderSetKeys));
	}
}
