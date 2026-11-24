<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/**
 * The `FileRowStore` queries of a mapper whose table has `file_id`, and `user_id` where a user is given.
 * @property IDBConnection $db
 */
trait FileRowQueries {
	use UserRowQueries;

	/** Oracle takes at most 1,000 values in an `IN` list. */
	private const int IN_CHUNK = 1_000;

	abstract public function getTableName(): string;

	#[\Override]
	public function carryOver(int $fileId, int $newFileId): void {
		$query = $this->db->getQueryBuilder();
		$query->update($this->getTableName())
			->set('file_id', $query->createNamedParameter($newFileId, IQueryBuilder::PARAM_INT))
			->where($query->expr()->eq('file_id', $query->createNamedParameter($fileId, IQueryBuilder::PARAM_INT)))
			->executeStatement();
	}

	/** @return array<int, int> row id to file id, skipping rows without a file id */
	#[\Override]
	public function fileIdsAfter(int $afterId, int $limit): array {
		$query = $this->db->getQueryBuilder();
		$query->select('id', 'file_id')
			->from($this->getTableName())
			->where($query->expr()->gt('id', $query->createNamedParameter($afterId, IQueryBuilder::PARAM_INT)))
			->andWhere($query->expr()->isNotNull('file_id'))
			->orderBy('id')
			->setMaxResults($limit);
		$result = $query->executeQuery();
		$fileIds = [];
		while (($row = $result->fetch()) !== false) {
			$fileIds[(int)$row['id']] = (int)$row['file_id'];
		}
		$result->closeCursor();
		return $fileIds;
	}

	#[\Override]
	public function deleteRows(array $ids): int {
		$removed = 0;
		foreach (array_chunk($ids, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$removed += $query->delete($this->getTableName())
				->where($query->expr()->in('id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
				->executeStatement();
		}
		return $removed;
	}

	/**
	 * The user's rows of `$fileIds`, or every row of them for null, in file id order.
	 * @param list<int> $fileIds
	 * @return list<array<string, mixed>>
	 */
	private function findFileRows(?string $userId, array $fileIds): array {
		sort($fileIds);
		$rows = [];
		foreach (array_chunk($fileIds, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$query->select('*')
				->from($this->getTableName())
				->where($query->expr()->in('file_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
				->orderBy('file_id');
			$this->ofUser($query, $userId);
			$result = $query->executeQuery();
			$chunkRows = $result->fetchAll();
			$result->closeCursor();
			array_push($rows, ...$chunkRows);
		}
		return $rows;
	}

	/**
	 * Saves `$rows` by file id: a file's existing row is updated in place, any other row inserted.
	 * Updates first, so SQLite takes its write lock at once; `RetryOnConflict` repeats a save that met a row inserted meanwhile.
	 * @param non-empty-array<string, mixed> $columns each column's `IQueryBuilder::PARAM_*` type, with `file_id`
	 * @param list<array<string, scalar|null>> $rows each row's value of every column
	 */
	private function upsertFileRows(?string $userId, array $columns, array $rows): void {
		$fresh = [];
		foreach ($rows as $row) {
			if ($this->updateFileRow($userId, $columns, $row) === 0) {
				$fresh[] = $row;
			}
		}
		$this->insertRows(new InsertStatements($this->getTableName(), $columns), $fresh);
	}

	/**
	 * @param array<string, mixed> $columns
	 * @param array<string, scalar|null> $row
	 */
	private function updateFileRow(?string $userId, array $columns, array $row): int {
		$query = $this->db->getQueryBuilder();
		$query->update($this->getTableName());
		/** @var array<string, int> $columns */
		foreach ($columns as $name => $type) {
			if ($name !== 'file_id' && $name !== 'user_id') {
				$query->set($name, $query->createNamedParameter($row[$name], $row[$name] === null ? IQueryBuilder::PARAM_NULL : $type));
			}
		}
		$query->where($query->expr()->eq('file_id', $query->createNamedParameter($row['file_id'], IQueryBuilder::PARAM_INT)));
		return $this->ofUser($query, $userId)->executeStatement();
	}

	/**
	 * Removes the user's rows of `$fileIds`, or every row of them for null.
	 * @param list<int> $fileIds
	 */
	private function deleteFileRows(?string $userId, array $fileIds): void {
		foreach (array_chunk($fileIds, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$query->delete($this->getTableName())
				->where($query->expr()->in('file_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)));
			$this->ofUser($query, $userId)->executeStatement();
		}
	}

	/** Removes the rows of `$userId`, or every row for null, and returns how many. */
	private function clearRows(?string $userId): int {
		$query = $this->db->getQueryBuilder();
		$query->delete($this->getTableName());
		return $this->ofUser($query, $userId)->executeStatement();
	}

	/** Narrows `$query` to the user's rows; null leaves it on every row. */
	private function ofUser(IQueryBuilder $query, ?string $userId): IQueryBuilder {
		return $userId === null ? $query : $query->andWhere($query->expr()->eq('user_id', $query->createNamedParameter($userId)));
	}
}
