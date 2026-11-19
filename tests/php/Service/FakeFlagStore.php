<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\FileFlag;
use OCA\Honeycomb\Service\FlagStore;
use OCP\DB\Exception as DbException;

/** Keeps the flags in memory by file id; a row's id is its file id. */
final class FakeFlagStore implements FlagStore {
	/** @var array<int, FileFlag> */
	public array $rows = [];
	/** @var list<list<int>> The file ids of each `find()`. */
	public array $findCalls = [];
	/** @var int How many writes still fail, as a concurrent save winning the insert would. */
	public int $failures = 0;
	/** @var int The reason the failing writes report. */
	public int $failureReason = DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION;
	/** @var int How many writes were tried, failed ones included. */
	public int $writeCalls = 0;
	/** @var ?FileFlag A row another save inserts just before the next take-over writes. */
	public ?FileFlag $insertedMeanwhile = null;
	/** @var bool Whether removing rows by file id fails, as a lost database connection would. */
	public bool $removeFails = false;
	/** @var bool Whether every read of row ids fails, as a lost database connection would. */
	public bool $readFails = false;

	#[\Override]
	public function find(array $fileIds): array {
		$this->findCalls[] = $fileIds;
		return array_intersect_key($this->rows, array_flip($fileIds));
	}

	#[\Override]
	public function save(array $flags): void {
		$this->write();
		foreach ($flags as $flag) {
			$this->rows[$flag->fileId] = $flag;
		}
	}

	#[\Override]
	public function takeOver(array $flags): array {
		$this->write();
		if ($this->insertedMeanwhile !== null) {
			$this->rows[$this->insertedMeanwhile->fileId] = $this->insertedMeanwhile;
			$this->insertedMeanwhile = null;
		}
		$inserted = [];
		foreach ($flags as $flag) {
			if (!isset($this->rows[$flag->fileId])) {
				$this->rows[$flag->fileId] = $flag;
				$inserted[] = $flag->fileId;
			}
		}
		return $inserted;
	}

	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		if (isset($this->rows[$fileId])) {
			$row = $this->rows[$fileId];
			unset($this->rows[$fileId]);
			$this->rows[$newFileId] = new FileFlag($newFileId, $row->flag, $row->keepRaw, $row->updatedAt);
		}
	}

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

	#[\Override]
	public function remove(array $fileIds): void {
		if ($this->removeFails) {
			throw new FakeDbException(0);
		}
		$this->rows = array_diff_key($this->rows, array_flip($fileIds));
	}

	private function write(): void {
		++$this->writeCalls;
		if ($this->failures > 0) {
			--$this->failures;
			throw new FakeDbException($this->failureReason);
		}
	}
}
