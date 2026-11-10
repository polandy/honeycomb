<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\DecisionStore;
use OCA\Honeycomb\Service\PictureDecision;

/** Keeps decisions in memory, by user and file id. */
final class FakeDecisionStore implements DecisionStore {
	/** @var array<string, array<int, PictureDecision>> */
	public array $rows = [];

	#[\Override]
	public function find(string $userId, array $fileIds): array {
		return array_values(array_intersect_key($this->rows[$userId] ?? [], array_flip($fileIds)));
	}

	#[\Override]
	public function replace(string $userId, array $fileIds, array $decisions): void {
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
}
