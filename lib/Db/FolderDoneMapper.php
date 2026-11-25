<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Domain\FolderDone;
use OCA\Honeycomb\Domain\Store\FolderDoneStore;
use OCP\AppFramework\Db\TTransactional;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/** Keeps the one done status of each folder in `honeycomb_folder_done` (ADR 0049). */
final class FolderDoneMapper implements FolderDoneStore {
	use FileRowQueries;
	use TTransactional;

	private const string TABLE = 'honeycomb_folder_done';
	private const array COLUMNS = [
		'file_id' => IQueryBuilder::PARAM_INT,
		'user_id' => IQueryBuilder::PARAM_STR,
		'done_at' => IQueryBuilder::PARAM_INT,
		'photos' => IQueryBuilder::PARAM_INT,
	];

	/** @psalm-suppress PossiblyUnusedMethod Nextcloud constructs it. */
	public function __construct(
		private IDBConnection $db,
	) {
	}

	/** The table, without the instance's prefix. */
	#[\Override]
	public function getTableName(): string {
		return self::TABLE;
	}

	#[\Override]
	public function find(array $fileIds): array {
		$done = [];
		foreach ($this->findFileRows(null, $fileIds) as $row) {
			$status = new FolderDone((int)$row['file_id'], $row['user_id'] === null ? null : (string)$row['user_id'], (int)$row['done_at'], (int)$row['photos']);
			$done[$status->fileId] = $status;
		}
		return $done;
	}

	#[\Override]
	public function put(FolderDone ...$done): void {
		$done = array_values($done);
		$this->atomic(function () use ($done): void {
			$this->deleteFileRows(null, array_map(static fn (FolderDone $row): int => $row->fileId, $done));
			$this->insertRows(new InsertStatements(self::TABLE, self::COLUMNS), array_map(static fn (FolderDone $row): array => [
				'file_id' => $row->fileId,
				'user_id' => $row->userId,
				'done_at' => $row->doneAt,
				'photos' => $row->photos,
			], $done));
		}, $this->db);
	}

	#[\Override]
	public function remove(int ...$fileIds): void {
		$this->atomic(fn () => $this->deleteFileRows(null, array_values($fileIds)), $this->db);
	}

	/** The statuses the user marked stay, without the name (ADR 0040, Who shares what). */
	#[\Override]
	public function forgetUser(string $userId): void {
		$query = $this->db->getQueryBuilder();
		$query->update(self::TABLE)
			->set('user_id', $query->createNamedParameter(null, IQueryBuilder::PARAM_NULL))
			->where($query->expr()->eq('user_id', $query->createNamedParameter($userId)))
			->executeStatement();
	}
}
