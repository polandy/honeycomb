<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\SeriesLookup;
use OCA\Honeycomb\Service\SeriesStatus;
use OCA\Honeycomb\Service\SeriesStore;
use OCA\Honeycomb\Service\SeriesWrite;
use OCA\Honeycomb\Service\StoredSeries;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** The stored series: a row per member or kept-out file, a row per series (ADR 0027). */
final class SeriesMapper implements SeriesStore {
	use FileRowQueries;
	use TTransactional;

	private const string TABLE = 'honeycomb_series_files';
	private const string SERIES_TABLE = 'honeycomb_series';
	private const array COLUMNS = [
		'user_id' => IQueryBuilder::PARAM_STR,
		'file_id' => IQueryBuilder::PARAM_INT,
		'series_id' => IQueryBuilder::PARAM_INT,
	];

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	/** The member table, without the instance's prefix. */
	#[\Override]
	public function getTableName(): string {
		return self::TABLE;
	}

	/** A member whose series row the sweep removed meanwhile reads as open. */
	#[\Override]
	public function find(string $userId, array $fileIds): SeriesLookup {
		$members = [];
		$keptOut = [];
		foreach ($this->findFileRows($userId, $fileIds) as $row) {
			if ($row['series_id'] === null) {
				$keptOut[] = (int)$row['file_id'];
			} else {
				$members[(int)$row['series_id']][] = (int)$row['file_id'];
			}
		}
		ksort($members);
		$seriesIds = array_keys($members);
		$statuses = $this->statuses($seriesIds);
		$counts = $this->memberCounts($userId, $seriesIds);
		$series = [];
		foreach ($members as $id => $memberIds) {
			$series[] = new StoredSeries($id, $statuses[$id] ?? SeriesStatus::Open, $memberIds, ($counts[$id] ?? 0) > count($memberIds));
		}
		return new SeriesLookup($series, $keptOut);
	}

	#[\Override]
	public function write(string $userId, SeriesWrite $write): array {
		// Only writes, so SQLite takes the write lock at once rather than failing after another save commits.
		return $this->atomic(function () use ($userId, $write): array {
			$rows = [];
			$ids = [];
			foreach ($write->series as $item) {
				$id = $item->id !== null && $this->updateStatus($userId, $item->id, $item->status) ? $item->id : $this->insertSeries($userId, $item->status);
				foreach ($item->fileIds as $fileId) {
					$rows[] = ['user_id' => $userId, 'file_id' => $fileId, 'series_id' => $id];
				}
				$ids[] = $id;
			}
			foreach ($write->keptOut as $fileId) {
				$rows[] = ['user_id' => $userId, 'file_id' => $fileId, 'series_id' => null];
			}
			$fileIds = $write->fileIds();
			// The same lock order in every write, so two writes of one user do not deadlock.
			sort($fileIds);
			$this->deleteFileRows($userId, $fileIds);
			$this->insertRows(new InsertStatements(self::TABLE, self::COLUMNS), $rows);
			return $ids;
		}, $this->db);
	}

	#[\Override]
	public function seriesIdsAfter(int $afterId, int $limit): array {
		$query = $this->db->getQueryBuilder();
		$query->select('id')
			->from(self::SERIES_TABLE)
			->where($query->expr()->gt('id', $query->createNamedParameter($afterId, IQueryBuilder::PARAM_INT)))
			->orderBy('id')
			->setMaxResults($limit);
		return $this->column($query);
	}

	/** One statement per chunk, so a series gaining a member meanwhile is not removed. */
	#[\Override]
	public function deleteEmptySeries(array $ids): int {
		$removed = 0;
		foreach (array_chunk($ids, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$members = $this->db->getQueryBuilder();
			$members->select($members->expr()->literal(1))
				->from(self::TABLE)
				->where($members->expr()->eq('series_id', $query->createFunction($query->getTableName(self::SERIES_TABLE) . '.' . $query->getColumnName('id'))));
			$removed += $query->delete(self::SERIES_TABLE)
				->where($query->expr()->in('id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
				->andWhere($query->createFunction('NOT EXISTS (' . $members->getSQL() . ')'))
				->executeStatement();
		}
		return $removed;
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		$this->atomic(function () use ($userId): void {
			$this->deleteUserRows(self::TABLE, $userId);
			$this->deleteUserRows(self::SERIES_TABLE, $userId);
		}, $this->db);
	}

	/** Whether the user has the series; Nextcloud counts matched rows on MySQL too. */
	private function updateStatus(string $userId, int $id, SeriesStatus $status): bool {
		$query = $this->db->getQueryBuilder();
		return $query->update(self::SERIES_TABLE)
			->set('status', $query->createNamedParameter($status->value))
			->where($query->expr()->eq('id', $query->createNamedParameter($id, IQueryBuilder::PARAM_INT)))
			->andWhere($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->executeStatement() > 0;
	}

	private function insertSeries(string $userId, SeriesStatus $status): int {
		$query = $this->db->getQueryBuilder();
		$query->insert(self::SERIES_TABLE)
			->values(['user_id' => $query->createNamedParameter($userId), 'status' => $query->createNamedParameter($status->value)])
			->executeStatement();
		return $query->getLastInsertId();
	}

	/**
	 * The status of each series among `$ids`.
	 * @param list<int> $ids
	 * @return array<int, SeriesStatus>
	 */
	private function statuses(array $ids): array {
		$statuses = [];
		foreach (array_chunk($ids, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$query->select('id', 'status')
				->from(self::SERIES_TABLE)
				->where($query->expr()->in('id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)));
			$result = $query->executeQuery();
			while (($row = $result->fetch()) !== false) {
				$statuses[(int)$row['id']] = SeriesStatus::tryFrom((string)$row['status']) ?? SeriesStatus::Open;
			}
			$result->closeCursor();
		}
		return $statuses;
	}

	/**
	 * How many members each of the user's series among `$ids` has in all.
	 * @param list<int> $ids
	 * @return array<int, int>
	 */
	private function memberCounts(string $userId, array $ids): array {
		$counts = [];
		foreach (array_chunk($ids, self::IN_CHUNK) as $chunk) {
			$query = $this->db->getQueryBuilder();
			$query->select('series_id')
				->selectAlias($query->func()->count('*'), 'members')
				->from(self::TABLE)
				->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
				->andWhere($query->expr()->in('series_id', $query->createNamedParameter($chunk, IQueryBuilder::PARAM_INT_ARRAY)))
				->groupBy('series_id');
			$result = $query->executeQuery();
			while (($row = $result->fetch()) !== false) {
				$counts[(int)$row['series_id']] = (int)$row['members'];
			}
			$result->closeCursor();
		}
		return $counts;
	}

	/** @return list<int> the first column of the query's rows */
	private function column(IQueryBuilder $query): array {
		$result = $query->executeQuery();
		$values = array_map(intval(...), $result->fetchAll(\PDO::FETCH_COLUMN));
		$result->closeCursor();
		return $values;
	}
}
