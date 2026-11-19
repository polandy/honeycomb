<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/**
 * The `FileRowStore` queries of a mapper whose table has `user_id` and `file_id`.
 * @property IDBConnection $db
 */
trait FileRowQueries {
	/** Oracle takes at most 1,000 values in an `IN` list. */
	private const int IN_CHUNK = 1_000;

	abstract public function getTableName(): string;

	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		$query = $this->db->getQueryBuilder();
		$query->update($this->getTableName())
			->set('file_id', $query->createNamedParameter($newFileId, IQueryBuilder::PARAM_INT))
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->andWhere($query->expr()->eq('file_id', $query->createNamedParameter($fileId, IQueryBuilder::PARAM_INT)))
			->executeStatement();
	}

	/** @return array<int, int> row id to file id */
	#[\Override]
	public function fileIdsAfter(int $afterId, int $limit): array {
		$query = $this->db->getQueryBuilder();
		$query->select('id', 'file_id')
			->from($this->getTableName())
			->where($query->expr()->gt('id', $query->createNamedParameter($afterId, IQueryBuilder::PARAM_INT)))
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
	 * The user's rows of `$fileIds`, in file id order.
	 * @param list<int> $fileIds
	 * @return list<array<string, mixed>>
	 */
	private function findFileRows(string $userId, array $fileIds): array {
		sort($fileIds);
		$rows = [];
		foreach (array_chunk($fileIds, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$query->select('*')
				->from($this->getTableName())
				->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
				->andWhere($query->expr()->in('file_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
				->orderBy('file_id');
			$result = $query->executeQuery();
			$chunkRows = $result->fetchAll();
			$result->closeCursor();
			array_push($rows, ...$chunkRows);
		}
		return $rows;
	}

	/**
	 * Removes the user's rows of `$fileIds`.
	 * @param list<int> $fileIds
	 */
	private function deleteFileRows(string $userId, array $fileIds): void {
		foreach (array_chunk($fileIds, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$query->delete($this->getTableName())
				->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
				->andWhere($query->expr()->in('file_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
				->executeStatement();
		}
	}

	/**
	 * Runs the statements inserting `$rows`.
	 * @param list<array<string, scalar|null>> $rows
	 */
	private function insertRows(InsertStatements $insert, array $rows): void {
		foreach ($insert->of($rows, $this->db->getDatabaseProvider()) as $statement) {
			$this->db->executeStatement($statement->sql, $statement->params, $statement->types);
		}
	}

	/** Removes the rows of `$userId`, or every row for null, and returns how many. */
	private function clearRows(?string $userId): int {
		$query = $this->db->getQueryBuilder();
		$query->delete($this->getTableName());
		if ($userId !== null) {
			$query->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)));
		}
		return $query->executeStatement();
	}

	private function deleteUserRows(string $table, string $userId): void {
		$query = $this->db->getQueryBuilder();
		$query->delete($table)
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->executeStatement();
	}
}
