<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

/** The row ids of a fake store whose rows are `$rows[$userId][$fileId]`, given out when a row is first read. */
trait FakeFileRows {
	/** @var bool Whether every read of row ids fails, as a lost database connection would. */
	public bool $readFails = false;

	/** @var array<string, int> */
	private array $rowIds = [];

	/** @return array<int, int> */
	#[\Override]
	public function fileIdsAfter(int $afterId, int $limit): array {
		if ($this->readFails) {
			throw new FakeDbException(0);
		}
		$fileIds = [];
		foreach ($this->rows as $userId => $rows) {
			foreach (array_keys($rows) as $fileId) {
				$id = $this->rowIds["{$userId}/{$fileId}"] ??= count($this->rowIds) + 1;
				if ($id > $afterId) {
					$fileIds[$id] = $fileId;
				}
			}
		}
		ksort($fileIds);
		return array_slice($fileIds, 0, $limit, true);
	}

	#[\Override]
	public function deleteRows(array $ids): int {
		$removed = 0;
		foreach (array_keys(array_intersect($this->rowIds, $ids)) as $key) {
			[$userId, $fileId] = explode('/', $key);
			if (isset($this->rows[$userId][(int)$fileId])) {
				unset($this->rows[$userId][(int)$fileId]);
				++$removed;
			}
		}
		return $removed;
	}
}
