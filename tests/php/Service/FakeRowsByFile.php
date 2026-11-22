<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

/**
 * The `FileRowStore` part of a fake store with one row per file, `$rows[$fileId]`, whose row id is the file id;
 * the store declares `$rows` and `movedTo()`, the row moved to a new file id.
 */
trait FakeRowsByFile {
	/** @var bool Whether every read of row ids fails, as a lost database connection would. */
	public bool $readFails = false;

	/** A file's row follows it, whoever saved it. */
	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		if (isset($this->rows[$fileId])) {
			$this->rows[$newFileId] = self::movedTo($this->rows[$fileId], $newFileId);
			unset($this->rows[$fileId]);
		}
	}

	/** @return array<int, int> */
	#[\Override]
	public function fileIdsAfter(int $afterId, int $limit): array {
		if ($this->readFails) {
			throw new FakeDbException(0);
		}
		$ids = array_values(array_filter(array_keys($this->rows), static fn (int $id): bool => $id > $afterId));
		sort($ids);
		$ids = array_slice($ids, 0, $limit);
		return $ids === [] ? [] : array_combine($ids, $ids);
	}

	#[\Override]
	public function deleteRows(array $ids): int {
		$before = count($this->rows);
		$this->rows = array_diff_key($this->rows, array_flip($ids));
		return $before - count($this->rows);
	}
}
