<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\VisualHash;
use OCA\Honeycomb\Service\VisualHashStore;
use OCP\DB\Exception as DbException;

/** Keeps visual hashes in memory, by user and file id. */
final class FakeVisualHashStore implements VisualHashStore {
	/** @var array<string, array<int, VisualHash>> */
	public array $rows = [];

	/** @var list<int> The file ids deleted for good. */
	public array $vanished = [];

	/** @var list<list<int>> The file ids of each `find()` call. */
	public array $findCalls = [];

	/** @var int How many `replace()` calls still fail, as a concurrent save winning the insert would. */
	public int $failures = 0;

	/** @var int How many times `replace()` was called, failed ones included. */
	public int $replaceCalls = 0;

	#[\Override]
	public function find(string $userId, array $fileIds): array {
		$this->findCalls[] = $fileIds;
		return array_intersect_key($this->rows[$userId] ?? [], array_flip($fileIds));
	}

	#[\Override]
	public function replace(string $userId, array $hashes): void {
		++$this->replaceCalls;
		if ($this->failures > 0) {
			--$this->failures;
			throw new FakeDbException(DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION);
		}
		foreach ($hashes as $hash) {
			$this->rows[$userId][$hash->fileId] = $hash;
		}
	}

	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		$hash = $this->rows[$userId][$fileId] ?? null;
		if ($hash !== null) {
			unset($this->rows[$userId][$fileId]);
			$this->rows[$userId][$newFileId] = new VisualHash($newFileId, $hash->etag, $hash->hash);
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
