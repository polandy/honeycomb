<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\PictureTags;
use OCA\Honeycomb\Service\TagStore;
use OCP\DB\Exception as DbException;

/** Keeps tags and tag lists in memory, by user and file id. */
final class FakeTagStore implements TagStore {
	/** @var array<string, array<int, PictureTags>> */
	public array $rows = [];

	/** @var array<string, list<string>> */
	public array $tagLists = [];

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
		$rows = array_intersect_key($this->rows[$userId] ?? [], array_flip($fileIds));
		ksort($rows);
		return array_values($rows);
	}

	#[\Override]
	public function replace(string $userId, array $fileIds, array $pictures): void {
		++$this->replaceCalls;
		if ($this->failures > 0) {
			--$this->failures;
			throw new FakeDbException($this->failureReason);
		}
		$this->rows[$userId] = array_diff_key($this->rows[$userId] ?? [], array_flip($fileIds));
		foreach ($pictures as $picture) {
			$this->rows[$userId][$picture->fileId] = $picture;
			$this->tagLists[$userId] = array_values(array_unique([...$this->tagLists[$userId] ?? [], ...$picture->tags]));
		}
	}

	#[\Override]
	public function tagList(string $userId): array {
		$tags = $this->tagLists[$userId] ?? [];
		sort($tags, SORT_STRING);
		return $tags;
	}

	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		$picture = $this->rows[$userId][$fileId] ?? null;
		if ($picture !== null) {
			unset($this->rows[$userId][$fileId]);
			$this->rows[$userId][$newFileId] = new PictureTags($newFileId, $picture->tags);
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
		unset($this->rows[$userId], $this->tagLists[$userId]);
	}
}
