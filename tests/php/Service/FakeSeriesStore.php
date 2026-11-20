<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\SeriesLookup;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\SeriesStore;
use OCA\Honeycomb\Service\SeriesWrite;
use OCA\Honeycomb\Service\StoredSeries;
use OCP\DB\Exception as DbException;

/** Keeps stored series in memory: member rows by user and file id, series by id. */
final class FakeSeriesStore implements SeriesStore {
	use FakeFileRows;

	/** @var array<string, array<int, ?int>> The series id of each file id, null when kept out. */
	public array $rows = [];
	/** @var array<int, array{userId: string, status: SeriesStatus}> */
	public array $series = [];
	/** @var int How many `write()` calls still fail, as a concurrent save winning the insert would. */
	public int $failures = 0;
	/** @var int The reason the failing `write()` calls report. */
	public int $failureReason = DbException::REASON_UNIQUE_CONSTRAINT_VIOLATION;
	/** @var int How many times `write()` was called, failed ones included. */
	public int $writeCalls = 0;
	/** @var bool Whether every read of series ids fails, as a lost database connection would. */
	public bool $seriesReadFails = false;
	private int $lastSeriesId = 0;

	/** Adds a series of the user with these members and returns its id. */
	public function add(string $userId, SeriesStatus $status, int ...$fileIds): int {
		$id = ++$this->lastSeriesId;
		$this->series[$id] = ['userId' => $userId, 'status' => $status];
		foreach ($fileIds as $fileId) {
			$this->rows[$userId][$fileId] = $id;
		}
		return $id;
	}

	#[\Override]
	public function find(string $userId, array $fileIds): SeriesLookup {
		$rows = array_intersect_key($this->rows[$userId] ?? [], array_flip($fileIds));
		ksort($rows);
		$members = [];
		foreach (array_filter($rows, static fn (?int $id): bool => $id !== null) as $fileId => $id) {
			$members[$id][] = $fileId;
		}
		ksort($members);
		$all = array_count_values(array_filter($this->rows[$userId] ?? [], static fn (?int $id): bool => $id !== null));
		$series = [];
		foreach ($members as $id => $memberIds) {
			$series[] = new StoredSeries($id, $this->series[$id]['status'] ?? SeriesStatus::Open, $memberIds, $all[$id] > count($memberIds));
		}
		return new SeriesLookup($series, array_keys(array_filter($rows, static fn (?int $id): bool => $id === null)));
	}

	#[\Override]
	public function write(string $userId, SeriesWrite $write): array {
		++$this->writeCalls;
		if ($this->failures > 0) {
			--$this->failures;
			throw new FakeDbException($this->failureReason);
		}
		$ids = [];
		$done = 0;
		foreach ($write->series as $item) {
			$id = $item->id;
			$before = $id !== null && ($this->series[$id]['userId'] ?? null) === $userId ? $this->series[$id]['status'] : null;
			$done += (int)($item->status === SeriesStatus::Done && $before !== SeriesStatus::Done);
			if ($before !== null && $id !== null) {
				$this->series[$id]['status'] = $item->status;
			} else {
				$id = $this->add($userId, $item->status);
			}
			foreach ($item->fileIds as $fileId) {
				$this->rows[$userId][$fileId] = $id;
			}
			$ids[] = $id;
		}
		foreach ($write->keptOut as $fileId) {
			$this->rows[$userId][$fileId] = null;
		}
		foreach ($write->released as $fileId) {
			unset($this->rows[$userId][$fileId]);
		}
		return ['ids' => $ids, 'done' => $done];
	}

	#[\Override]
	public function countDone(string $userId): int {
		return count(array_filter($this->series, static fn (array $series): bool => $series['userId'] === $userId && $series['status'] === SeriesStatus::Done));
	}

	#[\Override]
	public function seriesIdsAfter(int $afterId, int $limit): array {
		if ($this->seriesReadFails) {
			throw new FakeDbException(0);
		}
		$ids = array_values(array_filter(array_keys($this->series), static fn (int $id): bool => $id > $afterId));
		sort($ids);
		return array_slice($ids, 0, $limit);
	}

	#[\Override]
	public function deleteEmptySeries(array $ids): int {
		$used = [];
		foreach ($this->rows as $rows) {
			foreach (array_filter($rows, static fn (?int $id): bool => $id !== null) as $id) {
				$used[$id] = true;
			}
		}
		$empty = array_filter($ids, fn (int $id): bool => isset($this->series[$id]) && !isset($used[$id]));
		$this->series = array_diff_key($this->series, array_flip($empty));
		return count($empty);
	}

	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		if (array_key_exists($fileId, $this->rows[$userId] ?? [])) {
			$this->rows[$userId][$newFileId] = $this->rows[$userId][$fileId];
			unset($this->rows[$userId][$fileId]);
		}
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		unset($this->rows[$userId]);
		$this->series = array_filter($this->series, static fn (array $series): bool => $series['userId'] !== $userId);
	}
}
