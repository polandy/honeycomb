<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Db;

use OCA\Honeycomb\Service\FolderDone;
use OCA\Honeycomb\Service\FolderDoneStore;
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
			$status = new FolderDone((int)$row['file_id'], (string)$row['user_id'], (int)$row['done_at'], (int)$row['photos']);
			$done[$status->fileId] = $status;
		}
		return $done;
	}

	#[\Override]
	public function put(FolderDone $done): void {
		$this->atomic(function () use ($done): void {
			$this->deleteFileRows(null, [$done->fileId]);
			$this->insertRows(new InsertStatements(self::TABLE, self::COLUMNS), [[
				'file_id' => $done->fileId,
				'user_id' => $done->userId,
				'done_at' => $done->doneAt,
				'photos' => $done->photos,
			]]);
		}, $this->db);
	}

	#[\Override]
	public function remove(int $fileId): void {
		$this->deleteFileRows(null, [$fileId]);
	}

	/** The statuses the user marked go; those folders are open again. */
	#[\Override]
	public function forgetUser(string $userId): void {
		$this->deleteUserRows(self::TABLE, $userId);
	}

	/** A folder's done status follows it to the new file id, whoever moves it. */
	#[\Override]
	public function carryOver(string $userId, int $fileId, int $newFileId): void {
		$this->carryFileRow($fileId, $newFileId);
	}
}
