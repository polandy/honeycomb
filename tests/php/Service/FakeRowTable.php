<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileRowStore;

/** A table of file rows in memory, by row id, that counts its reads. */
final class FakeRowTable implements FileRowStore {
	/** @var array<int, int> Row id to file id, in row id order. */
	public array $rows = [];

	/** @var list<int> The row id after which each read started. */
	public array $reads = [];

	/** @var int How many reads succeed before every further one fails. */
	public int $readsBeforeFailure = PHP_INT_MAX;

	/** Fills row ids 1 to `$count` with file id = row id + `$fileIdOffset`. */
	public static function ofRows(int $count, int $fileIdOffset = 0): self {
		$table = new self();
		for ($id = 1; $id <= $count; ++$id) {
			$table->rows[$id] = $id + $fileIdOffset;
		}
		return $table;
	}

	#[\Override]
	public function fileIdsAfter(int $afterId, int $limit): array {
		if (count($this->reads) >= $this->readsBeforeFailure) {
			throw new FakeDbException(0);
		}
		$this->reads[] = $afterId;
		$fileIds = [];
		foreach ($this->rows as $id => $fileId) {
			if ($id > $afterId) {
				$fileIds[$id] = $fileId;
				if (count($fileIds) === $limit) {
					break;
				}
			}
		}
		return $fileIds;
	}

	#[\Override]
	public function deleteRows(array $ids): int {
		$before = count($this->rows);
		$this->rows = array_diff_key($this->rows, array_flip($ids));
		return $before - count($this->rows);
	}

	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
	}

	#[\Override]
	public function forgetUser(string $userId): void {
	}
}
