<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\Flag;
use OCA\Honeycomb\Service\XmpCacheRow;
use OCA\Honeycomb\Service\XmpCacheStore;
use OCA\Honeycomb\Service\XmpReadState;

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
	public function readCounts(string $userId): array {
		$read = array_filter($this->rows[$userId] ?? [], static fn (XmpCacheRow $row): bool => $row->state === XmpReadState::Read);
		return [
			'pictures' => count($read),
			'picked' => count(array_filter($read, static fn (XmpCacheRow $row): bool => $row->flag === Flag::Picked)),
			'rejected' => count(array_filter($read, static fn (XmpCacheRow $row): bool => $row->flag === Flag::Rejected)),
			'rated' => count(array_filter($read, static fn (XmpCacheRow $row): bool => $row->rating !== null && $row->rating > 0)),
		];
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
