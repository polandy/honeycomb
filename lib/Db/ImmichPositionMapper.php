<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Immich\ImmichPosition;
use OCA\Honeycomb\Immich\ImmichPositionStore;
use OCP\AppFramework\Db\QBMapper;
use OCP\AppFramework\Db\TTransactional;
use OCP\IDBConnection;

/**
 * The connections' positions in `honeycomb_positions`, keyed `immich:<connection id>` beside the folder sets' rows (ADR 0044).
 * @template-extends QBMapper<Position>
 */
final class ImmichPositionMapper extends QBMapper implements ImmichPositionStore {
	use TTransactional;

	private const string KEY_PREFIX = 'immich:';
	/** The folder set column is required; a connection's row has none. */
	private const string NO_FOLDER_SET = '{}';

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'honeycomb_positions', Position::class);
	}

	#[\Override]
	public function all(string $userId): array {
		$query = $this->db->getQueryBuilder();
		$query->select('*')
			->from($this->getTableName())
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->andWhere($query->expr()->isNotNull('asset_id'))
			->orderBy('updated_at', 'DESC')
			->addOrderBy('id', 'DESC');
		return array_map(static fn (Position $row): ImmichPosition => new ImmichPosition(
			substr($row->getFolderSetKey(), strlen(self::KEY_PREFIX)),
			(string)$row->getAssetId(),
			(int)$row->getTakenAt(),
			$row->getDecided(),
			$row->getTotal(),
			$row->getUpdatedAt(),
		), $this->findEntities($query));
	}

	/** Deletes and inserts, so a new id orders the latest save first within the same second. */
	#[\Override]
	public function save(string $userId, ImmichPosition $position): void {
		$this->atomic(function () use ($userId, $position): void {
			$this->remove($userId, self::KEY_PREFIX . $position->connectionId);
			$row = new Position();
			$row->setUserId($userId);
			$row->setFolderSetKey(self::KEY_PREFIX . $position->connectionId);
			$row->setFolderSet(self::NO_FOLDER_SET);
			$row->setAssetId($position->assetId);
			$row->setTakenAt($position->takenAt);
			$row->setDecided($position->decided);
			$row->setTotal($position->total);
			$row->setUpdatedAt($position->updatedAt);
			$this->insert($row);
		}, $this->db);
	}

	#[\Override]
	public function keepOnly(array $kept): int {
		$query = $this->db->getQueryBuilder();
		$query->selectDistinct(['user_id', 'folder_set_key'])
			->from($this->getTableName())
			->where($query->expr()->isNotNull('asset_id'));
		$result = $query->executeQuery();
		$rows = $result->fetchAll();
		$result->closeCursor();
		$removed = 0;
		foreach ($rows as $row) {
			$key = (string)$row['folder_set_key'];
			if (!in_array([substr($key, strlen(self::KEY_PREFIX)), (string)$row['user_id']], $kept, true)) {
				$removed += $this->remove((string)$row['user_id'], $key);
			}
		}
		return $removed;
	}

	private function remove(string $userId, string $key): int {
		$query = $this->db->getQueryBuilder();
		return $query->delete($this->getTableName())
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->andWhere($query->expr()->eq('folder_set_key', $query->createNamedParameter($key)))
			->executeStatement();
	}
}
