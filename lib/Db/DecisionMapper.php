<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\DecisionStore;
use OCP\AppFramework\Db\QBMapper;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** @template-extends QBMapper<Decision> */
final class DecisionMapper extends QBMapper implements DecisionStore {
	use TTransactional;

	/** Oracle takes at most 1,000 values in an `IN` list. */
	private const int IN_CHUNK = 1_000;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'honeycomb_decisions', Decision::class);
	}

	#[\Override]
	public function find(string $userId, array $fileIds): array {
		sort($fileIds);
		$decisions = [];
		foreach (array_chunk($fileIds, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$query->select('*')
				->from($this->getTableName())
				->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
				->andWhere($query->expr()->in('file_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
				->orderBy('file_id');
			foreach ($this->findEntities($query) as $row) {
				$decisions[] = $row->toDecision();
			}
		}
		return $decisions;
	}

	#[\Override]
	public function replace(string $userId, array $fileIds, array $decisions): void {
		$this->atomic(function () use ($userId, $fileIds, $decisions): void {
			foreach (array_chunk($fileIds, self::IN_CHUNK) as $chunk) {
				$query = $this->db->getQueryBuilder();
				$query->delete($this->getTableName())
					->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
					->andWhere($query->expr()->in('file_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
					->executeStatement();
			}
			foreach ($decisions as $decision) {
				$this->insert(Decision::of($userId, $decision));
			}
		}, $this->db);
	}

	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		$query = $this->db->getQueryBuilder();
		$query->update($this->getTableName())
			->set('file_id', $query->createNamedParameter($newFileId, IQueryBuilder::PARAM_INT))
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->andWhere($query->expr()->eq('file_id', $query->createNamedParameter($fileId, IQueryBuilder::PARAM_INT)))
			->executeStatement();
	}

	/** A file in the trash bin keeps its file cache row, so only a file deleted for good is gone. */
	#[\Override]
	public function forgetVanishedFiles(): int {
		$removed = 0;
		do {
			$query = $this->db->getQueryBuilder();
			$query->selectDistinct('d.file_id')
				->from($this->getTableName(), 'd')
				->leftJoin('d', 'filecache', 'f', $query->expr()->eq('d.file_id', 'f.fileid'))
				->where($query->expr()->isNull('f.fileid'))
				->setMaxResults(self::IN_CHUNK);
			$result = $query->executeQuery();
			$fileIds = array_map(intval(...), $result->fetchAll(\PDO::FETCH_COLUMN));
			$result->closeCursor();
			if ($fileIds !== []) {
				$delete = $this->db->getQueryBuilder();
				$removed += $delete->delete($this->getTableName())
					->where($delete->expr()->in('file_id', $delete->createNamedParameter($fileIds, IQueryBuilder::PARAM_INT_ARRAY)))
					->executeStatement();
			}
		} while (count($fileIds) === self::IN_CHUNK);
		return $removed;
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		$query = $this->db->getQueryBuilder();
		$query->delete($this->getTableName())
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->executeStatement();
	}
}
