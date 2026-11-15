<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\XmpCacheRow;
use OCA\Honeycomb\Service\XmpCacheStore;

/** Keeps XMP cache rows in memory, by user and file id. */
final class FakeXmpCacheStore implements XmpCacheStore {
	use FakeFileRows;

	/** @var array<string, array<int, XmpCacheRow>> */
	public array $rows = [];

	#[\Override]
	public function find(string $userId, array $fileIds): array {
		return array_intersect_key($this->rows[$userId] ?? [], array_flip($fileIds));
	}

	#[\Override]
	public function replace(string $userId, array $rows): void {
		foreach ($rows as $row) {
			$this->rows[$userId][$row->fileId] = $row;
		}
	}

	#[\Override]
	public function clear(?string $userId): int {
		$userIds = $userId === null ? array_keys($this->rows) : [$userId];
		$removed = 0;
		foreach ($userIds as $id) {
			$removed += count($this->rows[$id] ?? []);
			unset($this->rows[$id]);
		}
		return $removed;
	}

	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		unset($this->rows[$userId]);
	}
}
