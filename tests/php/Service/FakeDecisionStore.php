<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\DecisionStore;
use OCA\Honeycomb\Service\PictureDecision;
use OCP\DB\Exception as DbException;

/** Keeps decisions in memory, by user and file id. */
final class FakeDecisionStore implements DecisionStore {
	/** @var array<string, array<int, PictureDecision>> */
	public array $rows = [];

	/** @var list<int> The file ids deleted for good. */
	public array $vanished = [];

	/** @var int How many `replace()` calls still fail, as a concurrent save winning the insert would. */
	public int $failures = 0;

	/** @var int The reason the failing `replace()` calls report. */
	public int $failureReason = DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION;

	/** @var int How many times `replace()` was called, failed ones included. */
	public int $replaceCalls = 0;

	#[\Override]
	public function find(string $userId, array $fileIds): array {
		return array_values(array_intersect_key($this->rows[$userId] ?? [], array_flip($fileIds)));
	}

	#[\Override]
	public function replace(string $userId, array $fileIds, array $decisions): void {
		++$this->replaceCalls;
		if ($this->failures > 0) {
			--$this->failures;
			throw new FakeDbException($this->failureReason);
		}
		$this->rows[$userId] = array_diff_key($this->rows[$userId] ?? [], array_flip($fileIds));
		foreach ($decisions as $decision) {
			$this->rows[$userId][$decision->fileId] = $decision;
		}
	}

	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		$decision = $this->rows[$userId][$fileId] ?? null;
		if ($decision !== null) {
			unset($this->rows[$userId][$fileId]);
			$this->rows[$userId][$newFileId] = new PictureDecision($newFileId, $decision->rating, $decision->colourLabel, $decision->flag, $decision->keepRaw);
		}
	}

	#[\Override]
	public function forgetVanishedFiles(): int {
		$removed = 0;
		foreach ($this->rows as $userId => $rows) {
			$this->rows[$userId] = array_diff_key($rows, array_flip($this->vanished));
			$removed += count($rows) - count($this->rows[$userId]);
		}
		return $removed;
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		unset($this->rows[$userId]);
	}
}
