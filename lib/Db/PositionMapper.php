<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\LegacyPositionKeys;
use OCA\Honeycomb\Service\PositionStore;
use OCA\Honeycomb\Service\ResumePosition;
use OCP\AppFramework\Db\QBMapper;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** @template-extends QBMapper<Position> */
final class PositionMapper extends QBMapper implements PositionStore {
	use TTransactional;

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'honeycomb_positions', Position::class);
	}

	/** Re-keys rows stored under an older folder set key first (ADR 0034). */
	#[\Override]
	public function all(string $userId): array {
		$query = $this->db->getQueryBuilder();
		$query->select('*')
			->from($this->getTableName())
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->orderBy('updated_at', 'DESC')
			->addOrderBy('id', 'DESC');
		$repair = LegacyPositionKeys::repair(array_map(static fn (Position $row): array => [$row->getFolderSetKey(), $row->toPosition()], $this->findEntities($query)));
		if ($repair['forget'] !== [] || $repair['rekey'] !== []) {
			$this->atomic(function () use ($userId, $repair): void {
				if ($repair['forget'] !== []) {
					$this->forget($userId, $repair['forget']);
				}
				foreach ($repair['rekey'] as [$from, $to]) {
					$this->rekey($userId, $from, $to);
				}
			}, $this->db);
		}
		return $repair['keep'];
	}

	/** Deletes and inserts, so a new id orders the latest save first within the same second. */
	#[\Override]
	public function save(string $userId, ResumePosition $position): void {
		$this->atomic(function () use ($userId, $position): void {
			$this->forget($userId, [$position->folderSet->key()]);
			$this->insert(Position::of($userId, $position));
		}, $this->db);
	}

	#[\Override]
	public function forget(string $userId, array $folderSetKeys): void {
		$query = $this->db->getQueryBuilder();
		$query->delete($this->getTableName())
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->andWhere($query->expr()->in('folder_set_key', $query->createNamedParameter($folderSetKeys, IQueryBuilder::PARAM_STR_ARRAY)))
			->executeStatement();
	}

	private function rekey(string $userId, string $from, string $to): void {
		$query = $this->db->getQueryBuilder();
		$query->update($this->getTableName())
			->set('folder_set_key', $query->createNamedParameter($to))
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->andWhere($query->expr()->eq('folder_set_key', $query->createNamedParameter($from)))
			->executeStatement();
	}

	#[\Override]
	public function forgetUser(string $userId): void {
		$query = $this->db->getQueryBuilder();
		$query->delete($this->getTableName())
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->executeStatement();
	}
}
